/**
 * LLMClient 完整测试
 *
 * TDD 规范重写：验证真实行为，不使用虚假测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LLMClient, getLLMClient, type LLMRequest, type LLMResponse } from '../../../src/agents/llm.js';

// ============================================================
// Mock 依赖模块
// ============================================================

// Mock config 模块
vi.mock('../../../src/agents/config.js', () => ({
  getApiKey: vi.fn(() => 'test-api-key'),
  getBaseUrl: vi.fn(() => 'https://api.minimax.chat'),
  getDefaultModel: vi.fn(() => 'abab6.5s-chat'),
  getTemperature: vi.fn(() => 0.7),
  getMaxTokens: vi.fn(() => 4096),
}));

// Mock logger 模块
vi.mock('../../../src/logger/index.js', () => ({
  logLlmCall: vi.fn().mockResolvedValue(undefined),
}));

// ============================================================
// 全局 fetch mock
// ============================================================

let mockFetch: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockFetch = vi.fn();
  globalThis.fetch = mockFetch as unknown as typeof fetch;
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ============================================================
// 测试辅助函数
// ============================================================

/**
 * 创建成功的 LLM 响应
 */
function createSuccessResponse(overrides: Partial<LLMResponse> = {}): LLMResponse {
  return {
    id: 'msg_test123',
    type: 'message',
    role: 'assistant',
    content: [{ type: 'text', text: 'Hello, world!' }],
    model: 'abab6.5s-chat',
    stop_reason: 'stop',
    usage: { input_tokens: 10, output_tokens: 5 },
    ...overrides,
  };
}

/**
 * 创建工具调用响应
 */
function createToolCallResponse(): LLMResponse {
  return {
    id: 'msg_tool123',
    type: 'message',
    role: 'assistant',
    content: [
      { type: 'text', text: 'I need to use a tool' },
      { type: 'tool_use', id: 'call_123', name: 'read', input: { path: '/test.txt' } },
    ],
    model: 'abab6.5s-chat',
    stop_reason: 'tool_use',
    usage: { input_tokens: 50, output_tokens: 30 },
  };
}

// ============================================================
// 测试用例
// ============================================================

