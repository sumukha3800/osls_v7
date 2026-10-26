import crypto from 'node:crypto';
import deepSortObjectByKey from '../../utils/deep-sort-object-by-key.ts';

export default (schema: unknown) =>
  crypto
    .createHash('sha256')
    .update(JSON.stringify(deepSortObjectByKey(schema)))
    .digest('hex');
