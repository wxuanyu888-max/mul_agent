/**
 * Search Tool - 代码搜索和重构工具
 *
 * 支持：搜索代码、查找文件，重命名符号、查找引用
 */

import { jsonResult, errorResult } from './types.js';
import fs from 'node:fs/promises';
import path from 'node:path';

export interface SearchParams {
  query: string;
  path?: string;
  type?: 'js' | 'ts' | 'py' | 'go' | 'rs' | 'java' | 'all';
  caseSensitive?: boolean;
  regex?: boolean;
  limit?: number;
}

function matchesPattern(content: string, query: string, isRegex: boolean, caseSensitive: boolean): boolean {
  if (isRegex) {
    try {
      const flags = caseSensitive ? 'g' : 'gi';
      const re = new RegExp(query, flags);
      return re.test(content);
    } catch {
      return false;
    }
  }
  return caseSensitive
    ? content.includes(query)
    : content.toLowerCase().includes(query.toLowerCase());
}

async function searchInFile(filePath: string, query: string, options: { isRegex: boolean; caseSensitive: boolean }): Promise<string[]> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    const matches: string[] = [];

    lines.forEach((line, idx) => {
      if (matchesPattern(line, query, options.isRegex, options.caseSensitive)) {
        matches.push(`${idx + 1}: ${line.trim()}`);
      }
    });

    return matches;
  } catch {
    return [];
  }
}

async function findFiles(dir: string, extensions: string[]): Promise<string[]> {
  const files: string[] = [];

  async function walk(currentDir: string) {
    try {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        // Skip node_modules, .git, dist, build
        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist' || entry.name === 'build') {
          continue;
        }
        if (entry.isDirectory()) {
          await walk(fullPath);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).slice(1);
          if (extensions.includes(ext) || extensions.includes('all')) {
            files.push(fullPath);
          }
        }
      }
    } catch {
      // Ignore permission errors
    }
  }

  await walk(dir);
  return files;
}

export function createSearchTool() {
  return {
    label: 'Search',
    name: 'search',
    description: '搜索代码：查找文件、搜索文本、代码片段。支持正则和大小写敏感',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: '搜索关键词或正则表达式',
        },
        path: {
          type: 'string',
          description: '搜索路径 (默认当前目录)',
        },
        type: {
          type: 'string',
          enum: ['js', 'ts', 'py', 'go', 'rs', 'java', 'all'],
          description: '文件类型过滤',
          default: 'all',
        },
        caseSensitive: {
          type: 'boolean',
          description: '是否大小写敏感',
          default: false,
        },
        regex: {
          type: 'boolean',
          description: '是否使用正则表达式',
          default: false,
        },
        limit: {
          type: 'number',
          description: '返回结果数量限制',
          default: 50,
        },
      },
      required: ['query'],
    },
    permission: 'main' as const,
    execute: async (_toolCallId: string, params: Record<string, unknown>) => {
      try {
        const query = params.query as string;
        const searchPath = params.path as string | undefined;
        const type = (params.type as SearchParams['type']) || 'all';
        const caseSensitive = (params.caseSensitive as boolean) || false;
        const regex = (params.regex as boolean) || false;
        const limit = (params.limit as number) || 50;

        const dir = searchPath || process.cwd();
        const extensions = type === 'all' ? ['all'] : [type];

        // 查找所有匹配的文件
        const files = await findFiles(dir, extensions);
        const results: string[] = [];
        let filesSearched = 0;

        for (const file of files) {
          if (filesSearched >= 100) break; // 限制搜索文件数量
          filesSearched++;

          const matches = await searchInFile(file, query, { isRegex: regex, caseSensitive });
          if (matches.length > 0) {
            results.push(`\n=== ${file} ===`);
            results.push(...matches.slice(0, 10)); // 每个文件最多显示 10 行
            if (matches.length > 10) {
              results.push(`... and ${matches.length - 10} more matches`);
            }
          }

          if (results.length >= limit * 5) break;
        }

        if (results.length === 0) {
          return jsonResult({ message: `No matches found for: ${query}` });
        }

        const summary = { message: `Found matches in ${Math.min(filesSearched, files.length)} files (searched ${filesSearched} files)` };
        return jsonResult({
          ...summary,
          results: results.slice(0, limit).join('\n'),
        });
      } catch (error: any) {
        return errorResult(error.message || String(error));
      }
    },
  };
}