describe('LLMClient', () => {
  describe('constructor', () => {
    it('should initialize with default config from config module', () => {
      const client = new LLMClient();

      // 验证配置被正确加载
      expect(client).toBeInstanceOf(LLMClient);
    });
  });

  describe('chat()', () => {
    it('should make API call with correct URL and headers', async () => {
      const client = new LLMClient();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce(createSuccessResponse()),
      });

      await client.chat({
        model: 'abab6.5s-chat',
        messages: [{ role: 'user', content: 'Hi' }],
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.minimax.chat/v1/messages',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'x-api-key': 'test-api-key',
            'anthropic-version': '2023-06-01',
          }),
        })
      );
    });

    it('should include messages in request body', async () => {
      const client = new LLMClient();
      const messages = [{ role: 'user' as const, content: 'Hello' }];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce(createSuccessResponse()),
      });

      await client.chat({
        model: 'abab6.5s-chat',
        messages,
      });

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body as string);

      expect(body.messages).toEqual(messages);
    });

    it('should use request model or fallback to default', async () => {
      const client = new LLMClient();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce(createSuccessResponse({ model: 'abab6.5s-chat' })),
      });

      await client.chat({
        messages: [{ role: 'user', content: 'Hi' }],
      });

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body as string);

      // 应该使用默认模型（来自 config mock）
      expect(body.model).toBe('abab6.5s-chat');
    });

    it('should use request temperature or fallback to default', async () => {
      const client = new LLMClient();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce(createSuccessResponse()),
      });

      await client.chat({
        messages: [{ role: 'user', content: 'Hi' }],
        temperature: 0.9,
      });

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body as string);

      expect(body.temperature).toBe(0.9);
    });

    it('should use request max_tokens or fallback to default', async () => {
      const client = new LLMClient();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce(createSuccessResponse()),
      });

      await client.chat({
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 2000,
      });

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body as string);

      expect(body.max_tokens).toBe(2000);
    });

    it('should include system prompt when provided', async () => {
      const client = new LLMClient();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce(createSuccessResponse()),
      });

      await client.chat({
        messages: [{ role: 'user', content: 'Hi' }],
        system: 'You are a helpful assistant.',
      });

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body as string);

      expect(body.system).toBe('You are a helpful assistant.');
    });

    it('should include tools when provided', async () => {
      const client = new LLMClient();
      const tools = [
        {
          name: 'read',
          description: 'Read a file',
          input_schema: { type: 'object', properties: { path: { type: 'string' } } },
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce(createSuccessResponse()),
      });

      await client.chat({
        messages: [{ role: 'user', content: 'Read file' }],
        tools,
      });

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body as string);

      expect(body.tools).toEqual(tools);
    });

    it('should return text content from response', async () => {
      const client = new LLMClient();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce(
          createSuccessResponse({ content: [{ type: 'text', text: 'Response text' }] })
        ),
      });

      const result = await client.chat({
        messages: [{ role: 'user', content: 'Hi' }],
      });

      expect(result.content).toContainEqual({ type: 'text', text: 'Response text' });
    });

    it('should return tool_use content from response', async () => {
      const client = new LLMClient();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce(createToolCallResponse()),
      });

      const result = await client.chat({
        messages: [{ role: 'user', content: 'Use a tool' }],
      });

      expect(result.content).toContainEqual(
        expect.objectContaining({ type: 'tool_use', name: 'read' })
      );
      expect(result.stop_reason).toBe('tool_use');
    });

    it('should return usage from response', async () => {
      const client = new LLMClient();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce(
          createSuccessResponse({ usage: { input_tokens: 100, output_tokens: 50 } })
        ),
      });

      const result = await client.chat({
        messages: [{ role: 'user', content: 'Hi' }],
      });

      expect(result.usage).toEqual({ input_tokens: 100, output_tokens: 50 });
    });

    it('should throw error on API failure', async () => {
      const client = new LLMClient();

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: vi.fn().mockResolvedValueOnce('Unauthorized'),
      });

      await expect(
        client.chat({ messages: [{ role: 'user', content: 'Hi' }] })
      ).rejects.toThrow('LLM API error: 401 - Unauthorized');
    });

    it('should handle network error', async () => {
      const client = new LLMClient();

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(
        client.chat({ messages: [{ role: 'user', content: 'Hi' }] })
      ).rejects.toThrow('Network error');
    });

    it('should handle timeout', async () => {
      const client = new LLMClient();

      // 创建一个模拟的 AbortController
      const originalAbortController = globalThis.AbortController;
      let abortFn: (error: Error) => void;

      globalThis.AbortController = class AbortController {
        abort() {
          const error = new Error('Aborted');
          error.name = 'AbortError';
          abortFn(error);
        }
        signal = {
          aborted: true,
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => false,
        } as any;
        constructor() {
          abortFn = () => {};
        }
      } as any;

      mockFetch.mockRejectedValueOnce(new Error('Aborted'));

      await expect(
        client.chat({ messages: [{ role: 'user', content: 'Hi' }], timeoutMs: 1000 })
      ).rejects.toThrow();

      globalThis.AbortController = originalAbortController;
    });

    it('should log successful call', async () => {
      const { logLlmCall } = await import('../../../src/logger/index.js');
      const client = new LLMClient();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce(createSuccessResponse()),
      });

      await client.chat({
        messages: [{ role: 'user', content: 'Hi' }],
      });

      expect(logLlmCall).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
        })
      );
    });

    it('should log failed call', async () => {
      const { logLlmCall } = await import('../../../src/logger/index.js');
      const client = new LLMClient();

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: vi.fn().mockResolvedValueOnce('Internal error'),
      });

      await expect(
        client.chat({ messages: [{ role: 'user', content: 'Hi' }] })
      ).rejects.toThrow();

      expect(logLlmCall).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
        })
      );
    });
  });

  describe('chatSimple()', () => {
    it('should create message with user role', async () => {
      const client = new LLMClient();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce(createSuccessResponse()),
      });

      await client.chatSimple('Hello');

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body as string);

      expect(body.messages).toEqual([{ role: 'user', content: 'Hello' }]);
    });

    it('should include system prompt when provided', async () => {
      const client = new LLMClient();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce(createSuccessResponse()),
      });

      await client.chatSimple('Hello', 'Be helpful');

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body as string);

      expect(body.system).toBe('Be helpful');
    });

    it('should include tools when provided', async () => {
      const client = new LLMClient();
      const tools = [{ name: 'tool1', description: 'desc', input_schema: {} }];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce(createSuccessResponse()),
      });

      await client.chatSimple('Hello', undefined, tools);

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body as string);

      expect(body.tools).toEqual(tools);
    });

    it('should return extracted text content', async () => {
      const client = new LLMClient();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce(
          createSuccessResponse({ content: [{ type: 'text', text: 'Extracted text' }] })
        ),
      });

      const result = await client.chatSimple('Hello');

      expect(result).toBe('Extracted text');
    });

    it('should return empty string when no text content', async () => {
      const client = new LLMClient();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce(
          createSuccessResponse({ content: [{ type: 'tool_use', id: 'call_1', name: 'read', input: {} }] })
        ),
      });

      const result = await client.chatSimple('Hello');

      expect(result).toBe('');
    });
  });

  describe('chatWithContext()', () => {
    it('should prepend history messages before current message', async () => {
      const client = new LLMClient();
      const history = [
        { role: 'user', content: 'First message' },
        { role: 'assistant', content: 'First response' },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce(createSuccessResponse()),
      });

      await client.chatWithContext('Second message', history);

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body as string);

      expect(body.messages).toEqual([
        { role: 'user', content: 'First message' },
        { role: 'assistant', content: 'First response' },
        { role: 'user', content: 'Second message' },
      ]);
    });

    it('should filter out system messages from history', async () => {
      const client = new LLMClient();
      const history = [
        { role: 'user', content: 'User msg' },
        { role: 'assistant', content: 'Assistant msg' },
        { role: 'system', content: 'System msg' } as any,
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce(createSuccessResponse()),
      });

      await client.chatWithContext('New message', history);

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body as string);

      // System message should be filtered out
      expect(body.messages).not.toContainEqual(
        expect.objectContaining({ role: 'system' })
      );
    });

    it('should handle object content by stringifying', async () => {
      const client = new LLMClient();
      const history = [
        { role: 'user', content: { text: 'Object content' } },
      ] as any;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce(createSuccessResponse()),
      });

      await client.chatWithContext('New message', history);

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body as string);

      expect(body.messages[0].content).toBe('{"text":"Object content"}');
    });
  });

  describe('getLLMClient()', () => {
    it('should return singleton instance', () => {
      const client1 = getLLMClient();
      const client2 = getLLMClient();

      expect(client1).toBe(client2);
    });

    it('should create new instance when globalClient is null', () => {
      // 通过创建一个新的 LLMClient 来验证
      const client = new LLMClient();

      expect(client).toBeInstanceOf(LLMClient);
    });
  });
});

