import type { AWS } from 'osls-ts7';

const configuration: AWS = {
  service: 'typescript-consumer',
  provider: { name: 'aws', runtime: 'nodejs22.x' },
  functions: {
    hello: { handler: 'handler.hello', events: [{ httpApi: '*' }] },
  },
};

module.exports = configuration;
