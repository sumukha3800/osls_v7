import resolveStage from '../utils/resolve-stage.ts';
import type { CliOptions } from '../plugin-types.ts';

export default async (options: CliOptions, configuration: Record<string, any>) => {
  if (!configuration.useDotenv) return false;
  (await import('./load-dotenv.ts')).default(resolveStage({ configuration, options }));
  return true;
};
