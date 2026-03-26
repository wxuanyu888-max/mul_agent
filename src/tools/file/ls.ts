// 目录列表工具 - ls
import fs from 'node:fs/promises';
import path from 'node:path';
import { errorResult, jsonResult } from '../types.js';

export interface LsParams {
  path?: string;           // 目录路径
  all?: boolean;          // 显示隐藏文件
  long?: boolean;          // 详细模式
  recursive?: boolean;     // 递归显示
  maxDepth?: number;      // 递归深度
}

interface FileInfo {
  name: string;
  type: 'file' | 'directory' | 'symlink';
  size?: number;
  modified?: string;
  mode?: string;
}

/**
 * 创建目录列表工具
 */
export function createLsTool() {
  return {
    label: 'Ls',
    name: 'ls',
    description: 'List directory contents showing files and subdirectories. Use when you need to see what files exist in a directory, explore folder structure, or check directory contents. For finding files by name pattern, use find tool.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Directory path to list (default: current directory)', default: '.' },
        all: { type: 'boolean', description: 'Show hidden files (files starting with dot)', default: false },
        long: { type: 'boolean', description: 'Use long listing format with file size and date', default: false },
        recursive: { type: 'boolean', description: 'List subdirectories recursively to show full tree structure', default: false },
        maxDepth: { type: 'number', description: 'Maximum depth for recursive listing (default: 3)', default: 3 },
      },
      required: [],
    },
    execute: async (_toolCallId: string, params: LsParams) => {
      try {
        const {
          path: dirPath = '.',
          all = false,
          long = false,
          recursive = false,
          maxDepth = 3,
        } = params;

        const results: Record<string, FileInfo[]> = {};
        await listDirectory(dirPath, '', all, long, recursive, maxDepth, results);

        return jsonResult({
          path: dirPath,
          results,
          totalDirs: Object.keys(results).length,
        });
      } catch (error) {
        return errorResult(`Ls failed: ${error}`);
      }
    },
  };
}

async function listDirectory(
  dirPath: string,
  prefix: string,
  all: boolean,
  long: boolean,
  recursive: boolean,
  depth: number,
  results: Record<string, FileInfo[]>
): Promise<void> {
  if (depth <= 0) return;

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const files: FileInfo[] = [];

    for (const entry of entries) {
      // 跳过隐藏文件（除非指定）
      if (!all && entry.name.startsWith('.')) continue;

      const fullPath = path.join(dirPath, entry.name);
      const info: FileInfo = {
        name: entry.name,
        type: entry.isSymbolicLink() ? 'symlink' : entry.isDirectory() ? 'directory' : 'file',
      };

      if (long) {
        try {
          const stats = await fs.stat(fullPath);
          info.size = stats.size;
          info.modified = stats.mtime.toISOString();
          info.mode = stats.mode.toString(8);
        } catch {
          // 跳过
        }
      }

      files.push(info);

      // 递归处理子目录
      if (recursive && entry.isDirectory() && depth > 1) {
        const newPrefix = prefix ? `${prefix}/${entry.name}` : entry.name;
        await listDirectory(fullPath, newPrefix, all, long, recursive, depth - 1, results);
      }
    }

    // 按名称排序（目录在前）
    files.sort((a, b) => {
      if (a.type === 'directory' && b.type !== 'directory') return -1;
      if (a.type !== 'directory' && b.type === 'directory') return 1;
      return a.name.localeCompare(b.name);
    });

    const key = prefix || dirPath;
    results[key] = files;
  } catch {
    // 目录无法访问
  }
}
