import memoizee from 'memoizee';
import { packageJson as packageModule } from './package-root.ts';
import ensureExists from './ensure-exists.ts';
import path from 'node:path';
import os from 'node:os';
const { version } = packageModule;

const ensureArtifactInCache = memoizee(
  // Not passed when deleting a cache entry (the cache is keyed by the first two arguments)
  async (filename: string, cachePath: string, generate?: () => unknown) => {
    await ensureExists(path.resolve(cachePath, filename), generate);
    return cachePath;
  },
  { length: 2, promise: true, primitive: true }
);

const ensureArtifact = (
  filename,
  generate,
  { homeDir = os.homedir(), artifactVersion = version } = {}
) => {
  const cachePath = path.resolve(homeDir, '.serverless/artifacts', artifactVersion);

  return ensureArtifactInCache(filename, cachePath, generate);
};

ensureArtifact.clear = ensureArtifactInCache.clear;
ensureArtifact.delete = (filename, options: Record<string, any> = {}) => {
  const homeDir = options.homeDir || os.homedir();
  const artifactVersion = options.artifactVersion || version;
  const cachePath = path.resolve(homeDir, '.serverless/artifacts', artifactVersion);

  return ensureArtifactInCache.delete(filename, cachePath);
};

export default ensureArtifact;
