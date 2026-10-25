// Audits the type declarations of every dependency (runtime and dev) under TypeScript 7: each
// package is imported alone and type checked with `strict` on and `skipLibCheck` off, as an
// ES module (`nodenext`), as CommonJS (`nodenext`, .cts) and with `moduleResolution: bundler`
// Fails on any error not listed in `knownFailures`, and on a package that ships no types
// without being listed in `untypedPackages`
// Usage: node scripts/audit-dependency-types.ts
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const rootPath = path.resolve(import.meta.dirname, '..');
const tscPath = path.join(rootPath, 'node_modules', '.bin', 'tsc');
const packageJson = JSON.parse(fs.readFileSync(path.join(rootPath, 'package.json'), 'utf8'));

// Packages without type declarations, and where osls declares what it uses
const untypedPackages = new Map([
  ['ext', 'typings/vendor.d.ts'],
  ['json-cycle', 'typings/vendor.d.ts'],
  ['log', 'typings/vendor.d.ts'],
  ['log-node', 'typings/vendor.d.ts'],
  ['adm-zip', 'tests only, untyped'],
  ['git-list-updated', 'CLI only'],
  ['@typescript/native', 'the tsc 7 binary'],
]);

// Upstream declaration errors (they reproduce with TypeScript 6 too); osls type checks with
// `skipLibCheck`, so they do not affect it. Recheck when upgrading the package
const knownFailures = new Map([
  [
    'type',
    'ts-types/value/ensure.d.ts imports `EnsureOptions`, which ts-types/ensure.d.ts does not export',
  ],
  [
    'eslint-plugin-import-x',
    'eslint-import-context imports `type-fest` without depending on it; @package-json/types ' +
      'has index signature errors',
  ],
]);

// Entry points to import when the package root is not the one osls uses
const entryPoints = new Map([
  ['tsx', 'tsx/esm/api'],
  ['type', 'type/value/ensure.js'],
]);

const packageNames = [
  ...Object.keys(packageJson.dependencies),
  ...Object.keys(packageJson.devDependencies),
]
  // `@types/*` packages are checked through the package they describe
  .filter((name) => !name.startsWith('@types/') && !untypedPackages.has(name))
  .sort();

const modes = [
  { name: 'esm', extension: 'ts', compilerOptions: { module: 'nodenext' } },
  { name: 'cjs', extension: 'cts', compilerOptions: { module: 'nodenext' } },
  {
    name: 'bundler',
    extension: 'ts',
    compilerOptions: { module: 'preserve', moduleResolution: 'bundler' },
  },
];

const tmpPath = fs.mkdtempSync(path.join(os.tmpdir(), 'osls-dependency-types-'));
fs.writeFileSync(path.join(tmpPath, 'package.json'), '{ "private": true, "type": "module" }\n');
fs.symlinkSync(path.join(rootPath, 'node_modules'), path.join(tmpPath, 'node_modules'), 'junction');

const runTsc = promisify(execFile);
const checkPackage = async (packageName: string, mode: (typeof modes)[number]) => {
  const baseName = `${mode.name}-${packageName.replace(/[@/]/g, '_')}`;
  const sourcePath = path.join(tmpPath, `${baseName}.${mode.extension}`);
  const specifier = entryPoints.get(packageName) || packageName;
  fs.writeFileSync(
    sourcePath,
    `import type * as dependency from '${specifier}';\nexport type T = typeof dependency;\n`
  );
  const tsconfigPath = path.join(tmpPath, `${baseName}.tsconfig.json`);
  fs.writeFileSync(
    tsconfigPath,
    JSON.stringify({
      compilerOptions: {
        target: 'es2023',
        lib: ['es2023'],
        types: ['node'],
        strict: true,
        skipLibCheck: false,
        noEmit: true,
        ...mode.compilerOptions,
      },
      files: [sourcePath],
    })
  );
  try {
    await runTsc(tscPath, ['-p', tsconfigPath], { shell: process.platform === 'win32' });
    return [];
  } catch (error) {
    if (!error.stdout) throw error;
    return (error.stdout as string)
      .split('\n')
      .filter((line) => line.includes('error TS'))
      .map((line) => line.replace(/^.*\/node_modules\/(\.pnpm\/[^/]+\/node_modules\/)?/, ''));
  }
};

// Runs the checks a few at a time: each is a separate tsc process
const runLimited = async <T>(tasks: (() => Promise<T>)[], limit: number) => {
  const results: T[] = new Array(tasks.length);
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < tasks.length) {
      const index = nextIndex++;
      results[index] = await tasks[index]();
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results;
};

let hasFailed = false;
try {
  const results = await runLimited(
    packageNames.map((packageName) => async () => {
      const errorsByMode = await Promise.all(modes.map((mode) => checkPackage(packageName, mode)));
      return { packageName, errors: [...new Set(errorsByMode.flat())] };
    }),
    Math.max(os.availableParallelism() - 1, 1)
  );

  for (const { packageName, errors } of results) {
    const knownFailure = knownFailures.get(packageName);
    if (!errors.length) {
      process.stdout.write(`✔ ${packageName}\n`);
      if (knownFailure) {
        process.stdout.write(`  Passes now: remove it from \`knownFailures\` (${knownFailure})\n`);
      }
    } else if (knownFailure) {
      process.stdout.write(`- ${packageName}: known upstream failure (${knownFailure})\n`);
    } else {
      hasFailed = true;
      const isUntyped = errors.some((line) => line.includes('error TS7016'));
      process.stdout.write(
        `✖ ${packageName}${isUntyped ? ': ships no types (add types or list it in `untypedPackages`)' : ''}\n`
      );
      for (const line of errors.slice(0, 10)) process.stdout.write(`    ${line}\n`);
    }
  }
  for (const [packageName, reason] of untypedPackages) {
    process.stdout.write(`- ${packageName}: not checked, no types (${reason})\n`);
  }
} finally {
  fs.rmSync(tmpPath, { recursive: true, force: true });
}

if (hasFailed) process.exitCode = 1;
