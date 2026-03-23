// 文件搜索工具 - grep (基于向量搜索)
import { errorResult, jsonResult } from '../types.js';
import { getMemoryIndexManager } from '../../memory/manager.js';
import type { MemorySearchConfig } from '../../memory/types.js';
import { getMemoryPath } from '../../utils/path.js';

export interface GrepParams {
  query: string;           // 搜索内容
  path?: string;           // 搜索路径（保留兼容，实际现在搜 workspace）
  maxResults?: number;     // 最大结果数
  mode?: 'semantic' | 'exact';  // 搜索模式
}

interface GrepResult {
  path: string;
  snippet: string;
  score: number;
  startLine: number;
  endLine: number;
}

/**
 * 默认的 Memory 配置（用于 Grep）
 */
const GREP_MEMORY_CONFIG: MemorySearchConfig = {
  enabled: true,
  provider: 'offline',  // 默认使用离线嵌入
  model: 'tfidf',
  fallback: 'none',
  vector: {
    enabled: true,
  },
  fts: {
    enabled: true,
  },
  sources: ['memory'],
  extraPaths: [],  // 会包含 workspace
};

/**
 * 获取 Grep 用的 Memory Manager
 */
let grepManager: ReturnType<typeof getMemoryIndexManager> | null = null;

async function getGrepManager() {
  if (!grepManager) {
    const workspaceDir = getMemoryPath();
    grepManager = getMemoryIndexManager({
      agentId: 'grep',
      workspaceDir,
      config: {
        ...GREP_MEMORY_CONFIG,
        sources: ['memory'],
        extraPaths: ['storage/runtime/workspace'],
      },
    });
  }
  return grepManager;
}

/**
 * 同步工作区到向量库
 */
export async function syncWorkspaceToMemory() {
  try {
    const manager = await getGrepManager();
    await manager.sync({ reason: 'workspace_sync', force: true });
  } catch (error) {
    console.warn('[Grep] Failed to sync workspace:', error);
  }
}

/**
 * 创建文件内容搜索工具（基于向量搜索）
 */
export function createGrepTool() {
  return {
    label: 'Grep',
    name: 'grep',
    description: 'Search for information in workspace files using semantic search. Returns relevant snippets with context.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The search query (supports natural language)' },
        path: { type: 'string', description: 'Directory path to search in (default: workspace)', default: 'storage/runtime/workspace' },
        maxResults: { type: 'number', description: 'Maximum number of results', default: 10 },
        mode: { type: 'string', description: 'Search mode: semantic (vector) or exact (regex)', enum: ['semantic', 'exact'], default: 'semantic' },
      },
      required: ['query'],
    },
    execute: async (_toolCallId: string, params: GrepParams) => {
      try {
        const {
          query,
          maxResults = 10,
          mode = 'semantic',
        } = params;

        if (mode === 'exact') {
          // 精确搜索：使用传统的正则匹配
          return await exactSearch(query, params.path || '.', maxResults);
        }

        // 向量搜索：使用 rag search
        const manager = await getGrepManager();
        const results = await manager.search(query, { maxResults });

        return jsonResult({
          results: results.map((r) => ({
            path: r.path,
            snippet: r.snippet,
            score: r.score,
            startLine: r.startLine,
            endLine: r.endLine,
          })),
          count: results.length,
          query,
          mode: 'semantic',
        });
      } catch (error) {
        return errorResult(`Grep failed: ${error}`);
      }
    },
  };
}

/**
 * 精确搜索（传统正则匹配）
 */
async function exactSearch(query: string, searchPath: string, maxResults: number) {
  const fs = await import('node:fs/promises');
  const path = await import('node:path');

  const results: GrepResult[] = [];
  const regex = new RegExp(query, 'gi');

  async function searchDir(dirPath: string): Promise<void> {
    if (results.length >= maxResults) return;

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        if (results.length >= maxResults) break;

        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
          await searchDir(fullPath);
        } else if (entry.isFile()) {
          try {
            const content = await fs.readFile(fullPath, 'utf-8');
            const lines = content.split('\n');

            for (let i = 0; i < lines.length; i++) {
              if (results.length >= maxResults) break;
              if (regex.test(lines[i])) {
                const start = Math.max(0, i - 1);
                const end = Math.min(lines.length - 1, i + 1);

                results.push({
                  path: fullPath,
                  snippet: lines.slice(start, end + 1).join('\n'),
                  score: 1,
                  startLine: start + 1,
                  endLine: end + 1,
                });
              }
              regex.lastIndex = 0;
            }
          } catch {
            // 跳过无法读取的文件
          }
        }
      }
    } catch {
      // 跳过无法访问的目录
    }
  }

  await searchDir(searchPath);

  return jsonResult({
    results,
    count: results.length,
    query,
    mode: 'exact',
  });
}
