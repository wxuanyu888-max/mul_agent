/**
 * Multi-Model Collaboration Framework
 *
 * 支持多模型同时工作：
 * - 并行执行多个模型
 * - 结果汇总
 * - 模型选择策略
 */

import { getLLMClient, type LLMRequest, type LLMResponse } from '../agents/llm.js';
import type { Message } from '../agents/types.js';

/**
 * 模型配置
 */
export interface ModelConfig {
  /** 模型名称 */
  name: string;
  /** 模型提供商 */
  provider?: 'anthropic' | 'openai' | 'ollama' | 'minimax';
  /** 温度参数 */
  temperature?: number;
  /** 最大 token 数 */
  maxTokens?: number;
  /** 角色/职责 */
  role?: 'primary' | 'reviewer' | 'researcher' | 'executor';
}

/**
 * 模型任务
 */
export interface ModelTask {
  id: string;
  config: ModelConfig;
  messages: Message[];
  systemPrompt?: string;
}

/**
 * 模型结果
 */
export interface ModelResult {
  taskId: string;
  modelName: string;
  success: boolean;
  response?: LLMResponse;
  error?: string;
  duration: number;
}

/**
 * 协作策略
 */
export type CollaborationStrategy =
  | 'parallel'        // 所有模型并行执行
  | 'sequential'     // 顺序执行
  | 'primary-review'  // 主模型执行，评审模型审核
  | 'research-execute'; // 研究模型探索，执行模型实现

/**
 * 多模型协作器
 */
export class MultiModelCollaborator {
  private tasks: Map<string, ModelTask> = new Map();
  private results: Map<string, ModelResult> = new Map();
  private strategy: CollaborationStrategy;

  constructor(strategy: CollaborationStrategy = 'parallel') {
    this.strategy = strategy;
  }

  /**
   * 添加模型任务
   */
  addTask(task: ModelTask): void {
    this.tasks.set(task.id, task);
  }

  /**
   * 执行协作
   */
  async execute(): Promise<Map<string, ModelResult>> {
    switch (this.strategy) {
      case 'parallel':
        return this.executeParallel();
      case 'sequential':
        return this.executeSequential();
      case 'primary-review':
        return this.executePrimaryReview();
      case 'research-execute':
        return this.executeResearchExecute();
      default:
        return this.executeParallel();
    }
  }

  /**
   * 并行执行
   */
  private async executeParallel(): Promise<Map<string, ModelResult>> {
    const promises = Array.from(this.tasks.values()).map(task =>
      this.executeTask(task)
    );

    const results = await Promise.all(promises);
    return results.reduce((acc, r) => {
      acc.set(r.taskId, r);
      return acc;
    }, new Map<string, ModelResult>());
  }

  /**
   * 顺序执行
   */
  private async executeSequential(): Promise<Map<string, ModelResult>> {
    const results = new Map<string, ModelResult>();

    for (const task of this.tasks.values()) {
      const result = await this.executeTask(task);
      results.set(result.taskId, result);
    }

    return results;
  }

  /**
   * 主模型-评审模型模式
   */
  private async executePrimaryReview(): Promise<Map<string, ModelResult>> {
    const tasks = Array.from(this.tasks.values());
    const primary = tasks.find(t => t.config.role === 'primary') || tasks[0];
    const reviewers = tasks.filter(t => t.config.role === 'reviewer');

    // 执行主模型
    const primaryResult = await this.executeTask(primary);
    const results = new Map<string, ModelResult>();
    results.set(primaryResult.taskId, primaryResult);

    // 如果有评审模型，让它们审核主模型的结果
    for (const reviewer of reviewers) {
      // 将主模型的结果加入评审上下文
      const reviewMessages = [
        ...reviewer.messages,
        {
          role: 'user' as const,
          content: `请审核以下结果：\n\n${primaryResult.response?.content || ''}`
        }
      ];

      const reviewerTask = { ...reviewer, messages: reviewMessages };
      const reviewResult = await this.executeTask(reviewerTask);
      results.set(reviewResult.taskId, reviewResult);
    }

    return results;
  }

