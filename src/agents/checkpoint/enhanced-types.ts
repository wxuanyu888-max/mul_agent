/**
 * Checkpoint 增强类型定义
 *
 * 扩展基础 Checkpoint，支持：
 * - 分支执行
 * - 时间旅行
 * - 差异比较
 */

import type { Checkpoint } from './types.js';

/**
 * 分支信息
 */
export interface Branch {
  name: string;
  headCheckpointId: string;
  createdAt: number;
  createdFrom?: string;
  description?: string;
}

/**
 * 时间旅行请求
 */
export interface TimeTravelRequest {
  checkpointId: string;
  branchName?: string;
  preserveCurrent?: boolean;
  description?: string;
}

/**
 * 时间旅行结果
 */
export interface TimeTravelResult {
  snapshot: Checkpoint;
  newCheckpointId: string;
  currentBranch: string;
}

/**
 * Checkpoint 差异
 */
export interface CheckpointDiff {
  checkpointIdA: string;
  checkpointIdB: string;
  messagesAdded: number;
  messagesRemoved: number;
  messagesChanged: number;
  tokensDelta: number;
  toolsAdded: number;
  toolsRemoved: number;
  toolResultsDelta: number;
  duration?: number;
}

/**
 * 时间线视图
 */
export interface TimelineView {
  sessionId: string;
  branches: Branch[];
  checkpoints: TimelineCheckpoint[];
}

/**
 * 时间线中的 Checkpoint 简略信息
 */
export interface TimelineCheckpoint {
  id: string;
  branchName: string;
  parentId: string | null;
  timestamp: number;
  reason: string;
  iteration: number;
  conversationRound: number;
  messagesCount: number;
  toolCallsCount: number;
  inputTokens: number;
  outputTokens: number;
}

/**
 * Checkpoint 搜索选项
 */
export interface CheckpointSearchOptions {
  sessionId: string;
  branch?: string;
  reason?: string;
  minIteration?: number;
  maxIteration?: number;
  since?: number;
  until?: number;
  limit?: number;
  offset?: number;
}

/**
 * Checkpoint GC 配置
 */
export interface CheckpointGCConfig {
  maxCheckpoints: number;
  maxAgeMs?: number;
  keepReasons?: string[];
}
