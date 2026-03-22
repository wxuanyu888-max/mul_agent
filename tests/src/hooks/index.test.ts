/**
 * Hooks Index 测试
 */
import { describe, it, expect, vi } from 'vitest';

describe('Hooks Index', () => {
  describe('exports', () => {
    it('should export HookRegistry', async () => {
      const { HookRegistry } = await import('../../../src/hooks/index.js');

      expect(HookRegistry).toBeDefined();
    });

    it('should export HookExecutor', async () => {
      const { HookExecutor } = await import('../../../src/hooks/index.js');

      expect(HookExecutor).toBeDefined();
    });

    it('should export globalHookRegistry', async () => {
      const { globalHookRegistry } = await import('../../../src/hooks/index.js');

      expect(globalHookRegistry).toBeDefined();
    });
  });

  describe('AgentHooks', () => {
    it('should export agent hooks', async () => {
      const { AgentHooks } = await import('../../../src/hooks/index.js');

      expect(AgentHooks).toBeDefined();
      expect(AgentHooks.start).toBeDefined();
      expect(AgentHooks.end).toBeDefined();
    });
  });

  describe('SessionHooks', () => {
    it('should export session hooks', async () => {
      const { SessionHooks } = await import('../../../src/hooks/index.js');

      expect(SessionHooks).toBeDefined();
      expect(SessionHooks.start).toBeDefined();
      expect(SessionHooks.end).toBeDefined();
    });
  });

  describe('MessageHooks', () => {
    it('should export message hooks', async () => {
      const { MessageHooks } = await import('../../../src/hooks/index.js');

      expect(MessageHooks).toBeDefined();
      expect(MessageHooks.received).toBeDefined();
      expect(MessageHooks.beforeProcess).toBeDefined();
    });
  });

  describe('ToolHooks', () => {
    it('should export tool hooks', async () => {
      const { ToolHooks } = await import('../../../src/hooks/index.js');

      expect(ToolHooks).toBeDefined();
      expect(ToolHooks.beforeCall).toBeDefined();
      expect(ToolHooks.afterCall).toBeDefined();
    });
  });

  describe('MemoryHooks', () => {
    it('should export memory hooks', async () => {
      const { MemoryHooks } = await import('../../../src/hooks/index.js');

      expect(MemoryHooks).toBeDefined();
      expect(MemoryHooks.beforeSave).toBeDefined();
      expect(MemoryHooks.afterSave).toBeDefined();
    });
  });
});
