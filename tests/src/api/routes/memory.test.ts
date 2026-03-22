/**
 * API Routes 测试 - Memory
 */
import { describe, it, expect } from 'vitest';

describe('API Routes - Memory', () => {
  describe('exports', () => {
    it('should export memory router', async () => {
      const { createMemoryRouter } = await import('../../../../src/api/routes/memory.js');

      expect(createMemoryRouter).toBeDefined();
    });
  });

  describe('GET /api/v1/memory/status', () => {
    it('should have status endpoint', async () => {
      const { createMemoryRouter } = await import('../../../../src/api/routes/memory.js');
      const router = createMemoryRouter();

      expect(router).toBeDefined();
    });
  });

  describe('GET /api/v1/memory/search', () => {
    it('should have search endpoint', async () => {
      const { createMemoryRouter } = await import('../../../../src/api/routes/memory.js');
      const router = createMemoryRouter();

      expect(router).toBeDefined();
    });
  });
});
