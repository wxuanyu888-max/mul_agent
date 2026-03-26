// 文件查找工具 - find
import fs from 'node:fs/promises';
import path from 'node:path';
import { errorResult, jsonResult } from '../types.js';

export interface FindParams {
  name?: string;          // 文件名模式（支持 * 和 ?）
  pattern?: string;      // Glob 模式（如 **/*.ts, src/**/*.js）
  path?: string;         // 搜索路径
  type?: 'file' | 'directory';  // 类型
  ext?: string;          // 文件扩展名过滤（如 .ts, .js）
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
    description: 'Find files by name pattern or glob pattern in a directory tree. Use when you need to locate files by their filename (not content). For content search, use grep tool.',
    parameters: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'Glob pattern for file search. Examples: "**/*.ts" finds all TypeScript files recursively, "src/**/*.js" finds JS files in src, "*.json" finds JSON files in current directory. Use ** for recursive, * for any characters, ? for single character.',
        },
        name: {
          type: 'string',
          description: 'Simple filename pattern with * (any) and ? (single). Example: "*.ts" finds all TS files, "test*.js" finds test*.js, "???.txt" finds 3-letter txt files. Less powerful than pattern but simpler.',
        },
        path: { type: 'string', description: 'Directory path to search in (default: current directory)', default: '.' },
        type: { type: 'string', description: 'Search for "file" or "directory"', default: 'file' },
        ext: {
          type: 'string',
          description: 'Filter by file extension (with or without dot). Example: "ts" or ".ts" finds TypeScript files. Use with name pattern for best performance.',
        },
        maxDepth: { type: 'number', description: 'Maximum directory depth to search (default: 10)', default: 10 },
        maxResults: { type: 'number', description: 'Maximum number of results to return (default: 100)', default: 100 },
      },
      required: ['pattern'],
    },
    execute: async (_toolCallId: string, params: FindParams) => {
      try {
        const {
          name,
          pattern: globPattern,
          path: searchPath = '.',
          type = 'file',
          ext,
          maxDepth = 10,
          maxResults = 100,
        } = params;

        const results: string[] = [];

        // 优先使用 glob pattern
        if (globPattern) {
          await searchWithGlob(globPattern, searchPath, type, maxDepth, results, maxResults);
        } else if (name) {
          // 将通配符转换为正则
          // * 匹配任意字符，? 匹配0或1个字符
          const pattern = name
            .replace(/\./g, '\\.')
            .replace(/\*/g, '.*')
            .replace(/\?/g, '.?');

          const regex = new RegExp(`^${pattern}$`);
          await findInDirectory(searchPath, type, regex, ext, maxDepth, results, maxResults);
        } else {
          return errorResult('Either "name" or "pattern" parameter is required');
        }

        return jsonResult({
          results,
          count: results.length,
          name,
          pattern: globPattern,
          path: searchPath,
          type,
          ext,
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
  ext: string | undefined,
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

      // 检查扩展名过滤
      if (ext && entry.isFile()) {
        const fileExt = path.extname(entry.name);
        if (fileExt !== ext && fileExt !== `.${ext}`) {
          continue;
        }
      }

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
          await findInDirectory(fullPath, type, regex, ext, depth - 1, results, maxResults);
        }
      }
    }
  } catch {
    // 跳过无法访问的目录
  }
}

/**
 * 使用 glob 模式搜索文件
 */
async function searchWithGlob(
  globPattern: string,
  basePath: string,
  type: 'file' | 'directory',
  maxDepth: number,
  results: string[],
  maxResults: number
): Promise<void> {
  // 解析 glob 模式
  const { dirPattern, filePattern } = parseGlobPattern(globPattern);

  // 将 glob 转换为正则
  const dirRegex = dirPattern ? globToRegex(dirPattern) : null;
  const fileRegex = globToRegex(filePattern);

  await searchWithGlobRecursive(
    basePath,
    dirRegex,
    fileRegex,
    type,
    maxDepth,
    results,
    maxResults,
    0
  );
}

/**
 * 解析 glob 模式，分离目录部分和文件名部分
 */
function parseGlobPattern(globPattern: string): { dirPattern: string; filePattern: string } {
  // 处理 **/*.ts 这种模式
  if (globPattern.includes('**')) {
    // 找到 ** 之后的部分
    const idx = globPattern.indexOf('**');
    const after = globPattern.slice(idx + 2);
    // 去掉开头的 /
    const dirPart = after.startsWith('/') ? after.slice(1) : after;

    // 如果 dirPart 包含 /，则分割
    if (dirPart.includes('/')) {
      const slashIdx = dirPart.indexOf('/');
      return {
        dirPattern: dirPart.slice(0, slashIdx),
        filePattern: dirPart.slice(slashIdx + 1),
      };
    }
    return { dirPattern: '', filePattern: dirPart };
  }

  // 普通模式：检查是否包含路径
  const lastSlash = Math.max(globPattern.lastIndexOf('/'), globPattern.lastIndexOf('\\'));
  if (lastSlash === -1) {
    return { dirPattern: '', filePattern: globPattern };
  }

  return {
    dirPattern: globPattern.slice(0, lastSlash),
    filePattern: globPattern.slice(lastSlash + 1),
  };
}

/**
 * 将 glob 模式转换为正则表达式
 */
function globToRegex(glob: string): RegExp {
  let pattern = glob
    .replace(/\./g, '\\.')
    .replace(/\*\*/g, '{{DOUBLE_STAR}}')
    .replace(/\*/g, '.*')
    .replace(/\{\{DOUBLE_STAR\}\}/g, '.*')
    .replace(/\?/g, '.?');

  return new RegExp(`^${pattern}$`, 'i');
}

/**
 * 递归搜索（支持 glob 模式）
 */
async function searchWithGlobRecursive(
  dirPath: string,
  dirRegex: RegExp | null,
  fileRegex: RegExp,
  type: 'file' | 'directory',
  maxDepth: number,
  results: string[],
  maxResults: number,
  currentDepth: number
): Promise<void> {
  if (results.length >= maxResults || currentDepth >= maxDepth) return;

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (results.length >= maxResults) break;

      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        // 检查目录是否匹配
        if (!dirRegex || dirRegex.test(entry.name) || dirRegex.test('*')) {
          if (type === 'directory') {
            if (fileRegex.test(entry.name)) {
              results.push(fullPath);
            }
          }
          // 继续递归
          if (currentDepth + 1 < maxDepth) {
            await searchWithGlobRecursive(
              fullPath,
              dirRegex,
              fileRegex,
              type,
              maxDepth,
              results,
              maxResults,
              currentDepth + 1
            );
          }
        }
      } else if (entry.isFile()) {
        if (type === 'file' && fileRegex.test(entry.name)) {
          results.push(fullPath);
        }
      }
    }
  } catch {
    // 跳过无法访问的目录
  }
}
