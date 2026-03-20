/**
 * Subagent 子智能体模块
 *
 * 实现子智能体管理：
 * 1. 子智能体拥有独立的 messages[] 上下文
 * 2. 子智能体只能使用基础工具（不含 task，避免递归）
 * 3. 子智能体运行完成后只返回摘要文本给父智能体
 */

import { createAgentLoop, type AgentLoop, type AgentLoopConfig } from './loop.js';
import { createDefaultTools } from '../tools/index.js';
import { isTaskTool, type TaskTool } from '../tools/task.js';

export interface SubagentConfig {
  /** 子任务描述 */
  prompt: string;
  /** 子任务名称 */
  name?: string;
  /** 最大迭代次数 */
  maxIterations?: number;
  /** 工作目录 */
  workspaceDir?: string;
}

export interface SubagentResult {
  /** 返回的摘要内容 */
  content: string;
  /** 是否成功 */
  success: boolean;
  /** 迭代次数 */
  iterations: number;
  /** 工具调用次数 */
  toolCalls: number;
  /** 错误信息 */
  error?: string;
}

/**
 * 子智能体管理器
 */
class SubagentManager {
  private static instance: SubagentManager;
  private subagents: Map<string, AgentLoop> = new Map();
  private counter = 0;

  private constructor() {}

  static getInstance(): SubagentManager {
    if (!SubagentManager.instance) {
      SubagentManager.instance = new SubagentManager();
    }
    return SubagentManager.instance;
  }

  /**
   * 创建并运行子智能体
   */
  async run(config: SubagentConfig): Promise<SubagentResult> {
    const subagentId = this.generateId(config.name);

    try {
      // 创建子智能体的 AgentLoop（独立上下文）
      const subagentLoop = await this.createSubagent(subagentId, config);
      this.subagents.set(subagentId, subagentLoop);

      // 运行子智能体
      const result = await subagentLoop.run({
        message: config.prompt,
      });

      // 清理子智能体
      this.subagents.delete(subagentId);

      return {
        content: result.content,
        success: result.success,
        iterations: result.iterations,
        toolCalls: result.toolCalls,
        error: result.error,
      };
    } catch (error) {
      // 清理子智能体（即使出错）
      this.subagents.delete(subagentId);

      return {
        content: '',
        success: false,
        iterations: 0,
        toolCalls: 0,
        error: String(error),
      };
    }
  }

  /**
   * 创建子智能体
   */
  private async createSubagent(id: string, config: SubagentConfig): Promise<AgentLoop> {
    // 创建 AgentLoop 配置
    const loopConfig: AgentLoopConfig = {
      maxIterations: config.maxIterations ?? 20,
      timeoutMs: 300000,
      workspaceDir: config.workspaceDir ?? process.cwd(),
      promptMode: 'full',
    };

    // 创建 AgentLoop 实例
    const loop = createAgentLoop(loopConfig);

    // 获取所有默认工具
    const allTools = createDefaultTools() as TaskTool[];

    // 过滤掉 task 工具（子智能体不能使用 task，避免递归）
    const childTools = allTools.filter(tool => !isTaskTool(tool));

    // 注册工具（不含 task）
    for (const tool of childTools) {
      loop.registerTool({
        name: tool.name,
        description: tool.description,
        parameters: {
          type: 'object',
          properties: (tool.parameters as any).properties || {},
          required: (tool.parameters as any).required || [],
        },
        execute: async (toolCallId: string, params: Record<string, unknown>) => {
          return await tool.execute(toolCallId, params);
        },
      });
    }

    return loop;
  }

  /**
   * 生成子智能体 ID
   */
  private generateId(name?: string): string {
    this.counter++;
    const timestamp = Date.now();
    return name ? `subagent-${name}-${timestamp}` : `subagent-${this.counter}-${timestamp}`;
  }

  /**
   * 获取所有子智能体
   */
  list(): Array<{ id: string; status: string }> {
    return Array.from(this.subagents.keys()).map(id => ({
      id,
      status: 'running',
    }));
  }

  /**
   * 终止子智能体
   */
  kill(id: string): boolean {
    return this.subagents.delete(id);
  }
}

/**
 * 运行子智能体的便捷函数
 */
export async function runSubagent(config: SubagentConfig): Promise<SubagentResult> {
  const manager = SubagentManager.getInstance();
  return await manager.run(config);
}

/**
 * 列出所有子智能体
 */
export function listSubagents(): Array<{ id: string; status: string }> {
  const manager = SubagentManager.getInstance();
  return manager.list();
}

/**
 * 终止子智能体
 */
export function killSubagent(id: string): boolean {
  const manager = SubagentManager.getInstance();
  return manager.kill(id);
}
