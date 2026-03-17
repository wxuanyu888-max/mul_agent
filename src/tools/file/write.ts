// 文件写入工具
import fs from 'node:fs/promises';
import path from 'node:path';
import { errorResult, jsonResult } from '../types.js';

export interface WriteFileParams {
  path: string;
  content: string;
  createDirectories?: boolean;  // 是否自动创建目录
}

/**
 * 创建文件写入工具
 */
export function createWriteTool() {
  return {
    label: 'Write',
    name: 'write',
    description: 'Write content to a file. Creates the file if it does not exist, or overwrites if it does.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to the file to write' },
        content: { type: 'string', description: 'Content to write to the file' },
        createDirectories: { type: 'boolean', description: 'Create parent directories if they do not exist', default: true },
      },
      required: ['path', 'content'],
    },
    execute: async (_toolCallId: string, params: WriteFileParams) => {
      try {
        const { path: filePath, content, createDirectories = true } = params;

        if (createDirectories) {
          const dir = path.dirname(filePath);
          await fs.mkdir(dir, { recursive: true });
        }

        await fs.writeFile(filePath, content, 'utf-8');

        const lines = content.split('\n').length;
        return jsonResult({
          success: true,
          path: filePath,
          lines,
          bytes: Buffer.byteLength(content, 'utf-8'),
        });
      } catch (error) {
        return errorResult(`Failed to write file: ${error}`);
      }
    },
  };
}
