/**
 * CLI Types 测试
 */
import { describe, it, expect } from 'vitest';
import type { CliCommand, CliArg, CliOptions } from '../../../src/cli/types.js';

describe('CLI Types', () => {
  describe('CliCommand', () => {
    it('should create command', () => {
      const cmd: CliCommand = {
        name: 'start',
        description: 'Start the server',
        action: async () => {},
      };

      expect(cmd.name).toBe('start');
    });

    it('should accept arguments', () => {
      const cmd: CliCommand = {
        name: 'create',
        description: 'Create something',
        args: [
          { name: 'name', type: 'string', required: true },
        ],
        action: async () => {},
      };

      expect(cmd.args).toHaveLength(1);
    });

    it('should accept options', () => {
      const cmd: CliCommand = {
        name: 'test',
        description: 'Run tests',
        options: [
          { name: 'watch', type: 'boolean', default: false },
        ],
        action: async () => {},
      };

      expect(cmd.options).toHaveLength(1);
    });
  });

  describe('CliArg', () => {
    it('should define argument', () => {
      const arg: CliArg = {
        name: 'project',
        type: 'string',
        required: true,
        description: 'Project name',
      };

      expect(arg.name).toBe('project');
      expect(arg.required).toBe(true);
    });

    it('should accept default value', () => {
      const arg: CliArg = {
        name: 'port',
        type: 'number',
        default: 3000,
      };

      expect(arg.default).toBe(3000);
    });
  });

  describe('CliOptions', () => {
    it('should define options', () => {
      const options: CliOptions = {
        verbose: true,
        config: './config.json',
      };

      expect(options.verbose).toBe(true);
    });
  });
});
