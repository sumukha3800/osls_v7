import yazl from 'yazl';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { Readable } from 'node:stream';
import glob from '../../../utils/glob.ts';
import memoizee from 'memoizee';
import ServerlessError from '../../../serverless-error.ts';
import { log } from '../../../utils/serverless-utils/log.ts';
import spawnExt from '../../../utils/spawn.ts';
import promiseLimit from 'ext/promise/limit.js';
import { isTypeScriptSource, stripTypeScript, toJavaScriptPath } from './strip-typescript.ts';
const fsp = fs.promises;
const limit = promiseLimit.bind(Promise);

const npmList = async (cwd, envName, outputFilePath) => {
  const outputFile = await fsp.open(outputFilePath, 'a');
  try {
    await spawnExt(
      'npm',
      ['ls', `--${envName}=true`, '--parseable=true', '--long=false', '--silent', '--all'],
      {
        cwd,
        // We are overriding `NODE_ENV` because when it is set to "production"
        // it causes invalid output of `npm ls` with `--dev=true`
        env: {
          ...process.env,
          NODE_ENV: null,
        },
        stdio: ['ignore', outputFile.fd, 'ignore'],
      }
    );
  } finally {
    await outputFile.close();
  }
};
// Keeps the overloads of `fsp.readFile` (a Buffer without encoding, a string with one)
const readFile = ((...args: [any, any?]) => fsp.readFile(...args)) as typeof fsp.readFile;

const excludeNodeDevDependenciesMemoized = memoizee(excludeNodeDevDependencies, {
  promise: true,
  primitive: true,
});

const getArchiveEntryName = (filePath, prefix) => {
  const archivePath = path.normalize(prefix ? path.relative(prefix, filePath) : filePath);
  const segments = archivePath.split(path.sep).filter(Boolean);

  while (segments[0] === '.' || segments[0] === '..') {
    segments.shift();
  }

  return segments.join('/');
};

const zipMtime = new Date(0);
const maxConcurrentFileStats = 64;

const getFileMode = (stat) =>
  Number(stat.mode) & 0o100 || process.platform === 'win32' ? 0o100755 : 0o100644;

const getCannotReadFileError = (filePath, error) =>
  new ServerlessError(`Cannot read file ${filePath} due to: ${error.message}`, 'CANNOT_READ_FILE');

const getInvalidFileContentResultError = (filePath, data) => {
  const receivedType =
    data === null
      ? 'null'
      : data === undefined
        ? 'undefined'
        : data.constructor && data.constructor.name
          ? data.constructor.name
          : typeof data;

  return new ServerlessError(
    `Invalid getFileContent() result for "${filePath}". Expected Buffer, string, or Uint8Array, but received ${receivedType}.`,
    'INVALID_GET_FILE_CONTENT_RESULT'
  );
};

const normalizeFileContent = (data, filePath) => {
  if (Buffer.isBuffer(data)) return data;
  if (typeof data === 'string') return Buffer.from(data);
  if (data instanceof Uint8Array) {
    return Buffer.from(data);
  }

  throw getInvalidFileContentResultError(filePath, data);
};

const assertSameFile = (entry, currentStat) => {
  // `dev` is excluded: path-stat and handle-stat report a different `dev` for the
  // same unchanged file on Windows (issue #280). Bigint stats compare exactly.
  const sameIdentity = entry.stat.ino === currentStat.ino;
  const sameContentMetadata =
    entry.stat.size === currentStat.size && entry.stat.mtimeNs === currentStat.mtimeNs;

  if (!sameIdentity || !sameContentMetadata) {
    throw new Error('file changed between metadata collection and stream open');
  }
};

const compareUtf8 = (left, right) =>
  Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'));

const compareZipEntries = (entryA, entryB) => {
  const nameComparison = compareUtf8(entryA.name, entryB.name);
  if (nameComparison !== 0) return nameComparison;

  return compareUtf8(entryA.filePath, entryB.filePath);
};

async function getZipEntryMetadata(filePath, prefix) {
  const fullPath = path.resolve(this.serverless.serviceDir, filePath);

  try {
    const stat = await fsp.stat(fullPath, { bigint: true });

    return {
      filePath,
      fullPath,
      name: getArchiveEntryName(filePath, prefix),
      mode: getFileMode(stat),
      stat,
    };
  } catch (error) {
    throw getCannotReadFileError(filePath, error);
  }
}

