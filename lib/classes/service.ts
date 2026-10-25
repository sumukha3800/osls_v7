import ServerlessError from '../serverless-error.ts';
import util from 'node:util';
import semver from 'semver';
import isObject from 'type/object/is.js';
import isPlainObject from 'type/plain-object/is.js';
import mergePlainObjects from '../utils/merge-plain-objects.ts';
import { hasOwn } from '../utils/safe-object.ts';
import { log } from '../utils/serverless-utils/log.ts';
import validateStage from '../utils/validate-stage.ts';
import type { AWS } from '../../types/aws.d.ts';
import type Serverless from '../serverless.ts';

// A function, a function event and a layer of the service configuration
export type AwsFunction = NonNullable<AWS['functions']>[string];
export type AwsFunctionEvent = NonNullable<AwsFunction['events']>[number];
export type AwsLayer = NonNullable<AWS['layers']>[string];

// A CloudFormation template, as osls compiles it
export interface CloudFormationTemplate {
  AWSTemplateFormatVersion?: string;
  Description?: string;
  Resources: Record<string, any>;
  Outputs?: Record<string, any>;
  [key: string]: any;
}

// `service.provider` at run time: the provider configuration, with the stage and region resolved
// and the templates osls compiles. Other providers than AWS share the shape loosely
export type ServiceProvider = Omit<AWS['provider'], 'name' | 'region' | 'stage'> & {
  name: string;
  stage: string;
  region?: string;
  compiledCloudFormationTemplate?: CloudFormationTemplate;
  coreCloudFormationTemplate?: CloudFormationTemplate;
  [key: string]: any;
};

// const currentVersion = require('../../package').version;
// const isLocallyInstalled = require('../cli/is-locally-installed');

class Service {
  declare app: any;
  declare configValidationMode: any;
  declare custom: Record<string, any>;
  declare deprecationNotificationMode: any;
  declare disabledDeprecations: any;
  declare functions: Record<string, AwsFunction>;
  declare initialServerlessConfig: any;
  declare layers: AWS['layers'];
  declare org: any;
  declare outputs: any;
  declare package: AWS['package'];
  declare plugins: any;
  declare pluginsData: any;
  declare provider: ServiceProvider;
  declare resources: AWS['resources'];
  declare serverless: Serverless;
  // The service name
  declare service: string | null;
  declare serviceFilename: any;
  declare serviceObject: { name: string; [key: string]: any } | null;

  // `serverless`: the Serverless instance, or a stub of the properties used
  constructor(serverless: any, data?: Record<string, any> | null) {
    // #######################################################################
    // ## KEEP SYNCHRONIZED WITH EQUIVALENT IN ~/lib/plugins/print/print.js ##
    // #######################################################################
    this.serverless = serverless;

    // Default properties
    this.service = null;
    this.serviceObject = null;
    // Placeholder until the configuration is loaded
    this.provider = {
      stage: 'dev',
    } as ServiceProvider;
    this.custom = {};
    this.plugins = [];
    this.pluginsData = {};
    this.functions = {};
    this.resources = {};
    this.package = {};
    this.configValidationMode = 'error';
    this.disabledDeprecations = [];

    if (data) this.update(data);
  }

  async load(rawOptions?: Record<string, any> | null) {
    const options = rawOptions || {};
    if (!hasOwn(options, 'stage') && hasOwn(options, 's')) options.stage = options.s;
    if (hasOwn(options, 'stage')) options.stage = validateStage(options.stage);
    if (!options.region && options.r) options.region = options.r;
    const serviceDir = this.serverless.serviceDir;

    // skip if the service path is not found
    // because the user might be creating a new service
    if (!serviceDir) return;

    try {
      this.loadServiceFileParam();
    } catch (error) {
      if (this.serverless.processedInput.isHelpRequest) return;
      throw error;
    }
  }

