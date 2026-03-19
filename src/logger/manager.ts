// Logger 管理器
// 负责日志的写入、查询和管理

import fs from 'node:fs/promises';
import path from 'node:path';
import {
  type LogEntry,
  type LogLevel,
  type LogFilter,
  type LogQueryOptions,
  type LoggerConfig,
} from './types.js';

const STORAGE_DIR = './storage/logs';

/**
 * 默认配置
 */
const DEFAULT_CONFIG: LoggerConfig = {
  level: 'info',
  storageDir: STORAGE_DIR,
  maxFileSize: 10 * 1024 * 1024, // 10MB
  maxFiles: 10,
  format: 'json',
};

/**
 * LLM 日志数据类型
 */
export interface LlmLogData {
  // 请求
  url?: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  messageCount?: number;
  hasSystem?: boolean;
  hasTools?: boolean;

  // 响应
  responseId?: string;
  stopReason?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  responsePreview?: string;

  // 性能
  latencyMs: number;

  // 错误
  statusCode?: number;
  error?: string;
}

/**
 * 生成日志 ID
 */
function generateLogId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * 日志级别优先级
 */
const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Logger 类
 */
export class Logger {
  private config: LoggerConfig;
  private agentId?: string;
  private sessionId?: string;

  constructor(config: Partial<LoggerConfig> = {}, agentId?: string, sessionId?: string) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.agentId = agentId;
    this.sessionId = sessionId;
  }

  /**
   * 设置 Agent ID
   */
  setAgentId(agentId: string): void {
    this.agentId = agentId;
  }

  /**
   * 设置 Session ID
   */
  setSessionId(sessionId: string): void {
    this.sessionId = sessionId;
  }

  /**
   * 创建子 Logger（继承配置）
   */
  child(agentId?: string, sessionId?: string): Logger {
    return new Logger(this.config, agentId || this.agentId, sessionId || this.sessionId);
  }

  /**
   * 检查日志级别是否启用
   */
  private shouldLog(level: LogLevel): boolean {
    return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[this.config.level];
  }

  /**
   * 格式化日志条目
   */
  private formatEntry(entry: LogEntry): string {
    if (this.config.format === 'json') {
      return JSON.stringify(entry) + '\n';
    }
    const timestamp = new Date(entry.timestamp).toISOString();
    const context = entry.context ? ` ${JSON.stringify(entry.context)}` : '';
    const error = entry.error ? `\n  Error: ${entry.error}${entry.stack ? `\n  Stack: ${entry.stack}` : ''}` : '';
    return `[${timestamp}] [${entry.level.toUpperCase()}] ${entry.message}${context}${error}\n`;
  }

  /**
   * 写入日志到文件
   */
  private async write(entry: LogEntry): Promise<void> {
    const logDir = path.join(this.config.storageDir, entry.agentId || 'default');
    await fs.mkdir(logDir, { recursive: true });

    const date = new Date(entry.timestamp).toISOString().split('T')[0];
    const logFile = path.join(logDir, `${date}.log`);

    const content = this.formatEntry(entry);
    await fs.appendFile(logFile, content);
  }

  /**
   * 创建日志条目
   */
  private createEntry(level: LogLevel, message: string, context?: Record<string, any>, error?: Error): LogEntry {
    const entry: LogEntry = {
      id: generateLogId(),
      timestamp: Date.now(),
      level,
      message,
      context,
      agentId: this.agentId,
      sessionId: this.sessionId,
    };

    if (error) {
      entry.error = error.message;
      entry.stack = error.stack;
    }

    return entry;
  }

  /**
   * Debug 日志
   */
  debug(message: string, context?: Record<string, any>): void {
    if (!this.shouldLog('debug')) return;
    const entry = this.createEntry('debug', message, context);
    this.write(entry).catch(console.error);
  }

  /**
   * Info 日志
   */
  info(message: string, context?: Record<string, any>): void {
    if (!this.shouldLog('info')) return;
    const entry = this.createEntry('info', message, context);
    this.write(entry).catch(console.error);
  }

  /**
   * Warn 日志
   */
  warn(message: string, context?: Record<string, any>): void {
    if (!this.shouldLog('warn')) return;
    const entry = this.createEntry('warn', message, context);
    this.write(entry).catch(console.error);
  }

  /**
   * Error 日志
   */
  error(message: string, error?: Error, context?: Record<string, any>): void {
    if (!this.shouldLog('error')) return;
    const entry = this.createEntry('error', message, context, error);
    this.write(entry).catch(console.error);
  }

  /**
   * LLM 请求日志（info 级别）
   */
  logLlmRequest(data: LlmLogData): void {
    this.info('LLM Request', {
      type: 'llm_request',
      url: data.url,
      model: data.model,
      temperature: data.temperature,
      maxTokens: data.maxTokens,
      messageCount: data.messageCount,
      hasSystem: data.hasSystem,
      hasTools: data.hasTools,
    });
  }

  /**
   * LLM 响应日志（info 级别）
   */
  logLlmResponse(data: LlmLogData): void {
    this.info('LLM Response', {
      type: 'llm_response',
      responseId: data.responseId,
      model: data.model,
      stopReason: data.stopReason,
      latencyMs: data.latencyMs,
      usage: {
        input: data.inputTokens,
        output: data.outputTokens,
        total: data.totalTokens,
      },
      responsePreview: data.responsePreview,
    });
  }

  /**
   * LLM 错误日志（error 级别）
   */
  logLlmError(data: LlmLogData, error: Error): void {
    this.error('LLM API Error', error, {
      type: 'llm_error',
      model: data.model,
      latencyMs: data.latencyMs,
      statusCode: data.statusCode,
    });
  }
}

