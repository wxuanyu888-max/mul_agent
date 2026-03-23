/**
 * Provider Base 测试
 */
import { describe, it, expect, vi } from 'vitest';
import { vi } from 'vitest';

describe('Provider Base', () => {
  describe('BaseProvider', () => {
    it('should export base provider', async () => {
      const { BaseProvider } = await import('../../../src/providers/base.js');

      expect(BaseProvider).toBeDefined();
    });
  });

  describe('createProvider', () => {
    it('should create openai provider', async () => {
      const { createProvider } = await import('../../../src/providers/index.js');

      expect(createProvider).toBeDefined();
    });

    it('should create anthropic provider', async () => {
      const { createProvider } = await import('../../../src/providers/index.js');

      expect(createProvider).toBeDefined();
    });

    it('should create ollama provider', async () => {
      const { createProvider } = await import('../../../src/providers/index.js');

      expect(createProvider).toBeDefined();
    });
  });

  describe('listProviders', () => {
    it('should list available providers', async () => {
      const { listProviders } = await import('../../../src/providers/index.js');

      const providers = listProviders();

      expect(Array.isArray(providers)).toBe(true);
      expect(providers).toContain('openai');
      expect(providers).toContain('anthropic');
    });
  });

  describe('getProvider', () => {
    it('should get provider by ID', async () => {
      const { getProvider } = await import('../../../src/providers/index.js');

      const provider = getProvider('openai');

      expect(provider).toBeDefined();
    });

    it('should return null for unknown provider', async () => {
      const { getProvider } = await import('../../../src/providers/index.js');

      const provider = getProvider('unknown-provider');

      expect(provider).toBeNull();
    });
  });
});
