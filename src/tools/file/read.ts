// 文件读取工具
import fs from 'node:fs/promises';
import { errorResult, jsonResult } from '../types.js';

export interface ReadFileParams {
  path: string;
  from?: number;    // 起始行
  lines?: number;   // 读取行数
}

/**
 * 创建文件读取工具
 */
export function createReadTool() {
  return {
    label: 'Read',
    name: 'read',
    description: 'Read contents of a file. Returns the contents as a string.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to the file to read' },
        from: { type: 'number', description: 'Line number to start reading from (1-based)', default: 1 },
        lines: { type: 'number', description: 'Number of lines to read', default: 100 },
      },
      required: ['path'],
    },
    execute: async (_toolCallId: string, params: ReadFileParams) => {
      try {
        const { path: filePath, from = 1, lines = 100 } = params;

        const content = await fs.readFile(filePath, 'utf-8');
        const allLines = content.split('\n');

        const startIndex = Math.max(0, from - 1);
        const endIndex = Math.min(allLines.length, startIndex + lines);

        const selectedLines = allLines.slice(startIndex, endIndex);
        const selectedContent = selectedLines.join('\n');

        return jsonResult({
          content: selectedContent,
          lines: selectedLines.length,
          totalLines: allLines.length,
          from: from,
          to: endIndex,
          path: filePath,
        });
      } catch (error) {
        return errorResult(`Failed to read file: ${error}`);
      }
    },
  };
}