const getZipEntryMetadataLimited = limit(
  maxConcurrentFileStats,
  async ({ context, filePath, prefix }) => getZipEntryMetadata.call(context, filePath, prefix)
);

function addFileStream(zipfile, entry, options) {
  zipfile.addReadStreamLazy(entry.name, options, (callback) => {
    fsp
      .open(entry.fullPath, 'r')
      .then(async (fileHandle) => {
        try {
          const currentStat = await fileHandle.stat({ bigint: true });
          assertSameFile(entry, currentStat);

          const readStream = fileHandle.createReadStream({ autoClose: true });
          readStream.once('error', (error) => {
            zipfile.emit('error', getCannotReadFileError(entry.filePath, error));
          });

          callback(null, readStream);
        } catch (error) {
          await fileHandle.close().catch(() => {});
          callback(getCannotReadFileError(entry.filePath, error));
        }
      })
      .catch((error) => {
        callback(getCannotReadFileError(entry.filePath, error));
      });
  });
}

function addPluginContentStream(zipfile, entry, options) {
  zipfile.addReadStreamLazy(entry.name, options, (callback) => {
    Promise.resolve()
      .then(() => this.getFileContent(entry.fullPath))
      .then(
        (data) => {
          let content;
          try {
            content = normalizeFileContent(data, entry.filePath);
          } catch (error) {
            callback(error);
            return;
          }
          callback(null, Readable.from([content]));
        },
        (error) => callback(getCannotReadFileError(entry.filePath, error))
      );
  });
}

// With `package.stripTypeScript`, TypeScript sources are added as JavaScript
function addTypeScriptEntry(zipfile, entry, options) {
  zipfile.addReadStreamLazy(entry.name, options, (callback) => {
    Promise.resolve()
      .then(() => this.getFileContent(entry.fullPath))
      .then(
        async (data) => {
          let code;
          try {
            code = await stripTypeScript(
              normalizeFileContent(data, entry.filePath).toString('utf8'),
              entry.filePath
            );
          } catch (error) {
            callback(error);
            return;
          }
          callback(null, Readable.from([Buffer.from(code)]));
        },
        (error) => callback(getCannotReadFileError(entry.filePath, error))
      );
  });
}

const assertUniqueEntryNames = (entries) => {
  const filePathsByName = new Map();
  for (const { name, filePath } of entries) {
    if (filePathsByName.has(name)) {
      throw new ServerlessError(
        `Cannot package both "${filePathsByName.get(name)}" and "${filePath}" as "${name}": ` +
          'with "package.stripTypeScript", exclude the compiled JavaScript or the TypeScript source',
        'TYPESCRIPT_OUTPUT_CONFLICT'
      );
    }
    filePathsByName.set(name, filePath);
  }
};

async function addBufferedEntries(zipfile, normalizedFiles, prefix, stripsTypeScript) {
  const contents = await Promise.all(
    normalizedFiles.map((filePath) => this.getFileContentAndStat(filePath))
  );

  const files = await Promise.all(
    contents.map(async (file) => {
      const name = getArchiveEntryName(file.filePath, prefix);
      if (!stripsTypeScript || !isTypeScriptSource(file.filePath)) return { ...file, name };
      const code = await stripTypeScript(file.data.toString('utf8'), file.filePath);
      return { ...file, name: toJavaScriptPath(name), data: Buffer.from(code) };
    })
  );
  assertUniqueEntryNames(files);

  files.sort(compareZipEntries).forEach((file) => {
    zipfile.addBuffer(file.data, file.name, {
      mode: getFileMode(file.stat),
      mtime: zipMtime,
    });
  });
}

