/**
 * Checkpoint 模块
 *
 * 实现类似 LangGraph 的 Checkpoint 机制：
 * - 每个执行点的完整状态快照
 * - parent_config 支持时间旅行
 * - 完整的执行链路追踪
 *
 * @example
 * ```typescript
 * import { createCheckpoint, getCheckpoint, getSessionCheckpoints } from './checkpoint';
 *
 * // 创建 checkpoint
 * const checkpoint = await createCheckpoint({
 *   sessionId: 'session_123',
 *   iteration: 1,
 *   conversationRound: 1,
 *   messages: [],
 *   systemPrompt: 'You are a helpful assistant',
 *   compactionContext: createCompactionContext(),
 *   generatedFiles: [],
 *   pendingToolCalls: [],
 *   completedToolCalls: [],
 *   lastLlmCallId: null,
 *   lastLlmResponse: null,
 *   reason: 'before_llm_call',
 * });
 *
 * // 查询 checkpoint
 * const checkpoint = await getCheckpoint('ckpt_xxx');
 * const checkpoints = await getSessionCheckpoints('session_123');
 * ```
 */

// Types
export * from './types.js';

// Manager
export {
  CheckpointManager,
  getCheckpointManager,
  createCheckpoint,
  getCheckpoint,
  getSessionCheckpoints,
  getLatestCheckpoint,
  restoreFromCheckpoint,
  getCheckpointAncestors,
} from './manager.js';

// Replay
export {
  replay,
  getExecutionSummary,
  formatToolCall,
  printReplayResult,
  type ReplayOptions,
  type ReplayResult,
} from './replay.js';

// 时间旅行增强
export {
  timeTravel,
  diffCheckpoint,
  getTimelineView,
  searchCheckpoints,
  garbageCollect,
  getCheckpointChain,
  formatCheckpointBrief,
  getBranches,
  createBranch,
  updateBranchHead,
  deleteBranch,
} from './time-travel.js';
export type {
  Branch,
  TimeTravelRequest,
  TimeTravelResult,
  CheckpointDiff,
  TimelineView,
  TimelineCheckpoint,
  CheckpointSearchOptions,
  CheckpointGCConfig,
} from './enhanced-types.js';
