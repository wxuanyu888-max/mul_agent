/**
 * Hooks Types 测试
 */
import { describe, it, expect } from 'vitest';
import type { HookEventType, HookEvent, HookHandler, HookOptions, HookContext } from '../../../src/hooks/types.js';

describe('Hooks Types', () => {
  describe('HookEventType', () => {
    it('should accept string type', () => {
      const type: HookEventType = 'agent.start';
      expect(type).toBe('agent.start');
    });
  });

  describe('HookEvent', () => {
    it('should create event with type', () => {
      const event: HookEvent = {
        type: 'agent.start',
        data: { sessionId: 's1' },
        timestamp: Date.now(),
      };

      expect(event.type).toBe('agent.start');
      expect(event.data.sessionId).toBe('s1');
    });

    it('should accept optional metadata', () => {
      const event: HookEvent = {
        type: 'message.received',
        data: {},
        timestamp: 1000,
        metadata: { source: 'api' },
      };

      expect(event.metadata?.source).toBe('api');
    });
  });

  describe('HookHandler', () => {
    it('should define async handler', () => {
      const handler: HookHandler = async (event) => {
        console.log(event.type);
      };

      expect(typeof handler).toBe('function');
    });

    it('should handle sync handler', () => {
      const handler: HookHandler = (event) => {
        // sync handler returning void
      };

      expect(typeof handler).toBe('function');
    });
  });

  describe('HookOptions', () => {
    it('should accept options', () => {
      const options: HookOptions = {
        priority: 10,
        async: true,
      };

      expect(options.priority).toBe(10);
      expect(options.async).toBe(true);
    });

    it('should have defaults', () => {
      const options: HookOptions = {};
      expect(options.priority).toBe(0);
      expect(options.async).toBe(false);
    });
  });

  describe('HookContext', () => {
    it('should pass context through hooks', () => {
      const context: HookContext = {
        sessionId: 'session-1',
        agentId: 'agent-1',
      };

      expect(context.sessionId).toBe('session-1');
    });
  });
});
