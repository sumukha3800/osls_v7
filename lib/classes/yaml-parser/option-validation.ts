import isPlainObject from 'type/plain-object/is.js';
import { throwOptionsError } from './external-ref-errors.ts';

const getOptionLabel = (optionName: string) =>
  optionName === 'options' ? 'YAML parser options' : `YAML parser option ${optionName}`;

const assertOptionsObject = (value: unknown, optionName: string) => {
  if (value == null || !isPlainObject(value)) {
    throwOptionsError(`${getOptionLabel(optionName)} must be an object.`);
  }
};

const assertKnownOptions = (options: object, optionName: string, allowedOptions: string[]) => {
  for (const key of Object.keys(options)) {
    if (!allowedOptions.includes(key)) {
      const optionPath = optionName === 'options' ? key : `${optionName}.${key}`;
      throwOptionsError(`YAML parser option ${optionPath} is not supported.`);
    }
  }
};

export { assertKnownOptions, assertOptionsObject };

export default {
  assertKnownOptions,
  assertOptionsObject,
};
