/**
 * Prompt Versions API Endpoints
 */

import client from './client';

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  tags: string[];
  versionCount: number;
  currentVersion?: string;
  createdAt: number;
  updatedAt: number;
}

export interface PromptVersion {
  id: string;
  templateId: string;
  name: string;
  content: string;
  description?: string;
  createdBy: string;
  createdAt: number;
  metrics?: {
    successRate?: number;
    avgLatency?: number;
    totalTokens?: number;
  };
}

export interface VersionComparison {
  idA: string;
  idB: string;
  contentDiff: {
    added: string[];
    removed: string[];
    modified: { old: string; new: string }[];
  };
  metricsDiff?: {
    successRate: { old: number; new: number };
    avgLatency: { old: number; new: number };
  };
}

export const promptsApi = {
  // 创建模板
  createTemplate: (data: { name: string; description?: string; content: string; tags?: string[]; createdBy?: string }) =>
    client.post<{ template: PromptTemplate }>('/prompts/templates', data),

  // 获取所有模板
  listTemplates: () =>
    client.get<{ templates: PromptTemplate[] }>('/prompts/templates'),

  // 获取单个模板
  getTemplate: (id: string) =>
    client.get<{ template: PromptTemplate & { versions: PromptVersion[] } }>(`/prompts/templates/${id}`),

  // 获取当前活跃版本
  getActiveVersion: (id: string) =>
    client.get<{ version: PromptVersion }>(`/prompts/templates/${id}/active`),

  // 创建新版本
  createVersion: (id: string, data: { content: string; name: string; description?: string; createdBy?: string }) =>
    client.post<{ version: PromptVersion }>(`/prompts/templates/${id}/versions`, data),

  // 设置当前版本
  setCurrentVersion: (id: string, versionId: string) =>
    client.patch(`/prompts/templates/${id}/current`, { versionId }),

  // 启动 A/B 测试
  startABTest: (id: string, data: { versionId: string; trafficSplit?: number; metricToOptimize?: string }) =>
    client.post(`/prompts/templates/${id}/abtest`, data),

  // 停止 A/B 测试
  stopABTest: (id: string, versionId: string) =>
    client.delete(`/prompts/templates/${id}/abtest/${versionId}`),

  // 记录指标
  recordMetrics: (data: { versionId: string; sessionId: string; latencyMs?: number; tokens?: number; success?: boolean; error?: string }) =>
    client.post('/prompts/metrics', data),

  // 比较版本
  compareVersions: (idA: string, idB: string) =>
    client.get<{ comparison: VersionComparison }>(`/prompts/versions/${idA}/compare/${idB}`),

  // 删除模板
  deleteTemplate: (id: string) =>
    client.delete(`/prompts/templates/${id}`),
};
