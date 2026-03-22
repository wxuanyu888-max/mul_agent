/**
 * Trace ID 生成器
 *
 * 生成符合 W3C Trace Context 规范的 ID
 */

/**
 * 生成 16 字节的 Trace ID (32 个十六进制字符)
 */
export function generateTraceId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * 生成 8 字节的 Span ID (16 个十六进制字符)
 */
export function generateSpanId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * 验证 Trace ID 格式
 */
export function isValidTraceId(id: string): boolean {
  return /^[0-9a-f]{32}$/i.test(id);
}

/**
 * 验证 Span ID 格式
 */
export function isValidSpanId(id: string): boolean {
  return /^[0-9a-f]{16}$/i.test(id);
}

/**
 * 从 W3C traceparent 头解析 Trace 信息
 */
export function parseTraceparent(header: string): {
  traceId: string;
  spanId: string;
  traceFlags: string;
} | null {
  const match = header.match(
    /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/i
  );

  if (!match) return null;

  return {
    traceId: match[1],
    spanId: match[2],
    traceFlags: match[3],
  };
}

/**
 * 生成 W3C traceparent 头
 */
export function generateTraceparent(traceId: string, spanId: string, traceFlags = '01'): string {
  return `00-${traceId}-${spanId}-${traceFlags}`;
}
