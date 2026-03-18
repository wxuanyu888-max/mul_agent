// Memory Search 工具
import { jsonResult, errorResult } from "../types.js";
import { getMemoryIndexManager } from "../../memory/manager.js";
import type { MemorySearchConfig } from "../../memory/types.js";

/**
 * 默认的 Memory 搜索配置
 */
const DEFAULT_CONFIG: MemorySearchConfig = {
  enabled: true,
  provider: 'auto',
  model: 'BAAI/bge-small-zh-v1.5',
  fallback: 'none',
  vector: {
    enabled: true,
  },
  fts: {
    enabled: true,
  },
  sources: ['memory', 'sessions'],
};

/**
 * 获取或创建 MemoryIndexManager
 */
async function getManager(agentId: string, workspaceDir: string) {
  return getMemoryIndexManager({
    agentId,
    workspaceDir,
    config: DEFAULT_CONFIG,
  });
}

export function createMemorySearchTool() {
  return {
    label: "Memory Search",
    name: "memory_search",
    description: "Search memory for relevant information using vector search and keyword search",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        maxResults: { type: "number", description: "Max results", default: 5 },
        agentId: { type: "string", description: "Agent ID", default: "core_brain" },
      },
      required: ["query"],
    },
    execute: async (_toolCallId: string, params: { query: string; maxResults?: number; agentId?: string }) => {
      try {
        const { query, maxResults = 5, agentId = "core_brain" } = params;
        const workspaceDir = process.cwd();

        const manager = await getManager(agentId, workspaceDir);
        const results = await manager.search(query, { maxResults });

        return jsonResult({
          results: results.map((r) => ({
            path: r.path,
            snippet: r.snippet,
            score: r.score,
            source: r.source,
            startLine: r.startLine,
            endLine: r.endLine,
          })),
          query,
          count: results.length,
        });
      } catch (error) {
        return errorResult(`Memory search failed: ${error}`);
      }
    },
  };
}
