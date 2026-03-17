// 文件搜索工具 - grep
import fs from 'node:fs/promises';
import path from 'node:path';
import { errorResult, jsonResult } from '../types.js';

export interface GrepParams {
  query: string;           // 搜索内容
  path?: string;           // 搜索路径
  filePattern?: string;    // 文件模式，如 *.ts, *.js
  ignorePattern?: string;  // 忽略的模式，如 node_modules
  context?: number;       // 上下文行数
  caseSensitive?: boolean; // 是否大小写敏感
  maxResults?: number;     // 最大结果数
}

interface GrepResult {
  file: string;
  line: number;
  content: string;
}

/**
 * 创建文件内容搜索工具
 */
export function createGrepTool() {
  return {
    label: 'Grep',
    name: 'grep',
    description: 'Search for a string in files. Returns matching lines with context.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The string or regex pattern to search for' },
        path: { type: 'string', description: 'Directory path to search in (default: current directory)', default: '.' },
        filePattern: { type: 'string', description: 'File pattern to match (e.g., "*.ts", "*.js")', default: '*' },
        ignorePattern: { type: 'string', description: 'Pattern to ignore (e.g., "node_modules")', default: 'node_modules' },
        context: { type: 'number', description: 'Number of context lines to show', default: 2 },
        caseSensitive: { type: 'boolean', description: 'Case sensitive search', default: true },
        maxResults: { type: 'number', description: 'Maximum number of results', default: 100 },
      },
      required: ['query'],
    },
    execute: async (_toolCallId: string, params: GrepParams) => {
      try {
        const {
          query,
          path: searchPath = '.',
          filePattern = '*',
          ignorePattern = 'node_modules',
          context = 2,
          caseSensitive = true,
          maxResults = 100,
        } = params;

        const results: GrepResult[] = [];
        const regex = new RegExp(query, caseSensitive ? 'g' : 'gi');

        await searchDirectory(searchPath, filePattern, ignorePattern, regex, context, results, maxResults);

        return jsonResult({
          results: results.slice(0, maxResults),
          count: results.length,
          query,
          path: searchPath,
        });
      } catch (error) {
        return errorResult(`Grep failed: ${error}`);
      }
    },
  };
}

async function searchDirectory(
  dirPath: string,
  filePattern: string,
  ignorePattern: string,
  regex: RegExp,
  context: number,
  results: GrepResult[],
  maxResults: number
): Promise<void> {
  if (results.length >= maxResults) return;

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (results.length >= maxResults) break;

      const fullPath = path.join(dirPath, entry.name);

      // 跳过忽略的目录
      if (entry.isDirectory()) {
        if (entry.name === ignorePattern || entry.name.startsWith('.')) continue;
        await searchDirectory(fullPath, filePattern, ignorePattern, regex, context, results, maxResults);
      } else if (entry.isFile()) {
        // 检查文件模式
        const pattern = new RegExp(filePattern.replace('*', '.*'));
        if (!pattern.test(entry.name)) continue;

        // 搜索文件内容
        try {
          const content = await fs.readFile(fullPath, 'utf-8');
          const lines = content.split('\n');

          for (let i = 0; i < lines.length; i++) {
            if (results.length >= maxResults) break;
            if (regex.test(lines[i])) {
              // 获取上下文
              const start = Math.max(0, i - context);
              const end = Math.min(lines.length - 1, i + context);

              results.push({
                file: fullPath,
                line: i + 1,
                content: lines.slice(start, end + 1).join('\n'),
              });
            }
            regex.lastIndex = 0; // 重置正则
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
