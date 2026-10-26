import { expect } from 'chai';
import {
  isTypeScriptSource,
  stripTypeScript,
  toJavaScriptPath,
} from '../../../../../../lib/plugins/package/lib/strip-typescript.ts';

describe('lib/plugins/package/lib/strip-typescript.ts', () => {
  describe('isTypeScriptSource()', () => {
    it('matches TypeScript sources', () => {
      expect(isTypeScriptSource('handler.ts')).to.equal(true);
      expect(isTypeScriptSource('src/handler.mts')).to.equal(true);
      expect(isTypeScriptSource('src/handler.cts')).to.equal(true);
    });

    it('skips declaration files, node_modules and other files', () => {
      expect(isTypeScriptSource('src/types.d.ts')).to.equal(false);
      expect(isTypeScriptSource('src/types.d.mts')).to.equal(false);
      expect(isTypeScriptSource('node_modules/package/index.ts')).to.equal(false);
      expect(isTypeScriptSource('handler.js')).to.equal(false);
      expect(isTypeScriptSource('handler.tsx')).to.equal(false);
    });
  });

  it('toJavaScriptPath() maps each TypeScript extension to its JavaScript one', () => {
    expect(toJavaScriptPath('src/handler.ts')).to.equal('src/handler.js');
    expect(toJavaScriptPath('src/handler.mts')).to.equal('src/handler.mjs');
    expect(toJavaScriptPath('src/handler.cts')).to.equal('src/handler.cjs');
  });

  describe('stripTypeScript()', () => {
    it('strips types and keeps positions', async () => {
      const source = 'export const hello = (name: string): string => `Hello ${name}`;\n';
      const code = await stripTypeScript(source, 'handler.ts');

      expect(code).to.not.include(': string');
      expect(code).to.have.lengthOf(source.length);
      expect(code.indexOf('`Hello')).to.equal(source.indexOf('`Hello'));
    });

    it('rewrites relative imports of TypeScript files', async () => {
      const code = await stripTypeScript(
        [
          "import { a } from './a.ts';",
          "import type { B } from './b.ts';",
          "export { c } from '../lib/c.mts';",
          "export * from './d.cts';",
          "const e = await import('./e.ts');",
          "const f = require('./f.ts');",
          'export const g: B = a;',
        ].join('\n'),
        'handler.ts'
      );

      expect(code).to.include("import { a } from './a.js';");
      expect(code).to.not.include('./b.');
      expect(code).to.include("export { c } from '../lib/c.mjs';");
      expect(code).to.include("export * from './d.cjs';");
      expect(code).to.include("import('./e.js')");
      expect(code).to.include("require('./f.js')");
    });

    it('keeps other specifiers', async () => {
      const source = [
        "import fs from 'node:fs';",
        "import pkg from 'package.ts';",
        "import data from './data.json' with { type: 'json' };",
        "import util from './util.js';",
        "const name = './dynamic.ts';",
        'const loaded = await import(name);',
      ].join('\n');

      expect(await stripTypeScript(source, 'handler.ts')).to.equal(source);
    });

    it('rejects syntax Node.js cannot strip', async () => {
      await expect(
        stripTypeScript('enum Color { Red }\n', 'handler.ts')
      ).to.be.rejected.and.eventually.have.property('code', 'TYPESCRIPT_STRIP_FAILED');
    });

    it('does not report the experimental `stripTypeScriptTypes()` warning', async () => {
      const warnings: Error[] = [];
      const onWarning = (warning: Error) => warnings.push(warning);
      process.on('warning', onWarning);
      try {
        await stripTypeScript('export const x: number = 1;\n', 'handler.ts');
        await new Promise((resolve) => setImmediate(resolve));
      } finally {
        process.off('warning', onWarning);
      }

      expect(
        warnings.filter(({ message }) => message.includes('stripTypeScriptTypes'))
      ).to.deep.equal([]);
    });
  });
});
