import cliCommandsSchema from '../cli/commands-schema/index.ts';

class Remove {
  declare commands: any;
  declare serverless: any;

  constructor(serverless) {
    this.serverless = serverless;

    this.commands = {
      remove: {
        ...cliCommandsSchema.get('remove'),
      },
    };
  }
}

export default Remove;
