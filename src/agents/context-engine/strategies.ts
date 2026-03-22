/**
 * Context Engine 压缩策略实现
 *
 * 提供多种压缩策略：
 * - MicroCompactStrategy: 轻量级压缩，替换 tool result 为占位符
 * - AutoCompactStrategy: 超过阈值时，保存完整对话并用 LLM 摘要
 */

import * as fs from 'fs';
import * as path from 'path';

import type {
  CompactionStrategy,
  CompactionConfig,
  CompactionContext,
  ContextEngineInfo,
} from './types.js';
import type { Message, ContentBlock } from '../types.js';
import { DEFAULT_COMPACTION_CONFIG } from './types.js';
import { getLLMClient } from '../llm.js';

/**
 * Micro Compact 策略信息
 */
const MICRO_COMPACT_INFO: ContextEngineInfo = {
  name: 'micro-compact',
  description: '轻量级压缩：替换旧的 tool result 为占位符，减少每个 turn 的 token 使用',
  version: '1.0.0',
};

/**
 * Auto Compact 策略信息
 */
const AUTO_COMPACT_INFO: ContextEngineInfo = {
  name: 'auto-compact',
  description: '自动压缩：token 超过阈值时，保存完整对话到磁盘并用 LLM 摘要',
  version: '1.0.0',
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
 * 从 LLM 响应中提取文本内容
 */
function extractTextFromResponse(response: { content?: Array<{ type: string; text?: string }> }): string {
  if (!response.content) return '';

  const textBlocks = response.content.filter((block) => block.type === 'text');
  return textBlocks.map((block) => block.text || '').join('\n');
}

/**
 * Micro Compact 策略
 *
 * 将旧的 tool result 替换为占位符，减少每个 turn 的 token 使用
 */
export class MicroCompactStrategy implements CompactionStrategy {
  readonly info = MICRO_COMPACT_INFO;

  async compact(
    messages: Message[],
    config: CompactionConfig,
    context: CompactionContext
  ): Promise<{ messages: Message[]; context: CompactionContext }> {
    const cfg = { ...DEFAULT_COMPACTION_CONFIG, ...config };
    const ctx: CompactionContext = context ?? {
      compactionCount: 0,
      lastCompactionTokens: 0,
      toolResultPlaceholders: new Map(),
    };

    let replacedCount = 0;
    const toolResults: { index: number; content: string; toolName?: string }[] = [];

    // 收集所有 tool result 消息
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];

      if (msg.role === 'user') {
        const content = msg.content;

        if (typeof content === 'string') {
          if (msg.tool_call_id && content.length > (cfg.minResultLengthForCompact ?? 100)) {
            toolResults.push({ index: i, content, toolName: undefined });
          }
        } else if (Array.isArray(content)) {
          for (let j = 0; j < content.length; j++) {
            const part = content[j];
            if (part && typeof part === 'object' && part.type === 'tool_result') {
              const contentStr = part.content || '';
              if (typeof contentStr === 'string' && contentStr.length > (cfg.minResultLengthForCompact ?? 100)) {
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

  estimateTokens(messages: Message[]): number {
    return messages.reduce((sum, m) => {
      if (!m) return sum;

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

  needsCompaction(messages: Message[], threshold: number): boolean {
    return this.estimateTokens(messages) > threshold;
  }
}

/**
 * Auto Compact 策略
 *
 * token 超过阈值时，保存完整对话到磁盘并用 LLM 摘要
 */
export class AutoCompactStrategy implements CompactionStrategy {
  readonly info = AUTO_COMPACT_INFO;

  async compact(
    messages: Message[],
    config: CompactionConfig,
    context: CompactionContext
  ): Promise<{ messages: Message[]; context: CompactionContext }> {
    const cfg = { ...DEFAULT_COMPACTION_CONFIG, ...config };
    const ctx: CompactionContext = context ?? {
      compactionCount: 0,
      lastCompactionTokens: 0,
      toolResultPlaceholders: new Map(),
    };

    // 1. 保存完整 transcript 到磁盘
    const transcriptDir = cfg.transcriptDir ?? '.transcripts';
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
      const truncatedText = messagesText.slice(0, 80000);

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

      const compacted: Message[] = [summaryMessage];

      if (cfg.preserveSystem) {
        const systemMsgs = messages.filter((m) => m.role === 'system');
        compacted.unshift(...systemMsgs);
      }

      compacted.push({
        role: 'assistant',
        content: 'Understood. I will continue with the summarized context.',
      });

      ctx.compactionCount++;
      ctx.lastCompactionTokens = this.estimateTokens(compacted);

      return { messages: compacted, context: ctx };
    } catch (error) {
      console.error('[AutoCompactStrategy] LLM summary failed:', error);

      const fallbackSummary: Message = {
        role: 'user',
        content: `[Compressed] ${messages.length} messages (summary failed, see ${transcriptPath})`,
      };

      ctx.compactionCount++;
      ctx.lastCompactionTokens = this.estimateTokens([fallbackSummary]);

      return { messages: [fallbackSummary], context: ctx };
    }
  }

  estimateTokens(messages: Message[]): number {
    return messages.reduce((sum, m) => {
      if (!m) return sum;

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

  needsCompaction(messages: Message[], threshold: number): boolean {
    return this.estimateTokens(messages) > threshold;
  }
}

/**
 * 获取默认的压缩策略组合
 *
 * 返回一个包含 micro 和 auto 压缩的默认 ContextEngine
 */
export function createDefaultCompactionStrategies(): {
  micro: MicroCompactStrategy;
  auto: AutoCompactStrategy;
} {
  return {
    micro: new MicroCompactStrategy(),
    auto: new AutoCompactStrategy(),
  };
}