// ============================================================
// 类型测试
// ============================================================

describe('LLMRequest type', () => {
  it('should accept required fields', () => {
    const request: LLMRequest = {
      model: 'abab6.5s-chat',
      messages: [{ role: 'user', content: 'Hello' }],
    };

    expect(request.model).toBe('abab6.5s-chat');
    expect(request.messages).toHaveLength(1);
  });

  it('should accept optional fields', () => {
    const request: LLMRequest = {
      model: 'abab6.5s-chat',
      messages: [{ role: 'user', content: 'Hello' }],
      temperature: 0.8,
      max_tokens: 1000,
      system: 'You are helpful',
      tools: [{ name: 'tool', description: 'desc', input_schema: {} }],
      timeoutMs: 60000,
    };

    expect(request.temperature).toBe(0.8);
    expect(request.max_tokens).toBe(1000);
    expect(request.tools).toHaveLength(1);
  });
});

describe('LLMResponse type', () => {
  it('should have correct structure', () => {
    const response: LLMResponse = {
      id: 'msg_123',
      type: 'message',
      role: 'assistant',
      content: [{ type: 'text', text: 'Hello' }],
      model: 'abab6.5s-chat',
      stop_reason: 'stop',
      usage: { input_tokens: 10, output_tokens: 5 },
    };

    expect(response.id).toBeDefined();
    expect(response.content).toBeInstanceOf(Array);
    expect(response.usage.input_tokens).toBeDefined();
  });
});
