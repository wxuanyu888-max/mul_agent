// CLI 命令注册表
import type { CliCommand, CliAction, CliArgs } from "./types.js";

export class CliRegistry {
  private commands: Map<string, CliCommand> = new Map();

  /**
   * 注册命令
   */
  register(command: CliCommand): void {
    this.commands.set(command.name, command);

    // 注册别名
    if (command.aliases) {
      for (const alias of command.aliases) {
        this.commands.set(alias, command);
      }
    }
  }

  /**
   * 获取命令
   */
  get(name: string): CliCommand | undefined {
    return this.commands.get(name);
  }

  /**
   * 获取所有命令
   */
  getAll(): CliCommand[] {
    // 返回唯一的命令（不重复别名）
    const seen = new Set<string>();
    const unique: CliCommand[] = [];

    for (const cmd of this.commands.values()) {
      if (!seen.has(cmd.name)) {
        seen.add(cmd.name);
        unique.push(cmd);
      }
    }

    return unique;
  }

  /**
   * 检查命令是否存在
   */
  has(name: string): boolean {
    return this.commands.has(name);
  }

  /**
   * 列出所有可用命令
   */
  listCommands(): string[] {
    return Array.from(this.commands.keys());
  }

  /**
   * 注销命令
   */
  unregister(name: string): void {
    const command = this.commands.get(name);
    if (command) {
      this.commands.delete(name);
      // 移除别名
      if (command.aliases) {
        for (const alias of command.aliases) {
          this.commands.delete(alias);
        }
      }
    }
  }
}

// 全局单例
export const globalCliRegistry = new CliRegistry();
