import mergePlainObjects from '../../utils/merge-plain-objects.ts';
import serviceCommands from './service.ts';
import awsServiceCommands from './aws-service.ts';
import serviceOptions from './common-options/service.ts';
import awsServiceOptions from './common-options/aws-service.ts';
import ServerlessError from '../../serverless-error.ts';
import type { CommandSchema, CommandsSchema, OptionsSchema, PluginCommandConfig } from './types.ts';

// Resolved schemas always carry options (core schemas define them, plugin ones get `{}`)
type ResolvedCommandSchema = CommandSchema & { options: OptionsSchema };

// Plugin instances; only the properties read here are described
interface LoadedPlugin {
  hooks?: Record<string, unknown>;
  commands?: Record<string, PluginCommandConfig>;
  [key: string]: any;
}

export default (
  loadedPlugins: Iterable<LoadedPlugin>,
  // `configuration` is accepted for callers that pass it, it is not used
  { providerName }: { providerName?: string; configuration?: unknown }
): CommandsSchema => {
  const commands: CommandsSchema = new Map(
    providerName === 'aws' ? awsServiceCommands : serviceCommands
  );

  if (providerName !== 'aws') {
    // Recognize AWS provider commands adapted in context of other provider
    // Those commands do not have to be defined as "commands" in plugin.
    // It's good enough if hooks for command lifecycle events are setup
    // and our detection confirms on that.
    const optionalServiceCommandsHooksMap = new Map<string, string>(
      Array.from(awsServiceCommands)
        .filter(([name]) => !serviceCommands.has(name))
        .map(([name, schema]) => {
          const lifecycleEventNamePrefix = name.split(' ').join(':');
          return (schema.lifecycleEvents || []).map((lifecycleEventBaseName) => {
            const lifecycleEventName = `${lifecycleEventNamePrefix}:${lifecycleEventBaseName}`;
            return [
              [`before:${lifecycleEventName}`, name],
              [lifecycleEventName, name],
              [`after:${lifecycleEventName}`, name],
            ] as [string, string][];
          });
        })
        .flat(2)
    );

    const awsSpecificOptionNames = new Set(
      Object.keys(awsServiceOptions).filter((optionName) => !serviceOptions[optionName])
    );

    for (const loadedPlugin of loadedPlugins) {
      if (!loadedPlugin.hooks) continue;
      for (const hookName of Object.keys(loadedPlugin.hooks)) {
        const awsCommandName = optionalServiceCommandsHooksMap.get(hookName);
        if (awsCommandName && !commands.has(awsCommandName)) {
          const schema: ResolvedCommandSchema = Object.assign(
            mergePlainObjects({}, awsServiceCommands.get(awsCommandName)),
            {
              isExtension: true,
              sourcePlugin: loadedPlugin,
            }
          );
          for (const awsSpecificOptionName of awsSpecificOptionNames) {
            delete schema.options[awsSpecificOptionName];
          }
          commands.set(awsCommandName, schema);
        }
      }
    }
  }

  const missingOptionTypes: { pluginName: string; commandName: string; optionName: string }[] = [];
  const commonOptions = providerName === 'aws' ? awsServiceOptions : serviceOptions;
  commands.commonOptions = commonOptions;
  const resolveCommands = (
    loadedPlugin: LoadedPlugin,
    config: { commands?: Record<string, PluginCommandConfig> },
    commandPrefix = ''
  ) => {
    if (!config.commands) return;
    for (const [commandName, commandConfig] of Object.entries(config.commands)) {
      if (commandConfig.type === 'entrypoint') continue;
      const fullCommandName = `${commandPrefix}${commandName}`;
      if (commandConfig.type !== 'container') {
        const schema: ResolvedCommandSchema = commands.has(fullCommandName)
          ? mergePlainObjects({}, commands.get(fullCommandName))
          : {
              usage: commandConfig.usage,
              serviceDependencyMode: 'required',
              isExtension: true,
              sourcePlugin: loadedPlugin,
              isHidden: commandConfig.isHidden,
              noSupportNotice: commandConfig.noSupportNotice,
              options: {},
            };
        if (commandConfig.lifecycleEvents) schema.lifecycleEvents = commandConfig.lifecycleEvents;
        if (commandConfig.options) {
          for (const [optionName, optionConfig] of Object.entries(commandConfig.options)) {
            if (!schema.options[optionName]) {
              schema.options[optionName] = optionConfig;
              if (!optionConfig.type) {
                missingOptionTypes.push({
                  pluginName: loadedPlugin.constructor.name,
                  commandName: fullCommandName,
                  optionName,
                });
              }
            }
          }
        }

        // Put common options to end of index
        for (const optionName of Object.keys(commonOptions)) delete schema.options[optionName];
        Object.assign(schema.options, commonOptions);

        commands.set(fullCommandName, schema);
      }
      resolveCommands(loadedPlugin, commandConfig, `${fullCommandName} `);
    }
  };

  for (const loadedPlugin of loadedPlugins) resolveCommands(loadedPlugin, loadedPlugin);

  if (missingOptionTypes.length) {
    throw new ServerlessError(
      'CLI options definitions must define a "type" property ("string", "boolean", or "multiple"). ' +
        'Below listed plugin options do not define type:\n' +
        missingOptionTypes
          .map(
            ({ pluginName, commandName, optionName }) =>
              ` - ${pluginName} for command "${commandName}" option "${optionName}"`
          )
          .join('\n'),
      'INVALID_CLI_OPTIONS_SCHEMA'
    );
  }

  return commands;
};