  /**
   * 研究-执行模式
   */
  private async executeResearchExecute(): Promise<Map<string, ModelResult>> {
    const tasks = Array.from(this.tasks.values());
    const researcher = tasks.find(t => t.config.role === 'researcher') || tasks[0];
    const executors = tasks.filter(t => t.config.role === 'executor');

    // 研究模型先执行
    const researchResult = await this.executeTask(researcher);
    const results = new Map<string, ModelResult>();
    results.set(researchResult.taskId, researchResult);

    // 执行模型根据研究结果执行
    for (const executor of executors) {
      const execMessages = [
        ...executor.messages,
        {
          role: 'user' as const,
          content: `基于以下研究结果执行：\n\n${researchResult.response?.content || ''}`
        }
      ];

      const execTask = { ...executor, messages: execMessages };
      const execResult = await this.executeTask(execTask);
      results.set(execResult.taskId, execResult);
    }

    return results;
  }

  /**
   * 执行单个任务
   */
  private async executeTask(task: ModelTask): Promise<ModelResult> {
    const startTime = Date.now();

    try {
      const llm = getLLMClient();
      const response = await llm.chat({
        messages: task.messages as any,
        system: task.systemPrompt,
        model: task.config.name,
        temperature: task.config.temperature ?? 0.7,
        max_tokens: task.config.maxTokens,
      });

      return {
        taskId: task.id,
        modelName: task.config.name,
        success: true,
        response: response as any,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        taskId: task.id,
        modelName: task.config.name,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * 汇总结果
   */
  summarize(): string {
    const results = Array.from(this.results.values());
    const successCount = results.filter(r => r.success).length;

    let summary = `# 多模型协作结果\n\n`;
    summary += `## 统计\n`;
    summary += `- 总任务数: ${results.length}\n`;
    summary += `- 成功: ${successCount}\n`;
    summary += `- 失败: ${results.length - successCount}\n\n`;

    summary += `## 详细结果\n`;
    for (const result of results) {
      summary += `### ${result.modelName} (${result.taskId})\n`;
      summary += `- 状态: ${result.success ? '✅ 成功' : '❌ 失败'}\n`;
      summary += `- 耗时: ${result.duration}ms\n`;
      if (result.response && typeof result.response === 'object') {
        const content = (result.response as any).content;
        if (typeof content === 'string') {
          summary += `- 结果: ${content.substring(0, 100)}...\n`;
        }
      }
      if (result.error) {
        summary += `- 错误: ${result.error}\n`;
      }
      summary += '\n';
    }

    return summary;
  }

  /**
   * 获取结果
   */
  getResults(): Map<string, ModelResult> {
    return this.results;
  }
}

/**
 * 创建多模型协作器
 */
export function createMultiModelCollaborator(
  strategy?: CollaborationStrategy
): MultiModelCollaborator {
  return new MultiModelCollaborator(strategy);
}

/**
 * 预定义协作模板
 */
export const CollaborationTemplates = {
  /**
   * 代码审查模板
   */
  codeReview: (): ModelConfig[] => [
    { name: 'claude-sonnet-4-20250514', role: 'primary', temperature: 0.7 },
    { name: 'claude-haiku-4-5-20251001', role: 'reviewer', temperature: 0.3 },
  ],

  /**
   * 研究-实现模板
   */
  researchExecute: (): ModelConfig[] => [
    { name: 'claude-sonnet-4-20250514', role: 'researcher', temperature: 0.9 },
    { name: 'claude-opus-4-6-20251001', role: 'executor', temperature: 0.7 },
  ],

  /**
   * 并行探索模板
   */
  parallelExplore: (): ModelConfig[] => [
    { name: 'claude-sonnet-4-20250514', role: 'primary', temperature: 0.8 },
    { name: 'gpt-4o', role: 'researcher', temperature: 0.8 },
    { name: 'claude-haiku-4-5-20251001', role: 'executor', temperature: 0.5 },
  ],
};
