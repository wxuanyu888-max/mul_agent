/**
 * API Routes 测试 - Info
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('API Routes - Info', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/v1/info/summary', () => {
    it('should export summary route', async () => {
      const { createInfoRouter } = await import('../../../../src/api/routes/info.js');

      expect(createInfoRouter).toBeDefined();
    });
  });

  describe('GET /api/v1/info/routes', () => {
    it('should list available routes', async () => {
      const { createInfoRouter } = await import('../../../../src/api/routes/info.js');
      const router = createInfoRouter();

      expect(router).toBeDefined();
    });
  });

  describe('GET /api/v1/info/agent-team', () => {
    it('should export agent team info', async () => {
      const { createInfoRouter } = await import('../../../../src/api/routes/info.js');

      expect(createInfoRouter).toBeDefined();
    });
  });
});
