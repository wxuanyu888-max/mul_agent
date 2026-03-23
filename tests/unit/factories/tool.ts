/**
 * Tool Factory - 创建测试用的 Tool 对象
 */

import { vi } from 'vitest';
import type { Tool, ToolResult } from '../../src/tools/types.js';

export interface ToolFactoryOptions {
  name?: string;
  label?: string;
  description?: string;
  executeResult?: ToolResult;
  executeError?: Error;
}

export const createTool = (options: ToolFactoryOptions = {}): Tool => {
  const execute = options.executeError
    ? async () => ({ content: '', error: options.executeError!.message })
    : async () => options.executeResult ?? { content: 'ok', error: null };

  return {
    name: options.name ?? 'testTool',
    label: options.label ?? 'Test Tool',
    description: options.description ?? 'A test tool',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
    execute: vi.fn(execute),
  };
};

export const createToolWithSchema = (
  name: string,
  schema: Tool['parameters'],
  executeResult?: ToolResult
): Tool => ({
  name,
  label: name,
  description: `Tool: ${name}`,
  parameters: schema,
  execute: vi.fn(async () => executeResult ?? { content: 'ok', error: null }),
});

export const createSuccessTool = (name = 'successTool') =>
  createTool({ name, executeResult: { content: 'success', error: null } });

export const createErrorTool = (name = 'errorTool', errorMsg = 'Error occurred') =>
  createTool({ name, executeError: new Error(errorMsg) });

export const createReadToolFixture = (content = 'file content') =>
  createTool({
    name: 'read',
    label: 'Read',
    description: 'Read file content',
    executeResult: { content, error: null },
  });

export const createBashToolFixture = (output = 'command output') =>
  createTool({
    name: 'bash',
    label: 'Bash',
    description: 'Execute bash command',
    executeResult: { content: output, error: null },
  });
