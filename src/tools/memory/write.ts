// Memory Write 工具
import { jsonResult, errorResult } from "../types.js";
import fs from "node:fs/promises";
import path from "node:path";

export function createMemoryWriteTool() {
  return {
    label: "Memory Write",
    name: "memory_write",
    description: "Save information to memory for future retrieval",
    parameters: {
      type: "object",
      properties: {
        content: { type: "string", description: "Content to save to memory" },
        path: { type: "string", description: "File path to save to (relative to storage/memory/)" },
        agentId: { type: "string", description: "Agent ID", default: "core_brain" },
      },
      required: ["content", "path"],
    },
    execute: async (_toolCallId: string, params: { content: string; path?: string; agentId?: string }) => {
      try {
        const { content, path: filePath, agentId: _agentId = "core_brain" } = params;
        const workspaceDir = process.cwd();

        // 默认保存到 storage/memory/ 目录
        const memoryDir = path.join(workspaceDir, 'storage', 'memory');
        const fileName = filePath || `memory_${Date.now()}.md`;
        const fullPath = path.join(memoryDir, fileName);

        // 确保目录存在
        await fs.mkdir(memoryDir, { recursive: true });

        // 写入文件
        await fs.writeFile(fullPath, content, 'utf-8');

        return jsonResult({
          path: fileName,
          content: content,
          message: `Saved to ${fileName}`,
        });
      } catch (error) {
        return errorResult(`Memory write failed: ${error}`);
      }
    },
  };
}
