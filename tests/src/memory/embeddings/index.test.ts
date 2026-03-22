/**
 * Memory Embeddings 测试
 */
import { describe, it, expect, vi } from 'vitest';

describe('Memory Embeddings', () => {
  describe('exports', () => {
    it('should export createEmbeddingProvider', async () => {
      const { createEmbeddingProvider } = await import('../../../../src/memory/index.js');

      expect(createEmbeddingProvider).toBeDefined();
    });

    it('should export listOllamaModels', async () => {
      const { listOllamaModels } = await import('../../../../src/memory/index.js');

      expect(listOllamaModels).toBeDefined();
    });
  });

  describe('createEmbeddingProvider', () => {
    it('should create openai embedding provider', async () => {
      const { createEmbeddingProvider } = await import('../../../../src/memory/index.js');

      const provider = createEmbeddingProvider({ provider: 'openai', model: 'text-embedding-3-small' });

      expect(provider).toBeDefined();
    });

    it('should create voyage embedding provider', async () => {
      const { createEmbeddingProvider } = await import('../../../../src/memory/index.js');

      const provider = createEmbeddingProvider({ provider: 'voyage', model: 'voyage-2' });

      expect(provider).toBeDefined();
    });

    it('should create offline embedding provider', async () => {
      const { createEmbeddingProvider } = await import('../../../../src/memory/index.js');

      const provider = createEmbeddingProvider({ provider: 'offline' });

      expect(provider).toBeDefined();
    });
  });

  describe('listOllamaModels', () => {
    it('should be async function', async () => {
      const { listOllamaModels } = await import('../../../../src/memory/index.js');

      expect(typeof listOllamaModels).toBe('function');
    });
  });
});
