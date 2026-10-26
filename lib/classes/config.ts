import path from 'node:path';
import mergePlainObjects from '../utils/merge-plain-objects.ts';
import type Serverless from '../serverless.ts';

class Config {
  declare custom: any;
  declare serverless: any;
  declare serverlessPath: any;

  constructor(serverless: Serverless, config?: Record<string, any>) {
    this.serverless = serverless;
    this.serverlessPath = path.join(import.meta.dirname, '..');

    if (config) this.update(config);
  }

  update(config: Record<string, any>) {
    return mergePlainObjects(this, config);
  }

  get servicePath() {
    return this.serverless.serviceDir;
  }

  set servicePath(value) {
    this.serverless.serviceDir = value;
  }
}

export default Config;
