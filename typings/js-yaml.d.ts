// Members of js-yaml that exist at runtime but are missing from @types/js-yaml
export {};

declare module 'js-yaml' {
  interface Type {
    tag: string;
  }
  interface Schema {
    implicit: Type[];
    explicit: Type[];
  }
  // The built-in types by name, eg. `timestamp`
  const types: Record<string, Type>;
}
