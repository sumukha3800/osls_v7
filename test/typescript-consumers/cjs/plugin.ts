import type Serverless from 'osls';
import type { CliOptions, Hooks, Plugin, PluginConstructor, PluginUtils } from 'osls';

class StagePlugin implements Plugin {
  hooks: Hooks;

  constructor(serverless: Serverless, options: CliOptions, { log }: PluginUtils) {
    this.hooks = {
      initialize: () => {
        const stage: string = options.stage ?? serverless.service.provider.stage;
        log.notice(`Stage: ${stage}`);
      },
    };
  }
}

const pluginConstructor: PluginConstructor = StagePlugin;

module.exports = pluginConstructor;
