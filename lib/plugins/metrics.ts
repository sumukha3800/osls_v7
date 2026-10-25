import cliCommandsSchema from '../cli/commands-schema/index.ts';

class Metrics {
  declare commands: any;
  declare options: any;
  declare serverless: any;

  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;

    this.commands = {
      metrics: {
        ...cliCommandsSchema.get('metrics'),
      },
    };
  }
}

export default Metrics;
