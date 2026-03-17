// Memory Get 工具
import { jsonResult, errorResult } from "../types.js";

export function createMemoryGetTool() {
  return {
    label: "Memory Get",
    name: "memory_get",
    description: "Read specific memory content",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Memory file path" },
        from: { type: "number", description: "Start line" },
        lines: { type: "number", description: "Number of lines" },
      },
      required: ["path"],
    },
    execute: async (_toolCallId: string, params: { path: string; from?: number; lines?: number }) => {
      try {
        const { path, from, lines } = params;
        // TODO: 实现内存读取
        return jsonResult({ path, content: "", from: from || 1, lines: lines || 100 });
      } catch (error) {
        return errorResult(`Memory get failed: ${error}`);
      }
    },
  };
}
