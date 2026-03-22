/**
 * Session Index 测试 - 导出验证
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createSession,
  getSession,
  updateSession,
  addMessage,
  addToolCall,
  updateUsage,
  querySessions,
  getActiveSessions,
  deleteSession,
  updateSessionStatus,
} from '../../../src/session/index.js';
import { createFsMock, createFsMockWithFiles } from '../../mocks/fs.js';
import { createSession as createSessionFixture } from '../../factories/session.js';
import { sessionIndex } from '../../fixtures/sessions.js';

describe('Session Index', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createSession', () => {
    it('should export createSession function', () => {
      expect(createSession).toBeDefined();
      expect(typeof createSession).toBe('function');
    });

    it('should create session with default config', async () => {
      createFsMock();

      const session = await createSession();

      expect(session.id).toBeDefined();
      expect(session.status).toBe('active');
    });
  });

  describe('getSession', () => {
    it('should export getSession function', () => {
      expect(getSession).toBeDefined();
      expect(typeof getSession).toBe('function');
    });

    it('should return session when exists', async () => {
      const mockSession = createSessionFixture({ id: 'test-123' });
      createFsMockWithFiles({
        'storage/sessions/test-123.json': JSON.stringify(mockSession),
      });

      const session = await getSession('test-123');

      expect(session).toBeDefined();
      expect(session?.id).toBe('test-123');
    });

    it('should return null when not found', async () => {
      createFsMock();

      const session = await getSession('nonexistent');

      expect(session).toBeNull();
    });
  });

  describe('updateSession', () => {
    it('should export updateSession function', () => {
      expect(updateSession).toBeDefined();
      expect(typeof updateSession).toBe('function');
    });
  });

  describe('addMessage', () => {
    it('should export addMessage function', () => {
      expect(addMessage).toBeDefined();
      expect(typeof addMessage).toBe('function');
    });
  });

  describe('addToolCall', () => {
    it('should export addToolCall function', () => {
      expect(addToolCall).toBeDefined();
      expect(typeof addToolCall).toBe('function');
    });
  });

  describe('updateUsage', () => {
    it('should export updateUsage function', () => {
      expect(updateUsage).toBeDefined();
      expect(typeof updateUsage).toBe('function');
    });
  });

  describe('querySessions', () => {
    it('should export querySessions function', () => {
      expect(querySessions).toBeDefined();
      expect(typeof querySessions).toBe('function');
    });

    it('should query sessions from index', async () => {
      createFsMockWithFiles({
        'storage/sessions/index.json': JSON.stringify(sessionIndex),
      });

      const sessions = await querySessions();

      expect(sessions.length).toBe(3);
    });
  });

  describe('getActiveSessions', () => {
    it('should export getActiveSessions function', () => {
      expect(getActiveSessions).toBeDefined();
      expect(typeof getActiveSessions).toBe('function');
    });
  });

  describe('deleteSession', () => {
    it('should export deleteSession function', () => {
      expect(deleteSession).toBeDefined();
      expect(typeof deleteSession).toBe('function');
    });
  });

  describe('updateSessionStatus', () => {
    it('should export updateSessionStatus function', () => {
      expect(updateSessionStatus).toBeDefined();
      expect(typeof updateSessionStatus).toBe('function');
    });
  });
});
