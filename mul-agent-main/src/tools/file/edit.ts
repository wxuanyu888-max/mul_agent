// 文件编辑工具 - 字符串替换
import fs from 'node:fs/promises';
import { errorResult, jsonResult } from '../types.js';

export interface EditFileParams {
  path: string;
  oldString: string;  // 要替换的字符串
  newString: string; // 替换后的字符串
  replaceAll?: boolean;  // 是否替换所有匹配（默认 false）
}

/**
 * 创建文件编辑工具
 */
export function createEditTool() {
  return {
    label: 'Edit',
    name: 'edit',
    description: 'Edit a file by replacing a specific string with a new string.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to the file to edit' },
        oldString: { type: 'string', description: 'The string to replace' },
        newString: { type: 'string', description: 'The string to replace it with' },
        replaceAll: { type: 'boolean', description: 'Replace all occurrences (default: false)', default: false },
      },
      required: ['path', 'oldString', 'newString'],
    },
    execute: async (_toolCallId: string, params: EditFileParams) => {
      try {
        const { path: filePath, oldString, newString, replaceAll = false } = params;

        let content = await fs.readFile(filePath, 'utf-8');

        if (!content.includes(oldString)) {
          return errorResult(`String not found in file: "${oldString}"`);
        }

        let count: number;
        if (replaceAll) {
          const regex = new RegExp(escapeRegExp(oldString), 'g');
          content = content.replace(regex, newString);
          count = (content.match(new RegExp(escapeRegExp(newString), 'g')) || []).length;
        } else {
          content = content.replace(oldString, newString);
          count = 1;
        }

        await fs.writeFile(filePath, content, 'utf-8');

        return jsonResult({
          success: true,
          path: filePath,
          replacements: count,
        });
      } catch (error) {
        return errorResult(`Failed to edit file: ${error}`);
      }
    },
  };
}

// 转义正则表达式特殊字符
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
