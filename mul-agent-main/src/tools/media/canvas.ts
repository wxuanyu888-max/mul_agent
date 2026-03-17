// Canvas 工具
import { jsonResult, errorResult } from "../types.js";

export function createCanvasTool() {
  return {
    label: "Canvas",
    name: "canvas",
    description: "Present, evaluate, or snapshot the Canvas",
    parameters: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["present", "snapshot", "eval"] },
        content: { type: "string" },
        target: { type: "string" },
      },
      required: ["action"],
    },
    execute: async (_toolCallId: string, params: { action: string; content?: string; target?: string }) => {
      try {
        return jsonResult({ action: params.action });
      } catch (error) {
        return errorResult(`Failed: ${error}`);
      }
    },
  };
}
