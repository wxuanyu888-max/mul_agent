/**
 * 上下文压缩模块
 *
 * 三层压缩策略：
 * 1. micro_compact: 每次 LLM 调用前，将旧的 tool result 替换为占位符
 * 2. auto_compact: token 超过阈值时，保存完整对话到磁盘，让 LLM 做摘要
 * 3. manual compact: 手动调用 compact 工具触发同样的摘要机制
 *
 * 压缩前会触发记忆更新（short_term 和 long_term）
 */

import * as fs from 'fs';
import * as path from 'path';
import { getLLMClient } from './llm.js';
import type { Message, ContentBlock } from './types.js';
import { getLogsPath } from '../utils/path.js';
import { MemoryPersistence, getMemoryPersistence } from '../memory/persistence.js';

/**
 * 压缩配置
 */
export interface CompactionConfig {
  /** 最大 token 数阈值，超过时触发 auto_compact */
  autoCompactThreshold?: number;
  /** 保留最近 N 个 tool result */
  keepRecentResults?: number;
  /** 保留最近 N 条用户消息（包含当前需求），不压缩 */
  keepRecentUserMessages?: number;
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
  keepRecentUserMessages: 2,
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
 *
 * 重要：保留用户最近的消息（包含当前任务需求），只压缩历史上下文
 *
 * 压缩前会自动更新 short_term 和 long_term 记忆
 */
export async function autoCompact(
  messages: Message[],
  config: CompactionConfig = {},
  context?: CompactionContext,
  agentId?: string
): Promise<{ messages: Message[]; context: CompactionContext }> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const ctx: CompactionContext = context ?? createCompactionContext();

  // 0. 压缩前更新 short_term 和 long_term 记忆
  await updateMemoriesBeforeCompaction(messages, agentId);

  // 1. 保留用户最近的消息（包含当前需求），不压缩
  const keepRecentUserCount = cfg.keepRecentUserMessages ?? 2;
  const userMessages = messages.filter((m) => m.role === 'user');
  const recentUserMessages = userMessages.slice(-keepRecentUserCount);

