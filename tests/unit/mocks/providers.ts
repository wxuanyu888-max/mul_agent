/**
 * Provider Mock - 统一模拟 LLM Provider
 */

import { vi } from 'vitest';
import type { LLMProvider, LLMResponse } from '../../src/providers/types.js';

export const createMockProvider = (name = 'mock'): LLMProvider => ({
  id: name,
  name: name,
  baseURL: 'https://mock.example.com',
  apiKey: 'mock-key',

  chat: vi.fn().mockResolvedValue({
    content: 'Mock response',
    tool_calls: [],
    usage: { input_tokens: 100, output_tokens: 50 },
  } as LLMResponse),

  getModel: vi.fn().mockReturnValue('mock-model'),
  listModels: vi.fn().mockResolvedValue(['mock-model']),
  isAvailable: vi.fn().mockReturnValue(true),
});

// Mock provider factory
export const createMockProviderFactory = () => {
  vi.mock('../../src/providers/index.js', () => ({
    createProvider: vi.fn(() => createMockProvider()),
    getProvider: vi.fn(() => createMockProvider()),
    chat: vi.fn().mockResolvedValue({
      content: 'Mock response',
      tool_calls: [],
    }),
    createDefaultProvider: vi.fn(() => createMockProvider()),
  }));
};

// Mock different providers
export const createOpenAIMock = () =>
  createMockProvider('openai');

export const createAnthropicMock = () =>
  createMockProvider('anthropic');

export const createOllamaMock = () =>
  createMockProvider('ollama');
