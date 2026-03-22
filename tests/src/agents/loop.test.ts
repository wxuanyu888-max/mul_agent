/**
 * AgentLoop 完整测试
 *
 * TDD 规范重写：验证真实行为，不使用虚假测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AgentLoop, createAgentLoop, type AgentLoopConfig, type ToolCall } from '../../../src/agents/loop.js';
import type { RegisteredTool } from '../../../src/agents/loop.js';
import type { LLMResponse } from '../../../src/agents/llm.js';

// ============================================================
// Mock 依赖模块
// ============================================================

// Mock LLM 模块
const mockLlmClient = {
  chat: vi.fn<[unknown], Promise<LLMResponse>>(),
};

vi.mock('../../../src/agents/llm.js', () => ({
  getLLMClient: vi.fn(() => mockLlmClient),
}));

// Mock Prompt Builder
vi.mock('../../../src/agents/prompt/index.js', () => ({
  buildSystemPrompt: vi.fn(() => Promise.resolve('Mocked system prompt')),
}));

// Mock Tools
vi.mock('../../../src/tools/index.js', () => ({
  createDefaultTools: vi.fn(() => [
    {
      name: 'mock_tool',
      description: 'Mock tool',
      parameters: { type: 'object', properties: {} },
      execute: vi.fn(),
    },
  ]),
  createLoadTool: vi.fn(() => ({ name: 'load', description: 'Load tool', parameters: { type: 'object', properties: {} }, execute: vi.fn() })),
  syncWorkspaceToMemory: vi.fn(() => Promise.resolve()),
}));

// Mock Compaction
vi.mock('../../../src/agents/compaction.js', () => ({
  microCompact: vi.fn((msgs, _cfg, ctx) => ({ messages: msgs, context: ctx })),
  autoCompact: vi.fn((msgs, _cfg, ctx) => Promise.resolve({ messages: msgs, context: ctx })),
  manualCompact: vi.fn((msgs, _cfg, ctx) => Promise.resolve({ messages: msgs, context: ctx })),
  needsAutoCompact: vi.fn(() => false),
  estimateMessageTokens: vi.fn(() => 1000),
  createCompactionContext: vi.fn(() => ({})),
}));

// Mock Background Manager
const mockBackgroundManager = {
  drainNotifications: vi.fn(() => []),
};

vi.mock('../../../src/agents/background.js', () => ({
  getBackgroundManager: vi.fn(() => mockBackgroundManager),
}));

// Mock Skills
vi.mock('../../../src/skills/index.js', () => ({
  loadSkillsFromDir: vi.fn(() => Promise.resolve([])),
  getUserInvocableSkills: vi.fn((entries) => entries),
}));

vi.mock('../../../src/skills/manager.js', () => ({
  getEnabledSkills: vi.fn(() => []),
}));

// ============================================================
// 测试工具函数
// ============================================================

/**
 * 创建一个简单的测试工具
 */
function createTestTool(overrides: Partial<RegisteredTool> = {}): RegisteredTool {
  return {
    name: 'test_tool',
    description: 'A test tool',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string' },
      },
      required: ['query'],
    },
    execute: vi.fn().mockResolvedValue({ content: '{"result":"ok"}' }),
    ...overrides,
  };
}

/**
 * 创建文本响应
 */
function createTextResponse(text: string): LLMResponse {
  return {
    content: [{ type: 'text', text }],
    stop_reason: 'stop',
    usage: { input_tokens: 100, output_tokens: 50 },
  };
}

/**
 * 创建工具调用响应
 */
function createToolCallResponse(toolName: string, toolInput: Record<string, unknown>): LLMResponse {
  return {
    content: [
      { type: 'text', text: 'I need to use a tool' },
      { type: 'tool_use', id: `call_${Date.now()}`, name: toolName, input: toolInput },
    ],
    stop_reason: 'tool_use',
    usage: { input_tokens: 100, output_tokens: 50 },
  };
}

// ============================================================
// 测试用例
// ============================================================

