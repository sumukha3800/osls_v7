class Plugin {
  declare commands: any;
  declare options: any;
  declare serverless: any;

  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;

    this.commands = {
      plugin: { type: 'container' },
    };
  }
}

export default Plugin;
