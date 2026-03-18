/**
 * teammate_inbox - 读取收件箱工具
 */

import { jsonResult, errorResult } from "../types.js";

/**
 * 创建 teammate_inbox 工具
 */
export function createTeammateInboxTool() {
  return {
    label: "Teammate Inbox",
    name: "teammate_inbox",
    description: 'Read and clear the inbox of a teammate. Returns all messages in the inbox.',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Name of the teammate whose inbox to read',
        },
      },
      required: ['name'],
    },
    execute: async (_toolCallId: string, params: Record<string, unknown>) => {
      try {
        const name = params.name as string;

        if (!name) {
          return errorResult('name is required');
        }

        // 动态导入以避免循环依赖
        const { checkTeammateInbox } = await import('../../agents/teammate.js');
        const messages = checkTeammateInbox(name);

        return jsonResult({ messages: JSON.parse(messages) });
      } catch (error) {
        return errorResult(String(error));
      }
    },
  };
}
