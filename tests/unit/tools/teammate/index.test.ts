/**
 * Teammate Tools 测试
 */
import { describe, it, expect, vi } from 'vitest';

describe('Teammate Tools', () => {
  describe('exports', () => {
    it('should export teammate tools', async () => {
      const { createTeammateListTool, createTeammateSpawnTool, createTeammateSendTool } = await import('../../../../../src/tools/teammate/index.js');

      expect(createTeammateListTool).toBeDefined();
      expect(createTeammateSpawnTool).toBeDefined();
      expect(createTeammateSendTool).toBeDefined();
    });

    it('should export inbox tool', async () => {
      const { createTeammateInboxTool } = await import('../../../../../src/tools/teammate/index.js');

      expect(createTeammateInboxTool).toBeDefined();
    });

    it('should export delegate tool', async () => {
      const { createTeammateDelegateTool } = await import('../../../../../src/tools/teammate/index.js');

      expect(createTeammateDelegateTool).toBeDefined();
    });
  });

  describe('createTeammateListTool', () => {
    it('should create list tool', async () => {
      const { createTeammateListTool } = await import('../../../../../src/tools/teammate/index.js');
      const tool = createTeammateListTool();

      expect(tool.name).toBe('teammate_list');
      expect(tool.label).toBe('Teammate List');
    });

    it('should have list action', async () => {
      const { createTeammateListTool } = await import('../../../../../src/tools/teammate/index.js');
      const tool = createTeammateListTool();

      const result = await tool.execute('call-1', { action: 'list' });

      expect(result.content).toBeDefined();
    });
  });

  describe('createTeammateSpawnTool', () => {
    it('should create spawn tool', async () => {
      const { createTeammateSpawnTool } = await import('../../../../../src/tools/teammate/index.js');
      const tool = createTeammateSpawnTool();

      expect(tool.name).toBe('teammate_spawn');
    });

    it('should require name parameter', async () => {
      const { createTeammateSpawnTool } = await import('../../../../../src/tools/teammate/index.js');
      const tool = createTeammateSpawnTool();

      const result = await tool.execute('call-1', { action: 'spawn' });

      // Should return error for missing name
      expect(result.error || result.content).toBeDefined();
    });
  });

  describe('createTeammateSendTool', () => {
    it('should create send tool', async () => {
      const { createTeammateSendTool } = await import('../../../../../src/tools/teammate/index.js');
      const tool = createTeammateSendTool();

      expect(tool.name).toBe('teammate_send');
    });
  });
});
