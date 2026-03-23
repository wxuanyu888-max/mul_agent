/**
 * Context Engine - 可插拔上下文压缩架构
 *
 * 定义标准接口，允许插入不同的上下文压缩策略
 */

import type { Message } from '../types.js';

/**
 * 压缩配置
 */
export interface CompactionConfig {
  /** 最大 token 数阈值，超过时触发 auto_compact */
  autoCompactThreshold?: number;
  /** 保留最近 N 个 tool result */
  keepRecentResults?: number;
  /** 保留最近 N 条用户消息（包含当前需求），不压缩 */
  keepRecentUserMessages?: number;
  /** tool result 超过此长度才进行 micro_compact */
  minResultLengthForCompact?: number;
  /** 摘要最大 token 数 */
  summaryMaxTokens?: number;
  /** 是否保留系统消息 */
  preserveSystem?: boolean;
  /** transcript 保存目录 */
  transcriptDir?: string;
}

/**
 * 压缩上下文（用于在循环中保持状态）
 */
export interface CompactionContext {
  /** 已压缩次数 */
  compactionCount: number;
  /** 上次压缩的 token 数 */
  lastCompactionTokens: number;
  /** transcript 文件路径 */
  transcriptPath?: string;
  /** tool result 占位符映射 */
  toolResultPlaceholders: Map<string, string>;
}

/**
 * 默认配置
 */
export const DEFAULT_COMPACTION_CONFIG: Required<CompactionConfig> = {
  autoCompactThreshold: 50000,
  keepRecentResults: 3,
  keepRecentUserMessages: 2,
  minResultLengthForCompact: 100,
  summaryMaxTokens: 2000,
  preserveSystem: true,
  transcriptDir: 'storage/runtime/transcripts',
};

/**
 * 创建空压缩上下文
 */
export function createCompactionContext(): CompactionContext {
  return {
    compactionCount: 0,
    lastCompactionTokens: 0,
    toolResultPlaceholders: new Map(),
  };
}

/**
 * Context Engine 信息
 */
export interface ContextEngineInfo {
  name: string;
  description: string;
  version: string;
}

/**
 * 压缩策略接口
 *
 * 定义压缩策略的标准契约，支持：
 * - micro_compact: 轻量级压缩，替换 tool result 为占位符
 * - auto_compact: 超过阈值时，保存完整对话并用 LLM 摘要
 * - manual_compact: 手动触发压缩
 */
export interface CompactionStrategy {
  /** 策略标识 */
  readonly info: ContextEngineInfo;

  /**
   * 执行压缩
   * @param messages 消息列表
   * @param config 压缩配置
   * @param context 压缩上下文
   * @returns 压缩后的消息和更新后的上下文
   */
  compact(
    messages: Message[],
    config: CompactionConfig,
    context: CompactionContext
  ): Promise<{ messages: Message[]; context: CompactionContext }>;

  /**
   * 估算消息列表的 token 数量
   */
  estimateTokens(messages: Message[]): number;

  /**
   * 检查是否需要压缩
   */
  needsCompaction(messages: Message[], threshold: number): boolean;
}

/**
 * Bootstrap 参数
 */
export interface BootstrapParams {
  workspaceDir?: string;
  sessionId?: string;
}

/**
 * Bootstrap 结果
 */
export interface BootstrapResult {
  success: boolean;
  loadedFiles?: string[];
  error?: string;
}

/**
 * Ingest 参数
 */
export interface IngestParams {
  messages: Message[];
  maxTokens?: number;
}

/**
 * Ingest 结果
 */
export interface IngestResult {
  success: boolean;
  ingestedCount: number;
  skippedCount: number;
}

/**
 * Assemble 参数
 */
export interface AssembleParams {
  messages: Message[];
  maxTokens?: number;
}

/**
 * Assemble 结果
 */
export interface AssembleResult {
  messages: Message[];
  totalTokens: number;
  truncated: boolean;
}

/**
 * Compact 参数
 */
export interface CompactParams {
  messages: Message[];
  reason?: string;
}

/**
 * Compact 结果
 */
export interface CompactResult {
  success: boolean;
  compactedMessages: Message[];
  summary?: string;
  transcriptPath?: string;
  tokensSaved?: number;
  error?: string;
}

/**
 * Subagent Spawn 准备参数
 */
export interface SubagentSpawnPreparation {
  sessionSnapshot?: Message[];
  relevantContext?: string;
}

/**
 * Context Engine 主接口
 *
 * 可插拔的上下文管理引擎，支持：
 * - bootstrap: 加载工作区引导文件
 * - ingest: 摄入新消息
 * - assemble: 组装上下文
 * - compact: 压缩上下文
 * - prepareSubagentSpawn: 为子 agent 准备上下文
 */
export interface ContextEngine {
  /** 引擎信息 */
  readonly info: ContextEngineInfo;

  /**
   * Bootstrap - 初始化上下文引擎
   */
  bootstrap?(params: BootstrapParams): Promise<BootstrapResult>;

  /**
   * Ingest - 摄入新消息到上下文
   */
  ingest?(params: IngestParams): Promise<IngestResult>;

  /**
   * Assemble - 组装用于 LLM 调用的消息列表
   */
  assemble(params: AssembleParams): Promise<AssembleResult>;

  /**
   * Compact - 压缩上下文
   */
  compact(params: CompactParams): Promise<CompactResult>;

  /**
   * Prepare Subagent Spawn - 为子 agent 准备上下文
   */
  prepareSubagentSpawn?(params: { messages: Message[] }): Promise<SubagentSpawnPreparation | undefined>;

  /**
   * Dispose - 清理资源
   */
  dispose?(): Promise<void>;
}

/**
 * Context Engine 注册表
 */
export class ContextEngineRegistry {
  private static instance: ContextEngineRegistry;
  private engines: Map<string, ContextEngine> = new Map();
  private defaultEngine: string = 'default';

  static getInstance(): ContextEngineRegistry {
    if (!ContextEngineRegistry.instance) {
      ContextEngineRegistry.instance = new ContextEngineRegistry();
    }
    return ContextEngineRegistry.instance;
  }

  /**
   * 注册上下文引擎
   */
  register(name: string, engine: ContextEngine): void {
    this.engines.set(name, engine);
  }

  /**
   * 获取上下文引擎
   */
  get(name?: string): ContextEngine | undefined {
    return this.engines.get(name || this.defaultEngine);
  }

  /**
   * 设置默认引擎
   */
  setDefault(name: string): void {
    if (this.engines.has(name)) {
      this.defaultEngine = name;
    }
  }

  /**
   * 列出所有已注册的引擎
   */
  list(): ContextEngineInfo[] {
    return Array.from(this.engines.values()).map(e => e.info);
  }
}
