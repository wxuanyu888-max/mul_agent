/**
 * Commands Types 测试
 */
import { describe, it, expect } from 'vitest';
import type { ChatCommandDefinition, CommandHandler, CommandContext, CommandScope } from '../../../src/commands/types.js';

describe('Commands Types', () => {
  describe('ChatCommandDefinition', () => {
    it('should create command with required fields', () => {
      const cmd: ChatCommandDefinition = {
        name: 'test',
        description: 'A test command',
        trigger: '/test',
        handler: async () => 'result',
      };

      expect(cmd.name).toBe('test');
      expect(cmd.trigger).toBe('/test');
    });

    it('should accept all scopes', () => {
      const scopes: CommandScope[] = ['text', 'native', 'both'];

      scopes.forEach(scope => {
        const cmd: ChatCommandDefinition = {
          name: 'cmd',
          description: 'cmd',
          trigger: '/cmd',
          scope,
          handler: async () => 'ok',
        };
        expect(cmd.scope).toBe(scope);
      });
    });

    it('should accept parameters', () => {
      const cmd: ChatCommandDefinition = {
        name: 'greet',
        description: 'Greet someone',
        trigger: '/greet',
        parameters: {
          name: { type: 'string', description: 'Name to greet' },
        },
        required: ['name'],
        handler: async (params) => `Hello, ${params.name}!`,
      };

      expect(cmd.parameters?.name.type).toBe('string');
      expect(cmd.required).toContain('name');
    });
  });

  describe('CommandHandler', () => {
    it('should define async handler', () => {
      const handler: CommandHandler = async (params, context) => {
        return 'response';
      };

      expect(typeof handler).toBe('function');
    });

    it('should accept context parameter', () => {
      const handler: CommandHandler = async (params, context) => {
        expect(context.sessionId).toBeDefined();
        return 'ok';
      };
    });
  });

  describe('CommandContext', () => {
    it('should provide session context', () => {
      const context: CommandContext = {
        sessionId: 'session-1',
        agentId: 'agent-1',
        message: '/test',
      };

      expect(context.sessionId).toBe('session-1');
    });

    it('should accept optional fields', () => {
      const context: CommandContext = {
        sessionId: 's1',
        userId: 'user-1',
      };

      expect(context.userId).toBe('user-1');
    });
  });
});
