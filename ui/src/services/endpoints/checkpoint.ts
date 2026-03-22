/**
 * Checkpoint Time Travel API Endpoints
 */

import client from './client';

export interface CheckpointBrief {
  id: string;
  iteration: number;
  reason: string;
  timestamp: number;
  messagesCount: number;
  toolCallsCount: number;
}

export interface Checkpoint {
  messages: unknown[];
  toolCalls: unknown[];
  systemPrompt: string;
}

export interface Branch {
  name: string;
  checkpointId: string;
  description?: string;
  createdAt: number;
}

export interface CheckpointDiff {
  added: unknown[];
  removed: unknown[];
  modified: unknown[];
}

export interface TimeTravelResult {
  success: boolean;
  checkpointId: string;
  newBranch?: string;
}

export const checkpointApi = {
  // 获取会话的时间线视图
  getTimeline: (sessionId: string) =>
    client.get<{ timeline: unknown[] }>(`/checkpoints/sessions/${sessionId}/timeline`),

  // 获取分支列表
  getBranches: (sessionId: string) =>
    client.get<{ branches: Branch[] }>(`/checkpoints/sessions/${sessionId}/branches`),

  // 创建新分支
  createBranch: (sessionId: string, data: { name: string; fromCheckpointId: string; description?: string }) =>
    client.post<{ branch: Branch }>(`/checkpoints/sessions/${sessionId}/branches`, data),

  // 删除分支
  deleteBranch: (sessionId: string, name: string) =>
    client.delete(`/checkpoints/sessions/${sessionId}/branches/${name}`),

  // 时间旅行
  timeTravel: (sessionId: string, data: { checkpointId: string; branchName?: string; preserveCurrent?: boolean; description?: string }) =>
    client.post<TimeTravelResult>(`/checkpoints/sessions/${sessionId}/time-travel`, data),

  // 比较两个 Checkpoint
  diffCheckpoints: (idA: string, idB: string) =>
    client.get<{ diff: CheckpointDiff }>(`/checkpoints/${idA}/diff/${idB}`),

  // 搜索 Checkpoints
  searchCheckpoints: (sessionId: string, params?: {
    branch?: string;
    reason?: string;
    minIteration?: number;
    maxIteration?: number;
    since?: number;
    until?: number;
    limit?: number;
    offset?: number;
  }) =>
    client.get<{ checkpoints: CheckpointBrief[] }>(`/checkpoints/sessions/${sessionId}/checkpoints`, { params }),

  // 获取 Checkpoint 链
  getCheckpointChain: (id: string) =>
    client.get<{ chain: CheckpointBrief[] }>(`/checkpoints/${id}/chain`),

  // 获取单个 Checkpoint 详情
  getCheckpoint: (id: string) =>
    client.get<Checkpoint>(`/debug/checkpoints/${id}`),

  // 手动创建 Checkpoint
  createCheckpoint: (sessionId: string, reason?: string) =>
    client.post<{ success: boolean; message: string }>(`/debug/sessions/${sessionId}/checkpoint`, { reason }),

  // 导出 Trace 数据
  exportTrace: (sessionId: string, format?: 'json') =>
    client.get(`/debug/sessions/${sessionId}/export`, { params: { format } }),

  // 垃圾回收
  garbageCollect: (sessionId: string, params?: { maxCheckpoints?: number; maxAgeMs?: number; keepReasons?: string[] }) =>
    client.delete<{ deleted: number }>(`/checkpoints/sessions/${sessionId}/checkpoints/gc`, { params }),
};
