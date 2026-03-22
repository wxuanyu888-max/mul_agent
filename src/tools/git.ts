/**
 * Git Tool - 提供 Git 操作能力
 *
 * 支持：status, diff, commit, push, pull, branch, checkout, log, add
 */

import { jsonResult, errorResult } from './types.js';

export interface GitParams {
  command: 'status' | 'diff' | 'commit' | 'push' | 'pull' | 'branch' | 'checkout' | 'log' | 'add' | 'fetch';
  message?: string;
  branch?: string;
  file?: string;
  all?: boolean;
  cwd?: string;
}

function runGit(args: string[], cwd?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const { execSync } = require('child_process');
    try {
      const result = execSync(`git ${args.join(' ')}`, {
        cwd: cwd || process.cwd(),
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      resolve(result);
    } catch (error: any) {
      reject(new Error(error.stdout || error.message));
    }
  });
}

export function createGitTool() {
  return {
    label: 'Git',
    name: 'git',
    description: '执行 Git 操作：status, diff, commit, push, pull, branch, checkout, log, add, fetch',
    parameters: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          enum: ['status', 'diff', 'commit', 'push', 'pull', 'branch', 'checkout', 'log', 'add', 'fetch'],
          description: 'Git 命令',
        },
        message: {
          type: 'string',
          description: '提交信息 (用于 commit)',
        },
        branch: {
          type: 'string',
          description: '分支名 (用于 checkout/branch)',
        },
        file: {
          type: 'string',
          description: '指定文件 (用于 add/diff)',
        },
        all: {
          type: 'boolean',
          description: '是否暂存所有文件 (用于 add)',
          default: false,
        },
        cwd: {
          type: 'string',
          description: '工作目录 (可选)',
        },
      },
      required: ['command'],
    },
    permission: 'main' as const,
    execute: async (_toolCallId: string, params: Record<string, unknown>) => {
      try {
        const command = params.command as GitParams['command'];
        const message = params.message as string | undefined;
        const branch = params.branch as string | undefined;
        const file = params.file as string | undefined;
        const all = params.all as boolean | undefined;
        const cwd = params.cwd as string | undefined;

        let result: string;
        const args: string[] = [];
        const workDir = cwd || process.cwd();

        switch (command) {
          case 'status':
            result = await runGit(['status', '--short'], workDir);
            break;

          case 'diff':
            if (file) {
              result = await runGit(['diff', '--', file], workDir);
            } else {
              result = await runGit(['diff', '--stat'], workDir);
            }
            break;

          case 'add':
            if (all) {
              result = await runGit(['add', '-A'], workDir);
              result = 'Added all files';
            } else if (file) {
              result = await runGit(['add', file], workDir);
              result = `Added: ${file}`;
            } else {
              result = await runGit(['add', '-i'], workDir);
            }
            break;

          case 'commit':
            if (!message) {
              return errorResult('Commit message is required');
            }
            result = await runGit(['commit', '-m', message], workDir);
            break;

          case 'push':
            result = await runGit(['push'], workDir);
            break;

          case 'pull':
            result = await runGit(['pull'], workDir);
            break;

          case 'fetch':
            result = await runGit(['fetch', '--all'], workDir);
            break;

          case 'branch':
            if (branch) {
              result = await runGit(['checkout', '-b', branch], workDir);
              result = `Created and switched to branch: ${branch}`;
            } else {
              result = await runGit(['branch', '-v'], workDir);
            }
            break;

          case 'checkout':
            if (!branch) {
              return errorResult('Branch name is required for checkout');
            }
            result = await runGit(['checkout', branch], workDir);
            break;

          case 'log':
            result = await runGit(['log', '--oneline', '-10'], workDir);
            break;

          default:
            return errorResult(`Unknown command: ${command}`);
        }

        return jsonResult({ output: result || 'Command executed successfully' });
      } catch (error: any) {
        return errorResult(error.message || String(error));
      }
    },
  };
}
