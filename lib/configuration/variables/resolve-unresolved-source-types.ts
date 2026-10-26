import type { ValueMeta } from './parse.ts';

const processVariables = (
  propertyPath: string,
  variablesMeta: ValueMeta,
  resultMap: Map<string, Set<string>>
) => {
  if (!variablesMeta.variables) return;
  for (const variableMeta of variablesMeta.variables) {
    if (!variableMeta.sources) continue;
    const sourceData = variableMeta.sources[0];
    if (!sourceData.type) continue;
    if (sourceData.params) {
      for (const paramData of sourceData.params) {
        processVariables(propertyPath, paramData, resultMap);
      }
    }
    if (sourceData.address) {
      processVariables(propertyPath, sourceData.address, resultMap);
    }
    if (!resultMap.has(sourceData.type)) resultMap.set(sourceData.type, new Set());
    resultMap.get(sourceData.type)!.add(propertyPath);
  }
};

export default (propertiesVariablesMeta: Map<string, ValueMeta>) => {
  const resultMap = new Map<string, Set<string>>();
  for (const [propertyPath, propertyVariablesMeta] of propertiesVariablesMeta) {
    processVariables(propertyPath, propertyVariablesMeta, resultMap);
  }
  return resultMap;
};
