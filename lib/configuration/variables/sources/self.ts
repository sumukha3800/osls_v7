import type { VariableSourceResolverContext } from '../../../plugin-types.ts';

export default {
  resolve: async ({ address, resolveConfigurationProperty }: VariableSourceResolverContext) => {
    const result = await resolveConfigurationProperty(address ? address.split('.') : []);
    return { value: result == null ? null : result };
  },
};
