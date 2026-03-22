/**
 * Tracing 类型定义
 *
 * 基于 OpenTelemetry 概念，支持分布式追踪
 */

/**
 * Span 种类
 */
export type SpanKind = 'client' | 'server' | 'internal' | 'producer' | 'consumer';

/**
 * Span 状态
 */
export type SpanStatus = 'ok' | 'error' | 'unsettled';

/**
 * Trace 事件
 */
export interface TraceEvent {
  name: string;
  timestamp: number;
  attributes?: Record<string, unknown>;
}

/**
 * Trace Span
 */
export interface TraceSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind: SpanKind;
  startTime: number;
  endTime?: number;
  attributes: Record<string, string | number | boolean>;
  status: SpanStatus;
  events: TraceEvent[];
  statusMessage?: string;
}

/**
 * Tracer 配置
 */
export interface TracerConfig {
  serviceName: string;
  exporter: 'console' | 'jaeger' | 'otlp' | 'none';
  endpoint?: string;
  sampleRate?: number;
  debug?: boolean;
}

/**
 * 活跃 Span 信息
 */
export interface ActiveSpanInfo {
  span: TraceSpan;
  tracer: import('./index.js').AgentTracer;
}

/**
 * Span 创建选项
 */
export interface SpanOptions {
  parentSpanId?: string;
  kind?: SpanKind;
  attributes?: Record<string, string | number | boolean>;
}
