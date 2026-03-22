/**
 * Supervisor 多 Agent 协作系统类型定义
 *
 * 定义节点、子任务和 Supervisor 状态类型
 */

// ============================================================================
// 节点类型
// ============================================================================

/** 节点类型 */
export type NodeType = 'supervisor' | 'subagent' | 'teammate';

/** 节点状态 */
export type NodeStatus = 'registered' | 'running' | 'idle' | 'completed' | 'failed' | 'terminated';

/** 节点信息 */
export interface NodeInfo {
  id: string;
  name: string;
  type: NodeType;
  status: NodeStatus;
  sessionId: string;
  parentId?: string;
  createdAt: number;
  updatedAt: number;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// 子任务类型
// ============================================================================

/** 子任务执行类型 */
export type SubTaskType = 'subagent' | 'teammate';

/** 子任务状态 */
export type SubTaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

/** 子任务 */
export interface SubTask {
  id: string;
  name: string;
  description: string;
  type: SubTaskType;
  status: SubTaskStatus;
  nodeId?: string;
  result?: string;
  error?: string;
  dependencies: string[];
  createdAt: number;
  updatedAt: number;
}

// ============================================================================
// Supervisor 配置和状态
// ============================================================================

/** Supervisor 配置 */
export interface SupervisorConfig {
  name: string;
  role: string;
  sessionId: string;
  maxConcurrentSubtasks?: number;
}

/** Supervisor 运行状态 */
export type SupervisorStatus = 'idle' | 'decomposing' | 'delegating' | 'waiting' | 'aggregating' | 'completed';

/** Supervisor 状态 */
export interface SupervisorState {
  supervisorId: string;
  sessionId: string;
  status: SupervisorStatus;
  subTasks: Record<string, SubTask>;
  results: Record<string, string>;
  currentIteration: number;
}

// ============================================================================
// 节点索引
// ============================================================================

/** 节点索引 */
export interface NodeIndex {
  nodes: Record<string, NodeInfo>;
  lastUpdated: number;
}
