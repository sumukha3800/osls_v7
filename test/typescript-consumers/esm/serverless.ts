import type { AWS } from 'osls-ts7';

const configuration = {
  service: 'typescript-consumer',
  provider: {
    name: 'aws',
    runtime: 'nodejs24.x',
    region: 'eu-west-1',
    iam: {
      role: {
        statements: [{ Effect: 'Allow', Action: ['s3:GetObject'], Resource: '*' }],
      },
    },
  },
  functions: {
    hello: {
      handler: 'handler.hello',
      events: [{ httpApi: { method: 'GET', path: '/hello' } }, { schedule: 'rate(1 hour)' }],
    },
  },
  custom: { greeting: 'Hello' },
} satisfies AWS;

export default configuration;

export const invalidRuntime: AWS = {
  service: 'typescript-consumer',
  // @ts-expect-error The runtime must be one of the Lambda runtimes
  provider: { name: 'aws', runtime: 'nodejs4.3' },
};

export const invalidProperty: AWS = {
  service: 'typescript-consumer',
  provider: { name: 'aws' },
  // @ts-expect-error Unknown top-level properties are rejected, as by the schema validation
  dashboard: { disableMonitoring: true },
};
