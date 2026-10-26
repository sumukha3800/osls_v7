class VariableSourceResolutionError extends Error {
  declare code: string | undefined;

  // `Error` converts a non-string message to a string
  constructor(message: unknown, code?: string) {
    super(message as string);
    this.code = code;
  }
}

Object.defineProperty(VariableSourceResolutionError.prototype, 'name', {
  value: VariableSourceResolutionError.name,
  configurable: true,
  writable: true,
});

export default VariableSourceResolutionError;
