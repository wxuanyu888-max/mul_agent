// Logger 模块类型定义

/**
 * 日志级别
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * 日志条目
 */
export interface LogEntry {
  id: string;
  timestamp: number;
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
  agentId?: string;
  sessionId?: string;
  error?: string;
  stack?: string;
}

/**
 * 日志过滤器
 */
export interface LogFilter {
  level?: LogLevel;
  agentId?: string;
  sessionId?: string;
  startTime?: number;
  endTime?: number;
  search?: string;
}

/**
 * 日志查询选项
 */
export interface LogQueryOptions {
  filter?: LogFilter;
  limit?: number;
  offset?: number;
  sort?: 'asc' | 'desc';
}

/**
 * Logger 配置
 */
export interface LoggerConfig {
  level: LogLevel;
  storageDir: string;
  maxFileSize?: number;
  maxFiles?: number;
  format?: 'json' | 'text';
}
