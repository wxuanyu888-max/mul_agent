// Task 工具 - 派发子任务给子智能体
import { jsonResult, errorResult, type ToolResult } from './types.js';

/**
 * Tool 定义接口
 */
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
 * Task 工具参数
 */
export interface TaskParams {
  /** 子任务描述 */
  prompt: string;
  /** 子任务名称（可选） */
  name?: string;
  /** 最大迭代次数（可选） */
  maxIterations?: number;
}

/**
 * 创建 Task 工具
 * 用于派发子任务给子智能体，返回摘要结果
 */
export function createTaskTool(): TaskTool {
  return {
    label: 'Task',
    name: 'task',
    description: 'Spawn a subagent with fresh context to handle a subtask. Use this to delegate work to a separate agent with its own clean message history.',
    parameters: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'The task description for the subagent to execute',
        },
        name: {
          type: 'string',
          description: 'Optional name for the subagent task',
        },
        maxIterations: {
          type: 'number',
          description: 'Maximum iterations for the subagent (default: 20)',
          default: 20,
        },
      },
      required: ['prompt'],
    },
    execute: async (_toolCallId: string, params: Record<string, unknown>) => {
      try {
        // 动态导入以避免循环依赖
        const { runSubagent } = await import('../agents/subagent.js');

        const taskParams = params as unknown as TaskParams;
        const result = await runSubagent({
          prompt: taskParams.prompt,
          name: taskParams.name,
          maxIterations: taskParams.maxIterations ?? 20,
        });

        return jsonResult({
          success: true,
          result: result.content,
          iterations: result.iterations,
          toolCalls: result.toolCalls,
        });
      } catch (error) {
        return errorResult(`Subagent failed: ${error}`);
      }
    },
  };
}

/**
 * 判断是否为 task 工具
 */
export function isTaskTool(tool: TaskTool): boolean {
  return tool.name === 'task';
}
