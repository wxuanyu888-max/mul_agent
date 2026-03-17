// 预定义的 Command Handlers
import type { ChatCommandDefinition, CommandHandler, CommandArgs, CommandContext } from "./types.js";

/**
 * 创建通用命令处理器
 */
export function createCommandHandler(
  key: string,
  description: string,
  handler: (context: CommandContext, args?: CommandArgs) => Promise<{ text: string } | void>,
  options: {
    aliases?: string[];
    args?: ChatCommandDefinition["args"];
    argsParsing?: ChatCommandDefinition["argsParsing"];
    scope?: ChatCommandDefinition["scope"];
    category?: ChatCommandDefinition["category"];
  } = {}
): { definition: ChatCommandDefinition; handler: CommandHandler } {
  const definition: ChatCommandDefinition = {
    key,
    description,
    textAliases: options.aliases || [`/${key}`],
    acceptsArgs: Boolean(options.args?.length),
    args: options.args,
    argsParsing: options.argsParsing || "none",
    scope: options.scope || "text",
    category: options.category || "info",
  };

  const commandHandler: CommandHandler = async (context, args) => {
    const result = await handler(context, args);
    if (!result) {
      return { shouldContinue: true };
    }
    return {
      shouldContinue: false,
      reply: { text: result.text },
    };
  };

  return { definition, handler: commandHandler };
}

// ==================== 常用命令工厂函数 ====================

/**
 * 帮助命令
 */
export function createHelpCommand(
  getCommands: () => ChatCommandDefinition[]
): { definition: ChatCommandDefinition; handler: CommandHandler } {
  return createCommandHandler(
    "help",
    "Show available commands",
    async () => {
      const commands = getCommands();
      const lines = ["Available commands:"];
      for (const cmd of commands) {
        lines.push(`  /${cmd.key} - ${cmd.description}`);
      }
      return { text: lines.join("\n") };
    },
    { aliases: ["/help", "/h"], category: "info" }
  );
}

/**
 * 状态命令
 */
export function createStatusCommand(
  getStatus: () => Promise<Record<string, any>>
): { definition: ChatCommandDefinition; handler: CommandHandler } {
  return createCommandHandler(
    "status",
    "Show agent status",
    async () => {
      const status = await getStatus();
      return { text: JSON.stringify(status, null, 2) };
    },
    { category: "status" }
  );
}

/**
 * 内存命令 - 查看记忆
 */
export function createMemoryCommand(
  recallFn: (query: string) => Promise<string[]>
): { definition: ChatCommandDefinition; handler: CommandHandler } {
  return createCommandHandler(
    "memory",
    "Search and recall memories",
    async (_, args) => {
      const query = args?.values?.query as string || "";
      const memories = await recallFn(query);
      if (memories.length === 0) {
        return { text: "No memories found." };
      }
      return { text: memories.join("\n\n") };
    },
    {
      args: [{ name: "query", description: "Search query", type: "string" }],
      argsParsing: "positional",
    }
  );
}

/**
 * 历史命令 - 查看会话历史
 */
export function createHistoryCommand(
  getHistory: (sessionId: string, limit?: number) => Promise<string[]>
): { definition: ChatCommandDefinition; handler: CommandHandler } {
  return createCommandHandler(
    "history",
    "View session message history",
    async (context, args) => {
      const sessionId = context.sessionId || "default";
      const limit = (args?.values?.limit as number) || 10;
      const history = await getHistory(sessionId, limit);
      if (history.length === 0) {
        return { text: "No history found." };
      }
      return { text: history.join("\n\n---\n\n") };
    },
    {
      args: [{ name: "limit", description: "Number of messages", type: "number" }],
      argsParsing: "positional",
    }
  );
}

/**
 * 技能命令 - 列出可用技能
 */
export function createSkillsCommand(
  getSkills: () => Promise<Array<{ name: string; description: string }>>
): { definition: ChatCommandDefinition; handler: CommandHandler } {
  return createCommandHandler(
    "skills",
    "List available skills",
    async () => {
      const skills = await getSkills();
      if (skills.length === 0) {
        return { text: "No skills available." };
      }
      const lines = ["Available skills:"];
      for (const skill of skills) {
        lines.push(`  - ${skill.name}: ${skill.description}`);
      }
      return { text: lines.join("\n") };
    },
    { category: "info" }
  );
}

/**
 * 重置命令 - 重置会话
 */
export function createResetCommand(
  resetFn: (sessionId: string) => Promise<void>
): { definition: ChatCommandDefinition; handler: CommandHandler } {
  return createCommandHandler(
    "reset",
    "Reset the current session",
    async (context) => {
      const sessionId = context.sessionId || "default";
      await resetFn(sessionId);
      return { text: "Session reset successfully." };
    },
    {
      aliases: ["/reset", "/new"],
      category: "session",
    }
  );
}

/**
 * 停止命令 - 停止当前操作
 */
export function createStopCommand(
  stopFn: (sessionId: string) => Promise<void>
): { definition: ChatCommandDefinition; handler: CommandHandler } {
  return createCommandHandler(
    "stop",
    "Stop current operation",
    async (context) => {
      const sessionId = context.sessionId || "default";
      await stopFn(sessionId);
      return { text: "Operation stopped." };
    },
    { category: "session" }
  );
}
