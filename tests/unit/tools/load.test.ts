/**
 * Load Tool 测试
 */
import { describe, it, expect } from 'vitest';

describe('Load Tool', () => {
  describe('createLoadTool', () => {
    it('should export load tool', async () => {
      const { createLoadTool } = await import('../../../src/tools/load.js');

      expect(createLoadTool).toBeDefined();
    });

    it('should create tool with correct name', async () => {
      const { createLoadTool } = await import('../../../src/tools/load.js');
      const tool = createLoadTool();

      expect(tool.name).toBe('load');
    });

    it('should have load action', async () => {
      const { createLoadTool } = await import('../../../src/tools/load.js');
      const tool = createLoadTool();

      const result = await tool.execute('call-1', {
        action: 'load',
        type: 'skill',
        name: 'test',
      });

      expect(result.content).toBeDefined();
    });

    it('should list skills', async () => {
      const { createLoadTool } = await import('../../../src/tools/load.js');
      const tool = createLoadTool();

      const result = await tool.execute('call-1', {
        action: 'list',
      });

      expect(result.content).toBeDefined();
    });
  });
});
