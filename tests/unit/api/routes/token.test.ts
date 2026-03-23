/**
 * API Routes 测试 - Token
 */
import { describe, it, expect } from 'vitest';

describe('API Routes - Token', () => {
  describe('exports', () => {
    it('should export token router', async () => {
      const { createTokenRouter } = await import('../../../../src/api/routes/token.js');

      expect(createTokenRouter).toBeDefined();
    });
  });

  describe('GET /api/v1/token/count', () => {
    it('should have token count endpoint', async () => {
      const { createTokenRouter } = await import('../../../../src/api/routes/token.js');
      const router = createTokenRouter();

      expect(router).toBeDefined();
    });
  });
});
