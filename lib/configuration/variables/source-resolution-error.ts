class VariableSourceResolutionError extends Error {
  declare code: any;

  constructor(message, code?) {
    super(message);
    this.code = code;
  }
}

Object.defineProperty(VariableSourceResolutionError.prototype, 'name', {
  value: VariableSourceResolutionError.name,
  configurable: true,
  writable: true,
});

export default VariableSourceResolutionError;
