// Sessions Send 工具
import { jsonResult, errorResult } from "../types.js";
import { getSession, addMessage, updateSessionStatus } from "../../session/index.js";

export function createSessionsSendTool() {
  return {
    label: "Sessions Send",
    name: "sessions_send",
    description: "Send a message to another session",
    parameters: {
      type: "object",
      properties: {
        sessionKey: { type: "string", description: "Target session ID" },
        message: { type: "string", description: "Message to send" },
        role: { type: "string", default: "user", enum: ["user", "assistant", "system"] },
      },
      required: ["sessionKey", "message"],
    },
    execute: async (
      _toolCallId: string,
      params: { sessionKey: string; message: string; role?: 'user' | 'assistant' | 'system' },
    ) => {
      try {
        const session = await getSession(params.sessionKey);

        if (!session) {
          return errorResult(`Session not found: ${params.sessionKey}`);
        }

        // 添加消息
        await addMessage(params.sessionKey, {
          role: params.role || 'user',
          content: { type: 'text', text: params.message },
        });

        // 如果 session 处于 idle，激活它
        if (session.status === 'idle') {
          await updateSessionStatus(params.sessionKey, 'active');
        }

        return jsonResult({
          success: true,
          sessionId: session.id,
          message: params.message,
          timestamp: Date.now(),
        });
      } catch (error) {
        return errorResult(`Failed to send message: ${error}`);
      }
    },
  };
}
