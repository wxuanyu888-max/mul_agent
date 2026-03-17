// Command 注册表 - 管理所有注册的指令
import type {
  ChatCommandDefinition,
  CommandArgs,
  CommandDetection,
  CommandHandler,
  CommandArgsParsing,
  CommandArgValues,
} from "./types.js";

export class CommandRegistry {
  private commands: Map<string, ChatCommandDefinition> = new Map();
  private handlers: Map<string, CommandHandler> = new Map();
  private textAliasMap: Map<string, string> = new Map();

  /**
   * 注册一个命令
   */
  register(definition: ChatCommandDefinition, handler: CommandHandler): void {
    this.commands.set(definition.key, definition);

    // 注册文本别名
    for (const alias of definition.textAliases) {
      const normalized = alias.trim().toLowerCase();
      if (normalized) {
        this.textAliasMap.set(normalized, definition.key);
      }
    }

    // 注册处理器
    this.handlers.set(definition.key, handler);
  }

  /**
   * 注销一个命令
   */
  unregister(key: string): void {
    const command = this.commands.get(key);
    if (command) {
      // 移除文本别名
      for (const alias of command.textAliases) {
        const normalized = alias.trim().toLowerCase();
        this.textAliasMap.delete(normalized);
      }
    }
    this.commands.delete(key);
    this.handlers.delete(key);
  }

  /**
   * 根据 key 获取命令定义
   */
  getCommand(key: string): ChatCommandDefinition | undefined {
    return this.commands.get(key);
  }

  /**
   * 获取所有命令
   */
  getAllCommands(): ChatCommandDefinition[] {
    return Array.from(this.commands.values());
  }

  /**
   * 根据 key 获取处理器
   */
  getHandler(key: string): CommandHandler | undefined {
    return this.handlers.get(key);
  }

  /**
   * 获取所有命令键
   */
  getCommandKeys(): string[] {
    return Array.from(this.commands.keys());
  }

  /**
   * 根据文本别名解析命令
   */
  resolveTextCommand(raw: string): { key: string; args?: string } | null {
    const trimmed = raw.trim();
    if (!trimmed.startsWith("/")) {
      return null;
    }

    const singleLine = trimmed.split("\n")[0].trim();
    const lowered = singleLine.toLowerCase();

    // 检查精确匹配
    if (this.textAliasMap.has(lowered)) {
      const key = this.textAliasMap.get(lowered)!;
      const command = this.commands.get(key);
      if (!command?.acceptsArgs) {
        return { key };
      }
      const args = trimmed.slice(singleLine.length).trim();
      return { key, args: args || undefined };
    }

    // 检查 token 匹配
    const tokenMatch = trimmed.match(/^\/([^\s]+)(?:\s+([\s\S]+))?$/);
    if (!tokenMatch) {
      return null;
    }

    const [, token, rest] = tokenMatch;
    const tokenKey = `/${token.toLowerCase()}`;
    const commandKey = this.textAliasMap.get(tokenKey);

    if (!commandKey) {
      return null;
    }

    const command = this.commands.get(commandKey);
    if (!command?.acceptsArgs) {
      return { key: commandKey };
    }

    const args = rest?.trim();
    return { key: commandKey, args: args || undefined };
  }

  /**
   * 解析命令参数
   */
  parseArgs(
    command: ChatCommandDefinition,
    raw?: string
  ): CommandArgs | undefined {
    const trimmed = raw?.trim();
    if (!trimmed) {
      return undefined;
    }

    if (!command.args || command.argsParsing === "none") {
      return { raw: trimmed };
    }

    return {
      raw: trimmed,
      values: this.parsePositionalArgs(command.args, trimmed),
    };
  }

  /**
   * 解析位置参数
   */
  private parsePositionalArgs(
    definitions: ChatCommandDefinition["args"],
    raw: string
  ): CommandArgValues {
    const values: CommandArgValues = {};
    const tokens = raw.trim().split(/\s+/).filter(Boolean);
    let index = 0;

    for (const definition of definitions || []) {
      if (index >= tokens.length) {
        break;
      }
      if (definition.captureRemaining) {
        values[definition.name] = tokens.slice(index).join(" ");
        break;
      }
      values[definition.name] = tokens[index];
      index++;
    }

    return values;
  }

  /**
   * 构建命令检测器
   */
  buildDetection(): CommandDetection {
    const exact = new Set<string>();
    const patterns: string[] = [];

    for (const command of this.commands.values()) {
      for (const alias of command.textAliases) {
        const normalized = alias.trim().toLowerCase();
        if (!normalized) continue;

        exact.add(normalized);

        const escaped = this.escapeRegExp(normalized);
        if (!escaped) continue;

        if (command.acceptsArgs) {
          patterns.push(`${escaped}(?:\\s+.+|\\s*:\\s*.*)?`);
        } else {
          patterns.push(`${escaped}(?:\\s*:\\s*)?`);
        }
      }
    }

    return {
      exact,
      regex: patterns.length
        ? new RegExp(`^(?:${patterns.join("|")})$`, "i")
        : /$^/,
    };
  }

  /**
   * 转义正则表达式特殊字符
   */
  private escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /**
   * 检查是否有命令注册
   */
  hasCommand(key: string): boolean {
    return this.commands.has(key);
  }

  /**
   * 清空所有命令
   */
  clear(): void {
    this.commands.clear();
    this.handlers.clear();
    this.textAliasMap.clear();
  }

  /**
   * 按类别获取命令
   */
  getCommandsByCategory(category: string): ChatCommandDefinition[] {
    return this.getAllCommands().filter((cmd) => cmd.category === category);
  }
}

// 全局单例
export const globalCommandRegistry = new CommandRegistry();
