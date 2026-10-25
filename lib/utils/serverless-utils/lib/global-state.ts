import type { EventEmitter } from 'node:events';
import type { LogStyle } from '../log.ts';

// State shared by every copy of this module loaded in the process
interface GlobalState {
  // The "serverless" namespace logger of the `log` package
  log?: any;
  logStyle?: LogStyle;
  logLevelIndex?: number;
  logIsInteractive?: boolean | string;
  outputEmitter?: EventEmitter;
  progressEmitter?: EventEmitter;
}

const globalStateSymbol = Symbol.for('serverless/serverless/202110');

if (!Object.prototype.hasOwnProperty.call(globalThis, globalStateSymbol)) {
  Object.defineProperty(globalThis, globalStateSymbol, {
    value: Object.create(null),
  });
}

export default (globalThis as Record<symbol, GlobalState>)[globalStateSymbol];
