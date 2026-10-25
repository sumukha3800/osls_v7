import cliCommandsSchema from '../cli/commands-schema/index.ts';

class Info {
  declare commands: any;
  declare serverless: any;

  constructor(serverless) {
    this.serverless = serverless;

    this.commands = {
      info: {
        ...cliCommandsSchema.get('info'),
      },
    };
  }
}

export default Info;
