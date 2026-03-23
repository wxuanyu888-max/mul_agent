// Session Manager 模块测试
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from 'node:fs/promises';
import path from 'node:path';
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
} from "../../../src/session/manager.js";

// Store mock data for different scenarios
let mockSessionData: Record<string, any> = {};
let mockIndexData: Record<string, any> = {};

// Mock file-lock module
vi.mock('../../../src/utils/file-lock.js', () => ({
  withFileLock: vi.fn().mockImplementation(async (filePath: string, fn: () => Promise<any>) => {
    return fn();
  }),
  atomicReadJson: vi.fn().mockImplementation(async (filePath: string) => {
    if (filePath.includes('.lock')) {
      return null;
    }
    if (filePath.includes('index.json')) {
      return mockIndexData;
    }
    // Session file - extract session ID from path (e.g., storage/sessions/test-123.json)
    const match = filePath.match(/sessions[/](.+?)\.json$/);
    if (match) {
      const sessionId = match[1];
      return mockSessionData[sessionId] || null;
    }
    return null;
  }),
  atomicWriteJson: vi.fn().mockImplementation(async (filePath: string, data: any) => {
    if (filePath.includes('index.json')) {
      mockIndexData = data;
    } else {
      const match = filePath.match(/sessions[/](.+?)\.json$/);
      if (match) {
        mockSessionData[match[1]] = data;
      }
    }
    return;
  }),
  ensureDir: vi.fn().mockResolvedValue(undefined),
}));

// Mock fs module
vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    default: {
      ...actual,
      mkdir: vi.fn().mockResolvedValue(undefined),
      readFile: vi.fn().mockImplementation((path: string) => {
        if (path.includes('.lock')) {
          return Promise.reject(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
        }
        if (path.includes('index.json')) {
          return Promise.resolve(JSON.stringify(mockIndexData));
        }
        return Promise.reject(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
      }),
      writeFile: vi.fn().mockImplementation((path: string, data: string) => {
        if (path.includes('index.json')) {
          mockIndexData = JSON.parse(data);
        }
        return Promise.resolve(undefined);
      }),
      unlink: vi.fn().mockImplementation((path: string) => {
        const match = path.match(/sessions[/](.+?)\.json$/);
        if (match) {
          delete mockSessionData[match[1]];
        }
        return Promise.resolve(undefined);
      }),
      access: vi.fn().mockResolvedValue(undefined),
    },
  };
});

