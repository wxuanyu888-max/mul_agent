/**
 * API Routes 测试 - Tasks
 */
import { describe, it, expect } from 'vitest';

describe('API Routes - Tasks', () => {
  describe('exports', () => {
    it('should export tasks router', async () => {
      const { createTasksRouter } = await import('../../../../src/api/routes/tasks.js');

      expect(createTasksRouter).toBeDefined();
    });
  });

  describe('GET /api/v1/tasks', () => {
    it('should have tasks endpoint', async () => {
      const { createTasksRouter } = await import('../../../../src/api/routes/tasks.js');
      const router = createTasksRouter();

      expect(router).toBeDefined();
    });
  });
});
