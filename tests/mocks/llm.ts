/**
 * LLM Mock - 统一模拟 LLM 客户端
 */

import { vi, type Mock } from 'vitest';
import type { LLMResponse } from '../../src/agents/llm.js';

export interface LlmMock {
  chat: Mock;
}

export interface LlmResponseBuilder {
  content?: string;
  toolCalls?: Array<{
    id: string;
    name: string;
    input: Record<string, unknown>;
  }>;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}

// 创建简单的 LLM mock
export const createLlmMock = (response: LlmResponseBuilder = {}): LlmMock => {
  const mock: LlmMock = {
    chat: vi.fn().mockResolvedValue({
      content: response.content ?? 'Mock response',
      tool_calls: response.toolCalls ?? [],
      usage: response.usage ?? { input_tokens: 100, output_tokens: 50 },
    } as LLMResponse),
  };

  vi.mock('../../src/agents/llm.js', () => ({
    getLLMClient: vi.fn(() => mock),
    chat: mock.chat,
  }));

  return mock;
};

// 创建支持序列响应的 LLM mock（多次调用返回不同结果）
export const createSequenceLlmMock = (responses: LlmResponseBuilder[]): LlmMock => {
  let callIndex = 0;

  const mock: LlmMock = {
    chat: vi.fn().mockImplementation(() => {
      const response = responses[callIndex++] ?? responses[responses.length - 1];
      return Promise.resolve({
        content: response.content ?? 'Mock response',
        tool_calls: response.toolCalls ?? [],
        usage: response.usage ?? { input_tokens: 100, output_tokens: 50 },
      } as LLMResponse);
    }),
  };

  vi.mock('../../src/agents/llm.js', () => ({
    getLLMClient: vi.fn(() => mock),
    chat: mock.chat,
  }));

  return mock;
};

// 创建返回 tool call 的 LLM mock
export const createToolCallLlmMock = (
  toolName: string,
  toolInput: Record<string, unknown>,
  content = 'I will use a tool'
): LlmMock => {
  return createLlmMock({
    content,
    toolCalls: [
      {
        id: `call_${Date.now()}`,
        name: toolName,
        input: toolInput,
      },
    ],
  });
};

// 创建返回错误响应的 LLM mock
export const createErrorLlmMock = (errorMessage = 'LLM Error'): LlmMock => {
  const mock: LlmMock = {
    chat: vi.fn().mockRejectedValue(new Error(errorMessage)),
  };

  vi.mock('../../src/agents/llm.js', () => ({
    getLLMClient: vi.fn(() => mock),
    chat: mock.chat,
  }));

  return mock;
};

// 验证 LLM 被调用的次数
export const expectLlmCalled = (mock: LlmMock, times?: number) => {
  if (times !== undefined) {
    expect(mock.chat).toHaveBeenCalledTimes(times);
  } else {
    expect(mock.chat).toHaveBeenCalled();
  }
};
