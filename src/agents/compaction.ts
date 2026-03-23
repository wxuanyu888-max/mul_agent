/**
 * 上下文压缩模块
 *
 * 三层压缩策略：
 * 1. micro_compact: 每次 LLM 调用前，将旧的 tool result 替换为占位符
 * 2. auto_compact: token 超过阈值时，保存完整对话到磁盘，让 LLM 做摘要
 * 3. manual compact: 手动调用 compact 工具触发同样的摘要机制
 */

import * as fs from 'fs';
import * as path from 'path';
import { getLLMClient } from './llm.js';
import type { Message, ContentBlock } from './types.js';
import { getLogsPath } from '../utils/path.js';

/**
 * 压缩配置
 */
export interface CompactionConfig {
  /** 最大 token 数阈值，超过时触发 auto_compact */
  autoCompactThreshold?: number;
  /** 保留最近 N 个 tool result */
  keepRecentResults?: number;
  /** tool result 超过此长度才进行 micro_compact */
  minResultLengthForCompact?: number;
  /** 摘要最大 token 数 */
  summaryMaxTokens?: number;
  /** 是否保留系统消息 */
  preserveSystem?: boolean;
  /** transcript 保存目录 */
  transcriptDir?: string;
}

/**
 * 压缩上下文（用于在循环中保持状态）
 */
export interface CompactionContext {
  /** 已压缩次数 */
  compactionCount: number;
  /** 上次压缩的 token 数 */
  lastCompactionTokens: number;
  /** transcript 文件路径 */
  transcriptPath?: string;
  /** tool result 占位符映射 */
  toolResultPlaceholders: Map<string, string>;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: Required<CompactionConfig> = {
  autoCompactThreshold: 50000,
  keepRecentResults: 3,
  minResultLengthForCompact: 100,
  summaryMaxTokens: 2000,
  preserveSystem: true,
  transcriptDir: 'storage/runtime/transcripts',
};

/**
 * 简单估算 token (中文约 1.5 字符/token, 英文约 4 字符/token)
 */
function estimateTokens(text: string): number {
  if (!text) return 0;
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const otherChars = text.length - chineseChars;
  return Math.ceil(chineseChars * 0.7 + otherChars * 0.25);
}

/**
 * Layer 1: micro_compact
 * 将旧的 tool result 替换为占位符，减少每个 turn 的 token 使用
 */
export function microCompact(
  messages: Message[],
  config: CompactionConfig = {},
  context?: CompactionContext
): { messages: Message[]; context: CompactionContext } {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const ctx: CompactionContext = context ?? createCompactionContext();

  let replacedCount = 0;
  const toolResults: { index: number; content: string; toolName?: string }[] = [];

  // 收集所有 tool result 消息
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];

    // 查找 tool_result 类型的消息
    if (msg.role === 'user') {
      const content = msg.content;

      // 兼容两种格式：
      // 1. content 是字符串（新版）
      // 2. content 是数组，包含 tool_result 块（旧版/混合）
      if (typeof content === 'string') {
        // 检查是否是 tool result（通过 tool_call_id 判断）
        if (msg.tool_call_id && content.length > (cfg.minResultLengthForCompact ?? 100)) {
          toolResults.push({ index: i, content, toolName: undefined });
        }
      } else if (Array.isArray(content)) {
        for (let j = 0; j < content.length; j++) {
          const part = content[j];
          if (part && typeof part === 'object' && part.type === 'tool_result') {
            const contentStr = part.content || '';
            if (typeof contentStr === 'string' && contentStr.length > (cfg.minResultLengthForCompact ?? 100)) {
              // 尝试从原始消息中提取工具名称
              const toolName = extractToolName(messages, i, j);
              toolResults.push({ index: i, content: contentStr, toolName });
            }
          }
        }
      }
    }
  }

  // 如果 tool result 数量超过保留阈值，进行替换
  const keepCount = cfg.keepRecentResults ?? 3;
  if (toolResults.length > keepCount) {
    const toReplace = toolResults.slice(0, -keepCount);

    for (const result of toReplace) {
      const placeholder = `[Previous: used ${result.toolName || 'tool'}]`;

      // 生成唯一占位符 ID
      const placeholderId = `placeholder_${ctx.compactionCount}_${replacedCount}`;
      ctx.toolResultPlaceholders.set(placeholderId, result.content);

      // 替换消息内容
      const msg = messages[result.index];
      if (typeof msg.content === 'string') {
        msg.content = placeholder;
      } else if (Array.isArray(msg.content)) {
        for (let j = 0; j < msg.content.length; j++) {
          const part = msg.content[j];
          if (part && typeof part === 'object' && part.type === 'tool_result') {
            msg.content[j] = { ...part, content: placeholder };
          }
        }
      }

      replacedCount++;
    }
  }

  return { messages, context: ctx };
}

