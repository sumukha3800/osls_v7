// Process-wide values osls keeps on built-ins (they survive several module instances, eg. a
// global installation handing over to a local one)
interface EvalErrorConstructor {
  // `process.hrtime()` of the command start, set by bin/serverless.ts
  $serverlessCommandStartTime?: [number, number];
  // Version of a global installation that handed over to a local one
  $serverlessInitInstallationVersion?: string;
}

// Test bootstrap state shared with the test sandbox (test/mocha)
declare var __SERVERLESS_TEST_BOOTSTRAP__: {
  workerHomeDir: string;
  originalHomedir: () => string;
};
