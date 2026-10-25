import type Serverless from 'osls-ts7';
import type {
  AwsFunctionEvent,
  CliOptions,
  Hooks,
  Logger,
  Plugin,
  PluginCommand,
  PluginConstructor,
  PluginUtils,
  VariableSource,
} from 'osls-ts7';

export default class GreetingPlugin implements Plugin {
  serverless: Serverless;
  options: CliOptions;
  log: Logger;
  hooks: Hooks;
  commands: Record<string, PluginCommand>;
  configurationVariablesSources: Record<string, VariableSource>;

  constructor(serverless: Serverless, options: CliOptions, { log, progress }: PluginUtils) {
    this.serverless = serverless;
    this.options = options;
    this.log = log;

    serverless.configSchemaHandler.defineCustomProperties({
      type: 'object',
      properties: { greeting: { type: 'string' } },
    });

    this.commands = {
      greet: {
        usage: 'Greets someone',
        lifecycleEvents: ['run'],
        options: { name: { usage: 'Who to greet', type: 'string', shortcut: 'n' } },
      },
    };

    this.hooks = {
      'greet:run': () => this.greet(),
      'after:package:finalize': async () => {
        const deploying = progress.create({ message: 'Checking the region' });
        const region: string = serverless.getProvider('aws').getRegion();
        deploying.remove();
        log.verbose(`Packaged for ${region}`);
      },
    };

    this.configurationVariablesSources = {
      greeting: {
        resolve: async ({ address, resolveConfigurationProperty }) => ({
          value: `${String(await resolveConfigurationProperty(['custom', 'greeting']))} ${address}`,
        }),
      },
    };
  }

  greet(): void {
    const name = typeof this.options.name === 'string' ? this.options.name : 'world';
    const { service } = this.serverless;
    const handler: string | undefined = service.getFunction('hello').handler;
    const events: AwsFunctionEvent[] = service.getAllEventsInFunction('hello');
    const stage: string = service.provider.stage;
    this.log.success(`Hello ${name} from ${handler} (${events.length} events, stage ${stage})`);
    if (!name) throw new this.serverless.classes.Error('A name is required', 'MISSING_NAME');
  }

  checkTypes(): void {
    // @ts-expect-error `getRegion()` returns a string
    const region: number = this.serverless.getProvider('aws').getRegion();
    // @ts-expect-error Functions are typed from the configuration schema
    const timeout: string = this.serverless.service.getFunction('hello').timeout;
    // @ts-expect-error CLI option values are unknown until checked
    const name: string = this.options.name;
    // @ts-expect-error The logger takes messages, not an options object
    this.log.get(42);
    // @ts-expect-error `getAccountId()` resolves to a string
    const accountId: Promise<number> = this.serverless.getProvider('aws').getAccountId();
    // @ts-expect-error Commands are spawned by name
    void this.serverless.pluginManager.spawn(42);
    // @ts-expect-error Properties are defined with a JSON schema
    this.serverless.configSchemaHandler.defineTopLevelProperty('greeting', 'string');
    // @ts-expect-error `getStage()` returns a string
    const stage: number = this.serverless.getProvider('aws').getStage();
    void [region, timeout, name, accountId, stage];
  }
}

// What a plugin module exports: osls constructs it with the service, the CLI options and the I/O API
export const pluginConstructor: PluginConstructor = GreetingPlugin;
