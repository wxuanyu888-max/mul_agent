/**
 * Agent 分布式追踪系统
 *
 * 基于 OpenTelemetry 概念，支持：
 * - 分布式 Trace 追踪
 * - Span 嵌套（LLM 调用、工具执行等）
 * - 多种导出器（Console, Jaeger, OTLP）
 * - 采样率控制
 */

import { generateTraceId, generateSpanId } from './id-generator.js';
import { createExporter, type TraceExporter } from './exporter.js';
import type {
  TraceSpan,
  TracerConfig,
  SpanOptions,
  SpanStatus,
  ActiveSpanInfo,
} from './types.js';

/**
 * 全局 Tracer 单例
 */
let globalTracer: AgentTracer | null = null;

/**
 * 获取全局 Tracer
 */
export function getGlobalTracer(): AgentTracer | null {
  return globalTracer;
}

/**
 * 设置全局 Tracer
 */
export function setGlobalTracer(tracer: AgentTracer): void {
  globalTracer = tracer;
}

/**
 * Agent Tracer 主类
 */
export class AgentTracer {
  private config: TracerConfig;
  private exporter: TraceExporter;
  private traceId: string;
  private activeSpans: Map<string, TraceSpan> = new Map();
  private completedSpans: TraceSpan[] = [];
  private sessionId?: string;

  constructor(config: TracerConfig) {
    this.config = config;
    this.exporter = createExporter(config);
    this.traceId = generateTraceId();
  }

  /**
   * 设置会话 ID
   */
  setSessionId(sessionId: string): void {
    this.sessionId = sessionId;
  }

  /**
   * 获取当前 Trace ID
   */
  getTraceId(): string {
    return this.traceId;
  }

  /**
   * 采样判断
   */
  private shouldSample(): boolean {
    if (this.config.sampleRate === undefined || this.config.sampleRate >= 1) {
      return true;
    }
    return Math.random() < this.config.sampleRate;
  }

  /**
   * 开始一个 Span
   */
  startSpan(name: string, options: SpanOptions = {}): string {
    if (!this.shouldSample()) {
      return '';
    }

    const spanId = generateSpanId();
    const span: TraceSpan = {
      traceId: this.traceId,
      spanId,
      parentSpanId: options.parentSpanId,
      name,
      kind: options.kind || 'internal',
      startTime: Date.now(),
      attributes: {
        ...options.attributes,
        'service.name': this.config.serviceName,
      },
      status: 'unsettled',
      events: [],
    };

    if (this.sessionId) {
      span.attributes['session.id'] = this.sessionId;
    }

    this.activeSpans.set(spanId, span);
    return spanId;
  }

  /**
   * 结束一个 Span
   */
  endSpan(spanId: string, status: SpanStatus = 'ok', statusMessage?: string): void {
    const span = this.activeSpans.get(spanId);
    if (!span) return;

    span.endTime = Date.now();
    span.status = status;
    span.statusMessage = statusMessage;
    this.activeSpans.delete(spanId);
    this.completedSpans.push(span);

    // 达到阈值自动导出
    if (this.completedSpans.length >= 100) {
      this.flush().catch(console.error);
    }
  }

  /**
   * 设置 Span 属性
   */
  setAttribute(spanId: string, key: string, value: string | number | boolean): void {
    const span = this.activeSpans.get(spanId);
    if (span) {
      span.attributes[key] = value;
    }
  }

  /**
   * 设置多个 Span 属性
   */
  setAttributes(spanId: string, attributes: Record<string, string | number | boolean>): void {
    const span = this.activeSpans.get(spanId);
    if (span) {
      Object.assign(span.attributes, attributes);
    }
  }

  /**
   * 添加 Span 事件
   */
  addEvent(spanId: string, name: string, attributes?: Record<string, unknown>): void {
    const span = this.activeSpans.get(spanId);
    if (span) {
      span.events.push({
        name,
        timestamp: Date.now(),
        attributes,
      });
    }
  }

  /**
   * 记录错误
   */
  recordError(spanId: string, error: Error): void {
    const span = this.activeSpans.get(spanId);
    if (span) {
      span.status = 'error';
      span.statusMessage = error.message;
      span.attributes['error'] = true;
      span.attributes['error.message'] = error.message;
      span.attributes['error.stack'] = error.stack || '';

      span.events.push({
        name: 'exception',
        timestamp: Date.now(),
        attributes: {
          'exception.type': error.name,
          'exception.message': error.message,
          'exception.stacktrace': error.stack || '',
        },
      });
    }
  }

  /**
   * 追踪异步函数执行（工具）
   */
  async traceTool<T>(
    toolName: string,
    input: Record<string, unknown>,
    fn: () => Promise<T>
  ): Promise<T> {
    const spanId = this.startSpan(`tool.${toolName}`, {
      attributes: {
        'tool.name': toolName,
        'tool.input': JSON.stringify(input).slice(0, 1000),
      },
    });

    if (!spanId) {
      return fn();
    }

    try {
      const result = await fn();
      this.addEvent(spanId, 'tool.success');
      this.endSpan(spanId, 'ok');
      return result;
    } catch (error) {
      this.recordError(spanId, error instanceof Error ? error : new Error(String(error)));
      this.endSpan(spanId, 'error');
      throw error;
    }
  }

