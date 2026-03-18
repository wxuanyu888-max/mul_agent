// Bash 执行工具 - exec
import { exec as execAsync } from 'node:child_process';
import { promisify } from 'node:util';
import { errorResult, jsonResult } from '../types.js';
import { tmuxExec, initTmuxSession } from './tmux.js';

const execPromise = promisify(execAsync);

export interface ExecParams {
  command: string;           // 要执行的命令
  timeout?: number;          // 超时时间（毫秒）
  cwd?: string;              // 工作目录
  env?: Record<string, string>; // 环境变量
  shell?: string;           // 使用的 shell
  useTmux?: boolean;       // 是否使用 tmux 持久化会话
}

export interface ExecResult {
  stdout: string;
  stderr: string;
  returnCode: number;
  timedOut?: boolean;
}

// 初始化 tmux 会话
initTmuxSession('mulagent').catch(console.error);

/**
 * 创建 Bash 执行工具
 */
export function createExecTool() {
  return {
    label: 'Exec',
    name: 'exec',
    description: 'Execute a shell command and return the output. Commands run in a persistent tmux session.',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'The command to execute' },
        timeout: { type: 'number', description: 'Timeout in milliseconds', default: 60000 },
        cwd: { type: 'string', description: 'Working directory' },
        env: { type: 'object', description: 'Environment variables' },
        shell: { type: 'string', description: 'Shell to use (default: system default)' },
        useTmux: { type: 'boolean', description: 'Use tmux session for persistence (default: true)', default: true },
      },
      required: ['command'],
    },
    execute: async (_toolCallId: string, params: ExecParams) => {
      const { command, timeout = 60000, cwd, useTmux = true } = params;

      try {
        let result;

        if (useTmux) {
          // 使用 tmux 持久化会话
          result = await tmuxExec(command, { timeout, cwd });
        } else {
          // 直接执行（原有逻辑）
          const options: any = {
            timeout,
            cwd,
            env: { ...process.env, ...params.env },
          };

          if (params.shell) {
            options.shell = params.shell;
          }

          const { stdout, stderr } = await execPromise(command, options);
          result = {
            stdout: stdout || '',
            stderr: stderr || '',
            returnCode: 0,
          };
        }

        return jsonResult({
          stdout: result.stdout || '',
          stderr: result.stderr || '',
          returnCode: result.returnCode,
          timedOut: result.timedOut,
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