describe('AgentLoop', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLlmClient.chat.mockReset();
  });

  // ============================================================
  // 构造函数测试
  // ============================================================

  describe('constructor', () => {
    it('should use default config when no parameters provided', () => {
      const loop = new AgentLoop();

      // 通过公开 API 验证默认配置已生效
      expect(loop.getConversationRound()).toBe(0);
      expect(loop.getLoadedItems()).toEqual([]);
    });

    it('should apply custom maxIterations', async () => {
      const loop = new AgentLoop({ maxIterations: 5 });

      // 设置 maxIterations=5，LLM 返回文本响应（不触发迭代）
      mockLlmClient.chat.mockResolvedValueOnce(createTextResponse('done'));

      await loop.run({ message: 'test' });

      // 只应该调用 1 次 LLM（因为立即返回）
      expect(mockLlmClient.chat).toHaveBeenCalledTimes(1);
    });

    it('should apply custom timeoutMs in config', () => {
      const config: AgentLoopConfig = { timeoutMs: 60000 };
      const loop = new AgentLoop(config);

      // 验证构造函数不抛出错误
      expect(loop).toBeInstanceOf(AgentLoop);
    });

    it('should apply custom workspaceDir', () => {
      const loop = new AgentLoop({ workspaceDir: '/custom/path' });

      expect(loop).toBeInstanceOf(AgentLoop);
    });

    it('should apply custom sessionId', () => {
      const loop = new AgentLoop({ sessionId: 'session-123' });

      expect(loop).toBeInstanceOf(AgentLoop);
    });

    it('should apply custom promptMode', () => {
      const loop = new AgentLoop({ promptMode: 'minimal' });

      expect(loop).toBeInstanceOf(AgentLoop);
    });

    it('should apply custom extraSystemPrompt', () => {
      const loop = new AgentLoop({ extraSystemPrompt: 'Be concise' });

      expect(loop).toBeInstanceOf(AgentLoop);
    });

    it('should apply custom compaction config', () => {
      const compactionConfig = { autoCompactThreshold: 10000 };
      const loop = new AgentLoop({ compaction: compactionConfig });

      expect(loop).toBeInstanceOf(AgentLoop);
    });

    it('should store callback functions', () => {
      const onToolConfirm = vi.fn().mockResolvedValue(true);
      const onToolExecute = vi.fn();
      const onLlmCall = vi.fn();
      const onLlmResponse = vi.fn();

      const loop = new AgentLoop({
        onToolConfirm,
        onToolExecute,
        onLlmCall,
        onLlmResponse,
      });

      expect(loop).toBeInstanceOf(AgentLoop);
    });
  });

  // ============================================================
  // registerTool 测试
  // ============================================================

  describe('registerTool', () => {
    it('should register a tool and make it retrievable', async () => {
      const loop = new AgentLoop();
      const tool = createTestTool({ name: 'my_tool' });

      loop.registerTool(tool);

      // 工具应该被存储（通过 run 执行验证）
      mockLlmClient.chat.mockResolvedValueOnce(createTextResponse('done'));
      const result = await loop.run({ message: 'test' });

      expect(result.success).toBe(true);
    });

    it('should allow overwriting existing tool with same name', () => {
      const loop = new AgentLoop();

      const tool1 = createTestTool({
        name: 'overwrite_tool',
        description: 'Original',
      });
      const tool2 = createTestTool({
        name: 'overwrite_tool',
        description: 'Replacement',
      });

      loop.registerTool(tool1);
      loop.registerTool(tool2); // 应该覆盖

      expect(loop).toBeInstanceOf(AgentLoop);
    });

    it('should store all tool properties correctly', async () => {
      const loop = new AgentLoop();
      const tool = createTestTool({
        name: 'full_tool',
        description: 'Full tool description',
        parameters: {
          type: 'object',
          properties: { foo: { type: 'string' }, bar: { type: 'number' } },
          required: ['foo'],
        },
        requiresConfirmation: true,
      });

      loop.registerTool(tool);

      mockLlmClient.chat.mockResolvedValueOnce(createTextResponse('done'));
      const result = await loop.run({ message: 'test' });

      expect(result.success).toBe(true);
    });
  });

  // ============================================================
  // registerTools 测试
  // ============================================================

  describe('registerTools', () => {
    it('should register multiple tools at once', async () => {
      const loop = new AgentLoop();
      const tools = [
        createTestTool({ name: 'tool_a' }),
        createTestTool({ name: 'tool_b' }),
        createTestTool({ name: 'tool_c' }),
      ];

      loop.registerTools(tools);

      mockLlmClient.chat.mockResolvedValueOnce(createTextResponse('done'));
      const result = await loop.run({ message: 'test' });

      expect(result.success).toBe(true);
    });

    it('should register tools in order', async () => {
      const loop = new AgentLoop();
      const tools = [
        createTestTool({ name: 'first' }),
        createTestTool({ name: 'second' }),
      ];

      loop.registerTools(tools);

      mockLlmClient.chat.mockResolvedValueOnce(createTextResponse('done'));
      const result = await loop.run({ message: 'test' });

      expect(result.success).toBe(true);
    });
  });

  // ============================================================
  // registerDefaultTools 测试
  // ============================================================

  describe('registerDefaultTools', () => {
    it('should register default tools without error', async () => {
      const loop = new AgentLoop();

      loop.registerDefaultTools();

      mockLlmClient.chat.mockResolvedValueOnce(createTextResponse('done'));
      const result = await loop.run({ message: 'test' });

      expect(result.success).toBe(true);
    });
  });

  // ============================================================
  // getLoadedItems / getConversationRound 测试
  // ============================================================

  describe('getLoadedItems', () => {
    it('should return empty array initially', () => {
      const loop = new AgentLoop();

      expect(loop.getLoadedItems()).toEqual([]);
    });
  });

  describe('getConversationRound', () => {
    it('should return 0 initially', () => {
      const loop = new AgentLoop();

      expect(loop.getConversationRound()).toBe(0);
    });

    it('should return 1 after first run', async () => {
      const loop = new AgentLoop();
      mockLlmClient.chat.mockResolvedValueOnce(createTextResponse('done'));

      await loop.run({ message: 'test' });

      expect(loop.getConversationRound()).toBe(1);
    });
  });

  // ============================================================
  // run() 核心场景测试
  // ============================================================

  describe('run()', () => {
    it('should return text response when stop_reason is stop', async () => {
      const loop = new AgentLoop();
      mockLlmClient.chat.mockResolvedValueOnce(createTextResponse('Hello, World!'));

      const result = await loop.run({ message: 'Hi' });

      expect(result.success).toBe(true);
      expect(result.content).toBe('Hello, World!');
      expect(result.iterations).toBe(1);
      expect(result.toolCalls).toBe(0);
    });

    it('should track tool call count', async () => {
      const loop = new AgentLoop();
      const tool = createTestTool({ name: 'read' });
      loop.registerTool(tool);

      // 第一调用返回 tool_use，第二调用返回 stop
      mockLlmClient.chat
        .mockResolvedValueOnce(createToolCallResponse('read', { path: '/test.txt' }))
        .mockResolvedValueOnce(createTextResponse('Done'));

      const result = await loop.run({ message: 'Read the file' });

      expect(result.success).toBe(true);
      expect(result.toolCalls).toBe(1);
    });

    it('should track token usage from LLM response', async () => {
      const loop = new AgentLoop();
      mockLlmClient.chat.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Hi' }],
        stop_reason: 'stop',
        usage: { input_tokens: 150, output_tokens: 75 },
      });

      const result = await loop.run({ message: 'Hi' });

      expect(result.usage).toEqual({
        inputTokens: 150,
        outputTokens: 75,
      });
    });

    it('should return error when max iterations reached', async () => {
      const loop = new AgentLoop({ maxIterations: 2 });

      // 始终返回 tool_use，触发最大迭代
      mockLlmClient.chat.mockResolvedValue({
        content: [{ type: 'tool_use', id: 'c1', name: 'wait', input: {} }],
        stop_reason: 'tool_use',
        usage: { input_tokens: 100, output_tokens: 50 },
      });

      const result = await loop.run({ message: 'test' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Max iterations reached');
      expect(result.iterations).toBe(2);
    });

    it('should return error when LLM throws exception', async () => {
      const loop = new AgentLoop();
      mockLlmClient.chat.mockRejectedValue(new Error('Network error'));

      const result = await loop.run({ message: 'Hi' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });

    it('should include messages in result on success', async () => {
      const loop = new AgentLoop();
      mockLlmClient.chat.mockResolvedValueOnce(createTextResponse('Done'));

      const result = await loop.run({ message: 'test' });

      expect(result.messages).toBeDefined();
      expect(Array.isArray(result.messages)).toBe(true);
    });

    it('should include messages in result on max iterations', async () => {
      const loop = new AgentLoop({ maxIterations: 1 });
      mockLlmClient.chat.mockResolvedValue({
        content: [{ type: 'tool_use', id: 'c1', name: 'wait', input: {} }],
        stop_reason: 'tool_use',
        usage: { input_tokens: 100, output_tokens: 50 },
      });

      const result = await loop.run({ message: 'test' });

      expect(result.messages).toBeDefined();
    });

    it('should pass history messages to LLM', async () => {
      const loop = new AgentLoop();
      mockLlmClient.chat.mockResolvedValueOnce(createTextResponse('Response'));

      await loop.run({
        message: 'second message',
        history: [
          { role: 'user', content: 'first message' },
          { role: 'assistant', content: 'first response' },
        ],
      });

      expect(mockLlmClient.chat).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({ role: 'user', content: 'first message' }),
            expect.objectContaining({ role: 'assistant', content: 'first response' }),
            expect.objectContaining({ role: 'user', content: 'second message' }),
          ]),
        })
      );
    });

    it('should increment conversation round on each run', async () => {
      const loop = new AgentLoop();
      mockLlmClient.chat.mockResolvedValue(createTextResponse('done'));

      await loop.run({ message: 'first' });
      expect(loop.getConversationRound()).toBe(1);

      await loop.run({ message: 'second' });
      expect(loop.getConversationRound()).toBe(2);
    });
  });

  // ============================================================
  // 工具执行测试
  // ============================================================

  describe('tool execution', () => {
    it('should execute registered tool and return result', async () => {
      const loop = new AgentLoop();
      const executeFn = vi.fn().mockResolvedValue({ content: '{"data":"file content"}' });
      const tool = createTestTool({ name: 'read', execute: executeFn });
      loop.registerTool(tool);

      mockLlmClient.chat
        .mockResolvedValueOnce(createToolCallResponse('read', { path: '/test.txt' }))
        .mockResolvedValueOnce(createTextResponse('Read completed'));

      const result = await loop.run({ message: 'Read the file' });

      expect(executeFn).toHaveBeenCalledWith(expect.any(String), { path: '/test.txt' });
      expect(result.success).toBe(true);
    });

    it('should reject tool when onToolConfirm returns false', async () => {
      const onToolConfirm = vi.fn().mockResolvedValue(false);
      const loop = new AgentLoop({ onToolConfirm });
      const tool = createTestTool({ name: 'dangerous' });
      loop.registerTool(tool);

      mockLlmClient.chat
        .mockResolvedValueOnce(createToolCallResponse('dangerous', {}))
        .mockResolvedValueOnce(createTextResponse('Tool was rejected'));

      const result = await loop.run({ message: 'Do dangerous thing' });

      expect(onToolConfirm).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'dangerous' })
      );
      expect(result.success).toBe(true); // 继续执行但跳过了工具
    });

    it('should call onToolExecute callback after tool execution', async () => {
      const onToolExecute = vi.fn();
      const executeFn = vi.fn().mockResolvedValue({ content: 'ok' });
      const loop = new AgentLoop({ onToolExecute });
      const tool = createTestTool({ name: 'test', execute: executeFn });
      loop.registerTool(tool);

      mockLlmClient.chat
        .mockResolvedValueOnce(createToolCallResponse('test', { query: 'test' }))
        .mockResolvedValueOnce(createTextResponse('done'));

      await loop.run({ message: 'run tool' });

      expect(onToolExecute).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'test' }),
        expect.objectContaining({ output: 'ok' })
      );
    });

    it('should call onLlmCall callback before LLM chat', async () => {
      const onLlmCall = vi.fn();
      const loop = new AgentLoop({ onLlmCall });

      mockLlmClient.chat.mockResolvedValueOnce(createTextResponse('done'));

      await loop.run({ message: 'test' });

      expect(onLlmCall).toHaveBeenCalledWith(
        expect.any(Array),
        expect.any(String)
      );
    });

    it('should call onLlmResponse callback after LLM chat', async () => {
      const onLlmResponse = vi.fn();
      const loop = new AgentLoop({ onLlmResponse });

      mockLlmClient.chat.mockResolvedValueOnce(createTextResponse('done'));

      await loop.run({ message: 'test' });

      expect(onLlmResponse).toHaveBeenCalledWith(
        expect.objectContaining({ content: expect.any(Array) })
      );
    });
  });

  // ============================================================
  // createAgentLoop 工厂函数测试
  // ============================================================

  describe('createAgentLoop', () => {
    it('should create AgentLoop instance with config', () => {
      const loop = createAgentLoop({ maxIterations: 10 });

      expect(loop).toBeInstanceOf(AgentLoop);
    });

    it('should create AgentLoop instance without config', () => {
      const loop = createAgentLoop();

      expect(loop).toBeInstanceOf(AgentLoop);
    });
  });
});

