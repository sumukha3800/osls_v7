class ServerlessError extends Error {
  declare code: string | undefined;
  declare decoratedMessage: string | undefined;
  declare providerError: any;
  declare providerErrorCodeExtension: any;

  constructor(
    message: string,
    code?: string,
    options: ErrorOptions & { decoratedMessage?: string } = {}
  ) {
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
