// Tools 类型定义

/**
 * 工具结果
 */
export interface ToolResult {
  content: string;
  error?: string;
}

/**
 * JSON 格式工具结果
 */
export interface JsonToolResult extends ToolResult {
  content: string;
}

/**
 * 创建 JSON 结果
 */
export function jsonResult(data: unknown): JsonToolResult {
  return {
    content: JSON.stringify(data, null, 2),
  };
}

/**
 * 创建错误结果
 */
export function errorResult(message: string): JsonToolResult {
  return {
    content: JSON.stringify({ error: message }),
    error: message,
  };
}
