// `package.stripTypeScript`: TypeScript sources are packaged as JavaScript. Types are stripped
// the way Node.js runs .ts files (erasable syntax only, positions kept, so stack traces match
// the sources), and relative imports of .ts files are rewritten to the JavaScript files
import path from 'node:path';
import { stripTypeScriptTypes } from 'node:module';
import { init as initModuleLexer, parse as parseModule } from 'es-module-lexer';
import ServerlessError from '../../../serverless-error.ts';

const javaScriptExtensions = new Map([
  ['.ts', '.js'],
  ['.mts', '.mjs'],
  ['.cts', '.cjs'],
]);

const declarationFilePattern = /\.d\.[mc]?ts$/;

export const isTypeScriptSource = (filePath: string): boolean =>
  javaScriptExtensions.has(path.extname(filePath)) &&
  !declarationFilePattern.test(filePath) &&
  !filePath.split(/[\\/]/).includes('node_modules');

export const toJavaScriptPath = (filePath: string): string => {
  const extension = path.extname(filePath);
  return `${filePath.slice(0, -extension.length)}${javaScriptExtensions.get(extension)}`;
};

// A relative specifier of a TypeScript file, eg. `./lib/util.ts`
const typeScriptSpecifierPattern = /^\.\.?\/.*\.[mc]?ts$/;
const rewriteSpecifier = (specifier: string) =>
  typeScriptSpecifierPattern.test(specifier) && !declarationFilePattern.test(specifier)
    ? toJavaScriptPath(specifier)
    : specifier;

// `require('./x.ts')` in CommonJS sources (es-module-lexer only reports ES module imports)
const requirePattern = /\brequire\s*\(\s*(['"])(\.\.?\/[^'"\n]*\.[mc]?ts)\1\s*\)/g;

// Node.js reports `stripTypeScriptTypes()` as experimental with a process warning; osls uses
// it as Node.js itself does to run .ts files
const stripTypes = (source: string) => {
  const { emitWarning } = process;
  process.emitWarning = function (warning, ...args: any[]) {
    const message = typeof warning === 'string' ? warning : warning.message;
    if (message.includes('stripTypeScriptTypes')) return;
    emitWarning.call(process, warning, ...args);
  } as typeof process.emitWarning;
  try {
    return stripTypeScriptTypes(source, { mode: 'strip' });
  } finally {
    process.emitWarning = emitWarning;
  }
};

export const stripTypeScript = async (source: string, filePath: string): Promise<string> => {
  let code;
  try {
    code = stripTypes(source);
  } catch (error: any) {
    throw new ServerlessError(
      `Cannot strip the types of "${filePath}": ${error.message}\n` +
        'With "package.stripTypeScript", sources must use TypeScript syntax Node.js can strip ' +
        '(no `enum`, `namespace` or parameter properties: see `erasableSyntaxOnly`)',
      'TYPESCRIPT_STRIP_FAILED'
    );
  }

  await initModuleLexer();
  const [imports] = parseModule(code, filePath);
  // Rewritten from the end, so earlier positions stay valid
  for (const { type, specifier, start, end } of [...imports].reverse()) {
    if (typeof specifier !== 'string') continue;
    const rewritten = rewriteSpecifier(specifier);
    if (rewritten === specifier) continue;
    // A static import's range is the specifier; a dynamic import's includes the quotes
    const [from, to] = type === 'dynamic' ? [start + 1, end - 1] : [start, end];
    code = `${code.slice(0, from)}${rewritten}${code.slice(to)}`;
  }
  return code.replace(
    requirePattern,
    (match, quote: string, specifier: string) =>
      `require(${quote}${rewriteSpecifier(specifier)}${quote})`
  );
};
