/**
 * Commands Index 测试
 */
import { describe, it, expect, vi } from 'vitest';

describe('Commands Index', () => {
  describe('exports', () => {
    it('should export CommandRegistry', async () => {
      const { CommandRegistry } = await import('../../../src/commands/index.js');

      expect(CommandRegistry).toBeDefined();
    });

    it('should export CommandExecutor', async () => {
      const { CommandExecutor } = await import('../../../src/commands/index.js');

      expect(CommandExecutor).toBeDefined();
    });

    it('should export globalCommandRegistry', async () => {
      const { globalCommandRegistry } = await import('../../../src/commands/index.js');

      expect(globalCommandRegistry).toBeDefined();
    });
  });

  describe('CommandCategories', () => {
    it('should export command categories', async () => {
      const { CommandCategories } = await import('../../../src/commands/index.js');

      expect(CommandCategories).toBeDefined();
      expect(CommandCategories.session).toBeDefined();
      expect(CommandCategories.options).toBeDefined();
    });
  });

  describe('CommandScopes', () => {
    it('should export command scopes', async () => {
      const { CommandScopes } = await import('../../../src/commands/index.js');

      expect(CommandScopes).toBeDefined();
      expect(CommandScopes.text).toBeDefined();
      expect(CommandScopes.native).toBeDefined();
    });
  });

  describe('executeCommand', () => {
    it('should export execute function', async () => {
      const { executeCommand } = await import('../../../src/commands/index.js');

      expect(executeCommand).toBeDefined();
    });
  });

  describe('listCommands', () => {
    it('should export list function', async () => {
      const { listCommands } = await import('../../../src/commands/index.js');

      expect(listCommands).toBeDefined();
    });
  });
});
