import resolveInput from '../resolve-input.ts';
import type { ResolvedInput } from '../resolve-input.ts';
import renderGeneralHelp from './general.ts';
import renderCommandHelp from './command.ts';

export default (loadedPlugins: Set<any>, resolvedInput: ResolvedInput = resolveInput()) => {
  const { command } = resolvedInput;
  if (!command) {
    renderGeneralHelp(loadedPlugins, resolvedInput);
  } else if (command === 'help') {
    renderGeneralHelp(loadedPlugins, resolvedInput);
  } else {
    renderCommandHelp(command, resolvedInput);
  }
};
