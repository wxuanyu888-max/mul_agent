// Compact 工具 - 手动触发上下文压缩
import { jsonResult, errorResult } from "./types.js";
import { manualCompact, createCompactionContext, estimateMessageTokens, type CompactionConfig } from "../agents/compaction.js";
import type { Message } from "../agents/types.js";

export interface CompactToolParams {
  /** 消息列表（JSON 字符串） */
  messages: string;
  /** 压缩配置（可选） */
  config?: {
    autoCompactThreshold?: number;
    keepRecentResults?: number;
    transcriptDir?: string;
  };
}

/**
 * 创建 Compact 工具
 *
 * 手动触发上下文压缩，将对话历史保存到磁盘并生成摘要
 */
export function createCompactTool() {
  return {
    label: "Compact",
    name: "compact",
    description: "Manually trigger context compaction. Saves full conversation to disk and generates a summary to reduce token usage. Use when the conversation becomes too long.",
    parameters: {
      type: "object",
      properties: {
        messages: {
          type: "string",
          description: "The current conversation messages (JSON array string). This is typically passed automatically by the agent loop.",
        },
      },
    },
    execute: async (
      _toolCallId: string,
      params?: CompactToolParams,
    ) => {
      try {
        // 解析消息
        let parsedMessages: unknown[];
        if (typeof params?.messages === 'string') {
          try {
            parsedMessages = JSON.parse(params.messages);
          } catch {
            return errorResult('Invalid messages JSON string');
          }
        } else {
          return errorResult('messages parameter is required and must be a JSON string');
        }

        // 转换为 Message 类型
        const messages = parsedMessages as Message[];

        // 构建压缩配置
        const config: CompactionConfig = {
          autoCompactThreshold: params?.config?.autoCompactThreshold ?? 50000,
          keepRecentResults: params?.config?.keepRecentResults ?? 3,
          transcriptDir: params?.config?.transcriptDir ?? '.transcripts',
        };

        // 执行手动压缩
        const context = createCompactionContext();
        const result = await manualCompact(messages, config, context);

        // 返回压缩结果
        return jsonResult({
          success: true,
          originalMessageCount: messages.length,
          compactedMessageCount: result.messages.length,
          compactionCount: result.context.compactionCount,
          transcriptPath: result.context.transcriptPath,
          originalTokens: estimateMessageTokens(messages),
          compactedTokens: estimateMessageTokens(result.messages),
          savedTokens: estimateMessageTokens(messages) - estimateMessageTokens(result.messages),
          summary: result.messages[0]?.content?.slice(0, 500) || 'No summary generated',
        });
      } catch (error) {
        return errorResult(`Compact failed: ${error}`);
      }
    },
  };
}
