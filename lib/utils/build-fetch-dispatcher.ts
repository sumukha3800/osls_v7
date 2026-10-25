import { EnvHttpProxyAgent, ProxyAgent } from 'undici';
import { getCACertificates } from '../aws/config.ts';

// Dispatcher for the framework's plain fetch() calls, mirroring the proxy and custom CA
// configuration that AWS SDK clients receive. Built per call so environment changes are
// honored.
// The global fetch() types come from undici-types, a different version of undici than the
// dependency, so the agents are cast to the dispatcher type fetch() expects
type FetchDispatcher = RequestInit['dispatcher'];

export default (): FetchDispatcher => {
  const caCerts = getCACertificates();
  const tlsOptions = caCerts.length > 0 ? { ca: caCerts } : undefined;
  const agentOptions = tlsOptions
    ? { connect: tlsOptions, proxyTls: tlsOptions, requestTls: tlsOptions }
    : {};

  // The nonstandard lowercase `proxy` variable is not understood by undici; honor it the
  // same way AWS client configuration does
  if (process.env.proxy) {
    return new ProxyAgent({ ...agentOptions, uri: process.env.proxy }) as FetchDispatcher;
  }

  // Standard HTTP_PROXY / HTTPS_PROXY / NO_PROXY environment handling
  return new EnvHttpProxyAgent(agentOptions) as FetchDispatcher;
};
