// Nodes 工具
import { jsonResult, errorResult } from "../types.js";

export function createNodesTool() {
  return {
    label: "Nodes",
    name: "nodes",
    description: "List, describe, notify, camera, or screen on paired nodes",
    parameters: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["list", "describe", "notify", "camera", "screen"] },
        nodeId: { type: "string" },
        message: { type: "string" },
      },
      required: ["action"],
    },
    execute: async (_toolCallId: string, params: { action: string; nodeId?: string; message?: string }) => {
      try {
        return jsonResult({ action: params.action, nodes: [] });
      } catch (error) {
        return errorResult(`Failed: ${error}`);
      }
    },
  };
}
