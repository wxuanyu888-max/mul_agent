/**
 * Provider Types 测试
 */
import { describe, it, expect } from 'vitest';
import type {
  LLMMessage,
  LLMRequest,
  LLMResponse,
  LLMProvider,
  LLMProviderConfig,
  ProviderType,
} from '../../../src/providers/types.js';

describe('Provider Types', () => {
  describe('LLMMessage', () => {
    it('should accept valid role', () => {
      const message: LLMMessage = {
        role: 'user',
        content: 'Hello',
      };
      expect(message.role).toBe('user');
    });

    it('should accept all roles', () => {
      const roles: LLMMessage['role'][] = ['user', 'assistant', 'system'];
      roles.forEach(role => {
        const message: LLMMessage = { role, content: 'test' };
        expect(message.role).toBe(role);
      });
    });
  });

  describe('LLMRequest', () => {
    it('should create request with messages', () => {
      const request: LLMRequest = {
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi' },
        ],
      };
      expect(request.messages).toHaveLength(2);
    });

    it('should accept optional fields', () => {
      const request: LLMRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'gpt-4',
        temperature: 0.5,
        max_tokens: 1000,
        stream: false,
      };
      expect(request.model).toBe('gpt-4');
      expect(request.temperature).toBe(0.5);
    });
  });

  describe('LLMResponse', () => {
    it('should have required fields', () => {
      const response: LLMResponse = {
        content: 'Response content',
        model: 'gpt-4',
      };
      expect(response.content).toBe('Response content');
      expect(response.model).toBe('gpt-4');
    });

    it('should accept usage information', () => {
      const response: LLMResponse = {
        content: 'Response',
        model: 'gpt-4',
        usage: {
          input_tokens: 100,
          output_tokens: 50,
          total_tokens: 150,
        },
      };
      expect(response.usage?.total_tokens).toBe(150);
    });
  });

  describe('LLMProvider', () => {
    it('should have required interface', () => {
      const provider: LLMProvider = {
        id: 'openai',
        name: 'OpenAI',
        chat: async (req) => ({
          content: 'response',
          model: req.model || 'default',
        }),
        getModel: () => 'gpt-4',
        listModels: async () => ['gpt-4', 'gpt-3.5'],
        isAvailable: () => true,
      };

      expect(provider.id).toBe('openai');
      expect(typeof provider.chat).toBe('function');
    });

    it('should support optional chatStream', () => {
      const provider: LLMProvider = {
        id: 'test',
        name: 'Test',
        chat: async () => ({ content: '', model: 'test' }),
        chatStream: async (req, onChunk) => {
          onChunk('chunk');
          return { content: '', model: 'test' };
        },
      };

      expect(typeof provider.chatStream).toBe('function');
    });
  });

  describe('LLMProviderConfig', () => {
    it('should create config with required field', () => {
      const config: LLMProviderConfig = {
        provider: 'openai',
      };
      expect(config.provider).toBe('openai');
    });

    it('should accept all optional fields', () => {
      const config: LLMProviderConfig = {
        provider: 'anthropic',
        model: 'claude-3',
        apiKey: 'sk-xxx',
        baseUrl: 'https://api.anthropic.com',
        maxTokens: 4096,
        temperature: 0.7,
      };
      expect(config.model).toBe('claude-3');
      expect(config.apiKey).toBeDefined();
    });
  });

  describe('ProviderType', () => {
    it('should accept all provider types', () => {
      const types: ProviderType[] = ['openai', 'anthropic', 'gemini', 'ollama', 'azure', 'custom'];
      types.forEach(type => {
        const config: LLMProviderConfig = { provider: type };
        expect(config.provider).toBe(type);
      });
    });
  });
});
