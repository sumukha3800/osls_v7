import deepSortObjectByKey from '../../../../utils/deep-sort-object-by-key.ts';
import promiseLimit2 from 'ext/promise/limit.js';

const promiseLimit = promiseLimit2.bind(Promise);

const maxConcurrentVariableSourceCommands = 2;

// `undefined` falls back to the provider region
type Region = string | null | undefined;

// What the sources need from the `Serverless` instance
export interface AwsProviderHost {
  getProvider: (name: 'aws') => any;
}

function normalizeRegion(region: Region) {
  return region === undefined ? null : region;
}

function getCommandName(Command: { name: string }) {
  return Command.name || 'Command';
}

function createCacheKey({
  commandName,
  region,
  input,
}: {
  commandName: string;
  region: Region;
  input: unknown;
}) {
  return JSON.stringify({
    command: commandName,
    region: normalizeRegion(region),
    input: input === undefined ? null : deepSortObjectByKey(input),
  });
}

interface TransformResultInput {
  result: any;
  commandName: string;
  input: unknown;
  region: Region;
  effectiveRegion: string | null;
}

interface CommandSenderOptions {
  // Returns the AWS provider plugin instance
  getProvider: () => any;
  // An AWS SDK v3 client class
  Client: new (config: any) => { send: (command: any) => Promise<any> };
  clientOptions?: Record<string, unknown>;
  transformResult?: (input: TransformResultInput) => unknown;
}

function createCachedAwsVariableSourceCommandSender({
  getProvider,
  Client,
  clientOptions,
  transformResult = ({ result }) => result,
}: CommandSenderOptions) {
  const clients = new Map<string, Promise<{ send: (command: any) => Promise<any> }>>();
  const requests = new Map<string, Promise<any>>();
  const sendQueue = promiseLimit(maxConcurrentVariableSourceCommands, async (task) => task());
  let provider: ReturnType<CommandSenderOptions['getProvider']>;

  function resolveProvider() {
    if (!provider) provider = getProvider();
    return provider;
  }

  function getEffectiveRegion(region: Region): string | null {
    return region === undefined ? resolveProvider().getRegion() : region;
  }

  async function getClient(region: string | null) {
    const cacheKey = JSON.stringify({ region: normalizeRegion(region) });

    if (!clients.has(cacheKey)) {
      const clientPromise = (async () => {
        const config = await resolveProvider().getAwsSdkV3Config({ region, ...clientOptions });
        return new Client(config);
      })();

      clients.set(
        cacheKey,
        clientPromise.catch((error) => {
          clients.delete(cacheKey);
          throw error;
        })
      );
    }

    return clients.get(cacheKey)!;
  }

  // Resolves with the result of `transformResult()`
  async function send(
    Command: new (input: any) => unknown,
    input: unknown,
    options: { region?: Region } = {}
  ): Promise<any> {
    const { region } = options;
    const effectiveRegion = getEffectiveRegion(region);
    const commandName = getCommandName(Command);
    const cacheKey = createCacheKey({
      commandName,
      region: effectiveRegion,
      input,
    });

    if (!requests.has(cacheKey)) {
      const requestPromise = (async () => {
        const client = await getClient(effectiveRegion);

        return sendQueue(async () => {
          const result = await client.send(new Command(input));
          return transformResult({
            result,
            commandName,
            input,
            region,
            effectiveRegion,
          });
        });
      })();

      requests.set(
        cacheKey,
        requestPromise.catch((error) => {
          requests.delete(cacheKey);
          throw error;
        })
      );
    }

    return requests.get(cacheKey);
  }

  return { send };
}

export default createCachedAwsVariableSourceCommandSender;