/**
 * 从消息中提取工具名称
 */
function extractToolName(messages: Message[], msgIndex: number, _partIndex: number): string | undefined {
  // 向前查找最近的 assistant 消息中的 tool_calls
  for (let i = msgIndex - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === 'assistant' && msg.content) {
      try {
        // 尝试解析 JSON 内容
        const contentStr = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
        const parsed = JSON.parse(contentStr);
        if (parsed.tool_calls && Array.isArray(parsed.tool_calls)) {
          return parsed.tool_calls[0]?.name;
        }
      } catch {
        // 不是 JSON，继续
      }
    }
  }
  return undefined;
}

/**
 * 估算消息列表的 token 数量
 */
export function estimateMessageTokens(messages: Message[]): number {
  return messages.reduce((sum, m) => {
    if (!m) return sum;

    // 处理不同格式的消息
    let content = '';
    if (typeof m.content === 'string') {
      content = m.content;
    } else if (Array.isArray(m.content)) {
      content = m.content
        .map((part: ContentBlock) => (typeof part === 'string' ? part : part.content || ''))
        .join('\n');
    }

    return sum + estimateTokens(content);
  }, 0);
}

/**
 * 检查是否需要 auto_compact
 */
export function needsAutoCompact(messages: Message[], threshold: number): boolean {
  return estimateMessageTokens(messages) > threshold;
}

/**
 * Layer 2: auto_compact
 * token 超过阈值时，保存完整对话到磁盘，让 LLM 做摘要
 */
export async function autoCompact(
  messages: Message[],
  config: CompactionConfig = {},
  context?: CompactionContext
): Promise<{ messages: Message[]; context: CompactionContext }> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const ctx: CompactionContext = context ?? createCompactionContext();

  // 1. 保存完整 transcript 到磁盘
  const transcriptDir = cfg.transcriptDir ?? 'storage/runtime/transcripts';
  const timestamp = Date.now();
  const transcriptPath = path.join(transcriptDir, `transcript_${timestamp}.jsonl`);

  // 确保目录存在
  if (!fs.existsSync(transcriptDir)) {
    fs.mkdirSync(transcriptDir, { recursive: true });
  }

  // 保存 transcript
  const transcriptStream = fs.createWriteStream(transcriptPath);
  for (const msg of messages) {
    transcriptStream.write(JSON.stringify(msg, (key, value) => {
      // 处理不可序列化的值
      if (value instanceof Map) {
        return Object.fromEntries(value);
      }
      return value;
    }) + '\n');
  }
  transcriptStream.end();

  ctx.transcriptPath = transcriptPath;

  // 2. 使用 LLM 做摘要
  try {
    const llm = getLLMClient();

    // 准备摘要的上下文（限制长度避免超出 LLM 限制）
    const messagesText = JSON.stringify(messages, null, 2);
    const truncatedText = messagesText.slice(0, 80000); // 限制输入长度

    const summaryResponse = await llm.chat({
      model: (llm as any).model || 'default',
      messages: [
        {
          role: 'user',
          content: `Please summarize the following conversation for continuity. Include:
1. Main topics discussed
2. Key actions taken (files created, edited, commands run)
3. Current task progress
4. Any important decisions or conclusions

Conversation:
${truncatedText}`,
        },
      ],
      max_tokens: cfg.summaryMaxTokens ?? 2000,
    });

    // 提取摘要文本
    const summaryText = extractTextFromResponse(summaryResponse);

    // 3. 用摘要替换所有消息
    const summaryMessage: Message = {
      role: 'user',
      content: `[Compressed conversation at ${new Date(timestamp).toISOString()}]


## Summary

${summaryText}

---
Previous messages (${messages.length}) have been saved to: ${transcriptPath}
Use the transcript file to recover full details if needed.`,
    };

    // 构建新的消息列表
    const compacted: Message[] = [summaryMessage];

    // 保留系统消息（如果配置允许）
    if (cfg.preserveSystem) {
      const systemMsgs = messages.filter((m) => m.role === 'system');
      compacted.unshift(...systemMsgs);
    }

    // 添加一个确认消息
    compacted.push({
      role: 'assistant',
      content: 'Understood. I will continue with the summarized context.',
    });

    ctx.compactionCount++;
    ctx.lastCompactionTokens = estimateMessageTokens(compacted);

    return { messages: compacted, context: ctx };
  } catch (error) {
    // 如果 LLM 摘要失败，至少清理一下消息
    console.error('[Compaction] LLM summary failed:', error);

    const fallbackSummary: Message = {
      role: 'user',
      content: `[Compressed] ${messages.length} messages (summary failed, see ${transcriptPath})`,
    };

    ctx.compactionCount++;
    ctx.lastCompactionTokens = estimateMessageTokens([fallbackSummary]);

    return { messages: [fallbackSummary], context: ctx };
  }
}

