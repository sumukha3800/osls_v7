import { writeText, style } from '../utils/serverless-utils/log.ts';

export default (serviceOutputs: Map<string, string | Iterable<string>>) => {
  for (const [section, entries] of serviceOutputs) {
    if (typeof entries === 'string') {
      writeText(`${style.aside(`${section}:`)} ${entries}`);
    } else {
      // Iterable contents are stored as arrays by `addServiceOutputSection`
      writeText(`${style.aside(`${section}:\n`)}  ${(entries as string[]).join('\n  ')}`);
    }
  }
};
