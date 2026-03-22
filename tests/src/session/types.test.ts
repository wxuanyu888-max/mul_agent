/**
 * Session Types 测试 - 类型验证
 */
import { describe, it, expect } from 'vitest';
import type {
  Session,
  SessionConfig,
  SessionMetadata,
  Message,
  ToolCall,
  TokenUsage,
} from '../../../src/session/types.js';

describe('Session Types', () => {
  describe('Session', () => {
    it('should create session with required fields', () => {
      const session: Session = {
        id: 'session-1',
        label: 'Test Session',
        status: 'active',
        messages: [],
        toolCalls: [],
        usage: { input: 0, output: 0, total: 0 },
        createdAt: 1000,
        updatedAt: 1000,
      };

      expect(session.id).toBe('session-1');
      expect(session.label).toBe('Test Session');
      expect(session.status).toBe('active');
    });

    it('should accept all status values', () => {
      const statuses: Session['status'][] = ['active', 'idle', 'completed'];

      statuses.forEach(status => {
        const session: Session = {
          id: 's1',
          label: 's',
          status,
          messages: [],
          toolCalls: [],
          usage: { input: 0, output: 0, total: 0 },
          createdAt: 1,
          updatedAt: 1,
        };
        expect(session.status).toBe(status);
      });
    });
  });

  describe('SessionConfig', () => {
    it('should have default config values', () => {
      const config: SessionConfig = {
        model: 'claude-sonnet-4-20250514',
        runtime: 'main',
        temperature: 1.0,
        maxTokens: 4096,
      };

      expect(config.model).toBe('claude-sonnet-4-20250514');
      expect(config.runtime).toBe('main');
    });

    it('should accept custom values', () => {
      const config: SessionConfig = {
        model: 'claude-haiku',
        runtime: 'worker',
        temperature: 0.5,
        maxTokens: 2000,
        systemPrompt: 'You are a helpful assistant.',
      };

      expect(config.temperature).toBe(0.5);
      expect(config.maxTokens).toBe(2000);
    });
  });

  describe('Message', () => {
    it('should create text message', () => {
      const message: Message = {
        role: 'user',
        content: 'Hello',
        timestamp: 1000,
      };

      expect(message.role).toBe('user');
      expect(message.content).toBe('Hello');
    });

    it('should accept all roles', () => {
      const roles: Message['role'][] = ['user', 'assistant', 'system'];

      roles.forEach(role => {
        const message: Message = {
          role,
          content: 'test',
          timestamp: 1000,
        };
        expect(message.role).toBe(role);
      });
    });

    it('should accept object content', () => {
      const message: Message = {
        role: 'user',
        content: {
          type: 'tool_result',
          tool_use_id: 'call_1',
          content: 'result',
        },
        timestamp: 1000,
      };

      expect(message.content).toHaveProperty('type');
    });
  });

  describe('ToolCall', () => {
    it('should create tool call', () => {
      const toolCall: ToolCall = {
        id: 'tool-1',
        name: 'bash',
        input: { command: 'ls -la' },
        result: 'total 0',
        timestamp: 1000,
      };

      expect(toolCall.id).toBe('tool-1');
      expect(toolCall.name).toBe('bash');
      expect(toolCall.input).toEqual({ command: 'ls -la' });
    });

    it('should accept optional result', () => {
      const toolCall: ToolCall = {
        id: 'tool-1',
        name: 'read',
        input: { path: '/file.txt' },
      };

      expect(toolCall.result).toBeUndefined();
    });
  });

  describe('TokenUsage', () => {
    it('should track token usage', () => {
      const usage: TokenUsage = {
        input: 100,
        output: 50,
        total: 150,
      };

      expect(usage.input).toBe(100);
      expect(usage.output).toBe(50);
      expect(usage.total).toBe(150);
    });

    it('should calculate total when provided', () => {
      const usage: TokenUsage = {
        input: 100,
        output: 50,
        total: 150,
      };

      // total must be explicitly set as TypeScript doesn't auto-calculate
      expect(usage.total).toBe(150);
    });
  });

  describe('SessionMetadata', () => {
    it('should have optional metadata', () => {
      const metadata: SessionMetadata = {
        title: 'My Session',
        description: 'A test session',
        tags: ['test', 'demo'],
      };

      expect(metadata.title).toBe('My Session');
      expect(metadata.tags).toContain('test');
    });
  });
});
