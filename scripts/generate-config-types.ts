// Generates `types/aws.d.ts`, the service configuration types (`AWS`), from the configuration
// schema as the core plugins extend it, the way `@serverless/typescript` produced them
// Usage: node scripts/generate-config-types.ts [--check]
// With `--check`, nothing is written: exits with 1 when `types/aws.d.ts` is out of date
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { compile } from 'json-schema-to-typescript';
import { format } from 'prettier';
import prettierConfig from '../prettier.config.ts';
import Serverless from '../lib/serverless.ts';

const rootPath = path.resolve(import.meta.dirname, '..');
const typesPath = path.join(rootPath, 'types', 'aws.d.ts');
const isCheck = process.argv.includes('--check');

const serviceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'osls-config-types-'));
try {
  const serverless = new Serverless({
    serviceDir,
    configurationFilename: 'serverless.yml',
    configuration: { service: 'config-types', provider: { name: 'aws' } },
    commands: ['print'],
    options: {},
  });
  await serverless.init();

  const source = await compile(structuredClone(serverless.configSchemaHandler.schema), 'AWS', {
    bannerComment:
      '// Generated from the configuration schema by scripts/generate-config-types.ts:\n' +
      '// do not edit, run `pnpm run generate-types` instead',
    // `maxItems: 100` (eg. `provider.s3.corsConfiguration`) would generate 100 tuple types
    ignoreMinAndMaxItems: true,
    format: false,
  });
  const content = await format(source, { ...prettierConfig, parser: 'typescript' });

  if (isCheck) {
    const current = fs.existsSync(typesPath) ? fs.readFileSync(typesPath, 'utf8') : null;
    if (current !== content) {
      process.stderr.write(
        'types/aws.d.ts does not match the configuration schema: run `pnpm run generate-types`\n'
      );
      process.exitCode = 1;
    }
  } else {
    fs.writeFileSync(typesPath, content);
    process.stdout.write(`Generated ${path.relative(process.cwd(), typesPath)}\n`);
  }
} finally {
  fs.rmSync(serviceDir, { recursive: true, force: true });
}
