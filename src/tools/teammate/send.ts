/**
 * teammate_send - 发送消息给队友工具
 */

import { jsonResult, errorResult } from "../types.js";

/**
 * 创建 teammate_send 工具
 */
export function createTeammateSendTool() {
  return {
    label: "Teammate Send",
    name: "teammate_send",
    description: 'Send a message to a specific teammate. The message will be delivered to their inbox.',
    parameters: {
      type: 'object',
      properties: {
        to: {
          type: 'string',
          description: 'Name of the teammate to send message to',
        },
        content: {
          type: 'string',
          description: 'Message content to send',
        },
        msg_type: {
          type: 'string',
          description: 'Optional message type (e.g., task, question, notification)',
        },
      },
      required: ['to', 'content'],
    },
    execute: async (_toolCallId: string, params: Record<string, unknown>) => {
      try {
        const to = params.to as string;
        const content = params.content as string;
        const msgType = params.msg_type as string | undefined;

        if (!to || !content) {
          return errorResult('to and content are required');
        }

        // 动态导入以避免循环依赖
        const { sendToTeammate } = await import('../../agents/teammate.js');
        const result = sendToTeammate('lead', to, content, msgType);

        return jsonResult({ result });
      } catch (error) {
        return errorResult(String(error));
      }
    },
  };
}
