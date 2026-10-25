import { promises as fsp } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { denyExternalRef, throwOptionsError } from './external-ref-errors.ts';
import { assertKnownOptions, assertOptionsObject } from './option-validation.ts';

type AllowedRoot = { path: string; realpath: string };
type FileRefOptions = { allowedRoots: AllowedRoot[] | null };

const DEFAULT_ALLOWED_ROOTS = ['.'];
const FILE_REF_POLICY_HINT =
  'The code calling yamlParser.parse can allow this path by adding a trusted root ' +
  'to externalRefs.file.allowedRoots.';

const realpathIfExists = async (filePath: string): Promise<string> => {
  try {
    return await fsp.realpath(filePath);
  } catch (error: any) {
    if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') throw error;
  }

  const parentPath = path.dirname(filePath);
  if (parentPath === filePath) return filePath;

  return path.join(await realpathIfExists(parentPath), path.basename(filePath));
};

const isPathInside = (rootPath: string, candidatePath: string) => {
  const relativePath = path.relative(rootPath, candidatePath);
  return (
    relativePath === '' ||
    (Boolean(relativePath) && !relativePath.startsWith('..') && !path.isAbsolute(relativePath))
  );
};

const normalizeAllowedRoot = async (
  documentDir: string,
  rootPath: unknown
): Promise<AllowedRoot> => {
  if (typeof rootPath !== 'string') {
    throwOptionsError(
      'YAML parser option externalRefs.file.allowedRoots must contain only strings.'
    );
  }

  let absolutePath: string;
  try {
    absolutePath = rootPath.toLowerCase().startsWith('file:')
      ? fileURLToPath(rootPath)
      : path.resolve(documentDir, rootPath);
  } catch {
    throwOptionsError(
      `YAML parser option externalRefs.file.allowedRoots contains an invalid file URL: ${rootPath}`
    );
  }

  return {
    path: absolutePath,
    realpath: await realpathIfExists(absolutePath),
  };
};

const normalizeFileRefOptions = async (
  documentDir: string,
  options: Record<string, any> = {}
): Promise<FileRefOptions> => {
  assertOptionsObject(options, 'externalRefs.file');
  assertKnownOptions(options, 'externalRefs.file', ['allowedRoots']);

  let allowedRootValues;

  if (options.allowedRoots !== undefined) {
    if (options.allowedRoots === null) return { allowedRoots: null };
    allowedRootValues = options.allowedRoots;
  } else {
    allowedRootValues = DEFAULT_ALLOWED_ROOTS;
  }

  const allowedRoots = Array.isArray(allowedRootValues) ? allowedRootValues : [allowedRootValues];

  return {
    allowedRoots: await Promise.all(
      allowedRoots.map((allowedRoot) => normalizeAllowedRoot(documentDir, allowedRoot))
    ),
  };
};

const getRefFilePath = (documentUrl: string) => {
  try {
    const url = new URL(documentUrl);
    if (url.protocol === 'file:') return fileURLToPath(url);
    return null;
  } catch {
    return path.resolve(documentUrl);
  }
};

const isFileRefAllowedByPath = (
  candidatePath: string,
  allowedRoots: AllowedRoot[],
  rootProperty: keyof AllowedRoot
) => allowedRoots.some((allowedRoot) => isPathInside(allowedRoot[rootProperty], candidatePath));

const denyFileRefOutsideAllowedRoots: (documentUrl: string) => never = (documentUrl) => {
  denyExternalRef(
    `Blocked YAML $ref file outside allowed roots: ${documentUrl}. ${FILE_REF_POLICY_HINT}`
  );
};

const assertFileRefAllowed = async (documentUrl: string, options: FileRefOptions) => {
  if (options.allowedRoots == null) return;

  const candidatePath = getRefFilePath(documentUrl);
  if (!candidatePath) {
    denyFileRefOutsideAllowedRoots(documentUrl);
  }

  if (!isFileRefAllowedByPath(candidatePath, options.allowedRoots, 'path')) {
    denyFileRefOutsideAllowedRoots(documentUrl);
  }

  const candidateRealpath = await realpathIfExists(candidatePath);

  if (!isFileRefAllowedByPath(candidateRealpath, options.allowedRoots, 'realpath')) {
    denyFileRefOutsideAllowedRoots(documentUrl);
  }
};

export { assertFileRefAllowed, normalizeFileRefOptions };
export type { AllowedRoot, FileRefOptions };

export default {
  assertFileRefAllowed,
  normalizeFileRefOptions,
};
