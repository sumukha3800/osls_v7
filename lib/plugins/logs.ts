import cliCommandsSchema from '../cli/commands-schema/index.ts';

class Logs {
  declare commands: any;
  declare serverless: any;

  constructor(serverless) {
    this.serverless = serverless;

    this.commands = {
      logs: {
        ...cliCommandsSchema.get('logs'),
      },
    };
  }
}

export default Logs;
