// CLI 类型定义

export interface CliOptions {
  name: string;
  version: string;
  description?: string;
}

export interface CliCommand {
  name: string;
  description: string;
  aliases?: string[];
  options?: CliOption[];
  action: CliAction;
}

export interface CliOption {
  name: string;
  short?: string;
  description?: string;
  type: "string" | "number" | "boolean";
  default?: string | number | boolean;
  required?: boolean;
}

export type CliAction = (args: CliArgs, options: CliArgs, context: CliContext) => Promise<void> | void;

export interface CliArgs {
  [key: string]: string | number | boolean | undefined;
}

export interface CliContext {
  cwd: string;
  env: Record<string, string>;
  stdin: NodeJS.ReadableStream;
  stdout: NodeJS.WritableStream;
  stderr: NodeJS.WritableStream;
}
