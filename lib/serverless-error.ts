class ServerlessError extends Error {
  declare code: any;
  declare decoratedMessage: any;
  declare providerError: any;
  declare providerErrorCodeExtension: any;

  constructor(message, code?, options: Record<string, any> = {}) {
    super(message, options);
    this.code = code;
    this.decoratedMessage = options.decoratedMessage;
  }
}

Object.defineProperty(ServerlessError.prototype, 'name', {
  value: ServerlessError.name,
  configurable: true,
  writable: true,
});

export default ServerlessError;
