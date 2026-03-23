/**
 * ToolRegistry 和 ToolLoop 完整测试
 *
 * TDD 规范重写：验证真实行为
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ToolRegistry, ToolLoop, BashToolExecutor, createDefaultToolRegistry, type ToolExecutor, type ToolLoopConfig } from '../../../src/agents/tools.js';
import type { Tool, ToolCall, ToolResult, ToolGate } from '../../../src/agents/types.js';

// ============================================================
// 测试辅助函数
// ============================================================

/**
 * 创建一个简单的测试工具
 */
function createTestTool(overrides: Partial<Tool> = {}): Tool {
  return {
    name: 'test_tool',
    description: 'A test tool',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
    },
    execute: vi.fn().mockResolvedValue({ toolCallId: 'call_1', output: 'result' }),
    ...overrides,
  };
}

/**
 * 创建一个模拟执行器
 */
function createMockExecutor(results: ToolResult[] = []): ToolExecutor & { execute: ReturnType<typeof vi.fn> } {
  let index = 0;
  return {
    execute: vi.fn().mockImplementation(async (toolCall: ToolCall) => {
      const result = results[index] ?? { toolCallId: toolCall.id, output: 'default result' };
      index++;
      return result;
    }),
  };
}

// ============================================================
// ToolRegistry 测试
// ============================================================

describe('ToolRegistry', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  describe('register()', () => {
    it('should register a tool', () => {
      const tool = createTestTool({ name: 'my_tool' });

      registry.register(tool);

      expect(registry.has('my_tool')).toBe(true);
    });

    it('should overwrite existing tool with same name', () => {
      const tool1 = createTestTool({ name: 'tool', description: 'First' });
      const tool2 = createTestTool({ name: 'tool', description: 'Second' });

      registry.register(tool1);
      registry.register(tool2);

      const retrieved = registry.get('tool');
      expect(retrieved?.description).toBe('Second');
    });

    it('should register multiple tools', () => {
      registry.register(createTestTool({ name: 'tool_a' }));
      registry.register(createTestTool({ name: 'tool_b' }));
      registry.register(createTestTool({ name: 'tool_c' }));

      expect(registry.list()).toHaveLength(3);
    });
  });

  describe('get()', () => {
    it('should return tool when exists', () => {
      const tool = createTestTool({ name: 'existing_tool' });
      registry.register(tool);

      const retrieved = registry.get('existing_tool');

      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('existing_tool');
    });

    it('should return undefined when tool not found', () => {
      const result = registry.get('nonexistent');

      expect(result).toBeUndefined();
    });
  });

  describe('list()', () => {
    it('should return empty array when no tools', () => {
      expect(registry.list()).toEqual([]);
    });

    it('should return all registered tools', () => {
      registry.register(createTestTool({ name: 'a' }));
      registry.register(createTestTool({ name: 'b' }));
      registry.register(createTestTool({ name: 'c' }));

      const tools = registry.list();

      expect(tools).toHaveLength(3);
      expect(tools.map(t => t.name)).toContain('a');
      expect(tools.map(t => t.name)).toContain('b');
      expect(tools.map(t => t.name)).toContain('c');
    });
  });

  describe('has()', () => {
    it('should return true for existing tool', () => {
      registry.register(createTestTool({ name: 'exists' }));

      expect(registry.has('exists')).toBe(true);
    });

    it('should return false for nonexistent tool', () => {
      expect(registry.has('nonexistent')).toBe(false);
    });
  });
});

// ============================================================
// ToolLoop 测试
// ============================================================