// 全局 Logger 实例
let globalLogger: Logger | null = null;

/**
 * 获取全局 Logger
 */
export function getLogger(agentId?: string, sessionId?: string): Logger {
  if (!globalLogger) {
    globalLogger = new Logger();
  }
  return globalLogger.child(agentId, sessionId);
}

/**
 * 初始化全局 Logger
 */
export function initLogger(config: Partial<LoggerConfig>): Logger {
  globalLogger = new Logger(config);
  return globalLogger;
}

/**
 * 查询日志
 */
export async function queryLogs(options: LogQueryOptions = {}): Promise<LogEntry[]> {
  const { filter, limit = 100, offset = 0, sort = 'desc' } = options;
  const logsDir = path.join(process.cwd(), 'storage', 'logs', filter?.agentId || 'default');

  try {
    const entries = await fs.readdir(logsDir);
    const logFiles = entries.filter((f) => f.endsWith('.log')).sort();

    const results: LogEntry[] = [];

    for (const file of logFiles) {
      if (results.length >= limit + offset) break;

      const filePath = path.join(logsDir, file);
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n').filter((l) => l.trim());

      for (const line of lines) {
        try {
          if (line.startsWith('[')) {
            // text 格式解析
            const match = line.match(/^\[([^\]]+)\] \[(\w+)\] (.+)$/);
            if (match) {
              const [, timestamp, level, message] = match;
              results.push({
                id: '',
                timestamp: new Date(timestamp).getTime(),
                level: level.toLowerCase() as LogLevel,
                message,
              });
            }
          } else {
            // json 格式解析
            const entry = JSON.parse(line) as LogEntry;
            if (matchesFilter(entry, filter)) {
              results.push(entry);
            }
          }
        } catch {
          // 忽略解析错误
        }
      }
    }

    // 排序
    results.sort((a, b) =>
      sort === 'desc' ? b.timestamp - a.timestamp : a.timestamp - b.timestamp
    );

    // 分页
    return results.slice(offset, offset + limit);
  } catch {
    return [];
  }
}

/**
 * 检查日志条目是否匹配过滤器
 */
function matchesFilter(entry: LogEntry, filter?: LogFilter): boolean {
  if (!filter) return true;

  if (filter.level && entry.level !== filter.level) return false;
  if (filter.agentId && entry.agentId !== filter.agentId) return false;
  if (filter.sessionId && entry.sessionId !== filter.sessionId) return false;
  if (filter.startTime && entry.timestamp < filter.startTime) return false;
  if (filter.endTime && entry.timestamp > filter.endTime) return false;
  if (filter.search && !entry.message.includes(filter.search)) return false;

  return true;
}

/**
 * 清理过期日志
 */
export async function cleanOldLogs(daysToKeep: number = 30): Promise<number> {
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
        if (!file.endsWith('.log')) continue;

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