const zipService = {
  async zipService(exclude, include, zipFileName) {
    const params = await this.excludeDevDependencies({
      exclude,
      include,
      zipFileName,
    });
    return this.zip(params);
  },

  async excludeDevDependencies(params) {
    const serviceDir = this.serverless.serviceDir;

    let excludeDevDependencies = this.serverless.service.package.excludeDevDependencies;
    if (excludeDevDependencies === undefined || excludeDevDependencies === null) {
      excludeDevDependencies = true;
    }

    if (excludeDevDependencies) {
      if (params.contextName) {
        log.info(`Excluding development dependencies for ${params.contextName}`);
      } else {
        log.info('Excluding development dependencies');
      }

      const exAndInNode = await excludeNodeDevDependenciesMemoized(serviceDir);
      params.exclude = Array.from(new Set([...(params.exclude || []), ...exAndInNode.exclude]));
      params.include = Array.from(new Set([...(params.include || []), ...exAndInNode.include]));
      params.devDependencyExcludeSet = new Set(exAndInNode.exclude);
      return params;
    }

    return params;
  },

  async zip(params) {
    return this.resolveFilePathsFromPatterns(params).then((filePaths) =>
      this.zipFiles(filePaths, params.zipFileName)
    );
  },

  /**
   * Create a zip file on disk from an array of filenames of files on disk
   * @param files - an Array of filenames
   * @param zipFiles - the filename to save the zip at
   * @param prefix - a prefix to strip from the file names. use for layers support
   */
  async zipFiles(files, zipFileName, prefix) {
    if (files.length === 0) {
      const error = new ServerlessError('No files to package', 'NO_FILES_TO_PACKAGE');
      throw error;
    }

    // Create artifact in temp path and move it to the package path (if any) later
    const artifactFilePath = path.join(this.serverless.serviceDir, '.serverless', zipFileName);
    this.serverless.utils.writeFileDir(artifactFilePath);

    // normalize both maps to avoid problems with e.g. Path Separators in different shells
    const normalizedFiles = Array.from(new Set(files.map((file) => path.normalize(file))));
    const stripsTypeScript = Boolean(this.serverless.service.package?.stripTypeScript);

    const zipfile = new yazl.ZipFile();
    const output = fs.createWriteStream(artifactFilePath);

    return new Promise((resolve, reject) => {
      let settled = false;

      const cleanupPartialArtifact = async () => {
        await fsp.unlink(artifactFilePath).catch(() => {});
      };

      const onError = (error) => {
        if (settled) return;
        settled = true;

        try {
          zipfile.outputStream.unpipe(output);
        } catch {
          // best effort only
        }

        output.destroy();

        const cleanup = output.closed
          ? cleanupPartialArtifact()
          : new Promise<void>((cleanupResolve) => output.once('close', cleanupResolve)).then(
              cleanupPartialArtifact
            );

        cleanup.finally(() => reject(error));
      };

      output.on('close', () => {
        if (settled) return;
        settled = true;
        resolve(artifactFilePath);
      });
      output.on('error', onError);
      zipfile.on('error', onError);

      output.on('open', async () => {
        try {
          zipfile.outputStream.pipe(output);

          const usesDefaultGetFileContent = this.getFileContent === defaultGetFileContent;
          const usesDefaultGetFileContentAndStat =
            this.getFileContentAndStat === defaultGetFileContentAndStat;

          if (!usesDefaultGetFileContentAndStat) {
            await addBufferedEntries.call(this, zipfile, normalizedFiles, prefix, stripsTypeScript);
            zipfile.end();
            return;
          }

          const entries = await Promise.all(
            normalizedFiles.map((filePath) =>
              getZipEntryMetadataLimited({ context: this, filePath, prefix })
            )
          );

          if (stripsTypeScript) {
            for (const entry of entries) {
              if (!isTypeScriptSource(entry.filePath)) continue;
              entry.name = toJavaScriptPath(entry.name);
              entry.isTypeScript = true;
            }
            assertUniqueEntryNames(entries);
          }

          entries.sort(compareZipEntries);

          for (const entry of entries) {
            const options = {
              mode: entry.mode,
              mtime: zipMtime,
            };

            if (entry.isTypeScript) {
              addTypeScriptEntry.call(this, zipfile, entry, options);
            } else if (usesDefaultGetFileContent) {
              addFileStream(zipfile, entry, options);
            } else {
              addPluginContentStream.call(this, zipfile, entry, options);
            }
          }

          zipfile.end();
        } catch (error) {
          onError(error);
        }
      });
    });
  },

  async getFileContentAndStat(filePath) {
    const fullPath = path.resolve(this.serverless.serviceDir, filePath);

    return Promise.all([
      // Get file contents and stat in parallel
      this.getFileContent(fullPath),
      fsp.stat(fullPath),
    ]).then(
      (result) => ({
        data: normalizeFileContent(result[0], filePath),
        stat: result[1],
        filePath,
      }),
      (error) => {
        throw getCannotReadFileError(filePath, error);
      }
    );
  },

  // Useful point of entry for e.g. transpilation plugins
  getFileContent(fullPath) {
    return fsp.readFile(fullPath);
  },
};

