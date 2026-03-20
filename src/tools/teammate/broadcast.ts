/**
 * teammate_broadcast - 广播消息工具
 */

import { jsonResult, errorResult } from "../types.js";

/**
 * 创建 teammate_broadcast 工具
 */
export function createTeammateBroadcastTool() {
  return {
    label: "Teammate Broadcast",
    name: "teammate_broadcast",
    description: 'Broadcast a message to all teammates. The message will be sent to every teammate except the sender.',
    parameters: {
      type: 'object',
      properties: {
        content: {
          type: 'string',
          description: 'Message content to broadcast',
        },
        msg_type: {
          type: 'string',
          description: 'Optional message type',
        },
      },
      required: ['content'],
    },
    execute: async (_toolCallId: string, params: Record<string, unknown>) => {
      try {
        const content = params.content as string;
        const _msgType = params.msg_type as string | undefined;

        if (!content) {
          return errorResult('content is required');
        }

        // 动态导入以避免循环依赖
        const { broadcastToTeammates } = await import('../../agents/teammate.js');
        const result = broadcastToTeammates('lead', content);

        return jsonResult({ result });
      } catch (error) {
        return errorResult(String(error));
      }
    },
  };
}
