# TypeScript

osls ships type declarations for the service configuration and the plugin API, and is tested
against TypeScript 7 projects (ES modules, CommonJS and `moduleResolution: bundler`, with
`strict` on and `skipLibCheck` off). The `typescript` package on npm is TypeScript 7.

## Service configuration in TypeScript

Write `serverless.ts` (or `serverless.mts`) and check it against the `AWS` type with `satisfies`:

```ts
// serverless.ts
import type { AWS } from 'osls-ts7';

export default {
  service: 'users',
  provider: {
    name: 'aws',
    runtime: 'nodejs24.x',
  },
  functions: {
    usersCreate: {
      handler: 'dist/handlers/users.create',
      events: [{ httpApi: 'POST /users/create' }],
    },
  },
} satisfies AWS;
```

The `AWS` type is generated from the same schema osls validates the configuration with, so a
property the type rejects is also rejected by [configuration validation](configuration-validation.md).

osls loads `serverless.ts` with Node.js's built-in type stripping: no compiler is needed to run
commands. Syntax Node.js cannot strip (such as `enum` or parameter properties), extensionless
relative imports and tsconfig `paths` are loaded with [tsx](https://tsx.is) instead. Loading does
not type check: run `tsc` for that.

### Type checking

Install TypeScript 7 and Node.js types in the service:

```bash
npm install --save-dev typescript @types/node
```

A `tsconfig.json` for an ES module service (`"type": "module"` in `package.json`):

```json
{
  "compilerOptions": {
    "target": "es2023",
    "module": "nodenext",
    "types": ["node"],
    "strict": true,
    "noEmit": true,
    "erasableSyntaxOnly": true,
    "verbatimModuleSyntax": true
  }
}
```

TypeScript 7 includes no `@types` packages unless they are listed in `types`. `erasableSyntaxOnly`
keeps the configuration loadable by Node.js type stripping. Run `npx tsc` to check the project.

### Typing `custom`

`custom` accepts any properties. Type the ones the service uses:

```ts
import type { AWS } from 'osls-ts7';

interface Custom {
  tableName: string;
}

export default {
  service: 'users',
  provider: { name: 'aws' },
  custom: { tableName: 'users-${sls:stage}' } satisfies Custom,
} satisfies AWS;
```

## Plugins in TypeScript

The plugin API types are exported from `osls`:

```ts
// greeting-plugin.ts
import type Serverless from 'osls-ts7';
import type { CliOptions, Hooks, Plugin, PluginCommand, PluginUtils } from 'osls-ts7';

export default class GreetingPlugin implements Plugin {
  hooks: Hooks;
  commands: Record<string, PluginCommand> = {
    greet: {
      usage: 'Greets someone',
      lifecycleEvents: ['run'],
      options: { name: { usage: 'Who to greet', type: 'string' } },
    },
  };

  constructor(serverless: Serverless, options: CliOptions, { log }: PluginUtils) {
    this.hooks = {
      'greet:run': () => {
        const name = typeof options.name === 'string' ? options.name : 'world';
        log.success(`Hello ${name} from ${serverless.service.service}`);
      },
    };
  }
}
```

- `PluginUtils` is the I/O API (`log`, `writeText`, `progress`) described in [CLI output](plugins/cli-output.md).
- `CliOptions` types `stage` and `region`; check the type of the options the plugin declares.
- `serverless.service` is typed from the configuration types: `getFunction()` returns an
  `AwsFunction`, `getAllEventsInFunction()` returns `AwsFunctionEvent[]`, and `provider` has the
  resolved `stage`.
- `serverless.getProvider('aws')` returns the `AwsProvider` (for example `getRegion()`,
  `getStage()`, `getAwsSdkV3Config()`).
- Other exported types: `PluginConstructor`, `Logger`, `VariableSource` (for
  [custom variables](plugins/custom-variables.md)), `JsonSchema` and `ProviderSchemaParts` (for
  [custom configuration](plugins/custom-configuration.md)), `ServerlessError`.

A local plugin can be a TypeScript file, run with Node.js type stripping like the configuration.
List it with its extension:

```ts
plugins: ['./greeting-plugin.ts'],
```

Node.js does not strip types under `node_modules`: compile plugins published to npm to
JavaScript (for example with `tsc`) and publish the `.js` files with their `.d.ts` declarations.

## Lambda handlers in TypeScript

The Lambda Node.js runtimes run JavaScript: compile TypeScript handlers before packaging.

- With TypeScript 7 only: compile with `tsc` (with `outDir`, without `noEmit`), point `handler`
  to the compiled files (`dist/handlers/users.create`) and include them in the
  [package](packaging.md).
- With a bundler plugin: [serverless-esbuild](https://github.com/floydspace/serverless-esbuild)
  bundles TypeScript handlers with esbuild, which does not use the TypeScript compiler, so it works
  alongside TypeScript 7.

### Build plugins that need the TypeScript compiler API

TypeScript 7 has no JavaScript compiler API. Tools that call it (`ts.createProgram()` and
similar) fail when the `typescript` package is TypeScript 7:

- `serverless-plugin-typescript`
- `serverless-webpack` with `ts-loader` or `fork-ts-checker-webpack-plugin`

Either move to a tool that does not use the compiler API (such as serverless-esbuild), or keep
TypeScript 6 for these tools and use TypeScript 7 to type check:

```json
{
  "devDependencies": {
    "typescript": "npm:@typescript/typescript6@6.0.2",
    "@typescript/native": "npm:typescript@7.0.2"
  }
}
```

Tools that `import 'typescript'` get the TypeScript 6 API, and `npx tsc` runs TypeScript 7
(`@typescript/typescript6` installs its compiler as `tsc6`). osls itself is developed this way.