const defaultGetFileContent = zipService.getFileContent;
const defaultGetFileContentAndStat = zipService.getFileContentAndStat;

export default zipService;

async function excludeNodeDevDependencies(serviceDir) {
  const exAndIn = {
    include: [],
    exclude: [],
  };

  // the files where we'll write the dependencies into
  const tmpDir = os.tmpdir();
  const randHash = crypto.randomBytes(12).toString('hex');
  const nodeDevDepFile = path.join(tmpDir, `node-dependencies-${randHash}-dev`);
  const nodeProdDepFile = path.join(tmpDir, `node-dependencies-${randHash}-prod`);

  try {
    const packageJsonFilePaths = glob.sync(['**/package.json'], {
      cwd: serviceDir,
      dot: true,
      ignore: ['**/node_modules/**'],
      silent: true,
      follow: true,
      nosort: true,
    });

    // filter out non node_modules file paths
    const packageJsonPaths = packageJsonFilePaths.filter((filePath) => {
      const isNodeModulesDir = !!filePath.match(/node_modules/);
      return !isNodeModulesDir;
    });

    if (!packageJsonPaths.length) return exAndIn;

    // Run each package directory sequentially to preserve the previous race-avoidance behavior.
    for (const packageJsonPath of packageJsonPaths) {
      const fullPath = path.join(serviceDir, packageJsonPath);
      const dirWithPackageJson = fullPath.replace(path.join(path.sep, 'package.json'), '');

      await Promise.all(
        ['dev', 'prod'].map(async (env) => {
          const depFile = env === 'dev' ? nodeDevDepFile : nodeProdDepFile;
          try {
            await npmList(dirWithPackageJson, env, depFile);
          } catch {
            // Invalid package.json or npm ls failures should not crash packaging.
          }
        })
      );
    }

    const devAndProDependencies = [];
    for (const env of ['dev', 'prod']) {
      const depFile = env === 'dev' ? nodeDevDepFile : nodeProdDepFile;
      try {
        const fileContent = await readFile(depFile);
        devAndProDependencies.push(
          Array.from(new Set(fileContent.toString('utf8').split(/[\r\n]+/))).filter(Boolean)
        );
      } catch {
        devAndProDependencies.push([]);
      }
    }

    const devDependencies = devAndProDependencies[0];
    const prodDependencies = devAndProDependencies[1];

    const prodDependencySet = new Set(prodDependencies);
    const dependencies = devDependencies.filter((item) => !prodDependencySet.has(item));
    const nodeModulesRegex = new RegExp(`${path.join('node_modules', path.sep)}.*`, 'g');

    if (dependencies.length) {
      const globs = [];
      for (const dependency of dependencies) {
        const item = dependency.replace(path.join(serviceDir, path.sep), '');
        if (item.length <= 0 || !item.match(nodeModulesRegex)) continue;

        const packagePath = path.join(serviceDir, item, 'package.json');
        try {
          const packageJson = JSON.parse(await readFile(packagePath, 'utf-8'));
          const lastIndex = item.lastIndexOf(path.sep) + 1;
          const moduleName = item.substr(lastIndex);
          const modulePath = item.substr(0, lastIndex);
          const bin = packageJson.bin;
          const baseGlobs = [path.join(item, '**')];

          if (typeof bin === 'object') {
            Object.keys(bin).forEach((executable) => {
              baseGlobs.push(path.join(modulePath, '.bin', executable));
            });
          } else if (typeof bin === 'string') {
            baseGlobs.push(path.join(modulePath, '.bin', moduleName));
          }

          globs.push(...baseGlobs);
        } catch {
          // Ignore unreadable package metadata, preserving previous best-effort behavior.
        }
      }

      exAndIn.exclude = exAndIn.exclude.concat(globs);
    }

    await Promise.all([
      fsp.unlink(nodeDevDepFile).catch(() => {}),
      fsp.unlink(nodeProdDepFile).catch(() => {}),
    ]);
    return exAndIn;
  } catch {
    // fail silently
    return exAndIn;
  }
}
