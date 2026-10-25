import type { OptionsSchema } from '../types.ts';
import service from './service.ts';

const options: OptionsSchema = {
  'region': {
    usage: 'Region of the service',
    shortcut: 'r',
  },
  'aws-profile': {
    usage: 'AWS profile to use with the command',
  },
  ...service,
};

for (const optionSchema of Object.values(options)) {
  if (!optionSchema.type) optionSchema.type = 'string';
}

export default options;
