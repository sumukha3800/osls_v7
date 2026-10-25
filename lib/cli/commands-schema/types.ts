// Shapes of the CLI commands schema: the core command definitions in this directory and the
// `commands` that plugins declare, as resolved by `resolve-final.ts`

export interface OptionSchema {
  usage?: string;
  // Core options always set it; plugin options must ("string", "boolean" or "multiple")
  type?: string;
  shortcut?: string;
  required?: boolean;
  default?: unknown;
  [key: string]: unknown;
}

export type OptionsSchema = Record<string, OptionSchema>;

export interface CommandSchema {
  usage?: string;
  options?: OptionsSchema;
  lifecycleEvents?: string[];
  serviceDependencyMode?: 'required' | 'optional' | 'disabled';
  groupName?: string;
  hasAwsExtension?: boolean;
  isHidden?: boolean;
  noSupportNotice?: string;
  // Set on commands that come from a plugin
  isExtension?: boolean;
  sourcePlugin?: any;
  [key: string]: unknown;
}

// A command as declared by a plugin in its `commands` property
export interface PluginCommandConfig extends CommandSchema {
  type?: 'entrypoint' | 'container';
  commands?: Record<string, PluginCommandConfig>;
  aliases?: string[];
  // Legacy equivalent of `serviceDependencyMode: 'required'`
  configDependent?: boolean;
}

// Command names (space separated) mapped to their schema, with the options that apply to every
// command when no command matched
export type CommandsSchema = Map<string, CommandSchema> & { commonOptions?: OptionsSchema };