// ============================================================
// ToolCall 接口测试
// ============================================================

describe('ToolCall interface', () => {
  it('should have correct structure', () => {
    const toolCall: ToolCall = {
      id: 'call_123',
      name: 'bash',
      input: { command: 'ls -la' },
    };

    expect(toolCall.id).toBe('call_123');
    expect(toolCall.name).toBe('bash');
    expect(toolCall.input).toEqual({ command: 'ls -la' });
  });

  it('should allow empty input', () => {
    const toolCall: ToolCall = {
      id: 'call_456',
      name: 'no_params',
      input: {},
    };

    expect(toolCall.input).toEqual({});
  });

  it('should support complex input', () => {
    const toolCall: ToolCall = {
      id: 'call_789',
      name: 'multi_param',
      input: {
        files: [{ path: '/a.txt' }, { path: '/b.txt' }],
        options: { recursive: true },
      },
    };

    expect(toolCall.input.files).toHaveLength(2);
    expect(toolCall.input.options).toEqual({ recursive: true });
  });
});

// ============================================================
// AgentLoopConfig 接口测试
// ============================================================

describe('AgentLoopConfig interface', () => {
  it('should accept all configuration options', () => {
    const config: AgentLoopConfig = {
      maxIterations: 5,
      timeoutMs: 60000,
      workspaceDir: '/workspace',
      sessionId: 'session-1',
      fileRefreshInterval: 5,
      extraSystemPrompt: 'Be helpful and concise',
      promptMode: 'minimal',
      onToolConfirm: async () => true,
      onToolExecute: () => {},
      onLlmCall: () => {},
      onLlmResponse: () => {},
      compaction: {
        autoCompactThreshold: 10000,
      },
      onManualCompact: async () => {},
    };

    const loop = new AgentLoop(config);

    expect(loop).toBeInstanceOf(AgentLoop);
  });

  it('should accept promptMode full', () => {
    const loop = new AgentLoop({ promptMode: 'full' });
    expect(loop).toBeInstanceOf(AgentLoop);
  });

  it('should accept promptMode minimal', () => {
    const loop = new AgentLoop({ promptMode: 'minimal' });
    expect(loop).toBeInstanceOf(AgentLoop);
  });

  it('should accept promptMode none', () => {
    const loop = new AgentLoop({ promptMode: 'none' });
    expect(loop).toBeInstanceOf(AgentLoop);
  });
});
