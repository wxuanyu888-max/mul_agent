// 后台运行工具 - background_run
import { getBackgroundManager } from '../../agents/background.js';
import { errorResult, jsonResult } from '../types.js';

export interface BackgroundRunParams {
  command: string;
  cwd?: string;
  timeout?: number;
}

export interface BackgroundCheckParams {
  task_id: string;
}

export interface BackgroundListParams {
  action: 'list' | 'status';
  task_id?: string;
}

/**
 * 创建后台运行工具
 */
export function createBackgroundRunTool() {
  const bg = getBackgroundManager();

  return {
    label: 'BackgroundRun',
    name: 'background_run',
    description: 'Run a command in the background. Returns immediately with a task ID while the command continues running. Results will be injected before the next LLM call.',
    parameters: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'Command to run in the background',
        },
        cwd: {
          type: 'string',
          description: 'Working directory for the command',
        },
        timeout: {
          type: 'number',
          description: 'Timeout in milliseconds (default: 300000)',
        },
      },
      required: ['command'],
    },
    execute: async (_toolCallId: string, params: BackgroundRunParams) => {
      const { command, cwd, timeout } = params;
      const taskId = bg.run(command, cwd, timeout);

      return jsonResult({
        task_id: taskId,
        command,
        status: 'started',
        message: `Background task ${taskId} started. Results will be injected before the next LLM call.`,
      });
    },
  };
}

/**
 * 创建后台检查工具
 */
export function createBackgroundCheckTool() {
  const bg = getBackgroundManager();

  return {
    label: 'BackgroundCheck',
    name: 'background_check',
    description: 'Check the status of a background task',
    parameters: {
      type: 'object',
      properties: {
        task_id: {
          type: 'string',
          description: 'Task ID to check',
        },
      },
      required: ['task_id'],
    },
    execute: async (_toolCallId: string, params: BackgroundCheckParams) => {
      const { task_id } = params;
      const task = bg.getStatus(task_id);

      if (!task) {
        return errorResult(`Task not found: ${task_id}`);
      }

      return jsonResult({
        task_id: task.id,
        command: task.command,
        status: task.status,
        output: task.output.substring(0, 10000),
        exit_code: task.exitCode,
        started_at: task.startedAt,
        completed_at: task.completedAt,
        error: task.error,
      });
    },
  };
}

/**
 * 创建后台列表工具
 */
export function createBackgroundListTool() {
  const bg = getBackgroundManager();

  return {
    label: 'BackgroundList',
    name: 'background_list',
    description: 'List all background tasks or check status of a specific task',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description: 'Action: list or status',
          enum: ['list', 'status'],
        },
        task_id: {
          type: 'string',
          description: 'Task ID (for status action)',
        },
      },
      required: ['action'],
    },
    execute: async (_toolCallId: string, params: BackgroundListParams) => {
      const { action, task_id } = params;

      if (action === 'status' && task_id) {
        const task = bg.getStatus(task_id);
        if (!task) {
          return errorResult(`Task not found: ${task_id}`);
        }
        return jsonResult({
          task_id: task.id,
          command: task.command,
          status: task.status,
          output: task.output.substring(0, 5000),
          exit_code: task.exitCode,
        });
      }

      // list action
      const tasks = bg.listTasks();
      return jsonResult({
        tasks: tasks.map(t => ({
          task_id: t.id,
          command: t.command,
          status: t.status,
          started_at: t.startedAt,
        })),
        count: tasks.length,
      });
    },
  };
}

/**
 * 创建后台终止工具
 */
export function createBackgroundKillTool() {
  const bg = getBackgroundManager();

  return {
    label: 'BackgroundKill',
    name: 'background_kill',
    description: 'Kill a running background task',
    parameters: {
      type: 'object',
      properties: {
        task_id: {
          type: 'string',
          description: 'Task ID to kill',
        },
      },
      required: ['task_id'],
    },
    execute: async (_toolCallId: string, params: BackgroundCheckParams) => {
      const { task_id } = params;
      const success = bg.kill(task_id);

      if (!success) {
        return errorResult(`Task not found or already completed: ${task_id}`);
      }

      return jsonResult({
        task_id,
        status: 'killed',
        message: `Task ${task_id} has been killed`,
      });
    },
  };
}