/**
 * 从 LLM 响应中提取文本内容
 */
function extractTextFromResponse(response: { content?: Array<{ type: string; text?: string }> }): string {
  if (!response.content) return '';

  const textBlocks = response.content.filter((block) => block.type === 'text');
  return textBlocks.map((block) => block.text || '').join('\n');
}

/**
 * Layer 3: manual compact
 * 手动触发压缩（与 auto_compact 相同逻辑）
 */
export async function manualCompact(
  messages: Message[],
  config: CompactionConfig = {},
  context?: CompactionContext
): Promise<{ messages: Message[]; context: CompactionContext }> {
  return autoCompact(messages, config, context);
}

/**
 * 压缩消息历史（兼容旧 API）
 *
 * 策略：
 * 1. 保留所有系统消息
 * 2. 保留最近 N 条消息
 * 3. 对中间消息进行摘要
 */
export function compactMessages(messages: Message[], config: CompactionConfig): Message[] {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  // 不需要压缩
  if (messages.length <= (cfg.keepRecentResults ?? 3) * 2) {
    return messages;
  }

  // 计算当前 token
  const currentTokens = estimateMessageTokens(messages);

  // 不需要压缩
  if (currentTokens <= (cfg.autoCompactThreshold ?? 50000)) {
    return messages;
  }

  // 需要压缩
  const preserveCount = cfg.keepRecentResults ?? 3;
  const recentMessages = messages.slice(-preserveCount);
  const oldMessages = messages.slice(0, -preserveCount);

  // 对旧消息进行摘要（简化版）
  const summaryText = createDefaultSummary(oldMessages);

  // 构建压缩后的消息列表
  const compacted: Message[] = [];

  if (cfg.preserveSystem) {
    compacted.push(summaryText);
  }

  compacted.push(...recentMessages);

  return compacted;
}

/**
 * 创建默认摘要
 */
function createDefaultSummary(messages: Message[]): Message {
  const userMessages = messages.filter(m => m.role === 'user');
  const assistantMessages = messages.filter(m => m.role === 'assistant');

  const summaryParts: string[] = [];

  // 统计
  summaryParts.push(`- Total messages: ${messages.length}`);
  summaryParts.push(`- User messages: ${userMessages.length}`);
  summaryParts.push(`- Assistant messages: ${assistantMessages.length}`);

  // 提取主题关键词 (简化版)
  const allContent = messages.map(m => m.content).join(' ');
  const words = allContent.split(/\s+/).filter(w => w.length > 5);
  const uniqueWords = [...new Set(words)].slice(0, 10);

  if (uniqueWords.length > 0) {
    summaryParts.push(`- Topics: ${uniqueWords.join(', ')}`);
  }

  // 时间范围
  if (messages.length > 0) {
    const startTime = messages[0].timestamp ?? Date.now();
    const endTime = messages[messages.length - 1].timestamp ?? Date.now();
    const start = new Date(startTime).toLocaleDateString();
    const end = new Date(endTime).toLocaleDateString();
    summaryParts.push(`- Time range: ${start} to ${end}`);
  }

  return {
    id: generateId(),
    role: 'system',
    content: `## Previous Conversation\n${summaryParts.join('\n')}\n\n(Older messages have been summarized)`,
    timestamp: messages[0].timestamp ?? Date.now(),
  };
}

/**
 * 检查是否需要压缩（兼容旧 API）
 */
export function needsCompaction(messages: Message[], maxTokens: number): boolean {
  const currentTokens = estimateMessageTokens(messages);
  return currentTokens > maxTokens;
}

/**
 * 创建压缩上下文
 */
export function createCompactionContext(): CompactionContext {
  return {
    compactionCount: 0,
    lastCompactionTokens: 0,
    toolResultPlaceholders: new Map(),
  };
}

/**
 * 生成唯一 ID
 */
function generateId(): string {
  return crypto.randomUUID();
}
