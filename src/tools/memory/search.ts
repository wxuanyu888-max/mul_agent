// Memory 工具 - 统一入口
import { jsonResult, errorResult } from "../types.js";
import { getMemoryIndexManager } from "../../memory/manager.js";
import type { MemorySearchConfig } from "../../memory/types.js";
import fs from "node:fs/promises";
import path from "node:path";

/**
 * 默认的 Memory 配置
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

/**
 * 创建 Memory 工具（统一入口）
 */
export function createMemoryTool() {
  return {
    label: "Memory",
    name: "memory",
    description: `Memory management. Available actions:
- memory_search: Search for relevant information in memory
- memory_get: Read specific memory content from indexed files
- memory_write: Save information to memory for future retrieval`,
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["search", "get", "write"],
          description: "Action to perform"
        },
        // search 参数
        query: { type: "string", description: "Search query (for search action)" },
        maxResults: { type: "number", description: "Max results (for search action)", default: 5 },
        // get 参数
        path: { type: "string", description: "Memory file path (for get/write action)" },
        from: { type: "number", description: "Start line (for get action)", default: 1 },
        lines: { type: "number", description: "Number of lines (for get action)", default: 100 },
        // write 参数
        content: { type: "string", description: "Content to save (for write action)" },
        // 通用参数
        agentId: { type: "string", description: "Agent ID", default: "core_brain" },
      },
      required: ["action"],
    },
    execute: async (_toolCallId: string, params: {
      action: "search" | "get" | "write";
      query?: string;
      maxResults?: number;
      path?: string;
      from?: number;
      lines?: number;
      content?: string;
      agentId?: string;
    }) => {
      try {
        const { action, agentId = "core_brain" } = params;
        const workspaceDir = process.cwd();

        switch (action) {
          case "search": {
            const { query, maxResults = 5 } = params;
            if (!query) {
              return errorResult("query is required for search action");
            }
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
          }

          case "get": {
            const { path: filePath, from = 1, lines = 100 } = params;
            if (!filePath) {
              return errorResult("path is required for get action");
            }
            const manager = await getManager(agentId, workspaceDir);
            const result = await manager.readFile({
              relPath: filePath,
              from,
              lines,
            });
            return jsonResult({
              path: result.path,
              content: result.text,
              from,
              lines,
            });
          }

          case "write": {
            const { path: filePath, content } = params;
            if (!content) {
              return errorResult("content is required for write action");
            }
            const memoryDir = path.join(workspaceDir, 'storage', 'memory');
            const fileName = filePath || `memory_${Date.now()}.md`;
            const fullPath = path.join(memoryDir, fileName);

            // 确保目录存在
            await fs.mkdir(memoryDir, { recursive: true });
            await fs.writeFile(fullPath, content, 'utf-8');

            return jsonResult({
              path: fileName,
              content: content,
              message: `Saved to ${fileName}`,
            });
          }

          default:
            return errorResult(`Unknown action: ${action}`);
        }
      } catch (error) {
        return errorResult(`Memory operation failed: ${error}`);
      }
    },
  };
}

// 保留旧接口以便兼容
export function createMemorySearchTool() {
  return createMemoryTool();
}
