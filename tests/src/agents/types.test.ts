/**
 * Agent Types 测试 - 类型验证
 */
import { describe, it, expect } from 'vitest';
import type {
  Message,
  ToolCall,
  ToolResult,
  AgentState,
  SessionEntry,
  ContentBlock,
} from '../../../src/agents/types.js';

describe('Agent Types', () => {
  describe('Message', () => {
    it('should accept text content', () => {
      const message: Message = {
        role: 'user',
        content: 'Hello',
        timestamp: 1000,
      };
      expect(message.content).toBe('Hello');
    });

    it('should accept array content', () => {
      const message: Message = {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Hello' },
          { type: 'text', text: 'World' },
        ],
        timestamp: 1000,
      };
      expect(Array.isArray(message.content)).toBe(true);
    });

    it('should accept tool_result content', () => {
      const message: Message = {
        role: 'user',
        content: {
          type: 'tool_result',
          tool_use_id: 'call_123',
          content: 'result',
        },
        timestamp: 1000,
      };
      expect(message.content).toHaveProperty('type', 'tool_result');
    });

    it('should accept optional tool_call_id', () => {
      const message: Message = {
        role: 'user',
        content: 'content',
        tool_call_id: 'call_123',
        timestamp: 1000,
      };
      expect(message.tool_call_id).toBe('call_123');
    });
  });

  describe('ToolCall', () => {
    it('should have correct shape', () => {
      const toolCall: ToolCall = {
        id: 'call_123',
        name: 'bash',
        input: { command: 'ls -la' },
      };
      expect(toolCall.id).toBe('call_123');
      expect(toolCall.name).toBe('bash');
      expect(toolCall.input).toEqual({ command: 'ls -la' });
    });

    it('should accept complex input', () => {
      const toolCall: ToolCall = {
        id: 'call_456',
        name: 'read',
        input: {
          path: '/file.txt',
          from: 1,
          lines: 10,
        },
      };
      expect(toolCall.input.path).toBe('/file.txt');
    });
  });

  describe('ToolResult', () => {
    it('should accept valid result', () => {
      const result: ToolResult = {
        content: 'some content',
        error: null,
      };
      expect(result.content).toBe('some content');
      expect(result.error).toBeNull();
    });

    it('should accept error result', () => {
      const result: ToolResult = {
        content: '',
        error: 'File not found',
      };
      expect(result.content).toBe('');
      expect(result.error).toBe('File not found');
    });
  });

  describe('AgentState', () => {
    it('should accept valid states', () => {
      const states: AgentState[] = ['idle', 'running', 'paused', 'completed', 'error'];
      states.forEach(state => {
        const agent = { state };
        expect(agent.state).toBe(state);
      });
    });
  });

  describe('SessionEntry', () => {
    it('should have required fields', () => {
      const entry: SessionEntry = {
        id: 'session-1',
        messages: [],
        createdAt: 1000,
        updatedAt: 1000,
      };
      expect(entry.id).toBeDefined();
      expect(entry.messages).toEqual([]);
    });

    it('should accept optional fields', () => {
      const entry: SessionEntry = {
        id: 'session-1',
        messages: [],
        createdAt: 1000,
        updatedAt: 1000,
        parentId: 'parent-session',
        metadata: { key: 'value' },
      };
      expect(entry.parentId).toBe('parent-session');
      expect(entry.metadata).toEqual({ key: 'value' });
    });
  });

  describe('ContentBlock', () => {
    it('should accept text block', () => {
      const block: ContentBlock = {
        type: 'text',
        text: 'Hello',
      };
      expect(block.type).toBe('text');
    });

    it('should accept tool_use block', () => {
      const block: ContentBlock = {
        type: 'tool_use',
        id: 'call_1',
        name: 'bash',
        input: { command: 'ls' },
      };
      expect(block.type).toBe('tool_use');
      expect(block.name).toBe('bash');
    });

    it('should accept tool_result block', () => {
      const block: ContentBlock = {
        type: 'tool_result',
        tool_use_id: 'call_1',
        content: 'result',
      };
      expect(block.type).toBe('tool_result');
    });
  });
});
