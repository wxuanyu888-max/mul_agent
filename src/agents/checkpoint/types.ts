/**
 * Checkpoint 模块类型定义
 *
 * 实现类似 LangGraph 的 Checkpoint 机制：
 * - 每个执行点的完整状态快照
 * - parent_config 支持时间旅行
 * - 完整的执行链路追踪
 */

import type { Message } from '../types.js';
import type { CompactionContext } from '../compaction.js';

/**
 * 工具调用记录
 */
export interface ToolCallRecord {
  id: string;
  name: string;
  input: Record<string, unknown>;
  output: string;
  duration: number;
  error?: string;
}

/**
 * 生成的文件记录
 */
export interface GeneratedFile {
  path: string;
  name: string;
  timestamp: number;
}

/**
 * Checkpoint 创建原因
 */
export type CheckpointReason =
  | 'before_llm_call'     // LLM 调用前
  | 'after_tool_batch'   // 工具批次执行后
  | 'before_compact'     // 压缩前
  | 'after_compact'      // 压缩后
  | 'manual'             // 手动创建
  | 'max_iterations';   // 达到最大迭代

/**
 * Checkpoint 元数据
 */
export interface CheckpointMetadata {
  sessionId: string;
  iteration: number;
  conversationRound: number;
  reason: CheckpointReason;
  timestamp: number;
  parentId: string | null;
}

/**
 * Checkpoint 主结构
 * 记录 Agent 执行过程中的完整状态快照
 */
export interface Checkpoint {
  /** 唯一 ID，格式: ckpt_${timestamp}_${random} */
  id: string;
  /** 父 checkpoint ID（用于时间旅行） */
  parentId: string | null;

  // 执行上下文
  metadata: CheckpointMetadata;

  // 状态快照
  messages: Message[];
  systemPrompt: string;
  compactionContext: {
    compactionCount: number;
    lastCompactionTokens: number;
    transcriptPath?: string;
    // 注意：toolResultPlaceholders 是 Map，不适合序列化
    // 如果需要恢复，compact 时会重新创建
  };
  generatedFiles: GeneratedFile[];

  // 执行快照
  pendingToolCalls: Array<{
    id: string;
    name: string;
    input: Record<string, unknown>;
  }>;
  completedToolCalls: ToolCallRecord[];

  // LLM 快照
  lastLlmCallId: string | null;  // 来自 logger/llm.ts 的日志 ID
  lastLlmResponse: {
    content: string;
    stopReason: string;
    usage?: {
      inputTokens: number;
      outputTokens: number;
    };
  } | null;

  // 额外的运行时状态（可扩展）
  extra?: Record<string, unknown>;
}

/**
 * 创建 Checkpoint 的参数
 */
export interface CreateCheckpointParams {
  sessionId: string;
  iteration: number;
  conversationRound: number;
  messages: Message[];
  systemPrompt: string;
  compactionContext: CompactionContext;
  generatedFiles: Array<{ path: string; name: string; timestamp: number }>;
  pendingToolCalls: Array<{
    id: string;
    name: string;
    input: Record<string, unknown>;
  }>;
  completedToolCalls: ToolCallRecord[];
  lastLlmCallId: string | null;
  lastLlmResponse: Checkpoint['lastLlmResponse'];
  reason: CheckpointReason;
  parentId?: string | null;
  extra?: Record<string, unknown>;
}

/**
 * Checkpoint 状态（用于恢复）
 */
export interface CheckpointState {
  messages: Message[];
  systemPrompt: string;
  compactionContext: CompactionContext;
  generatedFiles: GeneratedFile[];
  // 其他需要恢复的状态
}

/**
 * Checkpoint 索引条目
 */
export interface CheckpointIndexEntry {
  id: string;
  parentId: string | null;
  timestamp: number;
  reason: CheckpointReason;
  iteration: number;
  conversationRound: number;
  messagesCount: number;
  completedToolCallsCount: number;
}

/**
 * Checkpoint 存储格式
 */
export interface CheckpointStorage {
  version: 1;
  checkpoint: Checkpoint;
}
