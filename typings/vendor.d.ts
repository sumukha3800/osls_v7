// Types for runtime dependencies that ship none and have no DefinitelyTyped package.
// Only the entry points osls uses are declared.

// `type` ships declarations (ts-types/, through `typesVersions`), but they are CommonJS files with
// `export default`: a default import gets a non-callable namespace under `nodenext`. These ambient
// declarations take precedence over them
interface TypeEnsureOptions {
  default?: unknown;
  ensureItem?: (value: unknown) => unknown;
  ensurePropertyValue?: (value: unknown) => unknown;
  allowedKeys?: readonly string[];
  denyEmpty?: boolean;
  errorMessage?: string;
  errorCode?: string;
  isOptional?: boolean;
  name?: string;
  Error?: new (message: string) => Error;
}

declare module 'type/array/ensure.js' {
  const ensureArray: (value: unknown, options?: TypeEnsureOptions) => any[];
  export default ensureArray;
}
declare module 'type/error/is.js' {
  const isError: (value: unknown) => value is Error;
  export default isError;
}
declare module 'type/iterable/ensure.js' {
  const ensureIterable: (value: unknown, options?: TypeEnsureOptions) => any;
  export default ensureIterable;
}
declare module 'type/lib/to-short-string.js' {
  const toShortString: (value: unknown) => string;
  export default toShortString;
}
declare module 'type/map/ensure.js' {
  const ensureMap: (value: unknown, options?: TypeEnsureOptions) => Map<any, any>;
  export default ensureMap;
}
declare module 'type/natural-number/ensure.js' {
  const ensureNaturalNumber: (value: unknown, options?: TypeEnsureOptions) => number;
  export default ensureNaturalNumber;
}
declare module 'type/object/is.js' {
  const isObject: (value: unknown) => value is Record<string, any>;
  export default isObject;
}
declare module 'type/plain-function/ensure.js' {
  const ensurePlainFunction: (
    value: unknown,
    options?: TypeEnsureOptions
  ) => (...args: any[]) => any;
  export default ensurePlainFunction;
}
declare module 'type/plain-function/is.js' {
  const isPlainFunction: (value: unknown) => value is (...args: any[]) => any;
  export default isPlainFunction;
}
declare module 'type/plain-object/ensure.js' {
  const ensurePlainObject: (value: unknown, options?: TypeEnsureOptions) => Record<string, any>;
  export default ensurePlainObject;
}
declare module 'type/plain-object/is.js' {
  const isPlainObject: (value: unknown) => value is Record<string, any>;
  export default isPlainObject;
}
declare module 'type/set/ensure.js' {
  const ensureSet: (value: unknown, options?: TypeEnsureOptions) => Set<any>;
  export default ensureSet;
}
declare module 'type/string/coerce.js' {
  const coerceString: (value: unknown) => string | null;
  export default coerceString;
}
declare module 'type/string/ensure.js' {
  const ensureString: (value: unknown, options?: TypeEnsureOptions) => string;
  export default ensureString;
}
declare module 'type/thenable/is.js' {
  const isThenable: (value: unknown) => value is PromiseLike<any>;
  export default isThenable;
}
declare module 'type/value/ensure.js' {
  const ensureValue: (value: unknown, options?: TypeEnsureOptions) => any;
  export default ensureValue;
}

declare module 'ext/function/identity.js' {
  const identity: <T>(value: T) => T;
  export default identity;
}
declare module 'ext/object/clear.js' {
  const clear: <T extends object>(object: T) => T;
  export default clear;
}
declare module 'ext/promise/limit.js' {
  // Called with the Promise constructor as `this` (`limit.bind(Promise)`)
  const limit: <F extends (...args: any[]) => any>(
    this: PromiseConstructorLike,
    limit: number,
    callback: F
  ) => (...args: Parameters<F>) => Promise<Awaited<ReturnType<F>>>;
  export default limit;
}
declare module 'ext/string/random.js' {
  const random: (options?: { charset?: string; length?: number; isUnique?: boolean }) => string;
  export default random;
}

declare module 'memoizee/methods.js' {
  const memoizeeMethods: (descriptors: Record<string, any>) => PropertyDescriptorMap;
  export default memoizeeMethods;
}
declare module 'memoizee/weak.js' {
  import memoize from 'memoizee';
  export default memoize;
}

declare module 'json-cycle' {
  const jsonCycle: {
    decycle: (value: unknown) => any;
    retrocycle: (value: unknown) => any;
    stringify: (
      value: unknown,
      replacer?: ((this: any, key: string, value: any) => any) | (number | string)[] | null,
      space?: string | number
    ) => string;
    parse: (text: string, reviver?: (this: any, key: string, value: any) => any) => any;
  };
  export default jsonCycle;
}

// `log` and `log-node` (event based logger): loggers are created dynamically per namespace and
// level, so they are typed loosely
declare module 'log' {
  const log: any;
  export default log;
}
declare module 'log/lib/emitter.js' {
  const emitter: import('node:events').EventEmitter;
  export default emitter;
}
declare module 'log-node/lib/writer.js' {
  const LogNodeWriter: any;
  export default LogNodeWriter;
}
