// 进程管理工具 - process
import { spawn, type ChildProcess } from 'node:child_process';
import { errorResult, jsonResult } from '../types.js';

// 存储运行中的进程
const runningProcesses = new Map<string, ChildProcess>();

export interface ProcessParams {
  action: 'start' | 'list' | 'kill' | 'status';
  command?: string;     // start 时使用
  processId?: string;  // kill/status 时使用
  cwd?: string;        // 工作目录
  env?: Record<string, string>;
}

// 生成简单的进程 ID
function generateProcessId(): string {
  return Math.random().toString(36).substring(2, 9);
}

/**
 * 创建进程管理工具
 */
export function createProcessTool() {
  return {
    label: 'Process',
    name: 'process',
    description: 'Manage background processes - start, list, kill, or check status.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description: 'Action: start, list, kill, status',
          enum: ['start', 'list', 'kill', 'status'],
        },
        command: { type: 'string', description: 'Command to start (for start action)' },
        processId: { type: 'string', description: 'Process ID (for kill/status actions)' },
        cwd: { type: 'string', description: 'Working directory' },
        env: { type: 'object', description: 'Environment variables' },
      },
      required: ['action'],
    },
    execute: async (_toolCallId: string, params: ProcessParams) => {
      const { action, command, processId, cwd, env } = params;

      switch (action) {
        case 'start':
          if (!command) {
            return errorResult('command is required for start action');
          }
          return startProcess(command, cwd, env);

        case 'list':
          return listProcesses();

        case 'kill':
          if (!processId) {
            return errorResult('processId is required for kill action');
          }
          return killProcess(processId);

        case 'status':
          if (!processId) {
            return errorResult('processId is required for status action');
          }
          return getProcessStatus(processId);

        default:
          return errorResult(`Unknown action: ${action}`);
      }
    },
  };
}

function startProcess(command: string, cwd?: string, env?: Record<string, string>): any {
  const processId = generateProcessId();

  const child = spawn(command, [], {
    cwd,
    env: { ...process.env, ...env },
    shell: true,
    detached: false,
  });

  runningProcesses.set(processId, child);

  // 收集输出
  let stdout = '';
  let stderr = '';

  child.stdout?.on('data', (data) => {
    stdout += data.toString();
  });

  child.stderr?.on('data', (data) => {
    stderr += data.toString();
  });

  child.on('exit', (code) => {
    runningProcesses.delete(processId);
  });

  return jsonResult({
    processId,
    command,
    status: 'running',
    startedAt: new Date().toISOString(),
  });
}

function listProcesses(): any {
  const processes = Array.from(runningProcesses.entries()).map(([id, proc]) => ({
    processId: id,
    pid: proc.pid,
    connected: proc.connected,
    killed: proc.killed,
  }));

  return jsonResult({
    processes,
    count: processes.length,
  });
}

function killProcess(processId: string): any {
  const proc = runningProcesses.get(processId);

  if (!proc) {
    return errorResult(`Process not found: ${processId}`);
  }

  proc.kill('SIGTERM');
  runningProcesses.delete(processId);

  return jsonResult({
    processId,
    status: 'killed',
  });
}

function getProcessStatus(processId: string): any {
  const proc = runningProcesses.get(processId);

  if (!proc) {
    return errorResult(`Process not found: ${processId}`);
  }

  return jsonResult({
    processId,
    pid: proc.pid,
    connected: proc.connected,
    killed: proc.killed,
    exited: proc.exitCode !== null,
    exitCode: proc.exitCode,
  });
}