describe("Session Manager", () => {
  const testStorageDir = './storage/sessions';

  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionData = {};
    mockIndexData = {};
  });

  describe("createSession", () => {
    it("should create a new session with default config", async () => {
      const session = await createSession();

      expect(session.id).toBeDefined();
      expect(session.status).toBe('active');
      expect(session.config.runtime).toBe('main');
      expect(session.config.model).toBe('claude-sonnet-4-20250514');
      expect(session.config.temperature).toBe(1.0);
      expect(session.messages).toEqual([]);
      expect(session.toolCalls).toEqual([]);
      expect(session.usage).toEqual({ input: 0, output: 0, total: 0 });
    });

    it("should create session with custom label", async () => {
      const session = await createSession({ label: 'Test Session' });

      expect(session.label).toBe('Test Session');
    });

    it("should create session with parent ID", async () => {
      const session = await createSession({ parentId: 'parent-123' });

      expect(session.parentId).toBe('parent-123');
    });

    it("should create session with custom config", async () => {
      const session = await createSession({
        config: {
          runtime: 'worker',
          model: 'claude-haiku',
          temperature: 0.5,
          maxTokens: 1000,
        },
      });

      expect(session.config.runtime).toBe('worker');
      expect(session.config.model).toBe('claude-haiku');
      expect(session.config.temperature).toBe(0.5);
      expect(session.config.maxTokens).toBe(1000);
    });
  });

  describe("getSession", () => {
    it("should return session when exists", async () => {
      const mockSession = {
        id: 'test-123',
        status: 'active',
        messages: [],
        toolCalls: [],
        usage: { input: 0, output: 0, total: 0 },
      };
      mockSessionData['test-123'] = mockSession;

      const session = await getSession('test-123');

      expect(session).toEqual(mockSession);
    });

    it("should return null when session not found", async () => {
      const session = await getSession('nonexistent');

      expect(session).toBeNull();
    });
  });

  describe("updateSession", () => {
    it("should update session fields", async () => {
      const mockSession = {
        id: 'test-123',
        label: 'Original',
        status: 'active',
        messages: [],
        toolCalls: [],
        usage: { input: 0, output: 0, total: 0 },
        updatedAt: 1000,
      };
      mockSessionData['test-123'] = mockSession;

      const updated = await updateSession('test-123', { label: 'Updated' });

      expect(updated?.label).toBe('Updated');
      expect(updated?.updatedAt).not.toBe(1000);
    });

    it("should return null for nonexistent session", async () => {
      const updated = await updateSession('nonexistent', { label: 'Updated' });

      expect(updated).toBeNull();
    });
  });

  describe("addMessage", () => {
    it("should add message to session", async () => {
      const mockSession = {
        id: 'test-123',
        status: 'active',
        messages: [],
        toolCalls: [],
        usage: { input: 0, output: 0, total: 0 },
        updatedAt: 1000,
      };
      mockSessionData['test-123'] = mockSession;

      const message = { role: 'user' as const, content: 'Hello' };
      const updated = await addMessage('test-123', message);

      expect(updated?.messages).toHaveLength(1);
      expect(updated?.messages[0].content).toBe('Hello');
      expect(updated?.messages[0].timestamp).toBeDefined();
    });
  });

  describe("addToolCall", () => {
    it("should add tool call to session", async () => {
      const mockSession = {
        id: 'test-123',
        status: 'active',
        messages: [],
        toolCalls: [],
        usage: { input: 0, output: 0, total: 0 },
        updatedAt: 1000,
      };
      mockSessionData['test-123'] = mockSession;

      const toolCall = { id: 'tool-1', name: 'bash', input: { command: 'ls' } };
      const updated = await addToolCall('test-123', toolCall);

      expect(updated?.toolCalls).toHaveLength(1);
      expect(updated?.toolCalls[0].name).toBe('bash');
    });
  });

  describe("updateUsage", () => {
    it("should replace token usage (not accumulate)", async () => {
      const mockSession = {
        id: 'test-123',
        status: 'active',
        messages: [],
        toolCalls: [],
        usage: { input: 100, output: 50, total: 150 },
        updatedAt: 1000,
      };
      mockSessionData['test-123'] = mockSession;

      const updated = await updateSession('test-123', {
        usage: { input: 200, output: 100, total: 300 },
      });

      expect(updated?.usage?.input).toBe(200);
      expect(updated?.usage?.output).toBe(100);
      expect(updated?.usage?.total).toBe(300);
    });
  });

  describe("querySessions", () => {
    it("should return all sessions sorted by updatedAt", async () => {
      mockIndexData = {
        'session-1': { id: 'session-1', updatedAt: 100, status: 'active' },
        'session-2': { id: 'session-2', updatedAt: 200, status: 'active' },
        'session-3': { id: 'session-3', updatedAt: 50, status: 'completed' },
      };

      const sessions = await querySessions();

      expect(sessions).toHaveLength(3);
      expect(sessions[0].id).toBe('session-2'); // Most recent first
      expect(sessions[1].id).toBe('session-1');
      expect(sessions[2].id).toBe('session-3');
    });

    it("should filter by status", async () => {
      mockIndexData = {
        'session-1': { id: 'session-1', updatedAt: 100, status: 'active' },
        'session-2': { id: 'session-2', updatedAt: 200, status: 'completed' },
      };

      const sessions = await querySessions({ status: 'active' });

      expect(sessions).toHaveLength(1);
      expect(sessions[0].status).toBe('active');
    });

    it("should filter by parentId", async () => {
      mockIndexData = {
        'session-1': { id: 'session-1', parentId: 'parent-1', status: 'active' },
        'session-2': { id: 'session-2', parentId: 'parent-2', status: 'active' },
      };

      const sessions = await querySessions({ parentId: 'parent-1' });

      expect(sessions).toHaveLength(1);
      expect(sessions[0].parentId).toBe('parent-1');
    });

    it("should filter by label", async () => {
      mockIndexData = {
        'session-1': { id: 'session-1', label: 'My Test Session', status: 'active' },
        'session-2': { id: 'session-2', label: 'Another Session', status: 'active' },
      };

      const sessions = await querySessions({ label: 'Test' });

      expect(sessions).toHaveLength(1);
      expect(sessions[0].label).toContain('Test');
    });

    it("should support pagination with offset and limit", async () => {
      mockIndexData = {
        'session-1': { id: 'session-1', updatedAt: 300, status: 'active' },
        'session-2': { id: 'session-2', updatedAt: 200, status: 'active' },
        'session-3': { id: 'session-3', updatedAt: 100, status: 'active' },
      };

      const sessions = await querySessions({ offset: 1, limit: 1 });

      expect(sessions).toHaveLength(1);
      expect(sessions[0].id).toBe('session-2');
    });
  });

  describe("getActiveSessions", () => {
    it("should return only active sessions", async () => {
      mockIndexData = {
        'session-1': { id: 'session-1', status: 'active' },
        'session-2': { id: 'session-2', status: 'completed' },
        'session-3': { id: 'session-3', status: 'active' },
      };

      const sessions = await getActiveSessions();

      expect(sessions).toHaveLength(2);
      expect(sessions.every(s => s.status === 'active')).toBe(true);
    });
  });

  describe("deleteSession", () => {
    it("should delete session successfully", async () => {
      mockIndexData = { 'test-123': { id: 'test-123' }, 'other': { id: 'other' } };
      mockSessionData['test-123'] = { id: 'test-123' };

      const result = await deleteSession('test-123');

      expect(result).toBe(true);
    });

    it("should return false when session not found", async () => {
      const result = await deleteSession('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe("updateSessionStatus", () => {
    it("should update session status", async () => {
      const mockSession = {
        id: 'test-123',
        status: 'active',
        messages: [],
        toolCalls: [],
        usage: { input: 0, output: 0, total: 0 },
      };
      mockSessionData['test-123'] = mockSession;

      const updated = await updateSessionStatus('test-123', 'completed');

      expect(updated?.status).toBe('completed');
    });
  });
});
