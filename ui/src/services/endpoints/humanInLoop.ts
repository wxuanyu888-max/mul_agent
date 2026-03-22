/**
 * Human-in-the-Loop API Endpoints
 */

import client from './client';

export interface Intervention {
  id: string;
  sessionId: string;
  type: string;
  trigger: string;
  message: string;
  status: 'pending' | 'approved' | 'rejected' | 'modified';
  createdAt: number;
  respondedAt?: number;
  response?: string;
  modifiedInput?: unknown;
}

export interface InterruptConfig {
  id: string;
  type: string;
  trigger: string;
  message: string;
  enabled: boolean;
  options?: Record<string, unknown>;
}

export interface InterventionStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  modified: number;
}

export const humanInLoopApi = {
  // 获取待处理的干预列表
  getPending: (sessionId?: string) =>
    client.get<{ interventions: Intervention[] }>('/human-in-loop/pending', { params: { sessionId } }),

  // 获取干预历史
  getHistory: (sessionId?: string, limit: number = 50) =>
    client.get<{ interventions: Intervention[] }>('/human-in-loop/history', { params: { sessionId, limit } }),

  // 获取单个干预详情
  getIntervention: (id: string) =>
    client.get<{ intervention: Intervention }>(`/human-in-loop/${id}`),

  // 响应干预请求
  respond: (id: string, data: { action: 'approve' | 'reject' | 'modify' | 'timeout'; response?: string; modifiedInput?: unknown }) =>
    client.post(`/human-in-loop/${id}/respond`, data),

  // 获取中断配置列表
  getConfigs: () =>
    client.get<{ configs: InterruptConfig[] }>('/human-in-loop/config'),

  // 注册中断配置
  createConfig: (config: Omit<InterruptConfig, 'enabled'>) =>
    client.post<{ success: boolean; config: InterruptConfig }>('/human-in-loop/config', config),

  // 更新中断配置
  updateConfig: (id: string, updates: Partial<InterruptConfig>) =>
    client.put(`/human-in-loop/config/${id}`, updates),

  // 删除中断配置
  deleteConfig: (id: string) =>
    client.delete(`/human-in-loop/config/${id}`),

  // 启用/禁用中断配置
  toggleConfig: (id: string, enabled: boolean) =>
    client.patch(`/human-in-loop/config/${id}/toggle`, { enabled }),

  // 获取统计信息
  getStats: () =>
    client.get<{ stats: InterventionStats }>('/human-in-loop/stats'),

  // 清空历史记录
  clearHistory: () =>
    client.delete('/human-in-loop/history'),
};
