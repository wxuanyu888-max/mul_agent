// CLI 模块 - 统一导出
export * from "./types.js";
export * from "./registry.js";
export * from "./executor.js";
export * from "./parsers/argv.js";
export * from "./commands/index.js";

// 便捷函数
import { CliRegistry, globalCliRegistry } from "./registry.js";
import { CliExecutor, defaultCliExecutor } from "./executor.js";

/**
 * 注册命令的便捷方法
 */
export function registerCommand(command: import("./types.js").CliCommand): void {
  globalCliRegistry.register(command);
}

/**
 * 执行 CLI
 */
export const run = (argv: string[]) => defaultCliExecutor.execute(argv);

/**
 * 打印帮助
 */
export const help = () => defaultCliExecutor.printHelp();

/**
 * 创建新的 CLI 注册表
 */
export const createCliRegistry = () => new CliRegistry();

/**
 * 创建新的 CLI 执行器
 */
export const createCliExecutor = (options?: { registry?: CliRegistry }) =>
  new CliExecutor(options);

// CLI 主入口
export interface CliMainOptions {
  name: string;
  version: string;
  description?: string;
  commands?: import("./types.js").CliCommand[];
}

/**
 * 创建 CLI 应用
 */
export function createCli(options: CliMainOptions) {
  const { name, version, description: _description, commands = [] } = options;

  // 注册命令
  for (const cmd of commands) {
    globalCliRegistry.register(cmd);
  }

  // 返回运行函数
  return {
    run: (argv: string[]) => {
      // 自动添加 help 和 version 命令
      if (argv.includes("--help") || argv.includes("-h")) {
        defaultCliExecutor.printHelp();
        return;
      }

      if (argv.includes("--version") || argv.includes("-v")) {
        console.log(`${name} v${version}`);
        return;
      }

      defaultCliExecutor.execute(argv);
    },
    registry: globalCliRegistry,
    executor: defaultCliExecutor,
  };
}
