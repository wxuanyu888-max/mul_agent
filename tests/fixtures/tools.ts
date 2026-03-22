/**
 * Tool Fixtures - 静态测试数据
 */

import type { Tool, ToolResult } from '../../src/tools/types.js';

export const mockTool: Tool = {
  name: 'mockTool',
  label: 'Mock Tool',
  description: 'A mock tool for testing',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'The query' },
    },
    required: ['query'],
  },
  execute: async (id, params) => {
    return {
      content: JSON.stringify({ success: true, result: params.query }),
      error: null,
    };
  },
};

export const mockTools = {
  read: {
    name: 'read',
    label: 'Read',
    description: 'Read file content',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path' },
      },
      required: ['path'],
    },
    execute: async () => ({ content: 'file content', error: null }),
  },
  write: {
    name: 'write',
    label: 'Write',
    description: 'Write file content',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        content: { type: 'string' },
      },
      required: ['path', 'content'],
    },
    execute: async () => ({ content: 'ok', error: null }),
  },
  bash: {
    name: 'bash',
    label: 'Bash',
    description: 'Execute bash command',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string' },
      },
      required: ['command'],
    },
    execute: async () => ({ content: 'output', error: null }),
  },
};

export const mockToolResults = {
  success: {
    content: '{"success": true, "result": "data"}',
    error: null,
  } as ToolResult,

  error: {
    content: '',
    error: 'File not found',
  } as ToolResult,

  empty: {
    content: '',
    error: null,
  } as ToolResult,
};
