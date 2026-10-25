// Type checks the TypeScript consumer projects of test/typescript-consumers against the built
// package (`dist/`, run `pnpm run build` first), with TypeScript 7, as a user installation
// sees it: `osls` and only its runtime dependencies (plus `@types/node`) in node_modules
// Each project also type checks every published declaration file
// Usage: node scripts/check-typescript-consumers.ts [--keep] (--keep leaves the projects on disk)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const rootPath = path.resolve(import.meta.dirname, '..');
const distPath = path.join(rootPath, 'dist');
const consumersPath = path.join(rootPath, 'test', 'typescript-consumers');
const tscPath = path.join(rootPath, 'node_modules', '.bin', 'tsc');

if (!fs.existsSync(path.join(distPath, 'package.json'))) {
  process.stderr.write('dist/ is missing: run `pnpm run build` first\n');
  process.exit(1);
}

const tmpPath = fs.mkdtempSync(path.join(os.tmpdir(), 'osls-typescript-consumers-'));
const nodeModulesPath = path.join(tmpPath, 'node_modules');

// The package is copied (a symlink would resolve to the repository and its devDependencies);
// dependencies are linked to their installed (real) location
fs.cpSync(distPath, path.join(nodeModulesPath, 'osls'), { recursive: true });
const { dependencies } = JSON.parse(fs.readFileSync(path.join(distPath, 'package.json'), 'utf8'));
for (const name of [...Object.keys(dependencies), '@types/node']) {
  const linkPath = path.join(nodeModulesPath, name);
  fs.mkdirSync(path.dirname(linkPath), { recursive: true });
  fs.symlinkSync(fs.realpathSync(path.join(rootPath, 'node_modules', name)), linkPath, 'junction');
}

const declarationSpecifiers = fs
  .readdirSync(distPath, { recursive: true, encoding: 'utf8' })
  .filter((filePath) => filePath.endsWith('.d.ts'))
  .map((filePath) => `osls/${filePath.split(path.sep).join('/').slice(0, -'.d.ts'.length)}.js`)
  .sort();

const writeDeclarationsImports = (projectPath: string, isCommonJs: boolean) => {
  const lines = declarationSpecifiers.map((specifier, index) =>
    isCommonJs
      ? `import type m${index} = require('${specifier}');\nexport type T${index} = typeof m${index};`
      : `import type * as m${index} from '${specifier}';\nexport type T${index} = typeof m${index};`
  );
  fs.writeFileSync(path.join(projectPath, 'all-declarations.ts'), `${lines.join('\n')}\n`);
};

const projects = [
  { name: 'esm', sources: 'esm', isCommonJs: false },
  { name: 'cjs', sources: 'cjs', isCommonJs: true },
  // Same sources as the ES module project, resolved the way bundlers do
  { name: 'bundler', sources: 'esm', isCommonJs: false },
];

let hasFailed = false;
try {
  for (const { name, sources, isCommonJs } of projects) {
    const projectPath = path.join(tmpPath, name);
    fs.cpSync(path.join(consumersPath, name), projectPath, { recursive: true });
    if (sources !== name) {
      for (const fileName of fs.readdirSync(path.join(consumersPath, sources))) {
        if (fileName.endsWith('.ts')) {
          fs.copyFileSync(
            path.join(consumersPath, sources, fileName),
            path.join(projectPath, fileName)
          );
        }
      }
    }
    writeDeclarationsImports(projectPath, isCommonJs);

    const result = spawnSync(tscPath, ['-p', path.join(projectPath, 'tsconfig.json')], {
      encoding: 'utf8',
      shell: process.platform === 'win32',
    });
    if (result.status === 0) {
      process.stdout.write(`✔ ${name}\n`);
    } else {
      hasFailed = true;
      process.stdout.write(`✖ ${name}\n${result.stdout}${result.stderr}\n`);
    }
  }
} finally {
  if (process.argv.includes('--keep')) process.stdout.write(`Projects kept in ${tmpPath}\n`);
  else fs.rmSync(tmpPath, { recursive: true, force: true });
}

if (hasFailed) process.exitCode = 1;
