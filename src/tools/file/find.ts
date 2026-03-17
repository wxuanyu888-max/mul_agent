// 文件查找工具 - find
import fs from 'node:fs/promises';
import path from 'node:path';
import { errorResult, jsonResult } from '../types.js';

export interface FindParams {
  name: string;           // 文件名模式
  path?: string;         // 搜索路径
  type?: 'file' | 'directory';  // 类型
  maxDepth?: number;     // 最大深度
  maxResults?: number;   // 最大结果数
}

/**
 * 创建文件查找工具
 */
export function createFindTool() {
  return {
    label: 'Find',
    name: 'find',
    description: 'Find files by name pattern in a directory tree.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'File or directory name pattern (supports * and ?)' },
        path: { type: 'string', description: 'Directory path to search in', default: '.' },
        type: { type: 'string', description: 'Type: "file" or "directory"', default: 'file' },
        maxDepth: { type: 'number', description: 'Maximum directory depth', default: 10 },
        maxResults: { type: 'number', description: 'Maximum number of results', default: 100 },
      },
      required: ['name'],
    },
    execute: async (_toolCallId: string, params: FindParams) => {
      try {
        const {
          name,
          path: searchPath = '.',
          type = 'file',
          maxDepth = 10,
          maxResults = 100,
        } = params;

        const results: string[] = [];

        // 将通配符转换为正则
        const pattern = name
          .replace(/\./g, '\\.')
          .replace(/\*/g, '.*')
          .replace(/\?/g, '.');

        const regex = new RegExp(`^${pattern}$`);

        await findInDirectory(searchPath, type, regex, maxDepth, results, maxResults);

        return jsonResult({
          results,
          count: results.length,
          name,
          path: searchPath,
          type,
        });
      } catch (error) {
        return errorResult(`Find failed: ${error}`);
      }
    },
  };
}

async function findInDirectory(
  dirPath: string,
  type: 'file' | 'directory',
  regex: RegExp,
  depth: number,
  results: string[],
  maxResults: number
): Promise<void> {
  if (results.length >= maxResults || depth <= 0) return;

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (results.length >= maxResults) break;

      const fullPath = path.join(dirPath, entry.name);

      if (regex.test(entry.name)) {
        if (type === 'file' && entry.isFile()) {
          results.push(fullPath);
        } else if (type === 'directory' && entry.isDirectory()) {
          results.push(fullPath);
        }
      }

      if (entry.isDirectory() && depth > 1) {
        // 跳过隐藏目录和常见忽略目录
        if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
          await findInDirectory(fullPath, type, regex, depth - 1, results, maxResults);
        }
      }
    }
  } catch {
    // 跳过无法访问的目录
  }
}
