/**
 * Trace 导出器
 *
 * 支持多种导出方式：Console, Jaeger, OTLP
 */

import type { TraceSpan, TracerConfig } from './types.js';

/**
 * 导出器接口
 */
export interface TraceExporter {
  export(spans: TraceSpan[]): Promise<void>;
  shutdown(): Promise<void>;
}

/**
 * Console 导出器（开发调试用）
 */
export class ConsoleExporter implements TraceExporter {
  private debug: boolean;

  constructor(debug = false) {
    this.debug = debug;
  }

  async export(spans: TraceSpan[]): Promise<void> {
    for (const span of spans) {
      const duration = span.endTime ? span.endTime - span.startTime : 0;
      const statusIcon = span.status === 'ok' ? '✓' : span.status === 'error' ? '✗' : '○';

      if (this.debug) {
        console.log(`[Trace] ${statusIcon} ${span.name}`, {
          traceId: span.traceId.slice(0, 8),
          spanId: span.spanId.slice(0, 8),
          duration: `${duration}ms`,
          kind: span.kind,
          attributes: span.attributes,
        });
      } else {
        console.log(`[Trace] ${statusIcon} ${span.name} - ${duration}ms`);
      }
    }
  }

  async shutdown(): Promise<void> {
    // 无需清理
  }
}

/**
 * Jaeger Thrift 导出器
 */
export class JaegerExporter implements TraceExporter {
  private endpoint: string;
  private serviceName: string;
  private batch: TraceSpan[] = [];
  private flushInterval: number;
  private timeout: NodeJS.Timeout | null = null;

  constructor(endpoint: string, serviceName: string, flushIntervalMs = 5000) {
    this.endpoint = endpoint;
    this.serviceName = serviceName;
    this.flushInterval = flushIntervalMs;
    this.startFlushTimer();
  }

  private startFlushTimer(): void {
    this.timeout = setInterval(() => {
      this.flush().catch(console.error);
    }, this.flushInterval);
  }

  async export(spans: TraceSpan[]): Promise<void> {
    this.batch.push(...spans);

    // 达到阈值自动导出
    if (this.batch.length >= 100) {
      await this.flush();
    }
  }

  private async flush(): Promise<void> {
    if (this.batch.length === 0) return;

    const spans = [...this.batch];
    this.batch = [];

    try {
      const thriftSpans = spans.map(this.toThriftSpan.bind(this));

      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-thrift' },
        body: this.encodeThriftBatch(this.serviceName, thriftSpans),
      });

      if (!response.ok) {
        console.error('[JaegerExporter] Export failed:', response.statusText);
      }
    } catch (error) {
      console.error('[JaegerExporter] Export error:', error);
    }
  }

  private toThriftSpan(span: TraceSpan): object {
    return {
      traceIdHigh: span.traceId.slice(0, 16),
      traceIdLow: span.traceId.slice(16),
      spanId: this.hexToInt64(span.spanId),
      parentSpanId: span.parentSpanId ? this.hexToInt64(span.parentSpanId) : 0,
      operationName: span.name,
      flags: span.status === 'error' ? 1 : 0,
      startTime: Math.floor(span.startTime / 1000), // 微秒
      duration: (span.endTime || Date.now()) - span.startTime, // 毫秒
      tags: Object.entries(span.attributes).map(([key, value]) => ({
        key,
        vStr: String(value),
        vType: 'STRING',
      })),
    };
  }

  private hexToInt64(hex: string): number {
    return parseInt(hex.slice(-16), 16);
  }

  private encodeThriftBatch(serviceName: string, spans: object[]): ArrayBuffer {
    // 简化的 Thrift 编码 - 实际生产应使用 thrift 库
    const encoder = new TextEncoder();
    const data = JSON.stringify({ serviceName, spans });
    return encoder.encode(data).buffer;
  }

  async shutdown(): Promise<void> {
    if (this.timeout) {
      clearInterval(this.timeout);
    }
    await this.flush();
  }
}

/**
 * OTLP (OpenTelemetry Protocol) 导出器
 */
export class OTLPExporter implements TraceExporter {
  private endpoint: string;
  private headers: Record<string, string>;

  constructor(endpoint: string, headers: Record<string, string> = {}) {
    this.endpoint = endpoint;
    this.headers = headers;
  }

  async export(spans: TraceSpan[]): Promise<void> {
    const otlpSpans = spans.map(this.toOTLPSpan.bind(this));

    try {
      const response = await fetch(`${this.endpoint}/v1/traces`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.headers,
        },
        body: JSON.stringify({
          resourceSpans: [{
            resource: {
              attributes: [
                { key: 'service.name', value: { stringValue: 'mul-agent' } },
              ],
            },
            scopeSpans: [{
              spans: otlpSpans,
            }],
          }],
        }),
      });

      if (!response.ok) {
        console.error('[OTLPExporter] Export failed:', response.statusText);
      }
    } catch (error) {
      console.error('[OTLPExporter] Export error:', error);
    }
  }

  private toOTLPSpan(span: TraceSpan): object {
    return {
      traceId: span.traceId,
      spanId: span.spanId,
      parentSpanId: span.parentSpanId || undefined,
      name: span.name,
      kind: span.kind.toUpperCase(),
      startTimeUnixNano: span.startTime * 1_000_000,
      endTimeUnixNano: (span.endTime || Date.now()) * 1_000_000,
      attributes: Object.entries(span.attributes).map(([key, value]) => ({
        key,
        value: {
          stringValue: String(value),
        },
      })),
      status: {
        code: span.status === 'ok' ? 1 : span.status === 'error' ? 2 : 0,
        message: span.statusMessage,
      },
      events: span.events.map(e => ({
        timeUnixNano: e.timestamp * 1_000_000,
        name: e.name,
        attributes: e.attributes ? Object.entries(e.attributes).map(([key, value]) => ({
          key,
          value: { stringValue: String(value) },
        })) : [],
      })),
    };
  }

  async shutdown(): Promise<void> {
    // 无需清理
  }
}

/**
 * 创建导出器
 */
export function createExporter(config: TracerConfig): TraceExporter {
  switch (config.exporter) {
    case 'console':
      return new ConsoleExporter(config.debug);
    case 'jaeger':
      if (!config.endpoint) {
        throw new Error('Jaeger endpoint is required');
      }
      return new JaegerExporter(config.endpoint, config.serviceName);
    case 'otlp':
      if (!config.endpoint) {
        throw new Error('OTLP endpoint is required');
      }
      return new OTLPExporter(config.endpoint);
    case 'none':
    default:
      // 空导出器
      return {
        export: async () => {},
        shutdown: async () => {},
      };
  }
}
