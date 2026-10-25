import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { syncBuiltinESMExports } from 'node:module';
import * as chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinonChai from 'sinon-chai';

chai.use(chaiAsPromised);
chai.use(sinonChai);

// Tests never use the developer's AWS configuration (profiles, region, credentials): it would
// change credential provider resolution and cache keys between runs
for (const name of Object.keys(process.env)) {
  if (name.startsWith('AWS_')) delete process.env[name];
}

process.env.SLS_DEPRECATION_NOTIFICATION_MODE ??= 'error';
process.env.SLS_TELEMETRY_DISABLED = '1';
process.env.LOG_TIME ??= 'abs';

const workerHomeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'serverless-test-'));
const originalHomedir = os.homedir;

os.homedir = () => workerHomeDir;
// Propagate the override to named `import { homedir } from 'node:os'` bindings
syncBuiltinESMExports();

process.on('exit', () => {
  os.homedir = originalHomedir;
  try {
    fs.rmSync(workerHomeDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors at process exit
  }
});

globalThis.__SERVERLESS_TEST_BOOTSTRAP__ = {
  workerHomeDir,
  originalHomedir,
};
