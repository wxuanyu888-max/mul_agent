/**
 * Memory Types 测试
 */
import { describe, it, expect } from 'vitest';
import type { MemoryEntry, MemorySearchResult, MemoryConfig, EmbeddingProvider } from '../../../src/memory/types.js';

describe('Memory Types', () => {
  describe('MemoryEntry', () => {
    it('should create entry with required fields', () => {
      const entry: MemoryEntry = {
        id: 'mem-1',
        content: 'Important information',
        type: 'user',
      };

      expect(entry.id).toBe('mem-1');
      expect(entry.content).toBe('Important information');
    });

    it('should accept all entry types', () => {
      const types: MemoryEntry['type'][] = ['user', 'system', 'tool', 'summary'];

      types.forEach(type => {
        const entry: MemoryEntry = { id: 'm1', content: 'test', type };
        expect(entry.type).toBe(type);
      });
    });

    it('should accept metadata', () => {
      const entry: MemoryEntry = {
        id: 'mem-1',
        content: 'test',
        type: 'user',
        metadata: { source: 'chat', timestamp: 1000 },
      };

      expect(entry.metadata?.source).toBe('chat');
    });
  });

  describe('MemorySearchResult', () => {
    it('should have entry and score', () => {
      const result: MemorySearchResult = {
        entry: { id: 'mem-1', content: 'test', type: 'user' },
        score: 0.95,
      };

      expect(result.entry.id).toBe('mem-1');
      expect(result.score).toBe(0.95);
    });

    it('should accept optional highlights', () => {
      const result: MemorySearchResult = {
        entry: { id: 'm1', content: 'test content', type: 'user' },
        score: 0.8,
        highlights: ['<em>test</em> content'],
      };

      expect(result.highlights?.[0]).toContain('<em>');
    });
  });

  describe('MemoryConfig', () => {
    it('should create config', () => {
      const config: MemoryConfig = {
        provider: 'openai',
        model: 'text-embedding-3-small',
      };

      expect(config.provider).toBe('openai');
    });

    it('should accept provider options', () => {
      const config: MemoryConfig = {
        provider: 'ollama',
        baseUrl: 'http://localhost:11434',
        model: 'nomic-embed-text',
      };

      expect(config.baseUrl).toBe('http://localhost:11434');
    });
  });

  describe('EmbeddingProvider', () => {
    it('should have embed method', () => {
      const provider: EmbeddingProvider = {
        embed: async (text) => [0.1, 0.2, 0.3],
        embedBatch: async (texts) => [[0.1], [0.2]],
      };

      expect(typeof provider.embed).toBe('function');
    });

    it('should support batch embedding', async () => {
      const provider: EmbeddingProvider = {
        embed: async (text) => [0.1],
        embedBatch: async (texts) => texts.map(() => [0.1]),
      };

      const results = await provider.embedBatch(['a', 'b']);
      expect(results).toHaveLength(2);
    });
  });
});
