/**
 * Context Engine 模块测试
 */
import { describe, it, expect } from 'vitest';
import {
  MicroCompactStrategy,
  AutoCompactStrategy,
  DefaultContextEngine,
  SimpleContextEngine,
  createCompactionContext,
} from '../../../../src/agents/context-engine/index.js';

describe('Context Engine', () => {
  describe('MicroCompactStrategy', () => {
    it('should create strategy with correct info', () => {
      const strategy = new MicroCompactStrategy();
      expect(strategy.info.name).toBe('micro-compact');
      expect(strategy.info.description).toContain('轻量级压缩');
    });

    it('should estimate tokens correctly', () => {
      const strategy = new MicroCompactStrategy();
      const messages = [
        { role: 'user', content: 'Hello world' },
        { role: 'assistant', content: 'Hi there!' },
      ];
      const tokens = strategy.estimateTokens(messages);
      expect(tokens).toBeGreaterThan(0);
    });

    it('should check needsCompaction', () => {
      const strategy = new MicroCompactStrategy();
      const messages = [
        { role: 'user', content: 'A'.repeat(10000) },
      ];
      expect(strategy.needsCompaction(messages, 1000)).toBe(true);
      expect(strategy.needsCompaction(messages, 100000)).toBe(false);
    });
  });

  describe('AutoCompactStrategy', () => {
    it('should create strategy with correct info', () => {
      const strategy = new AutoCompactStrategy();
      expect(strategy.info.name).toBe('auto-compact');
      expect(strategy.info.description).toContain('自动压缩');
    });
  });

  describe('DefaultContextEngine', () => {
    it('should create engine with correct info', () => {
      const engine = new DefaultContextEngine();
      expect(engine.info.name).toBe('default');
      expect(engine.info.description).toContain('默认');
    });

    it('should assemble messages', async () => {
      const engine = new DefaultContextEngine();
      const messages = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi' },
      ];
      const result = await engine.assemble({ messages });
      expect(result.messages).toEqual(messages);
      expect(result.totalTokens).toBeGreaterThan(0);
    });

    it('should compact messages', async () => {
      const engine = new DefaultContextEngine();
      const messages = [
        { role: 'user', content: 'Hello world test message for compaction' },
        { role: 'assistant', content: 'Response here' },
      ];
      const result = await engine.compact({ messages });
      expect(result.success).toBe(true);
      // autoCompact 会尝试调用 LLM，可能会失败但不应该抛异常
    });

    it('should prepare subagent spawn', async () => {
      const engine = new DefaultContextEngine();
      const messages = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi' },
      ];
      const result = await engine.prepareSubagentSpawn({ messages });
      expect(result).toBeDefined();
      expect(result?.sessionSnapshot).toBeDefined();
    });

    it('should reset context', () => {
      const engine = new DefaultContextEngine();
      engine.resetContext();
      const ctx = engine.getContext();
      expect(ctx.compactionCount).toBe(0);
    });
  });

  describe('SimpleContextEngine', () => {
    it('should create engine with correct info', () => {
      const engine = new SimpleContextEngine();
      expect(engine.info.name).toBe('simple');
      expect(engine.info.description).toContain('不进行任何压缩');
    });

    it('should assemble without compaction', async () => {
      const engine = new SimpleContextEngine();
      const messages = [
        { role: 'user', content: 'Test' },
      ];
      const result = await engine.assemble({ messages });
      expect(result.messages).toEqual(messages);
      expect(result.truncated).toBe(false);
    });

    it('should compact without changes', async () => {
      const engine = new SimpleContextEngine();
      const messages = [
        { role: 'user', content: 'Test' },
      ];
      const result = await engine.compact({ messages });
      expect(result.success).toBe(true);
      expect(result.compactedMessages).toEqual(messages);
    });
  });

  describe('createCompactionContext', () => {
    it('should create empty context', () => {
      const ctx = createCompactionContext();
      expect(ctx.compactionCount).toBe(0);
      expect(ctx.lastCompactionTokens).toBe(0);
      expect(ctx.toolResultPlaceholders).toBeDefined();
      expect(ctx.toolResultPlaceholders.size).toBe(0);
    });
  });
});