  // 找出需要保留的消息索引（用户最近的消息 + 系统消息 + tool results）
  const recentUserIndices = new Set<number>();
  let userCount = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') {
      if (userCount < keepRecentUserCount) {
        recentUserIndices.add(i);
        userCount++;
      }
    }
  }

  // 分类消息：需要压缩的历史消息 vs 保留的消息
  const messagesToCompress = messages.filter((_, i) => !recentUserIndices.has(i));
  const messagesToPreserve = messages.filter((_, i) => recentUserIndices.has(i));

  // 2. 保存完整 transcript 到磁盘
  const transcriptDir = cfg.transcriptDir ?? 'storage/runtime/transcripts';
  const timestamp = Date.now();
  const transcriptPath = path.join(transcriptDir, `transcript_${timestamp}.jsonl`);

  // 确保目录存在
  if (!fs.existsSync(transcriptDir)) {
    fs.mkdirSync(transcriptDir, { recursive: true });
  }

  // 保存 transcript（保存所有消息）
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

  // 3. 使用 LLM 对历史消息做摘要
  let summaryText = '';
  try {
    const llm = getLLMClient();

    // 只对需要压缩的历史消息做摘要
    const messagesToCompressText = JSON.stringify(messagesToCompress, null, 2);
    const truncatedText = messagesToCompressText.slice(0, 80000);

    const summaryResponse = await llm.chat({
      model: (llm as any).model || 'default',
      messages: [
        {
          role: 'user',
          content: `Please summarize the following conversation history for continuity. Include:
1. Main topics discussed
2. Key actions taken (files created, edited, commands run)
3. Any important decisions or conclusions
4. Progress made on tasks

Conversation History (to be summarized):
${truncatedText}`,
        },
      ],
      max_tokens: cfg.summaryMaxTokens ?? 2000,
    });

    summaryText = extractTextFromResponse(summaryResponse);
  } catch (error) {
    console.error('[Compaction] LLM summary failed:', error);
    summaryText = `[Summary failed - ${messagesToCompress.length} messages preserved in transcript]`;
  }

  // 4. 构建新的消息列表
  const compacted: Message[] = [];

  // 保留系统消息（如果配置允许）
  if (cfg.preserveSystem) {
    const systemMsgs = messages.filter((m) => m.role === 'system');
    compacted.push(...systemMsgs);
  }

  // 添加历史摘要
  if (messagesToCompress.length > 0) {
    const summaryMessage: Message = {
      role: 'user',
      content: `[Previous conversation (${messagesToCompress.length} messages) summarized at ${new Date(timestamp).toISOString()}]

## Summary

${summaryText}

---
Full transcript saved to: ${transcriptPath}`,
    };
    compacted.push(summaryMessage);
  }

  // 保留用户最近的消息（当前需求）
  compacted.push(...messagesToPreserve);

  // 添加一个确认消息
  compacted.push({
    role: 'assistant',
    content: 'Understood. I will continue with the current task using the preserved context.',
  });

  ctx.compactionCount++;
  ctx.lastCompactionTokens = estimateMessageTokens(compacted);

  return { messages: compacted, context: ctx };
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
  context?: CompactionContext,
  agentId?: string
): Promise<{ messages: Message[]; context: CompactionContext }> {
  return autoCompact(messages, config, context, agentId);
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

/**
 * 压缩前更新 short_term 和 long_term 记忆
 *
 * 将当前会话的重要信息保存到记忆中，确保压缩后不会丢失
 */
async function updateMemoriesBeforeCompaction(
  messages: Message[],
  agentId?: string
): Promise<void> {
  try {
    const persistence = getMemoryPersistence(agentId);

    // 提取对话摘要信息
    const userMessages = messages.filter((m) => m.role === 'user');
    const assistantMessages = messages.filter((m) => m.role === 'assistant');

    // 构建 short_term 记忆内容
    const shortTermContent = buildShortTermSummary(messages);

    // 检查是否已有 short_term 记忆
    const existingShortTerm = await persistence.getByType('short_term');

    if (existingShortTerm.length > 0) {
      // 更新已有的 short_term 记忆
      const latest = existingShortTerm.sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      )[0];
      await persistence.update(latest.id, {
        content: { key: 'session_summary', value: shortTermContent },
      });
    } else {
      // 创建新的 short_term 记忆
      await persistence.add({
        agent_id: agentId || 'core_brain',
        type: 'short_term',
        content: { key: 'session_summary', value: shortTermContent },
      });
    }

    // 提取项目相关的重要信息作为 long_term
    const longTermContent = extractLongTermInfo(messages);
    if (longTermContent) {
      const existingLongTerm = await persistence.getByType('long_term');

      if (existingLongTerm.length > 0) {
        const latest = existingLongTerm.sort(
          (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        )[0];
        await persistence.update(latest.id, {
          content: { key: 'project_info', value: longTermContent },
        });
      } else {
        await persistence.add({
          agent_id: agentId || 'core_brain',
          type: 'long_term',
          content: { key: 'project_info', value: longTermContent },
        });
      }
    }

    console.log('[Compaction] Memories updated before compaction');
  } catch (error) {
    console.error('[Compaction] Failed to update memories:', error);
    // 不阻塞压缩流程
  }
}

/**
 * 构建短期记忆摘要
 */
function buildShortTermSummary(messages: Message[]): string {
  const parts: string[] = [];

  const userMessages = messages.filter((m) => m.role === 'user');
  const assistantMessages = messages.filter((m) => m.role === 'assistant');

  parts.push(`会话消息数: ${messages.length} (用户: ${userMessages.length}, 助手: ${assistantMessages.length})`);

  // 提取最近的用户请求（保留当前需求）
  if (userMessages.length > 0) {
    const recentUserMsgs = userMessages.slice(-2);
    const recentContent = recentUserMsgs
      .map((m) => {
        const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
        return content.slice(0, 200);
      })
      .join('\n');
    parts.push(`最近用户需求:\n${recentContent}`);
  }

  return parts.join('\n\n');
}

/**
 * 提取长期记忆信息
 * 从对话中提取项目结构、技术栈等持久化信息
 */
function extractLongTermInfo(messages: Message[]): string | null {
  const allContent = messages
    .map((m) => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content)))
    .join(' ');

  // 提取文件路径作为关键上下文
  const filePaths = allContent.match(/[a-zA-Z0-9_\-./]+\.(ts|js|json|md|yaml|yml)/g) || [];
  const uniquePaths = [...new Set(filePaths)].slice(0, 20);

  if (uniquePaths.length === 0) {
    return null;
  }

  return `相关文件:\n${uniquePaths.join('\n')}`;
}
