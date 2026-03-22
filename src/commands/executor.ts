// Command 执行器 - 处理命令执行
import type {
  ChatCommandDefinition,
  CommandContext,
  CommandHandlerResult,
} from "./types.js";
import { globalCommandRegistry, CommandRegistry } from "./registry.js";

export interface CommandExecutorOptions {
  registry?: CommandRegistry;
}

export class CommandExecutor {
  private registry: CommandRegistry;

  constructor(options: CommandExecutorOptions = {}) {
    this.registry = options.registry || globalCommandRegistry;
  }

  /**
   * 执行命令
   */
  async execute(
    context: CommandContext,
    rawInput: string
  ): Promise<CommandHandlerResult> {
    // 解析命令
    const resolved = this.registry.resolveTextCommand(rawInput);
    if (!resolved) {
      return { shouldContinue: true };
    }

    const command = this.registry.getCommand(resolved.key);
    if (!command) {
      return { shouldContinue: true };
    }

    // 解析参数
    const args = this.registry.parseArgs(command, resolved.args);

    // 获取处理器
    const handler = this.registry.getHandler(resolved.key);
    if (!handler) {
      return { shouldContinue: true };
    }

    try {
      const result = await handler(context, args);
      return result || { shouldContinue: true };
    } catch (error) {
      console.error(`Command error:`, error);
      return {
        shouldContinue: false,
        reply: {
          text: `Command execution failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        },
      };
    }
  }

  /**
   * 列出所有可用命令
   */
  listCommands(): ChatCommandDefinition[] {
    return this.registry.getAllCommands();
  }

  /**
   * 获取命令帮助文本
   */
  getHelpText(key: string): string | undefined {
    const command = this.registry.getCommand(key);
    if (!command) {
      return undefined;
    }

    let help = `/${command.key}: ${command.description}`;

    if (command.args && command.args.length > 0) {
      help += "\n\nArguments:";
      for (const arg of command.args) {
        const required = arg.required ? " (required)" : "";
        help += `\n  ${arg.name}: ${arg.description}${required}`;
      }
    }

    return help;
  }
}

// 延迟初始化默认执行器
let _defaultCommandExecutor: CommandExecutor | null = null;

function getDefaultCommandExecutor(): CommandExecutor {
  if (!_defaultCommandExecutor) {
    _defaultCommandExecutor = new CommandExecutor();
  }
  return _defaultCommandExecutor;
}

// 便捷函数
export const executeCommand = (
  context: CommandContext,
  rawInput: string
): Promise<CommandHandlerResult> =>
  getDefaultCommandExecutor().execute(context, rawInput);

export const listCommands = () => getDefaultCommandExecutor().listCommands();
export const getCommandHelp = (key: string) => getDefaultCommandExecutor().getHelpText(key);
