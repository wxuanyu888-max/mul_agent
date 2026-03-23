/**
 * Message Types 测试
 */
import { describe, it, expect } from 'vitest';
import type { QueuedMessage, QueueStatus, EnqueueResult } from '../../../src/message/types.js';

describe('Message Types', () => {
  describe('QueuedMessage', () => {
    it('should create message with required fields', () => {
      const msg: QueuedMessage = {
        id: 'msg-1',
        sessionKey: 'session-1',
        content: 'Hello',
        timestamp: 1000,
        status: 'pending',
      };

      expect(msg.id).toBe('msg-1');
      expect(msg.sessionKey).toBe('session-1');
      expect(msg.status).toBe('pending');
    });

    it('should accept all status values', () => {
      const statuses: QueuedMessage['status'][] = ['pending', 'processing', 'completed'];

      statuses.forEach(status => {
        const msg: QueuedMessage = {
          id: 'm1',
          sessionKey: 's1',
          content: 'test',
          timestamp: 1000,
          status,
        };
        expect(msg.status).toBe(status);
      });
    });
  });

  describe('QueueStatus', () => {
    it('should track queue counts', () => {
      const status: QueueStatus = {
        pending: 5,
        processing: 2,
        completed: 10,
        total: 17,
      };

      expect(status.pending).toBe(5);
      expect(status.total).toBe(17);
    });
  });

  describe('EnqueueResult', () => {
    it('should have required fields', () => {
      const result: EnqueueResult = {
        message_id: 'msg-1',
        status: 'queued',
        queue_status: {
          pending: 1,
          processing: 0,
          completed: 0,
          total: 1,
        },
      };

      expect(result.message_id).toBe('msg-1');
      expect(result.status).toBe('queued');
    });
  });
});
