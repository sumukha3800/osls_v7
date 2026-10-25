import path from 'node:path';
import { log } from '../../utils/serverless-utils/log.ts';
import ServerlessError from '../../serverless-error.ts';
import resolveCliInput from '../../cli/resolve-input.ts';
import type { ValueMeta } from './parse.ts';

export default (
  // Set whenever there are variables (they come from the configuration file)
  configurationPath: string | null,
  configuration: unknown,
  variablesMeta: Map<string, ValueMeta>,
  options: Record<string, any> = {}
) => {
  if (!options) options = {};
  const isHelpRequest =
    options.isHelpRequest == null ? resolveCliInput().isHelpRequest : options.isHelpRequest;
  const resolutionErrors = new Set(
    Array.from(variablesMeta.values(), ({ error }) => error).filter(Boolean) as Error[]
  );

  if (!resolutionErrors.size) return false;

  if (isHelpRequest) {
    log.warning(
      'Resolution of service configuration failed when resolving variables: ' +
        `${Array.from(resolutionErrors, (error) => `\n  - ${error.message}`)}\n`
    );
    return true;
  }

  throw new ServerlessError(
    `Cannot resolve ${path.basename(
      configurationPath!
    )}: Variables resolution errored with:${Array.from(
      resolutionErrors,
      (error) => `\n  - ${error.message}`
    )}`,
    'VARIABLES_RESOLUTION_ERROR'
  );
};
