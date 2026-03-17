// Bash 执行工具 - exec
import { exec as execAsync } from 'node:child_process';
import { promisify } from 'node:util';
import { errorResult, jsonResult } from '../types.js';

const execPromise = promisify(execAsync);

export interface ExecParams {
  command: string;           // 要执行的命令
  timeout?: number;          // 超时时间（毫秒）
  cwd?: string;              // 工作目录
  env?: Record<string, string>; // 环境变量
  shell?: string;           // 使用的 shell
}

export interface ExecResult {
  stdout: string;
  stderr: string;
  returnCode: number;
  timedOut?: boolean;
}

/**
 * 创建 Bash 执行工具
 */
export function createExecTool() {
  return {
    label: 'Exec',
    name: 'exec',
    description: 'Execute a shell command and return its output.',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'The command to execute' },
        timeout: { type: 'number', description: 'Timeout in milliseconds', default: 60000 },
        cwd: { type: 'string', description: 'Working directory' },
        env: { type: 'object', description: 'Environment variables' },
        shell: { type: 'string', description: 'Shell to use (default: system default)' },
      },
      required: ['command'],
    },
    execute: async (_toolCallId: string, params: ExecParams) => {
      const { command, timeout = 60000, cwd, env, shell } = params;

      try {
        const options: any = {
          timeout,
          cwd,
          env: { ...process.env, ...env },
        };

        if (shell) {
          options.shell = shell;
        }

        const { stdout, stderr } = await execPromise(command, options);

        return jsonResult({
          stdout: stdout || '',
          stderr: stderr || '',
          returnCode: 0,
          command,
        } as ExecResult);
      } catch (error: any) {
        // 超时错误
        if (error.killed || error.signal === 'SIGTERM') {
          return jsonResult({
            stdout: '',
            stderr: 'Command timed out',
            returnCode: -1,
            timedOut: true,
            command,
          } as ExecResult);
        }

        // 命令执行错误
        return jsonResult({
          stdout: error.stdout || '',
          stderr: error.stderr || error.message,
          returnCode: error.code || -1,
          command,
        } as ExecResult);
      }
    },
  };
}
