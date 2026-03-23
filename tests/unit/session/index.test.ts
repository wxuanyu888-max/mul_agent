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

// Mock file-lock module
vi.mock('../../../src/utils/file-lock.js', () => ({
  withFileLock: vi.fn().mockImplementation(async (_filePath: string, fn: () => Promise<any>) => {
    return fn();
  }),
  atomicReadJson: vi.fn().mockImplementation(async (filePath: string) => {
    if (filePath.includes('.lock')) {
      return null;
    }
    if (filePath.includes('index.json')) {
      return sessionIndex;
    }
    return null;
  }),
  atomicWriteJson: vi.fn().mockResolvedValue(undefined),
  ensureDir: vi.fn().mockResolvedValue(undefined),
}));

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
