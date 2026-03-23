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
 * 过滤级别
 */
export type FilterLevel = 'full' | 'smart' | 'minimal';

/**
 * 默认过滤级别
 */
export const DEFAULT_FILTER_LEVEL: FilterLevel = 'smart';

/**
 * 默认是否格式化输出
 */
export const DEFAULT_PRETTY_PRINT = true;

/**
 * 需要过滤的元数据字段
 */
const METADATA_FIELDS = new Set([
  'annotations',
  'metadata',
  'mimeType',
  'uri',
  'data',
  'encoding',
  'size',
  'timestamp',
  'created_at',
  'updated_at',
  '_raw',
  '__typename',
]);

/**
 * 需要保留的顶层字段（minimal 模式）
 */
const ESSENTIAL_FIELDS = new Set([
  'title',
  'name',
  'description',
  'content',
  'text',
  'body',
  'message',
  'result',
  'status',
  'error',
  'data',
  'items',
  'results',
  'files',
  'commit',
  'branch',
  'url',
  'id',
]);

/**
 * 智能过滤 JSON 数据
 *
 * @param data - 原始数据
 * @param level - 过滤级别: full(完整) / smart(智能) / minimal(最小)
 * @returns 过滤后的数据
 */
export function filterJsonData(data: unknown, level: FilterLevel = DEFAULT_FILTER_LEVEL): unknown {
  // full 模式：不做过滤
  if (level === 'full') {
    return data;
  }

  // null / undefined
  if (data === null || data === undefined) {
    return data;
  }

  // 字符串：直接返回
  if (typeof data === 'string') {
    return data;
  }

  // 数字、布尔值：直接返回
  if (typeof data === 'number' || typeof data === 'boolean') {
    return data;
  }

  // 数组：过滤每个元素
  if (Array.isArray(data)) {
    const filtered = data
      .map(item => filterJsonData(item, level))
      .filter(item => item !== null && item !== undefined && item !== '');
    return filtered.length > 0 ? filtered : undefined;
  }

  // 对象：按级别过滤
  if (typeof data === 'object') {
    return filterObject(data as Record<string, unknown>, level);
  }

  return data;
}

/**
 * 过滤对象
 */
function filterObject(obj: Record<string, unknown>, level: FilterLevel): unknown {
  // MCP 标准格式：检查 content 数组
  if ('content' in obj && Array.isArray(obj.content)) {
    const filteredContent = obj.content
      .map((item: unknown) => filterMcpContentItem(item, level))
      .filter((item: unknown) => item !== null && item !== undefined && item !== '');

    if (filteredContent.length === 0) {
      return undefined;
    }

    return {
      content: filteredContent,
    };
  }

  // 普通 JSON 对象
  if (level === 'minimal') {
    // minimal 模式：只保留关键字段
    const filtered: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (ESSENTIAL_FIELDS.has(key)) {
        const filteredValue = filterJsonData(value, level);
        if (filteredValue !== undefined) {
          filtered[key] = filteredValue;
        }
      }
    }
    return Object.keys(filtered).length > 0 ? filtered : undefined;
  }

  // smart 模式：过滤元数据，保留其他
  const filtered: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    // 跳过元数据字段
    if (METADATA_FIELDS.has(key)) {
      continue;
    }

    const filteredValue = filterJsonData(value, level);
    if (filteredValue !== undefined) {
      filtered[key] = filteredValue;
    }
  }

  return Object.keys(filtered).length > 0 ? filtered : undefined;
}

/**
 * 过滤 MCP 内容项
 *
 * MCP 返回格式：
 * { content: [{ type: 'text', text: '...' }, { type: 'resource', resource: {...} }] }
 */
function filterMcpContentItem(item: unknown, level: FilterLevel): unknown {
  if (typeof item !== 'object' || item === null) {
    return item;
  }

  const obj = item as Record<string, unknown>;

  // type === 'text': 提取 text 字段
  if (obj.type === 'text') {
    if (level === 'full') {
      return item;
    }
    return {
      type: 'text',
      text: obj.text,
    };
  }

  // type === 'resource': 提取关键信息
  if (obj.type === 'resource') {
    if (level === 'full') {
      return item;
    }
    if (level === 'minimal') {
      // minimal: 完全跳过
      return undefined;
    }
    // smart: 提取 resource 中的关键信息
    const resource = obj.resource;
    if (typeof resource === 'object' && resource !== null) {
      return {
        type: 'resource',
        text: (resource as Record<string, unknown>).text ||
              (resource as Record<string, unknown>).content ||
              '[Resource content]',
      };
    }
    return { type: 'resource' };
  }

  // type === 'image': 提取描述
  if (obj.type === 'image') {
    if (level === 'full') {
      return item;
    }
    return {
      type: 'image',
      text: '[Image content - see screenshot]',
    };
  }

  // 其他类型：smart 过滤
  return filterObject(obj, level);
}

/**
 * 创建 JSON 结果（带智能过滤）
 *
 * @param data - 原始数据
 * @param options - 选项
 * @param options.level - 过滤级别: full / smart / minimal（默认 smart）
 * @param options.pretty - 是否格式化输出（默认 true，保持兼容）
 */
export function jsonResult(
  data: unknown,
  options?: { level?: FilterLevel; pretty?: boolean }
): JsonToolResult {
  const level = options?.level ?? DEFAULT_FILTER_LEVEL;
  const filtered = filterJsonData(data, level) ?? data; // 确保不会返回 undefined
  const pretty = options?.pretty ?? DEFAULT_PRETTY_PRINT;

  let content: string;
  if (pretty) {
    content = JSON.stringify(filtered, null, 2);
  } else {
    content = JSON.stringify(filtered);
  }

  return {
    content,
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
