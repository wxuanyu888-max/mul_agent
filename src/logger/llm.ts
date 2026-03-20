// LLM 调用日志
// 记录 LLM API 调用、token 消耗、延迟等

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  type LogLevel,
  type LogFilter,
  type LogQueryOptions,
} from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 使用 process.cwd() 获取项目根目录
const STORAGE_DIR = path.join(process.cwd(), 'storage', 'llm_logs');

console.log('📁 LLM logs dir:', STORAGE_DIR);

/**
 * LLM 日志条目
 */
export interface LlmCallLog {
  id: string;
  timestamp: number;
  provider: string;
  model: string;
  sessionId?: string;
  agentId?: string;

  // 请求
  promptTokens?: number;
  requestMessages?: number;

  // 响应
  completionTokens?: number;
  totalTokens?: number;

  // 性能
  latencyMs: number;
  firstTokenMs?: number;

  // 结果
  success: boolean;
  error?: string;
  finishReason?: string;

  // 原始数据（可选）
  rawRequest?: unknown;
  rawResponse?: unknown;
}

/**
 * LLM 日志查询选项
 */
export interface LlmLogQueryOptions {
  sessionId?: string;
  agentId?: string;
  provider?: string;
  model?: string;
  success?: boolean;
  startTime?: number;
  endTime?: number;
  limit?: number;
  offset?: number;
}

/**
 * 生成日志 ID
 */
function generateLogId(): string {
  return `llm_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * 写入 LLM 日志
 */
export async function logLlmCall(log: Omit<LlmCallLog, 'id' | 'timestamp'>): Promise<void> {
  try {
    const entry: LlmCallLog = {
      ...log,
      id: generateLogId(),
      timestamp: Date.now(),
    };

    const logDir = path.join(STORAGE_DIR, log.agentId || 'default');
    await fs.mkdir(logDir, { recursive: true });

    const date = new Date(entry.timestamp).toISOString().split('T')[0];
    const logFile = path.join(logDir, `${date}.jsonl`);

    await fs.appendFile(logFile, JSON.stringify(entry) + '\n');
    console.log('✅ LLM log written to:', logFile);
  } catch (error) {
    console.error('❌ Failed to write LLM log:', error);
  }
}

/**
 * 查询 LLM 日志
 */
export async function queryLlmLogs(options: LlmLogQueryOptions = {}): Promise<LlmCallLog[]> {
  const {
    sessionId,
    agentId,
    provider,
    model,
    success,
    startTime,
    endTime,
    limit = 100,
    offset = 0,
  } = options;

  const logsDir = path.join(STORAGE_DIR, agentId || 'default');

  try {
    const entries = await fs.readdir(logsDir);
    // 按日期倒序排序（最新的文件优先），确保 limit 较小时也能获取最新日志
    const logFiles = entries.filter((f) => f.endsWith('.jsonl')).sort().reverse();

    const results: LlmCallLog[] = [];

    for (const file of logFiles) {
      if (results.length >= limit + offset) break;

      const filePath = path.join(logsDir, file);
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n').filter((l) => l.trim());

      for (const line of lines) {
        try {
          const entry = JSON.parse(line) as LlmCallLog;

          // 过滤
          if (sessionId && entry.sessionId !== sessionId) continue;
          if (provider && entry.provider !== provider) continue;
          if (model && entry.model !== model) continue;
          if (success !== undefined && entry.success !== success) continue;
          if (startTime && entry.timestamp < startTime) continue;
          if (endTime && entry.timestamp > endTime) continue;

          results.push(entry);
        } catch {
          // 忽略解析错误
        }
      }
    }

    // 按时间倒序
    results.sort((a, b) => b.timestamp - a.timestamp);

    return results.slice(offset, offset + limit);
  } catch {
    return [];
  }
}

/**
 * 获取 LLM 使用统计
 */
export async function getLlmStats(
  agentId?: string,
  startTime?: number,
  endTime?: number
): Promise<{
  totalCalls: number;
  successCalls: number;
  failedCalls: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  avgLatencyMs: number;
  totalLatencyMs: number;
}> {
  const logs = await queryLlmLogs({
    agentId,
    startTime,
    endTime,
    limit: 10000,
  });

  const stats = {
    totalCalls: logs.length,
    successCalls: 0,
    failedCalls: 0,
    totalPromptTokens: 0,
    totalCompletionTokens: 0,
    totalTokens: 0,
    avgLatencyMs: 0,
    totalLatencyMs: 0,
  };

  for (const log of logs) {
    if (log.success) {
      stats.successCalls++;
    } else {
      stats.failedCalls++;
    }
    stats.totalPromptTokens += log.promptTokens || 0;
    stats.totalCompletionTokens += log.completionTokens || 0;
    stats.totalTokens += log.totalTokens || 0;
    stats.totalLatencyMs += log.latencyMs;
  }

  stats.avgLatencyMs = stats.totalCalls > 0 ? stats.totalLatencyMs / stats.totalCalls : 0;

  return stats;
}

/**
 * 按模型分组统计
 */
export async function getLlmStatsByModel(
  agentId?: string,
  startTime?: number,
  endTime?: number
): Promise<Record<string, {
  calls: number;
  totalTokens: number;
  avgLatencyMs: number;
}>> {
  const logs = await queryLlmLogs({
    agentId,
    startTime,
    endTime,
    limit: 10000,
  });

  const stats: Record<string, {
    calls: number;
    totalTokens: number;
    totalLatencyMs: number;
    avgLatencyMs: number;
  }> = {};

  for (const log of logs) {
    const key = `${log.provider}/${log.model}`;
    if (!stats[key]) {
      stats[key] = { calls: 0, totalTokens: 0, totalLatencyMs: 0, avgLatencyMs: 0 };
    }
    stats[key].calls++;
    stats[key].totalTokens += log.totalTokens || 0;
    stats[key].totalLatencyMs += log.latencyMs;
  }

  // 计算平均值
  for (const key of Object.keys(stats)) {
    stats[key].avgLatencyMs = stats[key].totalLatencyMs / stats[key].calls;
  }

  return stats;
}

/**
 * 清理过期 LLM 日志
 */
export async function cleanOldLlmLogs(daysToKeep: number = 30): Promise<number> {
  const cutoffTime = Date.now() - daysToKeep * 24 * 60 * 60 * 1000;
  let deletedCount = 0;

  try {
    const agents = await fs.readdir(STORAGE_DIR);

    for (const agentId of agents) {
      const agentDir = path.join(STORAGE_DIR, agentId);
      const stat = await fs.stat(agentDir);
      if (!stat.isDirectory()) continue;

      const files = await fs.readdir(agentDir);

      for (const file of files) {
        if (!file.endsWith('.jsonl')) continue;

        const filePath = path.join(agentDir, file);
        const fileStat = await fs.stat(filePath);

        if (fileStat.mtimeMs < cutoffTime) {
          await fs.unlink(filePath);
          deletedCount++;
        }
      }
    }
  } catch {
    // 忽略错误
  }

  return deletedCount;
}
