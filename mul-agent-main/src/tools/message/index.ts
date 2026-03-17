// Message 工具
import { jsonResult, errorResult } from "../types.js";

export function createMessageTool() {
  return {
    label: "Message",
    name: "message",
    description: "Send messages and channel actions",
    parameters: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["send", "react", "reply"] },
        to: { type: "string" },
        message: { type: "string" },
        channel: { type: "string" },
      },
      required: ["action", "message"],
    },
    execute: async (_toolCallId: string, params: { action: string; to?: string; message: string; channel?: string }) => {
      try {
        return jsonResult({ success: true, ...params });
      } catch (error) {
        return errorResult(`Failed: ${error}`);
      }
    },
  };
}
