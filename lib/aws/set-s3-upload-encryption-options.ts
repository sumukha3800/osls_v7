export default <T extends Record<string, any>>(
  putParams: T,
  deploymentBucketOptions: Record<string, any>
): T => {
  const encryptionFields = [
    ['serverSideEncryption', 'ServerSideEncryption'],
    ['sseCustomerAlgorithim', 'SSECustomerAlgorithm'],
    ['sseCustomerKey', 'SSECustomerKey'],
    ['sseCustomerKeyMD5', 'SSECustomerKeyMD5'],
    ['sseKMSKeyId', 'SSEKMSKeyId'],
  ];

  const params: Record<string, any> = putParams;

  encryptionFields.forEach((element) => {
    if (deploymentBucketOptions[element[0]]) {
      params[element[1]] = deploymentBucketOptions[element[0]];
    }
  });

  return params as T;
};
