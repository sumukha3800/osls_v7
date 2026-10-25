// Types of the osls package entry: the service configuration types (`AWS` and its parts,
// generated in ./aws.d.ts), the plugin API types and the main export, the Serverless class
export * from './aws.js';
export type * from '../lib/plugin-types.js';
export type {
  AwsFunction,
  AwsFunctionEvent,
  AwsLayer,
  CloudFormationTemplate,
  ServiceProvider,
  default as Service,
} from '../lib/classes/service.js';
export type { default as AwsProvider } from '../lib/plugins/aws/provider.js';
export type { default as ConfigSchemaHandler } from '../lib/classes/config-schema-handler/index.js';
export type { default as PluginManager } from '../lib/classes/plugin-manager.js';
export type { default as ServerlessError } from '../lib/serverless-error.js';
export { default } from '../lib/serverless.js';
