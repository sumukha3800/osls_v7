const stripNullPropsFromObj = (obj) => {
  Object.entries<any>(obj).forEach(([propName, propVal]) => {
    if (propVal === null) {
      delete obj[propName];
    } else if (typeof propVal === 'object') {
      stripNullPropsFromObj(propVal);
    }
  });
};

export default {
  stripNullPropsFromTemplateResources() {
    const resources = this.serverless.service.provider.compiledCloudFormationTemplate.Resources;

    for (const resource of Object.values<any>(resources)) {
      if (resource.Properties) {
        stripNullPropsFromObj(resource.Properties);
      } else {
        delete resource.Properties;
      }
    }
  },
};
