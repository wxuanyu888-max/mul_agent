// Memory Get 工具
import { jsonResult, errorResult } from "../types.js";
import { getMemoryIndexManager } from "../../memory/manager.js";
import type { MemorySearchConfig } from "../../memory/types.js";
import { getMemoryPath } from "../../utils/path.js";

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

export function createMemoryGetTool() {
  return {
    label: "Memory Get",
    name: "memory_get",
    description: "Read specific memory content from indexed files",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Memory file path (relative to workspace)" },
        from: { type: "number", description: "Start line", default: 1 },
        lines: { type: "number", description: "Number of lines", default: 100 },
        agentId: { type: "string", description: "Agent ID", default: "core_brain" },
      },
      required: ["path"],
    },
    execute: async (_toolCallId: string, params: { path: string; from?: number; lines?: number; agentId?: string }) => {
      try {
        const { path, from = 1, lines = 100, agentId = "core_brain" } = params;
        const workspaceDir = getMemoryPath();

        const manager = await getManager(agentId, workspaceDir);
        const result = await manager.readFile({
          relPath: path,
          from,
          lines,
        });

        return jsonResult({
          path: result.path,
          content: result.text,
          from,
          lines,
        });
      } catch (error) {
        return errorResult(`Memory get failed: ${error}`);
      }
    },
  };
}
