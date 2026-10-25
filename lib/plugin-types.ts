// Types of the plugin API, exported from the package entry:
// `import type { Plugin, PluginConstructor, PluginUtils } from 'osls'`
// See docs/guides/plugins for the behaviour behind them
import type Serverless from './serverless.ts';
import type { OptionSchema, PluginCommandConfig } from './cli/commands-schema/types.ts';
import type { OutputWriter } from './utils/serverless-utils/lib/log/get-output-reporter.ts';
import type { ProgressReporter } from './utils/serverless-utils/lib/log/get-progress-reporter.ts';

export type { OutputWriter, ProgressReporter };
export type { Progress } from './utils/serverless-utils/lib/log/get-progress-reporter.ts';

// CLI options of the command: values are strings, booleans or string arrays (option types
// "string", "boolean" and "multiple"), so check the type of the options a plugin declares
export interface CliOptions {
  stage?: string;
  region?: string;
  [option: string]: unknown;
}

// Writes a message, formatted like `util.format()`
export type LogWriter = (...args: unknown[]) => void;

// A logger writes at the "notice" level when called, and at other levels through its methods
export interface Logger extends LogWriter {
  error: LogWriter;
  warning: LogWriter;
  notice: LogWriter;
  // Shown with `--verbose`
  info: LogWriter;
  verbose: LogWriter;
  // Shown with `--debug`
  debug: LogWriter;
  success: LogWriter;
  skip: LogWriter;
  // A logger for a nested namespace (eg. `log.get('my-step').debug(...)`)
  get: (namespace: string) => Logger;
}

// The I/O API given to the constructor of plugins loaded from the service (`plugins:`)
export interface PluginUtils {
  log: Logger;
  // Writes command output to stdout
  writeText: OutputWriter;
  progress: ProgressReporter;
}

// A lifecycle event hook, keyed by event name in `hooks`
// (eg. `before:package:createDeploymentArtifacts`, `my-command:run`)
export type Hook = () => unknown;
export type Hooks = Record<string, Hook>;

export type PluginCommand = PluginCommandConfig;
export type PluginCommandOption = OptionSchema;

// JSON schema given to the `configSchemaHandler.define*()` methods
export type JsonSchema = Record<string, unknown>;

// Schema parts of a provider, given to `configSchemaHandler.defineProvider()`
export interface ProviderSchemaParts {
  definitions?: Record<string, JsonSchema>;
  provider?: JsonSchema;
  function?: JsonSchema;
  // Event schemas by event name (eg. `http`)
  functionEvents?: Record<string, JsonSchema>;
  resources?: JsonSchema;
  layers?: JsonSchema;
}

export interface VariableSourceResolverContext {
  // In `${foo(one, two):bar}`: "bar"
  address: string | undefined;
  // In `${foo(one, two):bar}`: ["one", "two"], once their own variables are resolved
  params: unknown[] | undefined;
  options: CliOptions;
  isSourceFulfilled: boolean;
  serviceDir: string;
  // Resolves a configuration property, eg. `['provider', 'region']`
  resolveConfigurationProperty: (propertyPath: string[]) => Promise<unknown>;
  // Resolves a variable without `${}`, eg. `sls:stage`
  resolveVariable: (variable: string) => Promise<unknown>;
  resolveVariablesInString: (value: string) => Promise<unknown>;
}

export interface VariableSource {
  resolve: (
    context: VariableSourceResolverContext
  ) => { value: unknown } | Promise<{ value: unknown }>;
}

export interface Plugin {
  hooks?: Hooks;
  commands?: Record<string, PluginCommand>;
  // Variable sources by name: `foo` resolves `${foo:...}`
  configurationVariablesSources?: Record<string, VariableSource>;
  // Restricts the plugin to services of this provider (eg. "aws")
  provider?: string | object;
  asyncInit?: () => unknown;
}

// What a plugin module exports (as its default export, or `module.exports` in CommonJS)
export type PluginConstructor = new (
  serverless: Serverless,
  options: CliOptions,
  utils: PluginUtils
) => Plugin;