describe('ToolLoop', () => {
  let registry: ToolRegistry;
  let executor: ToolExecutor & { execute: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    registry = new ToolRegistry();
    executor = createMockExecutor();
  });

  describe('constructor', () => {
    it('should use default config values', () => {
      const loop = new ToolLoop(registry, { executor });

      expect(loop).toBeInstanceOf(ToolLoop);
    });

    it('should apply custom maxIterations', () => {
      const loop = new ToolLoop(registry, {
        executor,
        maxIterations: 5,
      });

      expect(loop).toBeInstanceOf(ToolLoop);
    });

    it('should apply custom timeoutMs', () => {
      const loop = new ToolLoop(registry, {
        executor,
        timeoutMs: 60000,
      });

      expect(loop).toBeInstanceOf(ToolLoop);
    });
  });

  describe('executeToolCalls()', () => {
    it('should execute registered tool and return result', async () => {
      const tool = createTestTool({ name: 'read' });
      registry.register(tool);

      const loop = new ToolLoop(registry, { executor });

      const toolCalls: ToolCall[] = [
        { id: 'call_1', name: 'read', input: { path: '/test.txt' } },
      ];

      const results = await loop.executeToolCalls(toolCalls);

      expect(executor.execute).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'read' })
      );
      expect(results).toHaveLength(1);
    });

    it('should return error when tool not found', async () => {
      const loop = new ToolLoop(registry, { executor });

      const toolCalls: ToolCall[] = [
        { id: 'call_1', name: 'nonexistent', input: {} },
      ];

      const results = await loop.executeToolCalls(toolCalls);

      expect(results[0].isError).toBe(true);
      expect(results[0].output).toContain('not found');
    });

    it('should execute multiple tool calls in order', async () => {
      const tool1 = createTestTool({ name: 'tool_1' });
      const tool2 = createTestTool({ name: 'tool_2' });
      registry.register(tool1);
      registry.register(tool2);

      const loop = new ToolLoop(registry, { executor });

      const toolCalls: ToolCall[] = [
        { id: 'call_1', name: 'tool_1', input: {} },
        { id: 'call_2', name: 'tool_2', input: {} },
      ];

      await loop.executeToolCalls(toolCalls);

      expect(executor.execute).toHaveBeenCalledTimes(2);
    });

    it('should catch and wrap executor errors', async () => {
      const errorExecutor: ToolExecutor = {
        execute: vi.fn().mockRejectedValue(new Error('Execution failed')),
      };

      const tool = createTestTool({ name: 'error_tool' });
      registry.register(tool);

      const loop = new ToolLoop(registry, { executor: errorExecutor });

      const toolCalls: ToolCall[] = [
        { id: 'call_1', name: 'error_tool', input: {} },
      ];

      const results = await loop.executeToolCalls(toolCalls);

      expect(results[0].isError).toBe(true);
      expect(results[0].output).toBe('Execution failed');
    });

    it('should handle empty tool call list', async () => {
      const loop = new ToolLoop(registry, { executor });

      const results = await loop.executeToolCalls([]);

      expect(results).toEqual([]);
      expect(executor.execute).not.toHaveBeenCalled();
    });

    it('should skip tool when gate.always is true (always available)', async () => {
      const tool = createTestTool({
        name: 'always_available',
        gate: { always: true },
      });
      registry.register(tool);

      const loop = new ToolLoop(registry, { executor });

      const toolCalls: ToolCall[] = [
        { id: 'call_1', name: 'always_available', input: {} },
      ];

      const results = await loop.executeToolCalls(toolCalls);

      // Tool should execute because gate.always = true
      expect(executor.execute).toHaveBeenCalled();
      expect(results[0].isError).toBeFalsy();
    });

    it('should skip tool when gate.os does not match', async () => {
      const tool = createTestTool({
        name: 'os_limited',
        gate: { os: ['win32'] }, // Linux but tool requires Windows
      });
      registry.register(tool);

      const loop = new ToolLoop(registry, { executor });

      const toolCalls: ToolCall[] = [
        { id: 'call_1', name: 'os_limited', input: {} },
      ];

      const results = await loop.executeToolCalls(toolCalls);

      // Tool should be skipped due to OS mismatch
      expect(executor.execute).not.toHaveBeenCalled();
      expect(results[0].isError).toBe(true);
    });
  });
});

// ============================================================
// BashToolExecutor 测试
// ============================================================

describe('BashToolExecutor', () => {
  let executor: BashToolExecutor;

  beforeEach(() => {
    executor = new BashToolExecutor();
  });

  it('should execute command and return output', async () => {
    const result = await executor.execute({
      id: 'call_1',
      name: 'bash',
      input: { command: 'echo "hello"' },
    });

    expect(result.toolCallId).toBe('call_1');
    expect(result.output).toContain('hello');
    expect(result.isError).toBeFalsy();
  });

  it('should return error when command fails', async () => {
    const result = await executor.execute({
      id: 'call_1',
      name: 'bash',
      input: { command: 'exit 1' },
    });

    expect(result.isError).toBe(true);
  });
});

// ============================================================
// createDefaultToolRegistry 测试
// ============================================================

describe('createDefaultToolRegistry', () => {
  it('should create registry with built-in tools', () => {
    const registry = createDefaultToolRegistry();

    expect(registry.has('bash')).toBe(true);
    expect(registry.has('read')).toBe(true);
    expect(registry.has('write')).toBe(true);
    expect(registry.has('edit')).toBe(true);
    expect(registry.has('search')).toBe(true);
  });

  it('should have correct tool descriptions', () => {
    const registry = createDefaultToolRegistry();

    const bash = registry.get('bash');
    expect(bash?.description).toBe('执行 bash 命令');

    const read = registry.get('read');
    expect(read?.description).toBe('读取文件内容');
  });

  it('should have correct input schemas', () => {
    const registry = createDefaultToolRegistry();

    const bash = registry.get('bash');
    expect(bash?.inputSchema.properties.command).toBeDefined();

    const read = registry.get('read');
    expect(read?.inputSchema.properties.path).toBeDefined();
  });

  it('should mark confirmation-requiring tools', () => {
    const registry = createDefaultToolRegistry();

    const bash = registry.get('bash');
    expect(bash?.requiresConfirmation).toBe(true);

    const read = registry.get('read');
    expect(read?.requiresConfirmation).toBeUndefined();
  });
});
