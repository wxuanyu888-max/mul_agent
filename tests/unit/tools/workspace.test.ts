/**
 * Workspace Tool 测试
 */
import { describe, it, expect } from 'vitest';

describe('Workspace Tool', () => {
  describe('createWorkspaceTool', () => {
    it('should export workspace tool', async () => {
      const { createWorkspaceTool } = await import('../../../src/tools/workspace.js');

      expect(createWorkspaceTool).toBeDefined();
    });

    it('should create tool with correct name', async () => {
      const { createWorkspaceTool } = await import('../../../src/tools/workspace.js');
      const tool = createWorkspaceTool();

      expect(tool.name).toBe('workspace');
    });

    it('should have refresh action', async () => {
      const { createWorkspaceTool } = await import('../../../src/tools/workspace.js');
      const tool = createWorkspaceTool();

      const result = await tool.execute('call-1', { action: 'refresh' });

      expect(result.content).toBeDefined();
    });
  });
});