  loadServiceFileParam() {
    // Not used internally, left set to not break plugins which depend on it
    // TODO: Remove with next major
    this.serviceFilename = this.serverless.configurationFilename;

    // Set with `serviceDir`, which `load()` checks
    const configurationInput = this.serverless.configurationInput!;

    this.initialServerlessConfig = configurationInput;

    // TODO: Ideally below approach should be replaced at some point with:
    // 1. In "initialization" phase: Minimize reliance on service configuration
    //    to few core properties
    // 2. Before "run" phase: Validate and normalize (via AJV) `serverless.configurationInput`
    //    into `serverless.configuration`
    // 3. In "run" phase: Instead of relying on `serverless.service` rely on
    //    `serverless.configuration` internally

    // Below comments provide usage feedback helpful for future refactor process.

    // ## Properties currently accessed at "initialization" phase

    this.disabledDeprecations = configurationInput.disabledDeprecations;
    this.deprecationNotificationMode = configurationInput.deprecationNotificationMode;

    // `provider` (`provider.name` by many plugin constructs, and few other core properties as
    //              `provider.stage` are read by dashboard plugin)
    if (!isObject(configurationInput.provider)) {
      const providerName = configurationInput.provider;
      this.provider = {
        name: providerName,
      } as ServiceProvider;
    } else {
      this.provider = configurationInput.provider as ServiceProvider;
    }
    if (this.provider.stage == null) {
      this.provider.stage = 'dev';
    }

    // `service` (read by dashboard plugin)
    if (isObject(configurationInput.service)) {
      throw new ServerlessError(
        'Object notation for "service" property is not supported. Set "service" property directly with service name.',
        'SERVICE_OBJECT_NOTATION'
      );
    } else {
      this.serviceObject = { name: configurationInput.service };
      this.service = configurationInput.service;
    }

    // (dashboard plugin)
    this.app = configurationInput.app;
    this.org = configurationInput.org;

    this.plugins = configurationInput.plugins;

    // `package.path` is read by few core plugins at initialization
    if (configurationInput.package) {
      this.package = configurationInput.package;
    }

    // ## Properties accessed at "run" phase
    this.custom = configurationInput.custom; // (dashboard plugin)
    this.resources = configurationInput.resources;
    this.functions = configurationInput.functions || {};
    this.configValidationMode = configurationInput.configValidationMode || 'error';
    if (this.provider.name === 'aws') {
      this.layers = configurationInput.layers || {};
    }
    this.outputs = configurationInput.outputs;

    // basic service level validation
    const version = this.serverless.utils.getVersion();
    let ymlVersion = configurationInput.frameworkVersion;
    if (ymlVersion && !semver.validRange(ymlVersion)) {
      if (this.configValidationMode === 'error') {
        throw new ServerlessError(
          'Configured "frameworkVersion" does not represent a valid semver version range.',
          'INVALID_FRAMEWORK_VERSION'
        );
      }
      log.warning(
        'Configured "frameworkVersion" does not represent a valid semver version range, version validation is skipped'
      );
      ymlVersion = null;
    }
    // Commented out because we don't expect new major versions, so we might as well remove this noise
    // if (!isLocallyInstalled && !ymlVersion && !semver.parse(version).prerelease.length) {
    //   log.info(
    //     'To ensure safe major version upgrades ensure "frameworkVersion" setting in ' +
    //       'service configuration ' +
    //       `(recommended setup: "frameworkVersion: ^${currentVersion}")\n`
    //   );
    // }
    if (
      ymlVersion &&
      version !== ymlVersion &&
      !semver.satisfies(semver.coerce(version)!.raw, ymlVersion)
    ) {
      const errorMessage = [
        `The osls version (${version}) does not satisfy the`,
        ` "frameworkVersion" (${ymlVersion}) in ${this.serverless.configurationFilename}`,
      ].join('');
      throw new ServerlessError(errorMessage, 'FRAMEWORK_VERSION_MISMATCH');
    }
    if (!configurationInput.service) {
      throw new ServerlessError(
        `"service" property is missing in ${this.serverless.configurationFilename}`,
        'SERVICE_NAME_MISSING'
      );
    }
    if (!configurationInput.provider) {
      throw new ServerlessError(
        `"provider" property is missing in ${this.serverless.configurationFilename}`,
        'PROVIDER_NAME_MISSING'
      );
    }
    if (!isObject(configurationInput.provider)) {
      // Schema unconditionally expects `provider` to be an object.
      // Ideally if it's fixed at some point, and either we do not support string notation for
      // provider, or we support string by schema
      configurationInput.provider = this.provider;
    }

    return this;
  }

  reloadServiceFileParam() {
    const configurationInput = this.initialServerlessConfig;
    if (isObject(configurationInput.provider)) {
      this.provider = configurationInput.provider;
      if (this.provider.stage == null) this.provider.stage = 'dev';
    }
    if (configurationInput.package) {
      this.package = configurationInput.package;
    }
    this.custom = configurationInput.custom;
    this.resources = configurationInput.resources;
    this.functions = configurationInput.functions || {};
    this.configValidationMode = configurationInput.configValidationMode || 'error';
    if (this.provider.name === 'aws') {
      this.layers = configurationInput.layers || {};
    }
    this.outputs = configurationInput.outputs;
  }

