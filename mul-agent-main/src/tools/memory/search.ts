// Memory Search 工具
import { jsonResult, errorResult } from "../types.js";

export function createMemorySearchTool() {
  return {
    label: "Memory Search",
    name: "memory_search",
    description: "Search memory for relevant information",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        maxResults: { type: "number", description: "Max results", default: 5 },
      },
      required: ["query"],
    },
    execute: async (_toolCallId: string, params: { query: string; maxResults?: number }) => {
      try {
        const { query, maxResults = 5 } = params;
        // TODO: 实现向量搜索
        return jsonResult({ results: [], query, maxResults });
      } catch (error) {
        return errorResult(`Memory search failed: ${error}`);
      }
    },
  };
}
