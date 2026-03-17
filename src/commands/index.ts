// Commands 模块 - 统一导出
export * from "./types.js";
export * from "./registry.js";
export * from "./executor.js";
export * from "./predefined.js";

// 便捷函数 - 快速注册命令
import { globalCommandRegistry, CommandRegistry } from "./registry.js";
import { defaultCommandExecutor, CommandExecutor, executeCommand, listCommands, getCommandHelp } from "./executor.js";
import type { ChatCommandDefinition, CommandHandler, CommandContext, CommandArgs } from "./types.js";

/**
 * 注册一个命令的便捷方法
 */
export function registerCommand(
  definition: ChatCommandDefinition,
  handler: CommandHandler
): void {
  globalCommandRegistry.register(definition, handler);
}

/**
 * 执行命令的便捷方法
 */
export const run = executeCommand;

/**
 * 列出所有命令
 */
export const commands = listCommands;

/**
 * 获取命令帮助
 */
export const help = getCommandHelp;

/**
 * 创建新的命令注册表
 */
export const createCommandRegistry = () => new CommandRegistry();

/**
 * 创建新的命令执行器
 */
export const createCommandExecutor = (options?: { registry?: CommandRegistry }) =>
  new CommandExecutor(options);

// ==================== 预定义命令类别 ====================

export const CommandCategories = {
  session: "session",
  options: "options",
  status: "status",
  management: "management",
  media: "media",
  tools: "tools",
  info: "info",
} as const;

export const CommandScopes = {
  text: "text",
  native: "native",
  both: "both",
} as const;
