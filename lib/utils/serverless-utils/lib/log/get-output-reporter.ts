import { EventEmitter } from 'node:events';
import globalState from '../global-state.ts';
import memoizee from 'memoizee';

// Writes text tokens to the output (stdout) in the given mode, eg. `text`
export type OutputWriter = (text?: unknown, ...textTokens: unknown[]) => void;

export interface OutputReporter {
  get: (mode: string) => OutputWriter;
}

const outputEmitter = (() => {
  if (!globalState.outputEmitter) {
    globalState.outputEmitter = new EventEmitter();
    globalState.outputEmitter.setMaxListeners(0);
  }
  return globalState.outputEmitter;
})();

type GetOutputReporter = ((namespace: string) => OutputReporter) & { emitter?: EventEmitter };

const getOutputReporter: GetOutputReporter = memoizee(
  (namespace: string): OutputReporter => {
    return {
      get: memoizee(
        (mode: string): OutputWriter =>
          (text, ...textTokens) => {
            outputEmitter.emit('write', {
              namespace,
              mode,
              textTokens: [text, ...textTokens],
            });
          },
        { primitive: true }
      ),
    };
  },
  { primitive: true }
);

getOutputReporter.emitter = outputEmitter;

export { outputEmitter as emitter };
export default getOutputReporter;
