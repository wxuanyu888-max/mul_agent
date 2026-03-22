/**
 * Prompt 版本管理类型定义
 *
 * 支持：
 * - 版本历史
 * - A/B 测试
 * - 性能指标追踪
 */

import type { Message } from '../types.js';

/**
 * Prompt 版本
 */
export interface PromptVersion {
  id: string;
  version: number;
  name: string;
  content: string;
  variables: string[];
  createdAt: number;
  createdBy: string;
  description?: string;

  // 性能指标
  metrics?: {
    avgLatencyMs: number;
    avgTokens: number;
    successRate: number;
    sampleCount: number;
  };

  // A/B 测试配置
  testConfig?: {
    enabled: boolean;
    trafficSplit?: number;
    metricToOptimize?: string;
    startedAt?: number;
    endedAt?: number;
  };
}

/**
 * Prompt 模板
 */
export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  versions: PromptVersion[];
  currentVersionId: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

/**
 * 版本性能记录
 */
export interface VersionMetricsRecord {
  versionId: string;
  sessionId: string;
  timestamp: number;
  latencyMs: number;
  tokens: number;
  success: boolean;
  error?: string;
}

/**
 * 版本比较结果
 */
export interface VersionComparison {
  versionA: string;
  versionB: string;
  latencyDiff: number;
  tokensDiff: number;
  successRateDiff: number;
  sampleCountA: number;
  sampleCountB: number;
}

/**
 * 创建版本的请求
 */
export interface CreateVersionRequest {
  templateId: string;
  content: string;
  name: string;
  description?: string;
  createdBy: string;
}

/**
 * A/B 测试请求
 */
export interface ABTestRequest {
  templateId: string;
  versionId: string;
  trafficSplit: number;
  metricToOptimize: string;
}
