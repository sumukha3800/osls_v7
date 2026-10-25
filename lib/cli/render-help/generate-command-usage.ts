import { style } from '../../utils/serverless-utils/log.ts';
import type { CommandSchema } from '../commands-schema/types.ts';

export default (commandName: string, commandSchema: CommandSchema) => {
  const indentFillLength = 30;

  const usage = commandSchema.usage;
  return `${commandName} ${' '.repeat(
    Math.max(indentFillLength - commandName.length, 0)
  )} ${style.aside(usage)}`;
};
