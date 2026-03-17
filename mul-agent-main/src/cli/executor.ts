// CLI 执行器
import { CliRegistry, globalCliRegistry } from "./registry.js";
import { parseArgs, validateOptions, withDefaults } from "./parsers/argv.js";
import type { CliContext, CliArgs, CliCommand } from "./types.js";

export interface CliExecutorOptions {
  registry?: CliRegistry;
}

export class CliExecutor {
  private registry: CliRegistry;

  constructor(options: CliExecutorOptions = {}) {
    this.registry = options.registry || globalCliRegistry;
  }

  /**
   * 执行 CLI 命令
   */
  async execute(argv: string[], context?: Partial<CliContext>): Promise<void> {
    const ctx: CliContext = {
      cwd: context?.cwd || process.cwd(),
      env: context?.env || process.env,
      stdin: context?.stdin || process.stdin,
      stdout: context?.stdout || process.stdout,
      stderr: context?.stderr || process.stderr,
    };

    // 解析参数
    const { command, args, options } = parseArgs(argv);

    // 查找命令
    const cmd = this.registry.get(command);
    if (!cmd) {
      ctx.stderr.write(`Error: Unknown command '${command}'\n`);
      this.printHelp(ctx.stderr);
      process.exit(1);
    }

    // 验证选项
    if (cmd.options) {
      const validation = validateOptions(options, cmd.options);
      if (!validation.valid) {
        ctx.stderr.write(`Error: Missing required option '${validation.missing}'\n`);
        process.exit(1);
      }
    }

    // 合并默认选项
    const mergedOptions = cmd.options
      ? withDefaults(options, cmd.options)
      : options;

    try {
      await cmd.action(args, mergedOptions, ctx);
    } catch (error) {
      ctx.stderr.write(`Error: ${error}\n`);
      process.exit(1);
    }
  }

  /**
   * 打印帮助信息
   */
  printHelp(stream: NodeJS.WritableStream = process.stdout): void {
    const commands = this.registry.getAll();

    stream.write("Available commands:\n\n");

    for (const cmd of commands) {
      const alias = cmd.aliases ? ` (${cmd.aliases.join(", ")})` : "";
      stream.write(`  ${cmd.name}${alias} - ${cmd.description}\n`);

      if (cmd.options) {
        for (const opt of cmd.options) {
          const short = opt.short ? `-${opt.short}, ` : "  ";
          const required = opt.required ? " (required)" : "";
          stream.write(`      ${short}--${opt.name}${required}: ${opt.description || ""}\n`);
        }
      }
    }

    stream.write("\n");
  }
}

// 默认执行器
export const defaultCliExecutor = new CliExecutor();
