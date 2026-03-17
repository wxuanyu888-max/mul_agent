// Gateway 工具
import { jsonResult, errorResult } from "../types.js";

export function createGatewayTool() {
  return {
    label: "Gateway",
    name: "gateway",
    description: "Restart, apply config, or run updates",
    parameters: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["status", "restart", "update"] },
      },
      required: ["action"],
    },
    execute: async (_toolCallId: string, params: { action: string }) => {
      try {
        return jsonResult({ action: params.action, status: "running" });
      } catch (error) {
        return errorResult(`Failed: ${error}`);
      }
    },
  };
}
