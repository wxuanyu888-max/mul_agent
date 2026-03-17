// CLI 参数解析器
import type { CliArgs, CliOption } from "../types.js";

/**
 * 解析命令行参数
 */
export function parseArgs(argv: string[]): { command: string; args: CliArgs; options: CliArgs } {
  const args: CliArgs = {};
  const options: CliArgs = {};

  let command: string | null = null;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    // 跳过程序名
    if (i === 0) continue;

    // 命令
    if (!arg.startsWith("-") && !command) {
      command = arg;
      continue;
    }

    // 选项 (--option 或 -o)
    if (arg.startsWith("-")) {
      const isLong = arg.startsWith("--");
      const key = isLong ? arg.slice(2) : arg.slice(1);
      const [name, value] = key.split("=");

      // 布尔选项
      if (!value && !argv[i + 1]?.startsWith("-")) {
        options[name] = argv[i + 1] || true;
        i++;
      } else if (!value) {
        options[name] = true;
      } else {
        options[name] = value;
      }
      continue;
    }

    // 位置参数
    if (command) {
      const posKey = `arg${Object.keys(args).length}`;
      args[posKey] = arg;
    }
  }

  return {
    command: command || "",
    args,
    options,
  };
}

/**
 * 验证必需选项
 */
export function validateOptions(options: CliArgs, schema: CliOption[]): { valid: boolean; missing?: string } {
  for (const opt of schema) {
    if (opt.required && !(opt.name in options) && !(opt.short && `-${opt.short}` in options)) {
      return { valid: false, missing: opt.name };
    }
  }
  return { valid: true };
}

/**
 * 合并默认选项
 */
export function withDefaults(options: CliArgs, schema: CliOption[]): CliArgs {
  const result = { ...options };

  for (const opt of schema) {
    if (!(opt.name in result) && opt.default !== undefined) {
      result[opt.name] = opt.default;
    }
  }

  return result;
}
