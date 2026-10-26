import colors from '../utils/colors.ts';
import { log } from '../utils/serverless-utils/log.ts';
import renderHelp from '../cli/render-help/index.ts';
import type Serverless from '../serverless.ts';
import type { PluginInstance } from './plugin-manager.ts';
const { stdoutColors, stderrColors } = colors;

const legacyPluginLog = log.get('plugin-legacy');

// Formatting options of the legacy `serverless.cli.log()`
export interface LegacyLogOptions {
  underline?: boolean;
  bold?: boolean;
  color?: string | null;
}

const formatLegacyMessage = (message: unknown, opts?: LegacyLogOptions) => {
  const { underline = false, bold = false, color = null } = opts || {};
  let text = String(message);

  if (color) {
    text = stderrColors.colorize(text, color);
  }
  if (underline) {
    text = stderrColors.underline(text);
  }
  if (bold) {
    text = stderrColors.bold(text);
  }

  return text;
};

class CLI {
  declare loadedCommands: any;
  declare loadedPlugins: any;
  declare serverless: any;

  constructor(serverless?: Serverless) {
    this.serverless = serverless;
    this.loadedPlugins = [];
    this.loadedCommands = {};
  }

  setLoadedPlugins(plugins: PluginInstance[]) {
    this.loadedPlugins = plugins;
  }

  setLoadedCommands(commands: Record<string, any>) {
    this.loadedCommands = commands;
  }

  displayHelp() {
    if (!this.serverless.processedInput.isHelpRequest) return false;
    renderHelp(this.serverless.pluginManager.externalPlugins, this.serverless.processedInput);
    return true;
  }

  printDot() {
    process.stdout.write(stdoutColors.yellow('.'));
  }

  log(message: unknown, entity?: string, opts?: LegacyLogOptions) {
    const formattedMessage = formatLegacyMessage(message, opts);

    legacyPluginLog.notice(entity ? `${entity}: ${formattedMessage}` : formattedMessage);
  }

  consoleLog(message: unknown) {
    process.stdout.write(`${message}\n`);
  }
}

export default CLI;
