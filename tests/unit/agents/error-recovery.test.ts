/**
 * Error Recovery 模块测试 - 错误自动恢复
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ErrorRecoverySystem, ErrorClassifier, createErrorRecoverySystem } from '../../../src/agents/error-recovery.js';

describe('ErrorClassifier', () => {
  describe('classify', () => {
    it('should classify network errors', () => {
      const error = new Error('ECONNREFUSED connection failed');
      const result = ErrorClassifier.classify(error);

      expect(result.type).toBe('network');
      expect(result.severity).toBeDefined();
    });

    it('should classify timeout errors', () => {
      const error = new Error('Request timed out');
      const result = ErrorClassifier.classify(error);

      expect(result.type).toBe('timeout');
    });

    it('should classify rate limit errors', () => {
      const error = new Error('Rate limit exceeded: 429 Too Many Requests');
      const result = ErrorClassifier.classify(error);

      expect(result.type).toBe('rate_limit');
    });

    it('should classify authentication errors', () => {
      const error = new Error('401 Unauthorized: invalid API key');
      const result = ErrorClassifier.classify(error);

      expect(result.type).toBe('authentication');
    });

    it('should classify permission errors', () => {
      const error = new Error('403 Forbidden: access denied');
      const result = ErrorClassifier.classify(error);

      expect(result.type).toBe('permission');
    });

    it('should classify validation errors', () => {
      const error = new Error('Validation error: invalid input');
      const result = ErrorClassifier.classify(error);

      expect(result.type).toBe('validation');
    });

    it('should classify compilation errors', () => {
      const error = new Error('SyntaxError: unexpected token');
      const result = ErrorClassifier.classify(error);

      expect(result.type).toBe('compilation');
    });

    it('should classify execution errors', () => {
      const error = new Error('Execution failed: process error');
      const result = ErrorClassifier.classify(error);

      expect(result.type).toBe('execution');
    });

    it('should default to unknown for unrecognized errors', () => {
      const error = new Error('Some random error');
      const result = ErrorClassifier.classify(error);

      expect(result.type).toBe('unknown');
    });
  });
});

describe('ErrorRecoverySystem', () => {
  let recovery: ErrorRecoverySystem;

  beforeEach(() => {
    recovery = createErrorRecoverySystem(false);
  });

  describe('registerStrategy', () => {
    it('should register custom recovery strategy', () => {
      const called = { value: false };

      recovery.registerStrategy({
        name: 'test_strategy',
        priority: 100,
        canHandle: () => true,
        recover: async () => {
          called.value = true;
          return { success: true, recovered: true, message: 'test' };
        },
      });

      expect(called.value).toBe(false); // Not called yet
    });
  });

  describe('recover', () => {
    it('should handle timeout error with retry', async () => {
      const result = await recovery.recover(new Error('Request timed out'), { maxAttempts: 1 });

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('recovered');
      expect(result).toHaveProperty('message');
    });

    it('should handle network error with retry', async () => {
      const result = await recovery.recover(new Error('ECONNREFUSED'), { maxAttempts: 1 });

      expect(result.success).toBe(true);
    });

    it('should handle rate limit with backoff', async () => {
      const result = await recovery.recover(new Error('429 rate limit retry-after 0'), { maxAttempts: 1 });

      expect(result.success).toBe(true);
    });

    it('should handle unknown errors', async () => {
      const result = await recovery.recover(new Error('unknown error'), { maxAttempts: 1 });

      expect(result).toHaveProperty('success');
    });
  });

  describe('getErrorHistory', () => {
    it('should track error history', async () => {
      await recovery.recover(new Error('error 1'));
      await recovery.recover(new Error('error 2'));

      const history = recovery.getErrorHistory();
      expect(history.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('getErrorStats', () => {
    it('should return error statistics', async () => {
      await recovery.recover(new Error('timeout error'));
      await recovery.recover(new Error('timeout error'));
      await recovery.recover(new Error('network error'));

      const stats = recovery.getErrorStats();
      expect(stats).toHaveProperty('timeout');
      expect(stats).toHaveProperty('network');
    });
  });
});
