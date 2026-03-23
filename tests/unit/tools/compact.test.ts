/**
 * Compact Tool 测试
 */
import { describe, it, expect } from 'vitest';

describe('Compact Tool', () => {
  describe('createCompactTool', () => {
    it('should export compact tool', async () => {
      const { createCompactTool } = await import('../../../src/tools/compact.js');

      expect(createCompactTool).toBeDefined();
    });

    it('should create tool with correct name', async () => {
      const { createCompactTool } = await import('../../../src/tools/compact.js');
      const tool = createCompactTool();

      expect(tool.name).toBe('compact');
    });

    it('should have compact action', async () => {
      const { createCompactTool } = await import('../../../src/tools/compact.js');
      const tool = createCompactTool();

      const result = await tool.execute('call-1', {
        action: 'compact',
      });

      expect(result.content).toBeDefined();
    });

    it('should have status action', async () => {
      const { createCompactTool } = await import('../../../src/tools/compact.js');
      const tool = createCompactTool();

      const result = await tool.execute('call-1', {
        action: 'status',
      });

      expect(result.content).toBeDefined();
    });
  });
});
