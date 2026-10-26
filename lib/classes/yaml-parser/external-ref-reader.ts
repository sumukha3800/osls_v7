import path from 'node:path';
import { assertFileRefAllowed } from './file-ref-policy.ts';
import { readHttpRef } from './http-ref-reader.ts';
import type { RefFileInfo, RefResolver } from './http-ref-reader.ts';
import type { ExternalRefOptions } from './external-ref-options.ts';

let refParserModulePromise:
  | Promise<typeof import('@apidevtools/json-schema-ref-parser')>
  | undefined;

const getRefParserModule = () => {
  if (!refParserModulePromise) {
    refParserModulePromise = import('@apidevtools/json-schema-ref-parser');
  }

  return refParserModulePromise;
};

const getFileExtension = (documentUrl: string) => {
  try {
    return path.extname(new URL(documentUrl).pathname).toLowerCase();
  } catch {
    return path.extname(documentUrl).toLowerCase();
  }
};

const getFileInfo = (documentUrl: string): RefFileInfo => ({
  url: documentUrl,
  extension: getFileExtension(documentUrl),
  hash: '',
});

const readExternalDocument = async (documentUrl: string, externalRefs: ExternalRefOptions) => {
  const refParserModule = await getRefParserModule();
  // The built-in resolvers implement canRead and read as functions
  const FileResolver = refParserModule.FileResolver as RefResolver;
  const HTTPResolver = refParserModule.HTTPResolver as RefResolver;
  const fileInfo = getFileInfo(documentUrl);

  if (FileResolver.canRead(fileInfo)) {
    await assertFileRefAllowed(documentUrl, externalRefs.file);
    return FileResolver.read(fileInfo);
  }

  const httpResolver = { ...HTTPResolver, safeUrlResolver: false };

  if (httpResolver.canRead(fileInfo)) {
    return readHttpRef(documentUrl, fileInfo, HTTPResolver, externalRefs.http);
  }

  throw new Error(`Unsupported $ref protocol: ${documentUrl}`);
};

export { readExternalDocument };

export default {
  readExternalDocument,
};
