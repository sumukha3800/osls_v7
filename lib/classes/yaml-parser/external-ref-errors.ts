import ServerlessError from '../../serverless-error.ts';

const YAML_REF_ACCESS_DENIED = 'YAML_REF_ACCESS_DENIED';
const YAML_REF_OPTIONS_ERROR = 'YAML_REF_OPTIONS_ERROR';

const isExternalRefAccessDeniedError = (error: any) =>
  error && error.code === YAML_REF_ACCESS_DENIED;

const createExternalRefAccessDeniedError = (message: string) =>
  new ServerlessError(message, YAML_REF_ACCESS_DENIED);

const denyExternalRef: (message: string) => never = (message) => {
  throw createExternalRefAccessDeniedError(message);
};

const getExternalRefAccessDeniedError = (
  error: any,
  seenErrors = new Set<unknown>()
): Error | null => {
  if (error == null || typeof error !== 'object') return null;
  if (seenErrors.has(error)) return null;

  seenErrors.add(error);

  if (isExternalRefAccessDeniedError(error)) return error;

  const causeError = getExternalRefAccessDeniedError(error.cause, seenErrors);
  if (causeError) return causeError;

  if (Array.isArray(error.errors)) {
    for (const childError of error.errors) {
      const accessDeniedError = getExternalRefAccessDeniedError(childError, seenErrors);
      if (accessDeniedError) return accessDeniedError;
    }
  }

  return null;
};

const throwOptionsError: (message: string) => never = (message) => {
  throw new ServerlessError(message, YAML_REF_OPTIONS_ERROR);
};

export {
  createExternalRefAccessDeniedError,
  denyExternalRef,
  getExternalRefAccessDeniedError,
  isExternalRefAccessDeniedError,
  throwOptionsError,
  YAML_REF_ACCESS_DENIED,
  YAML_REF_OPTIONS_ERROR,
};

export default {
  createExternalRefAccessDeniedError,
  denyExternalRef,
  getExternalRefAccessDeniedError,
  isExternalRefAccessDeniedError,
  throwOptionsError,
  YAML_REF_ACCESS_DENIED,
  YAML_REF_OPTIONS_ERROR,
};
