/**
 * 上下文压缩模块
 *
 * 当对话历史过长时，压缩消息以控制 token 使用
 */

import type { Message } from './types.js';

/**
 * 压缩配置
 */
export interface CompactionConfig {
  /** 最大 token 数 */
  maxTokens: number;
  /** 保留最近 N 条消息 */
  preserveLastN?: number;
  /** 是否保留系统消息 */
  preserveSystem?: boolean;
  /** 摘要函数 */
  summarize?: (messages: Message[]) => string;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: Required<CompactionConfig> = {
  maxTokens: 8000,
  preserveLastN: 20,
  preserveSystem: true,
};

/**
 * 简单估算 token (中文约 1.5 字符/token, 英文约 4 字符/token)
 */
function estimateTokens(text: string): number {
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const otherChars = text.length - chineseChars;
  return Math.ceil(chineseChars * 0.7 + otherChars * 0.25);
}

/**
 * 压缩消息历史
 *
 * 策略：
 * 1. 保留所有系统消息
 * 2. 保留最近 N 条消息
 * 3. 对中间消息进行摘要
 */
export function compactMessages(messages: Message[], config: CompactionConfig): Message[] {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  // 不需要压缩
  if (messages.length <= (cfg.preserveLastN ?? 20)) {
    return messages;
  }

  // 分离消息类型
  const systemMessages = cfg.preserveSystem
    ? messages.filter(m => m.role === 'system')
    : [];
  const nonSystemMessages = messages.filter(m => m.role !== 'system');

  // 计算当前 token
  const currentTokens = messages.reduce((sum, m) => sum + estimateTokens(m.content), 0);

  // 不需要压缩
  if (currentTokens <= cfg.maxTokens) {
    return messages;
  }

  // 需要压缩
  const preserveCount = cfg.preserveLastN ?? 20;
  const recentMessages = nonSystemMessages.slice(-preserveCount);
  const oldMessages = nonSystemMessages.slice(0, -preserveCount);

  // 对旧消息进行摘要
  let summaryMessage: Message | undefined;

  if (oldMessages.length > 0) {
    if (cfg.summarize) {
      // 使用自定义摘要函数
      const summaryText = cfg.summarize(oldMessages);
      summaryMessage = {
        id: generateId(),
        role: 'system',
        content: `## Previous Conversation Summary\n${summaryText}`,
        timestamp: oldMessages[0].timestamp,
      };
    } else {
      // 使用默认摘要
      summaryMessage = createDefaultSummary(oldMessages);
    }
  }

  // 构建压缩后的消息列表
  const compacted: Message[] = [];

  if (cfg.preserveSystem && summaryMessage) {
    compacted.push(summaryMessage);
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
    const start = new Date(messages[0].timestamp).toLocaleDateString();
    const end = new Date(messages[messages.length - 1].timestamp).toLocaleDateString();
    summaryParts.push(`- Time range: ${start} to ${end}`);
  }

  return {
    id: generateId(),
    role: 'system',
    content: `## Previous Conversation\n${summaryParts.join('\n')}\n\n(Older messages have been summarized)`,
    timestamp: messages[0].timestamp,
  };
}

/**
 * 估算消息列表的 token 数量
 */
export function estimateMessageTokens(messages: Message[]): number {
  return messages.reduce((sum, m) => sum + estimateTokens(m.content), 0);
}

/**
 * 检查是否需要压缩
 */
export function needsCompaction(messages: Message[], maxTokens: number): boolean {
  const currentTokens = estimateMessageTokens(messages);
  return currentTokens > maxTokens;
}

/**
 * 生成唯一 ID
 */
function generateId(): string {
  return crypto.randomUUID();
}