  setFunctionNames(rawOptions?: Record<string, any> | null) {
    const options = rawOptions || {};
    if (!hasOwn(options, 'stage') && hasOwn(options, 's')) options.stage = options.s;
    if (hasOwn(options, 'stage')) options.stage = validateStage(options.stage);
    options.region = options.region || options.r;

    // Ensure that function is an object and setup function.name property
    const stageNameForFunction = validateStage(options.stage ?? this.provider.stage ?? 'dev');

    if (!isObject(this.functions)) {
      throw new ServerlessError(
        `Unexpected "functions" configuration: Expected object received: ${util.inspect(
          this.functions
        )}`,
        'NON_OBJECT_FUNCTIONS_CONFIGURATION'
      );
    }
    Object.entries(this.functions).forEach(([functionName, functionObj]) => {
      if (functionObj == null) {
        delete this.functions[functionName];
        return;
      }
      if (!isObject(functionObj)) {
        throw new ServerlessError(
          `Unexpected "${functionName}" function configuration: Expected object received ${util.inspect(
            functionObj
          )})`,
          'NON_OBJECT_FUNCTION_CONFIGURATION_ERROR'
        );
      }
      if (!functionObj.events) {
        this.functions[functionName].events = [];
      }

      if (!functionObj.name) {
        this.functions[functionName].name =
          `${this.service}-${stageNameForFunction}-${functionName}`;
      }
    });
  }

  mergeArrays() {
    (['resources', 'functions'] as const).forEach((key) => {
      // Either may be an array of objects to merge, which the declared types do not describe
      const configuration: unknown = this[key];
      if (Array.isArray(configuration)) {
        (this as Record<string, any>)[key] = configuration.reduce((memo, value) => {
          if (value) {
            if (isPlainObject(value)) {
              return mergePlainObjects(memo, value);
            }
            throw new ServerlessError(
              `Non-object value specified in ${key} array: ${util.inspect(value)}`,
              'LEGACY_CONFIGURATION_PROPERTY_MERGE_INVALID_INPUT'
            );
          }

          return memo;
        }, {});
      }
    });
  }

  async validate() {
    const userConfig = this.initialServerlessConfig;

    // Ensure to validate normalized (after mergeArrays) input
    if (userConfig.functions) userConfig.functions = this.functions;
    if (userConfig.resources) userConfig.resources = this.resources;

    if (userConfig.variablesResolutionMode === '20210219') {
      throw new ServerlessError(
        'The "variablesResolutionMode: 20210219" mode is not supported in osls 4.0.0. Remove "variablesResolutionMode" from the configuration.',
        'VARIABLES_RESOLUTION_MODE_20210219_UNSUPPORTED'
      );
    }

    await this.serverless.configSchemaHandler.validateConfig(userConfig);

    if (userConfig.projectDir != null) {
      this.serverless._logDeprecation(
        'PROJECT_DIR',
        'The "projectDir" option is no longer used and is ignored. ' +
          'You can safely remove it from the configuration. ' +
          'This property is scheduled for removal in osls 5.0.0.'
      );
    }
    if (userConfig.variablesResolutionMode != null) {
      this.serverless._logDeprecation(
        'VARIABLES_RESOLUTION_MODE',
        'Starting with v3.0, the "variablesResolutionMode" option is no longer effective. ' +
          'You can safely remove it from the configuration. ' +
          'This property is scheduled for removal in osls 5.0.0.'
      );
    }
    return this;
  }

  update(data: Record<string, any>) {
    return mergePlainObjects(this, data);
  }

  getServiceName(): string {
    return this.serviceObject!.name;
  }

  getServiceObject() {
    return this.serviceObject;
  }

  getAllFunctions() {
    return Object.keys(this.functions);
  }

  getAllLayers() {
    return this.layers ? Object.keys(this.layers) : [];
  }

  getAllFunctionsNames() {
    return this.getAllFunctions().map((func) => this.getFunction(func).name);
  }

  getFunction(functionName: string): AwsFunction {
    if (hasOwn(this.functions, functionName)) {
      return this.functions[functionName];
    }
    throw new ServerlessError(
      `Function "${functionName}" doesn't exist in this Service`,
      'FUNCTION_MISSING_IN_SERVICE'
    );
  }

  getLayer(layerName: string): AwsLayer {
    if (hasOwn(this.layers, layerName)) {
      return this.layers![layerName];
    }
    throw new ServerlessError(
      `Layer "${layerName}" doesn't exist in this Service`,
      'LAYER_MISSING_IN_SERVICE'
    );
  }

  getEventInFunction(eventName: string, functionName: string): AwsFunctionEvent {
    // `setFunctionNames()` sets `events` on every function
    const event = this.getFunction(functionName).events!.find(
      (e) => Object.keys(e)[0] === eventName
    );
    if (event) {
      return event;
    }
    throw new ServerlessError(
      `Event "${eventName}" doesn't exist in function "${functionName}"`,
      'EVENT_MISSING_FOR_FUNCTION'
    );
  }

  getAllEventsInFunction(functionName: string): AwsFunctionEvent[] {
    return this.getFunction(functionName).events!;
  }

  publish(dataParam?: Record<string, any> | null) {
    const data = dataParam || {};
    this.pluginsData = mergePlainObjects(this.pluginsData, data);
  }
}

export default Service;
