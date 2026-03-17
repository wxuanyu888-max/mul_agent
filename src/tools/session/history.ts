// Sessions History 工具
import { jsonResult, errorResult } from "../types.js";
import { getSession } from "../../session/index.js";

export function createSessionsHistoryTool() {
  return {
    label: "Sessions History",
    name: "sessions_history",
    description: "Fetch history for another session",
    parameters: {
      type: "object",
      properties: {
        sessionKey: { type: "string", description: "Session ID to fetch history from" },
        limit: { type: "number", description: "Maximum number of messages" },
        offset: { type: "number", description: "Offset from the start" },
      },
      required: ["sessionKey"],
    },
    execute: async (_toolCallId: string, params: { sessionKey: string; limit?: number; offset?: number }) => {
      try {
        const session = await getSession(params.sessionKey);

        if (!session) {
          return errorResult(`Session not found: ${params.sessionKey}`);
        }

        let messages = session.messages;

        // 应用分页
        if (params.offset) {
          messages = messages.slice(params.offset);
        }
        if (params.limit) {
          messages = messages.slice(0, params.limit);
        }

        return jsonResult({
          sessionId: session.id,
          label: session.label,
          status: session.status,
          messages: messages,
          messageCount: session.messages.length,
          toolCallCount: session.toolCalls.length,
          usage: session.usage,
        });
      } catch (error) {
        return errorResult(`Failed to fetch history: ${error}`);
      }
    },
  };
}
