import createProgressFooter from '../../../../progress-footer.ts';
import { emitter } from '../../log/get-progress-reporter.ts';
import { progress, log } from '../../../log.ts';
import joinTextTokens from '../../log/join-text-tokens.ts';
import style from './style.ts';

// Emitted by the progress reporter (lib/log/get-progress-reporter.ts)
interface ProgressUpdate {
  namespace: string;
  name: string;
  levelIndex: number;
  textTokens: unknown;
  options: Record<string, any> | null;
}

export default ({ logLevelIndex }: { logLevelIndex: number }) => {
  const cliProgressFooter = createProgressFooter();
  cliProgressFooter.shouldAddProgressAnimationPrefix = true;
  cliProgressFooter.progressAnimationPrefixFrames =
    cliProgressFooter.progressAnimationPrefixFrames.map((frame: string) =>
      style.noticeSymbol(frame)
    );

  let mainProgressTextContent: string | undefined;
  let mainProgressIntervalId: ReturnType<typeof setInterval> | undefined;
  let mainProgressStartTime: number | undefined;
  let lastMainEventText: string | undefined;

  let isClosed = false;
  progress.clear = () => {
    isClosed = true;
    clearInterval(mainProgressIntervalId);
    cliProgressFooter.updateProgress();
  };

  const ongoingSubProgress = new Map<string, string>();
  const repaint = () => {
    if (isClosed) {
      return;
    }
    const progressItems: string[] = [];
    if (mainProgressStartTime) {
      progressItems.push(
        `${mainProgressTextContent} ${style.aside(
          `(${Math.floor((Date.now() - mainProgressStartTime) / 1000)}s)`
        )}`
      );
    }
    progressItems.push(...ongoingSubProgress.values());
    cliProgressFooter.updateProgress(progressItems);
  };

  emitter.on('update', ({ namespace, name, levelIndex, textTokens, options }: ProgressUpdate) => {
    if (levelIndex > logLevelIndex) {
      return;
    }
    const textContent = joinTextTokens([textTokens]).slice(0, -1);
    if (namespace === 'serverless' && name === 'main') {
      if (options && options.isMainEvent && lastMainEventText !== textContent) {
        lastMainEventText = textContent;
        log.info(textContent);
      }
      mainProgressTextContent = textContent;
      if (!mainProgressStartTime) {
        mainProgressStartTime = Date.now();
        mainProgressIntervalId = setInterval(repaint, 200);
      }
    } else {
      ongoingSubProgress.set(`${namespace}:${name}`, textContent);
    }
    repaint();
  });
  emitter.on('remove', ({ namespace, name }: { namespace: string; name: string }) => {
    ongoingSubProgress.delete(`${namespace}:${name}`);
    repaint();
  });
};
