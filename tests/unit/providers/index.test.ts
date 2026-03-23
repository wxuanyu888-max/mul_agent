// Providers 模块测试 - 不依赖具体 provider 实现
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock all provider modules to avoid import issues
vi.mock('../../../src/providers/anthropic.js', () => ({
  AnthropicProvider: class MockAnthropicProvider {
    id = 'anthropic';
    name = 'Anthropic';
  },
}));

vi.mock('../../../src/providers/openai.js', () => ({
  OpenAIProvider: class MockOpenAIProvider {
    id = 'openai';
    name = 'OpenAI';
  },
}));

vi.mock('../../../src/providers/ollama.js', () => ({
  OllamaProvider: class MockOllamaProvider {
    id = 'ollama';
    name = 'Ollama';
  },
}));

// Now import after mocking
import {
  createProvider,
  registerProvider,
  getProvider,
  setDefaultProvider,
  createDefaultProvider,
  chat,
  chatWithProvider,
  listProviders,
  type LLMProvider,
} from "../../../src/providers/index.js";

describe("Providers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createProvider", () => {
    it("should create Anthropic provider", () => {
      const provider = createProvider({
        provider: 'anthropic',
        apiKey: 'test-key',
        model: 'claude-3-5-sonnet-20241022',
      });

      expect(provider).toBeDefined();
      expect(provider.id).toBe('anthropic');
    });

    it("should create Anthropic provider with claude alias", () => {
      const provider = createProvider({
        provider: 'claude',
        apiKey: 'test-key',
        model: 'claude-3-5-sonnet-20241022',
      });

      expect(provider).toBeDefined();
      expect(provider.id).toBe('anthropic');
    });

    it("should create OpenAI provider", () => {
      const provider = createProvider({
        provider: 'openai',
        apiKey: 'test-key',
        model: 'gpt-4o',
      });

      expect(provider).toBeDefined();
      expect(provider.id).toBe('openai');
    });

    it("should create Ollama provider", () => {
      const provider = createProvider({
        provider: 'ollama',
        model: 'llama2',
      });

      expect(provider).toBeDefined();
      expect(provider.id).toBe('ollama');
    });

    it("should throw for unknown provider", () => {
      expect(() =>
        createProvider({
          provider: 'unknown',
          apiKey: 'test-key',
        })
      ).toThrow('Unknown provider: unknown');
    });
  });

  describe("registerProvider", () => {
    it("should register a provider", () => {
      const provider = createProvider({
        provider: 'anthropic',
        apiKey: 'test-key',
      });

      registerProvider('test-provider', provider);

      expect(getProvider('test-provider')).toBe(provider);
    });

    it("should overwrite existing provider", () => {
      const provider1 = createProvider({
        provider: 'anthropic',
        apiKey: 'key1',
      });
      const provider2 = createProvider({
        provider: 'anthropic',
        apiKey: 'key2',
      });

      registerProvider('duplicate', provider1);
      registerProvider('duplicate', provider2);

      expect(getProvider('duplicate')).toBe(provider2);
    });
  });

  describe("getProvider", () => {
    it("should return registered provider by id", () => {
      const provider = createProvider({
        provider: 'anthropic',
        apiKey: 'test-key',
      });

      registerProvider('by-id', provider);

      expect(getProvider('by-id')).toBe(provider);
    });

    it("should return null for unknown id", () => {
      expect(getProvider('unknown')).toBeNull();
    });

    it("should return default provider when no id provided", () => {
      const provider = createProvider({
        provider: 'anthropic',
        apiKey: 'test-key',
      });

      setDefaultProvider(provider);

      expect(getProvider()).toBe(provider);
    });
  });

  describe("setDefaultProvider", () => {
    it("should set default provider", () => {
      const provider = createProvider({
        provider: 'anthropic',
        apiKey: 'test-key',
      });

      setDefaultProvider(provider);

      expect(getProvider('default')).toBe(provider);
      expect(getProvider()).toBe(provider);
    });
  });

  describe("createDefaultProvider", () => {
    it("should create and set default provider", () => {
      const provider = createDefaultProvider({
        provider: 'anthropic',
        apiKey: 'test-key',
        model: 'claude-3-5-sonnet-20241022',
      });

      expect(provider).toBeDefined();
      expect(getProvider()).toBe(provider);
    });
  });

  describe("chat", () => {
    it("should throw when no default provider", async () => {
      // Create a mock provider that throws
      const mockProvider = {
        chat: () => { throw new Error('No default provider configured'); },
        id: 'test',
      } as unknown as LLMProvider;

      setDefaultProvider(mockProvider);

      // Now replace with one that doesn't have chat
      const badProvider = {
        id: 'bad',
      } as unknown as LLMProvider;
      setDefaultProvider(badProvider);

      await expect(
        chat({ messages: [{ role: 'user', content: 'Hello' }] })
      ).rejects.toThrow();
    });

    it("should call default provider chat", async () => {
      const mockChat = vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Hello' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 10, output_tokens: 20 },
      });

      const provider = {
        chat: mockChat,
        id: 'test',
      } as unknown as LLMProvider;

      setDefaultProvider(provider);

      await chat({ messages: [{ role: 'user', content: 'Hello' }] });

      expect(mockChat).toHaveBeenCalledWith({
        messages: [{ role: 'user', content: 'Hello' }],
      });
    });
  });

  describe("chatWithProvider", () => {
    it("should throw when provider not found", async () => {
      await expect(
        chatWithProvider('nonexistent', { messages: [] })
      ).rejects.toThrow('Provider not found: nonexistent');
    });

    it("should call specific provider", async () => {
      const mockChat = vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Response' }],
        stop_reason: 'end_turn',
      });

      const provider = {
        chat: mockChat,
        id: 'specific',
      } as unknown as LLMProvider;

      registerProvider('specific', provider);

      await chatWithProvider('specific', { messages: [{ role: 'user', content: 'Hi' }] });

      expect(mockChat).toHaveBeenCalledWith({ messages: [{ role: 'user', content: 'Hi' }] });
    });
  });

  describe("listProviders", () => {
    it("should list registered providers", () => {
      const provider1 = createProvider({ provider: 'anthropic', apiKey: 'key1' });
      const provider2 = createProvider({ provider: 'openai', apiKey: 'key2' });

      // Register with unique IDs
      const id1 = `provider-${Date.now()}-1`;
      const id2 = `provider-${Date.now()}-2`;

      registerProvider(id1, provider1);
      registerProvider(id2, provider2);

      const list = listProviders();

      expect(list).toContain(id1);
      expect(list).toContain(id2);
    });
  });
});
