import ensureString from 'type/string/ensure.js';

const flattenDeep = (items: Iterable<unknown>): unknown[] => {
  const result: unknown[] = [];
  for (const item of items) {
    if (Array.isArray(item)) {
      result.push(...flattenDeep(item));
    } else {
      result.push(item);
    }
  }
  return result;
};

export default (textTokens: Iterable<unknown>): string =>
  `${flattenDeep(textTokens)
    .map((textToken) => ensureString(textToken, { isOptional: true, name: 'textToken' }) || '')
    .join('\n')}\n`;
