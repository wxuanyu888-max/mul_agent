// 文件编辑工具 - 字符串替换/正则表达式替换
import fs from 'node:fs/promises';
import { errorResult, jsonResult } from '../types.js';

export interface EditFileParams {
  path: string;
  oldString: string;  // 要替换的字符串
  newString: string; // 替换后的字符串
  replaceAll?: boolean;  // 是否替换所有匹配（默认 false）
  regex?: boolean;   // 是否使用正则表达式匹配（默认 false）
}

/**
 * 创建文件编辑工具
 */
export function createEditTool() {
  return {
    label: 'Edit',
    name: 'edit',
    description: 'Edit a file by replacing a specific string with a new string. Use when you need to make targeted modifications to existing files. For creating new files, use write tool. Supports both exact string replacement and regex patterns.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absolute or relative path to the file to edit' },
        oldString: { type: 'string', description: 'The exact string to find and replace (must match exactly including whitespace). For regex, use regex: true.' },
        newString: { type: 'string', description: 'The string to replace it with. Use capture groups ($1, $2) in regex mode.' },
        replaceAll: { type: 'boolean', description: 'Replace all occurrences of oldString (default: false, only replaces first match)', default: false },
        regex: { type: 'boolean', description: 'Treat oldString as a regex pattern instead of literal string (default: false). Use for complex patterns like "function\\s+(\\w+)"', default: false },
      },
      required: ['path', 'oldString', 'newString'],
    },
    execute: async (_toolCallId: string, params: EditFileParams) => {
      try {
        const { path: filePath, oldString, newString, replaceAll = false, regex = false } = params;

        let content = await fs.readFile(filePath, 'utf-8');

        let count: number;
        if (regex) {
          // 正则表达式模式
          const flags = replaceAll ? 'g' : '';
          const regexObj = new RegExp(oldString, flags);

          if (!regexObj.test(content)) {
            return errorResult(`Regex pattern not found in file: "${oldString}"`);
          }

          content = content.replace(regexObj, newString);
          const matches = content.match(regexObj);
          count = matches ? matches.length : 0;
        } else {
          // 字符串模式
          if (!content.includes(oldString)) {
            return errorResult(`String not found in file: "${oldString}"`);
          }

          if (replaceAll) {
            const escaped = escapeRegExp(oldString);
            const regexObj = new RegExp(escaped, 'g');
            content = content.replace(regexObj, newString);
            const matches = content.match(new RegExp(escapeRegExp(newString), 'g'));
            count = matches ? matches.length : 0;
          } else {
            content = content.replace(oldString, newString);
            count = 1;
          }
        }

        await fs.writeFile(filePath, content, 'utf-8');

        return jsonResult({
          success: true,
          path: filePath,
          replacements: count,
          mode: regex ? 'regex' : 'string',
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
