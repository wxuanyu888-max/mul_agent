/**
 * Logger Types 测试
 */
import { describe, it, expect } from 'vitest';
import type { LogLevel, LogEntry, LoggerConfig, LogFilter } from '../../../src/logger/types.js';

describe('Logger Types', () => {
  describe('LogLevel', () => {
    it('should accept all log levels', () => {
      const levels: LogLevel[] = ['debug', 'info', 'warn', 'error', 'fatal'];

      levels.forEach(level => {
        const config: LoggerConfig = { level };
        expect(config.level).toBe(level);
      });
    });
  });

  describe('LogEntry', () => {
    it('should create log entry', () => {
      const entry: LogEntry = {
        timestamp: Date.now(),
        level: 'info',
        message: 'Test log',
        context: { source: 'test' },
      };

      expect(entry.level).toBe('info');
      expect(entry.message).toBe('Test log');
    });

    it('should accept optional context', () => {
      const entry: LogEntry = {
        timestamp: 1000,
        level: 'error',
        message: 'Error occurred',
      };

      expect(entry.context).toBeUndefined();
    });

    it('should accept error object', () => {
      const entry: LogEntry = {
        timestamp: 1000,
        level: 'error',
        message: 'Error',
        error: new Error('Test error'),
      };

      expect(entry.error).toBeInstanceOf(Error);
    });
  });

  describe('LoggerConfig', () => {
    it('should create config with defaults', () => {
      const config: LoggerConfig = {
        level: 'info',
        storageDir: './logs',
      };

      expect(config.level).toBe('info');
    });

    it('should accept custom level', () => {
      const config: LoggerConfig = { level: 'debug' };
      expect(config.level).toBe('debug');
    });

    it('should accept output format', () => {
      const config: LoggerConfig = { format: 'json' };
      expect(config.format).toBe('json');
    });
  });

  describe('LogFilter', () => {
    it('should define filter function', () => {
      const filter: LogFilter = (entry) => entry.level !== 'debug';

      const entry: LogEntry = { timestamp: 1, level: 'debug', message: 'test' };
      expect(filter(entry)).toBe(false);
    });
  });
});
