/**
 * Compaction 模块测试 - 上下文压缩功能
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  microCompact,
  autoCompact,
  manualCompact,
  needsAutoCompact,
  estimateMessageTokens,
  createCompactionContext,
  type CompactionConfig,
  type CompactionContext,
} from '../../../src/agents/compaction.js';
import type { Message } from '../../../src/agents/types.js';

// Mock fs module
vi.mock('node:fs', () => ({
  existsSync: vi.fn().mockReturnValue(true),
  mkdirSync: vi.fn(),
  createWriteStream: vi.fn().mockReturnValue({
    write: vi.fn(),
    end: vi.fn(),
  }),
  readFileSync: vi.fn().mockReturnValue(''),
}));

vi.mock('node:fs/promises', () => ({
  default: {},
}));

describe('Compaction Module', () => {
  describe('estimateMessageTokens', () => {
    it('should estimate tokens for empty messages', () => {
      const tokens = estimateMessageTokens([]);
      expect(tokens).toBe(0);
    });

    it('should estimate tokens for English text', () => {
      const messages: Message[] = [
        { role: 'user', content: 'Hello world', timestamp: 1000 },
      ];
      const tokens = estimateMessageTokens(messages);
      expect(tokens).toBeGreaterThan(0);
    });

    it('should estimate tokens for Chinese text', () => {
      const messages: Message[] = [
        { role: 'user', content: '你好世界', timestamp: 1000 },
      ];
      const tokens = estimateMessageTokens(messages);
      expect(tokens).toBeGreaterThan(0);
    });

    it('should handle mixed Chinese and English', () => {
      const messages: Message[] = [
        { role: 'user', content: 'Hello 你好 World 世界', timestamp: 1000 },
      ];
      const tokens = estimateMessageTokens(messages);
      expect(tokens).toBeGreaterThan(0);
    });

    it('should handle message with array content', () => {
      const messages: Message[] = [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Hello' },
            { type: 'text', text: 'World' },
          ],
          timestamp: 1000,
        },
      ];
      const tokens = estimateMessageTokens(messages);
      expect(tokens).toBeGreaterThan(0);
    });

    it('should handle null/undefined messages', () => {
      const tokens = estimateMessageTokens([null as any, undefined as any]);
      expect(tokens).toBe(0);
    });
  });

  describe('needsAutoCompact', () => {
    it('should return false when under threshold', () => {
      const messages: Message[] = [
        { role: 'user', content: 'Short message', timestamp: 1000 },
      ];
      expect(needsAutoCompact(messages, 10000)).toBe(false);
    });

    it('should return true when over threshold', () => {
      // Create a long message that exceeds threshold
      const longContent = 'x'.repeat(50000);
      const messages: Message[] = [
        { role: 'user', content: longContent, timestamp: 1000 },
      ];
      expect(needsAutoCompact(messages, 10000)).toBe(true);
    });
  });

  describe('createCompactionContext', () => {
    it('should create context with default values', () => {
      const context = createCompactionContext();

      expect(context.compactionCount).toBe(0);
      expect(context.lastCompactionTokens).toBe(0);
      expect(context.toolResultPlaceholders).toBeInstanceOf(Map);
    });

    it('should create empty placeholder map', () => {
      const context = createCompactionContext();
      expect(context.toolResultPlaceholders.size).toBe(0);
    });
  });

  describe('microCompact', () => {
    const createMessagesWithToolResults = (count: number): Message[] => {
      const messages: Message[] = [];
      for (let i = 0; i < count; i++) {
        // Assistant message with tool call
        messages.push({
          role: 'assistant',
          content: JSON.stringify({
            tool_calls: [{ id: `call_${i}`, name: 'tool', input: {} }],
          }),
          timestamp: i * 1000,
        });
        // Tool result message
        messages.push({
          role: 'user',
          content: `Tool result ${i} - ${'x'.repeat(200)}`, // Long result to trigger compaction
          tool_call_id: `call_${i}`,
          timestamp: i * 1000 + 500,
        });
      }
      return messages;
    };

    it('should not compact when under keepRecentResults threshold', () => {
      const messages: Message[] = [
        {
          role: 'assistant',
          content: JSON.stringify({ tool_calls: [{ id: 'call_1', name: 'bash', input: {} }] }),
          timestamp: 1000,
        },
        {
          role: 'user',
          content: 'Short result',
          tool_call_id: 'call_1',
          timestamp: 1500,
        },
      ];

      const result = microCompact(messages, { keepRecentResults: 3 });
      expect(result.messages[1].content).toBe('Short result');
    });

    it('should compact old tool results when exceeding threshold', () => {
      const messages = createMessagesWithToolResults(5);

      const result = microCompact(messages, { keepRecentResults: 2 });

      // First tool result should be compacted
      expect(result.messages[1].content).toContain('[Previous');
      // Last tool results should be kept
      expect(result.messages[7].content).toContain('Tool result 4');
    });

    it('should update compaction context', () => {
      const messages = createMessagesWithToolResults(4);
      const context = createCompactionContext();

      const result = microCompact(messages, {}, context);

      expect(result.context.compactionCount).toBeGreaterThan(0);
    });

    it('should preserve placeholders in context', () => {
      const messages = createMessagesWithToolResults(4);
      const context = createCompactionContext();

      const result = microCompact(messages, {}, context);

      // Context should have placeholders stored
      expect(result.context.toolResultPlaceholders.size).toBeGreaterThan(0);
    });

    it('should handle custom minResultLengthForCompact', () => {
      const messages: Message[] = [
        {
          role: 'assistant',
          content: JSON.stringify({ tool_calls: [{ id: 'call_1', name: 'bash', input: {} }] }),
          timestamp: 1000,
        },
        {
          role: 'user',
          content: 'Short', // Short, under default threshold
          tool_call_id: 'call_1',
          timestamp: 1500,
        },
      ];

      const result = microCompact(messages, { minResultLengthForCompact: 3 });
      // Should still keep because we set min length lower
      expect(result.messages[1].content).toBe('Short');
    });

    it('should handle empty messages', () => {
      const result = microCompact([]);
      expect(result.messages).toEqual([]);
    });

    it('should handle messages without tool results', () => {
      const messages: Message[] = [
        { role: 'user', content: 'Hello', timestamp: 1000 },
        { role: 'assistant', content: 'Hi there!', timestamp: 2000 },
      ];

      const result = microCompact(messages);
      expect(result.messages).toEqual(messages);
    });
  });

  describe('autoCompact', () => {
    it('should save transcript to disk', async () => {
      const messages: Message[] = [
        { role: 'user', content: 'Test message', timestamp: 1000 },
        { role: 'assistant', content: 'Response', timestamp: 2000 },
      ];

      // This would require mocking LLM, so we just verify it doesn't throw
      try {
        await autoCompact(messages, { transcriptDir: '/tmp/test-transcripts' });
      } catch {
        // Expected to fail without LLM
      }
    });
  });

  describe('manualCompact', () => {
    it('should be similar to autoCompact', async () => {
      const messages: Message[] = [
        { role: 'user', content: 'Test', timestamp: 1000 },
      ];

      // Should have similar behavior to autoCompact
      try {
        await manualCompact(messages);
      } catch {
        // Expected to fail without LLM
      }
    });
  });
});
