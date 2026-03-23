/**
 * Task 工具 - 任务系统
 *
 * 提供 4 个工具：
 * - task_create: 创建任务
 * - task_update: 更新任务状态
 * - task_list: 列出所有任务
 * - task_get: 获取单个任务详情
 */

import { getTaskManager, type Task, type TaskCreateParams, type TaskUpdateParams } from './manager.js';
import { jsonResult, errorResult, type ToolResult } from '../types.js';

export interface TaskTool {
  label: string;
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };
  execute: (toolCallId: string, params: Record<string, unknown>) => Promise<ToolResult>;
}

/**
 * 创建任务工具
 */
export function createTaskCreateTool(): TaskTool {
  return {
    label: 'Task Create',
    name: 'task_create',
    description: 'Create a new task. After created, use write tool to update progress and write summaries.',
    parameters: {
      type: 'object',
      properties: {
        subject: {
          type: 'string',
          description: 'Task title/subject',
        },
        description: {
          type: 'string',
          description: 'Task description (optional)',
        },
        owner: {
          type: 'string',
          description: 'Task owner (optional)',
        },
        blockedBy: {
          type: 'array',
          items: { type: 'number' },
          description: 'Task IDs that this task is blocked by',
        },
        blocks: {
          type: 'array',
          items: { type: 'number' },
          description: 'Task IDs that this task blocks',
        },
      },
      required: ['subject'],
    },
    execute: async (_toolCallId: string, params: Record<string, unknown>) => {
      try {
        const manager = getTaskManager();

        const createParams: TaskCreateParams = {
          subject: params.subject as string,
          description: params.description as string | undefined,
          owner: params.owner as string | undefined,
          blockedBy: params.blockedBy as number[] | undefined,
          blocks: params.blocks as number[] | undefined,
        };

        const task = manager.create(createParams);

        return jsonResult({
          success: true,
          task: formatTask(task),
          message: `Task created with ID: ${task.id}`,
        });
      } catch (error) {
        return errorResult(`Failed to create task: ${error}`);
      }
    },
  };
}

/**
 * 更新任务工具
 */
export function createTaskUpdateTool(): TaskTool {
  return {
    label: 'Task Update',
    name: 'task_update',
    description: 'Update a task: change status, add/remove dependencies, update details.',
    parameters: {
      type: 'object',
      properties: {
        task_id: {
          type: 'number',
          description: 'Task ID to update',
        },
        status: {
          type: 'string',
          enum: ['pending', 'in_progress', 'completed'],
          description: 'New status',
        },
        subject: {
          type: 'string',
          description: 'New task title',
        },
        description: {
          type: 'string',
          description: 'New task description',
        },
        owner: {
          type: 'string',
          description: 'New task owner',
        },
        add_blocked_by: {
          type: 'array',
          items: { type: 'number' },
          description: 'Add blocking dependencies',
        },
        add_blocks: {
          type: 'array',
          items: { type: 'number' },
          description: 'Add blocked dependencies',
        },
        remove_blocked_by: {
          type: 'array',
          items: { type: 'number' },
          description: 'Remove blocking dependencies',
        },
        remove_blocks: {
          type: 'array',
          items: { type: 'number' },
          description: 'Remove blocked dependencies',
        },
      },
      required: ['task_id'],
    },
    execute: async (_toolCallId: string, params: Record<string, unknown>) => {
      try {
        const manager = getTaskManager();

        const updateParams: TaskUpdateParams = {
          task_id: params.task_id as number,
          status: params.status as 'pending' | 'in_progress' | 'completed' | undefined,
          subject: params.subject as string | undefined,
          description: params.description as string | undefined,
          owner: params.owner as string | undefined,
          add_blocked_by: params.add_blocked_by as number[] | undefined,
          add_blocks: params.add_blocks as number[] | undefined,
          remove_blocked_by: params.remove_blocked_by as number[] | undefined,
          remove_blocks: params.remove_blocks as number[] | undefined,
        };

        const task = manager.update(updateParams);

        if (!task) {
          return errorResult(`Task not found: ${params.task_id}`);
        }

        return jsonResult({
          success: true,
          task: formatTask(task),
          message: `Task ${task.id} updated`,
        });
      } catch (error) {
        return errorResult(`Failed to update task: ${error}`);
      }
    },
  };
}

/**
 * 任务列表工具
 */
export function createTaskListTool(): TaskTool {
  return {
    label: 'Task List',
    name: 'task_list',
    description: 'List all tasks, optionally filter by status. Shows dependency relationships.',
    parameters: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['pending', 'in_progress', 'completed', 'all'],
          description: 'Filter by status (default: all)',
        },
        include_blocked: {
          type: 'boolean',
          description: 'Include blocked task count (default: true)',
          default: true,
        },
      },
      required: [],
    },
    execute: async (_toolCallId: string, params: Record<string, unknown>) => {
      try {
        const manager = getTaskManager();

        const status = params.status as string | undefined;
        let tasks = manager.list();

        // 按状态过滤
        if (status && status !== 'all') {
          tasks = tasks.filter(t => t.status === status);
        }

        // 获取统计信息
        const stats = manager.getStats();

        return jsonResult({
          tasks: tasks.map(formatTask),
          stats: {
            total: stats.total,
            pending: stats.pending,
            in_progress: stats.inProgress,
            completed: stats.completed,
            blocked: stats.blocked,
          },
          message: `Found ${tasks.length} tasks`,
        });
      } catch (error) {
        return errorResult(`Failed to list tasks: ${error}`);
      }
    },
  };
}

/**
 * 获取单个任务工具
 */
export function createTaskGetTool(): TaskTool {
  return {
    label: 'Task Get',
    name: 'task_get',
    description: 'Get detailed information about a specific task, including dependencies.',
    parameters: {
      type: 'object',
      properties: {
        task_id: {
          type: 'number',
          description: 'Task ID to retrieve',
        },
      },
      required: ['task_id'],
    },
    execute: async (_toolCallId: string, params: Record<string, unknown>) => {
      try {
        const manager = getTaskManager();
        const taskId = params.task_id as number;

        const task = manager.get(taskId);

        if (!task) {
          return errorResult(`Task not found: ${taskId}`);
        }

        // 获取依赖任务的详细信息
        const blockedByTasks = task.blockedBy
          .map(id => manager.get(id))
          .filter((t): t is Task => t !== null);

        const blockedTasks = task.blocks
          .map(id => manager.get(id))
          .filter((t): t is Task => t !== null);

        return jsonResult({
          task: formatTask(task),
          blockedBy: blockedByTasks.map(t => ({ id: t.id, subject: t.subject, status: t.status })),
          blocks: blockedTasks.map(t => ({ id: t.id, subject: t.subject, status: t.status })),
          isRunnable: task.status === 'pending' && task.blockedBy.length === 0,
          message: `Task ${taskId} details`,
        });
      } catch (error) {
        return errorResult(`Failed to get task: ${error}`);
      }
    },
  };
}

/**
 * 格式化任务输出
 */
function formatTask(task: Task): object {
  return {
    id: task.id,
    subject: task.subject,
    description: task.description,
    status: task.status,
    blockedBy: task.blockedBy,
    blocks: task.blocks,
    owner: task.owner,
    createdAt: new Date(task.createdAt).toISOString(),
    updatedAt: new Date(task.updatedAt).toISOString(),
  };
}
