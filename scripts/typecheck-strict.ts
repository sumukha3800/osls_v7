// Type checks the files listed in tsconfig.strict.json in strict mode. TypeScript has no
// per-file strictness: the program includes what those files import, so errors in files that
// are not listed are left out of the report
// Usage: node scripts/typecheck-strict.ts
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const rootPath = path.resolve(import.meta.dirname, '..');
const tsconfigPath = path.join(rootPath, 'tsconfig.strict.json');
const tscPath = path.join(rootPath, 'node_modules', '.bin', 'tsc');

// tsconfig.strict.json has comments, which JSON.parse() rejects
const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8').replace(/^\s*\/\/.*$/gm, '')) as {
  include: string[];
};

const directoryPattern = /^(.+)\/\*\*\/\*(\.d)?\.ts$/;
const strictDirectories: string[] = [];
const strictFiles = new Set<string>();
for (const pattern of tsconfig.include) {
  const directoryMatch = pattern.match(directoryPattern);
  if (directoryMatch) strictDirectories.push(`${directoryMatch[1]}/`);
  else if (!pattern.includes('*')) strictFiles.add(pattern);
  else throw new Error(`Unsupported pattern in tsconfig.strict.json: ${pattern}`);
}
const isStrictFile = (filePath: string) =>
  strictFiles.has(filePath) ||
  strictDirectories.some((directory) => filePath.startsWith(directory));

const result = spawnSync(tscPath, ['-p', tsconfigPath, '--pretty', 'false'], {
  cwd: rootPath,
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
  shell: process.platform === 'win32',
});

// An error is a line `path(line,col): error TSxxxx: message`, followed by indented details
const reported: string[] = [];
let isReporting = false;
for (const line of `${result.stdout}${result.stderr}`.split('\n')) {
  const errorMatch = line.match(/^(.+?)\(\d+,\d+\): error TS\d+/);
  if (errorMatch) {
    isReporting = isStrictFile(errorMatch[1].split(path.sep).join('/'));
  } else if (!line.startsWith(' ')) {
    // A message without a location (eg. a configuration error) is always reported
    isReporting = line.includes('error TS');
  }
  if (isReporting) reported.push(line);
}

if (reported.length) {
  process.stdout.write(`${reported.join('\n')}\n`);
  const count = reported.filter((line) => line.includes('error TS')).length;
  process.stderr.write(`${count} strict mode errors in strict files\n`);
  process.exitCode = 1;
} else if (result.status !== 0 && !result.stdout.includes('error TS')) {
  // A non-zero exit with diagnostics only means errors in files that are not strict yet
  process.stderr.write(`tsc failed (exit code ${result.status}): ${result.stderr}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write('Strict files type check in strict mode\n');
}
