// Subagents 工具
import { jsonResult, errorResult } from "../types.js";

export function createSubagentsTool() {
  return {
    label: "Subagents",
    name: "subagents",
    description: "List, steer, or kill sub-agent runs",
    parameters: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["list", "steer", "kill"] },
        subagentId: { type: "string" },
        message: { type: "string" },
      },
      required: ["action"],
    },
    execute: async (_toolCallId: string, params: { action: string; subagentId?: string; message?: string }) => {
      try {
        return jsonResult({ action: params.action, subagents: [] });
      } catch (error) {
        return errorResult(`Failed: ${error}`);
      }
    },
  };
}
