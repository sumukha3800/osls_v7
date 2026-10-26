import os from 'node:os';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import fileExistsSync from '../utils/fs/file-exists-sync.ts';
import writeFileSync from '../utils/fs/write-file-sync.ts';
import copyDirContentsSync from '../utils/fs/copy-dir-contents-sync.ts';
import readFileSync from '../utils/fs/read-file-sync.ts';
import readFile from '../utils/fs/read-file.ts';
import walkDirSync from '../utils/fs/walk-dir-sync.ts';
import dirExistsSync from '../utils/fs/dir-exists-sync.ts';
import { packageJson as packageModule } from '../utils/package-root.ts';
import type { AwsFunction } from './service.ts';
const version = packageModule.version;

class Utils {
  declare serverless: any;

  // `serverless`: the Serverless instance, or a stub of it (not read here)
  constructor(serverless: any) {
    this.serverless = serverless;
  }

  getVersion() {
    return version;
  }

  dirExistsSync(dirPath: string) {
    return dirExistsSync(dirPath);
  }

  getTmpDirPath() {
    const dirPath = path.join(
      os.tmpdir(),
      'tmpdirs-serverless',
      crypto.randomBytes(12).toString('hex')
    );
    fs.mkdirSync(dirPath, { recursive: true });
    return dirPath;
  }

  fileExistsSync(filePath: string) {
    return fileExistsSync(filePath);
  }

  writeFileDir(filePath: string) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }

  writeFileSync(filePath: string, contents?: unknown, cycles?: boolean) {
    writeFileSync(filePath, contents, cycles);
  }

  async writeFile(filePath: string, contents?: unknown, cycles?: boolean) {
    this.writeFileSync(filePath, contents, cycles);
  }

  async appendFileSync(filePath: string, conts?: string | Uint8Array) {
    const contents = conts || '';
    fs.appendFileSync(filePath, contents);
  }

  readFileSync(filePath: string) {
    return readFileSync(filePath);
  }

  readFile(filePath: string) {
    return readFile(filePath);
  }

  walkDirSync(dirPath: string) {
    return walkDirSync(dirPath);
  }

  copyDirContentsSync(srcDir: string, destDir: string) {
    return copyDirContentsSync(srcDir, destDir);
  }

  generateShortId(length?: number) {
    return Math.random().toString(36).substr(2, length);
  }

  isEventUsed(functions: Record<string, AwsFunction>, eventName: string) {
    return Object.keys(functions).reduce((accum, key) => {
      const events = functions[key].events || [];
      if (events.length) {
        events.forEach((event) => {
          if (Object.keys(event)[0] === eventName) {
            accum = true;
          }
        });
      }
      return accum;
    }, false);
  }
}

export default Utils;