  /**
   * 追踪 LLM 调用
   */
  async traceLLM<T>(
    model: string,
    messages: unknown[],
    fn: () => Promise<T>
  ): Promise<T> {
    const spanId = this.startSpan(`llm.${model}`, {
      attributes: {
        'llm.model': model,
        'llm.message_count': messages.length,
      },
    });

    if (!spanId) {
      return fn();
    }

    try {
      const result = await fn() as T & { usage?: { input_tokens?: number; output_tokens?: number } };

      if (result && typeof result === 'object') {
        const r = result as Record<string, unknown>;
        if (r.usage) {
          const u = r.usage as Record<string, number>;
          this.setAttribute(spanId, 'llm.input_tokens', u.input_tokens || 0);
          this.setAttribute(spanId, 'llm.output_tokens', u.output_tokens || 0);
          this.setAttribute(spanId, 'llm.total_tokens', (u.input_tokens || 0) + (u.output_tokens || 0));
        }
      }

      this.addEvent(spanId, 'llm.response');
      this.endSpan(spanId, 'ok');
      return result;
    } catch (error) {
      this.recordError(spanId, error instanceof Error ? error : new Error(String(error)));
      this.endSpan(spanId, 'error');
      throw error;
    }
  }

  /**
   * 追踪同步函数执行
   */
  traceSync<T>(name: string, fn: () => T): T {
    const spanId = this.startSpan(name);

    if (!spanId) {
      return fn();
    }

    try {
      const result = fn();
      this.endSpan(spanId, 'ok');
      return result;
    } catch (error) {
      this.recordError(spanId, error instanceof Error ? error : new Error(String(error)));
      this.endSpan(spanId, 'error');
      throw error;
    }
  }

  /**
   * 导出当前累积的 Spans
   */
  async flush(): Promise<void> {
    if (this.completedSpans.length === 0) return;

    const spans = [...this.completedSpans];
    this.completedSpans = [];

    try {
      await this.exporter.export(spans);
    } catch (error) {
      console.error('[AgentTracer] Flush error:', error);
    }
  }

  /**
   * 获取当前活跃的 Spans
   */
  getActiveSpans(): TraceSpan[] {
    return Array.from(this.activeSpans.values());
  }

  /**
   * 获取已完成的 Spans
   */
  getCompletedSpans(): TraceSpan[] {
    return [...this.completedSpans];
  }

  /**
   * 获取所有 Spans（活跃 + 已完成）
   */
  getAllSpans(): TraceSpan[] {
    return [...this.activeSpans.values(), ...this.completedSpans];
  }

  /**
   * 关闭 Tracer
   */
  async shutdown(): Promise<void> {
    await this.flush();
    await this.exporter.shutdown();
  }
}

/**
 * 创建 Tracer
 */
export function createTracer(config: TracerConfig): AgentTracer {
  return new AgentTracer(config);
}

/**
 * 初始化全局 Tracer
 */
export function initGlobalTracer(config: TracerConfig): AgentTracer {
  const tracer = new AgentTracer(config);
  setGlobalTracer(tracer);
  return tracer;
}

// 便捷函数：使用全局 Tracer
let _globalSpanId = '';

/**
 * 全局开始 Span
 */
export function startSpan(name: string, options?: SpanOptions): string {
  if (!globalTracer) return '';
  _globalSpanId = globalTracer.startSpan(name, options);
  return _globalSpanId;
}

/**
 * 全局结束 Span
 */
export function endSpan(status: SpanStatus = 'ok', statusMessage?: string): void {
  if (!globalTracer || !_globalSpanId) return;
  globalTracer.endSpan(_globalSpanId, status, statusMessage);
  _globalSpanId = '';
}

/**
 * 全局追踪工具执行
 */
export async function traceTool<T>(
  toolName: string,
  input: Record<string, unknown>,
  fn: () => Promise<T>
): Promise<T> {
  if (!globalTracer) return fn();
  return globalTracer.traceTool(toolName, input, fn);
}

/**
 * 全局追踪 LLM 调用
 */
export async function traceLLM<T>(
  model: string,
  messages: unknown[],
  fn: () => Promise<T>
): Promise<T> {
  if (!globalTracer) return fn();
  return globalTracer.traceLLM(model, messages, fn);
}

/**
 * 全局刷新导出
 */
export async function flushTrace(): Promise<void> {
  if (globalTracer) {
    await globalTracer.flush();
  }
}

// 类型导出
export type { TracerConfig, TraceSpan, TraceEvent, SpanKind, SpanStatus, SpanOptions } from './types.js';
