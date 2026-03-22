/**
 * Context Engine 主实现
 *
 * 可插拔的上下文管理引擎
 */

import type {
  ContextEngine,
  ContextEngineInfo,
  CompactionConfig,
  CompactionContext,
  AssembleParams,
  AssembleResult,
  CompactParams,
  CompactResult,
  BootstrapParams,
  BootstrapResult,
  IngestParams,
  IngestResult,
  SubagentSpawnPreparation,
} from './types.js';
import { createDefaultCompactionStrategies } from './strategies.js';
import { createCompactionContext } from './types.js';
import type { Message } from '../types.js';

/**
 * Context Engine 信息
 */
const CONTEXT_ENGINE_INFO: ContextEngineInfo = {
  name: 'default',
  description: '默认上下文压缩引擎：结合 micro-compact 和 auto-compact 策略',
  version: '1.0.0',
};

/**
 * 默认 Context Engine 实现
 *
 * 使用组合策略：
 * 1. micro-compact: 每次 LLM 调用前应用，替换旧的 tool result
 * 2. auto-compact: token 超过阈值时，保存完整对话并用 LLM 摘要
 */
export class DefaultContextEngine implements ContextEngine {
  readonly info = CONTEXT_ENGINE_INFO;

  private config: CompactionConfig;
  private context: CompactionContext;
  private strategies: ReturnType<typeof createDefaultCompactionStrategies>;

  constructor(config: CompactionConfig = {}) {
    this.config = config;
    this.context = createCompactionContext();
    this.strategies = createDefaultCompactionStrategies();
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<CompactionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取当前上下文
   */
  getContext(): CompactionContext {
    return this.context;
  }

  /**
   * 重置上下文
   */
  resetContext(): void {
    this.context = createCompactionContext();
  }

  /**
   * Bootstrap - 初始化上下文引擎
   */
  async bootstrap(_params: BootstrapParams): Promise<BootstrapResult> {
    // 默认实现不做任何操作
    // 子类可以覆盖以加载工作区引导文件
    return {
      success: true,
      loadedFiles: [],
    };
  }

  /**
   * Ingest - 摄入新消息
   *
   * 默认实现：应用 micro-compact 策略
   */
  async ingest(params: IngestParams): Promise<IngestResult> {
    const threshold = params.maxTokens ?? this.config.autoCompactThreshold ?? 50000;

    // 检查是否需要 micro compact
    if (this.strategies.micro.needsCompaction(params.messages, threshold)) {
      const result = await this.strategies.micro.compact(
        params.messages,
        this.config,
        this.context
      );
      this.context = result.context;
    }

    return {
      success: true,
      ingestedCount: params.messages.length,
      skippedCount: 0,
    };
  }

  /**
   * Assemble - 组装用于 LLM 调用的消息列表
   */
  async assemble(params: AssembleParams): Promise<AssembleResult> {
    const maxTokens = params.maxTokens ?? this.config.autoCompactThreshold ?? 50000;
    const totalTokens = this.strategies.micro.estimateTokens(params.messages);

    return {
      messages: params.messages,
      totalTokens,
      truncated: totalTokens > maxTokens,
    };
  }

  /**
   * Compact - 压缩上下文
   *
   * 使用 auto-compact 策略进行深度压缩
   */
  async compact(params: CompactParams): Promise<CompactResult> {
    try {
      const result = await this.strategies.auto.compact(
        params.messages,
        this.config,
        this.context
      );

      this.context = result.context;

      return {
        success: true,
        compactedMessages: result.messages,
        transcriptPath: this.context.transcriptPath,
        tokensSaved: this.context.lastCompactionTokens,
      };
    } catch (error) {
      return {
        success: false,
        compactedMessages: params.messages,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Prepare Subagent Spawn - 为子 agent 准备上下文
   *
   * 返回精简的上下文用于子 agent
   */
  async prepareSubagentSpawn(params: { messages: Message[] }): Promise<SubagentSpawnPreparation | undefined> {
    // 对于子 agent，返回最近的消息作为上下文
    const recentMessages = params.messages.slice(-10);

    return {
      sessionSnapshot: recentMessages,
      relevantContext: `包含 ${recentMessages.length} 条最近消息的摘要`,
    };
  }

  /**
   * Dispose - 清理资源
   */
  async dispose(): Promise<void> {
    // 清理占位符映射
    this.context.toolResultPlaceholders.clear();
  }
}

/**
 * 简易上下文引擎（用于不需要压缩的场景）
 */
export class SimpleContextEngine implements ContextEngine {
  readonly info: ContextEngineInfo = {
    name: 'simple',
    description: '简单上下文引擎：不进行任何压缩',
    version: '1.0.0',
  };

  async assemble(params: AssembleParams): Promise<AssembleResult> {
    const messages = params.messages ?? [];
    let totalTokens = 0;

    for (const msg of messages) {
      if (typeof msg.content === 'string') {
        totalTokens += this.estimateTokens(msg.content);
      } else if (Array.isArray(msg.content)) {
        for (const part of msg.content) {
          if (typeof part === 'string') {
            totalTokens += this.estimateTokens(part);
          } else if (part.content) {
            totalTokens += this.estimateTokens(part.content);
          }
        }
      }
    }

    return {
      messages: params.messages,
      totalTokens,
      truncated: false,
    };
  }

  async compact(params: CompactParams): Promise<CompactResult> {
    return {
      success: true,
      compactedMessages: params.messages,
    };
  }

  private estimateTokens(text: string): number {
    if (!text) return 0;
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const otherChars = text.length - chineseChars;
    return Math.ceil(chineseChars * 0.7 + otherChars * 0.25);
  }
}

// 导出默认引擎工厂函数
let defaultEngineInstance: DefaultContextEngine | null = null;

/**
 * 获取默认 Context Engine 实例
 */
export function getDefaultContextEngine(config?: CompactionConfig): ContextEngine {
  if (!defaultEngineInstance) {
    defaultEngineInstance = new DefaultContextEngine(config);
  } else if (config) {
    defaultEngineInstance.updateConfig(config);
  }
  return defaultEngineInstance;
}

/**
 * 重置默认引擎实例
 */
export function resetDefaultContextEngine(): void {
  if (defaultEngineInstance) {
    defaultEngineInstance.dispose();
    defaultEngineInstance = null;
  }
}
