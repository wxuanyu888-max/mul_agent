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
  default?: any;
  required?: boolean;
}

export type CliAction = (args: CliArgs, options: CliOptions) => Promise<void> | void;

export interface CliArgs {
  [key: string]: any;
}

export interface CliContext {
  cwd: string;
  env: Record<string, string>;
  stdin: NodeJS.ReadableStream;
  stdout: NodeJS.WritableStream;
  stderr: NodeJS.WritableStream;
}
