// Bash 执行工具 - exec
import { exec as execAsync } from 'node:child_process';
import { promisify } from 'node:util';
import { jsonResult } from '../types.js';
import { initTmuxSession, tmuxExec } from './tmux.js';

const execPromise = promisify(execAsync);

export interface ExecParams {
  command: string;           // 要执行的命令
  timeout?: number;          // 超时时间（毫秒）
  cwd?: string;              // 工作目录
  env?: Record<string, string>; // 环境变量
  shell?: string;           // 使用的 shell
  useTmux?: boolean;       // 是否使用 tmux 持久化会话
}

export interface ExecOptions {
  timeout?: number;
  cwd?: string;
  env?: Record<string, string>;
  shell?: string;
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
    description: 'Execute a shell command and return the output. Use when you need to run system commands, git operations, npm scripts, file operations, or any command-line tasks. Commands run in a persistent tmux session for state retention.',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Shell command to execute. Examples: "ls -la", "git status", "npm run build", "pnpm install"' },
        timeout: { type: 'number', description: 'Timeout in milliseconds (default: 60000 = 60 seconds). Use for long-running commands.', default: 60000 },
        cwd: { type: 'string', description: 'Working directory for the command (default: current directory)' },
        env: { type: 'object', description: 'Additional environment variables to set for this command' },
        shell: { type: 'string', description: 'Shell to use (default: system default, usually /bin/zsh or /bin/bash)' },
        useTmux: { type: 'boolean', description: 'Use tmux session for persistence (default: true). Set false for one-off commands.', default: true },
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
          const options: ExecOptions = {
            timeout,
            cwd,
            env: { ...process.env, ...params.env } as Record<string, string>,
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
      } catch (error: unknown) {
        // 超时错误
        const err = error as { killed?: boolean; signal?: string; stdout?: string; stderr?: string; message?: string; code?: number };
        if (err.killed || err.signal === 'SIGTERM') {
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
          stdout: err.stdout || '',
          stderr: err.stderr || err.message || 'Unknown error',
          returnCode: err.code || -1,
          command,
        } as ExecResult);
      }
    },
  };
}
