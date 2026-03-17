// 预定义 CLI 命令
import type { CliCommand, CliArgs, CliContext } from "../types.js";

/**
 * 创建帮助命令
 */
export function createHelpCommand(getCommands: () => CliCommand[]): CliCommand {
  return {
    name: "help",
    description: "Show help information",
    aliases: ["h", "?"],
    action: async (_args: CliArgs, _options: CliArgs, ctx: CliContext) => {
      const commands = getCommands();
      ctx.stdout.write("Available commands:\n\n");

      for (const cmd of commands) {
        const alias = cmd.aliases ? ` (${cmd.aliases.join(", ")})` : "";
        ctx.stdout.write(`  ${cmd.name}${alias} - ${cmd.description}\n`);
      }

      ctx.stdout.write("\n");
    },
  };
}

/**
 * 创建版本命令
 */
export function createVersionCommand(version: string): CliCommand {
  return {
    name: "version",
    description: "Show version information",
    aliases: ["v"],
    action: async (_args: CliArgs, _options: CliArgs, ctx: CliContext) => {
      ctx.stdout.write(`Version: ${version}\n`);
    },
  };
}

/**
 * 创建状态命令
 */
export function createStatusCommand(
  getStatus: () => Promise<Record<string, any>>
): CliCommand {
  return {
    name: "status",
    description: "Show agent status",
    action: async (_args: CliArgs, _options: CliArgs, ctx: CliContext) => {
      const status = await getStatus();
      ctx.stdout.write(JSON.stringify(status, null, 2) + "\n");
    },
  };
}

/**
 * 创建启动命令
 */
export function createStartCommand(
  startAgent: (options: CliArgs) => Promise<void>
): CliCommand {
  return {
    name: "start",
    description: "Start the agent",
    aliases: ["run"],
    options: [
      { name: "prompt", short: "p", description: "Initial prompt", type: "string" },
      { name: "model", short: "m", description: "Model to use", type: "string" },
    ],
    action: async (args: CliArgs, options: CliArgs, ctx: CliContext) => {
      ctx.stdout.write("Starting agent...\n");
      await startAgent({ ...args, ...options });
      ctx.stdout.write("Agent started.\n");
    },
  };
}

/**
 * 创建停止命令
 */
export function createStopCommand(
  stopAgent: () => Promise<void>
): CliCommand {
  return {
    name: "stop",
    description: "Stop the agent",
    aliases: ["kill"],
    action: async (_args: CliArgs, _options: CliArgs, ctx: CliContext) => {
      ctx.stdout.write("Stopping agent...\n");
      await stopAgent();
      ctx.stdout.write("Agent stopped.\n");
    },
  };
}

/**
 * 创建列表命令
 */
export function createListCommand(
  listItems: (type: string) => Promise<string[]>
): CliCommand {
  return {
    name: "list",
    description: "List items (sessions, agents, etc.)",
    aliases: ["ls"],
    options: [
      {
        name: "type",
        short: "t",
        description: "Type to list (sessions, agents, tools)",
        type: "string",
        default: "sessions",
      },
    ],
    action: async (_args: CliArgs, options: CliArgs, ctx: CliContext) => {
      const type = (options.type as string) || "sessions";
      const items = await listItems(type);

      if (items.length === 0) {
        ctx.stdout.write(`No ${type} found.\n`);
        return;
      }

      for (const item of items) {
        ctx.stdout.write(`  ${item}\n`);
      }
    },
  };
}
