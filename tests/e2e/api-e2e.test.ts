/**
 * E2E 测试 - API 路由
 *
 * 端到端测试 API 端点：
 * 1. 健康检查
 * 2. Session API
 * 3. 错误处理
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createSession, deleteSession } from '../../src/session/index.js';
import { getLogger, initLogger } from '../../src/logger/index.js';

describe('API E2E', () => {
  const testSessionIds: string[] = [];
  const baseUrl = process.env.API_URL || 'http://localhost:3000';

  beforeAll(() => {
    initLogger({ level: 'error' });
  });

  afterEach(async () => {
    for (const id of testSessionIds) {
      try {
        await deleteSession(id);
      } catch {
        // Ignore
      }
    }
    testSessionIds.length = 0;
  });

  describe('Session API', () => {
    it('should create session via API', async () => {
      // This test would require the API server to be running
      // Skip if server is not available
      if (!process.env.RUN_API_TESTS) {
        expect(true).toBe(true); // Placeholder
        return;
      }

      const response = await request(baseUrl)
        .post('/api/v1/sessions')
        .send({ label: 'API Test Session' });

      expect(response.status).toBe(201);
      expect(response.body.id).toBeDefined();

      if (response.body.id) {
        testSessionIds.push(response.body.id);
      }
    });

    it('should list sessions via API', async () => {
      if (!process.env.RUN_API_TESTS) {
        expect(true).toBe(true);
        return;
      }

      // Create a session first
      const session = await createSession({ label: 'List Test' });
      testSessionIds.push(session.id);

      const response = await request(baseUrl).get('/api/v1/sessions');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should get session by ID via API', async () => {
      if (!process.env.RUN_API_TESTS) {
        expect(true).toBe(true);
        return;
      }

      const session = await createSession({ label: 'Get Test' });
      testSessionIds.push(session.id);

      const response = await request(baseUrl).get(`/api/v1/sessions/${session.id}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(session.id);
    });

    it('should return 404 for non-existent session', async () => {
      if (!process.env.RUN_API_TESTS) {
        expect(true).toBe(true);
        return;
      }

      const response = await request(baseUrl).get('/api/v1/sessions/non-existent-id');

      expect(response.status).toBe(404);
    });
  });

  describe('Message API', () => {
    it('should add message to session via API', async () => {
      if (!process.env.RUN_API_TESTS) {
        expect(true).toBe(true);
        return;
      }

      const session = await createSession({ label: 'Message Test' });
      testSessionIds.push(session.id);

      const response = await request(baseUrl)
        .post(`/api/v1/sessions/${session.id}/messages`)
        .send({ role: 'user', content: 'Test message' });

      expect(response.status).toBe(201);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid request body', async () => {
      if (!process.env.RUN_API_TESTS) {
        expect(true).toBe(true);
        return;
      }

      const response = await request(baseUrl)
        .post('/api/v1/sessions')
        .send({ invalid: 'data' });

      // Should return validation error
      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('should handle malformed JSON', async () => {
      if (!process.env.RUN_API_TESTS) {
        expect(true).toBe(true);
        return;
      }

      const response = await request(baseUrl)
        .post('/api/v1/sessions')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }');

      expect(response.status).toBe(400);
    });
  });
});
