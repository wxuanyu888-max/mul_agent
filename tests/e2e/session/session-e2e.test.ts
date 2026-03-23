/**
 * E2E 测试 - 会话流程
 *
 * 端到端测试完整的用户会话流程：
 * 1. 创建会话
 * 2. 发送消息
 * 3. 接收响应
 * 4. 查看历史
 * 5. 删除会话
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createSession, getSession, addMessage, querySessions, deleteSession, updateSessionStatus } from '../../src/session/index.js';

describe('Session E2E', () => {
  const testSessionIds: string[] = [];

  afterEach(async () => {
    // Cleanup
    for (const id of testSessionIds) {
      try {
        await deleteSession(id);
      } catch {
        // Ignore cleanup errors
      }
    }
    testSessionIds.length = 0;
  });

  describe('Full Session Lifecycle', () => {
    it('should create, use, and delete session', async () => {
      // 1. Create session
      const session = await createSession({ label: 'E2E Test Session' });
      testSessionIds.push(session.id);
      expect(session.id).toBeDefined();
      expect(session.status).toBe('active');

      // 2. Add user message
      await addMessage(session.id, {
        role: 'user',
        content: 'Hello, agent!',
      });

      // 3. Add assistant response
      await addMessage(session.id, {
        role: 'assistant',
        content: 'Hello! How can I help you today?',
      });

      // 4. Verify session state
      let retrieved = await getSession(session.id);
      expect(retrieved?.messages).toHaveLength(2);
      expect(retrieved?.messages[0].content).toBe('Hello, agent!');

      // 5. Update status to completed
      await updateSessionStatus(session.id, 'completed');

      // 6. Verify completion
      retrieved = await getSession(session.id);
      expect(retrieved?.status).toBe('completed');

      // 7. Delete session
      const deleted = await deleteSession(session.id);
      expect(deleted).toBe(true);

      // 8. Verify deletion
      const notFound = await getSession(session.id);
      expect(notFound).toBeNull();
    });

    it('should persist session data correctly', async () => {
      const session = await createSession({
        label: 'Persistence Test',
        config: {
          model: 'claude-sonnet-4-20250514',
          temperature: 0.7,
        },
      });
      testSessionIds.push(session.id);

      // Add multiple messages
      for (let i = 0; i < 5; i++) {
        await addMessage(session.id, {
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Message ${i + 1}`,
        });
      }

      // Verify all messages persisted
      const retrieved = await getSession(session.id);
      expect(retrieved?.messages).toHaveLength(5);

      // Verify config persisted
      expect(retrieved?.config.temperature).toBe(0.7);
    });

    it('should query multiple sessions', async () => {
      // Create multiple sessions
      const session1 = await createSession({ label: 'Session 1' });
      const session2 = await createSession({ label: 'Session 2' });
      const session3 = await createSession({ label: 'Session 3' });

      testSessionIds.push(session1.id, session2.id, session3.id);

      // Query all sessions
      const sessions = await querySessions({ limit: 10 });

      expect(sessions.length).toBeGreaterThanOrEqual(3);

      // Should be sorted by updatedAt (most recent first)
      if (sessions.length >= 3) {
        expect(sessions[0].updatedAt).toBeGreaterThanOrEqual(sessions[1].updatedAt);
      }
    });

    it('should filter sessions by status', async () => {
      const session1 = await createSession({ label: 'Active Session' });
      testSessionIds.push(session1.id);

      await updateSessionStatus(session1.id, 'completed');

      // Query only active sessions
      const activeSessions = await querySessions({ status: 'active' });
      expect(activeSessions.every(s => s.status === 'active')).toBe(true);

      // Query only completed sessions
      const completedSessions = await querySessions({ status: 'completed' });
      expect(completedSessions.every(s => s.status === 'completed')).toBe(true);
    });
  });

  describe('Session Error Handling', () => {
    it('should handle non-existent session', async () => {
      const session = await getSession('non-existent-id');
      expect(session).toBeNull();
    });

    it('should handle delete non-existent session', async () => {
      const result = await deleteSession('non-existent-id');
      expect(result).toBe(false);
    });
  });
});
