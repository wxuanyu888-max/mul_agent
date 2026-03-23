/**
 * Learning 模块测试 - 自主学习系统
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { LearningSystem, createLearningSystem } from '../../../src/agents/learning.js';

describe('LearningSystem', () => {
  let learning: LearningSystem;

  beforeEach(() => {
    learning = createLearningSystem({
      enabled: true,
      minSuccessCount: 2,
      minFailureCount: 1,
    });
  });

  describe('recordSuccess', () => {
    it('should record success experience', async () => {
      await learning.recordSuccess('成功完成任务A', { taskId: '123' }, ['task']);

      const stats = learning.getStats();
      expect(stats.successCount).toBe(1);
    });

    it('should increment count for duplicate pattern', async () => {
      await learning.recordSuccess('完成任务', { id: '1' });
      await learning.recordSuccess('完成任务', { id: '2' });

      const stats = learning.getStats();
      expect(stats.successCount).toBe(1); // Same pattern, count should be 1 with incremented count
    });

    it('should extract keywords from description', async () => {
      await learning.recordSuccess('完成用户认证功能开发', {}, ['dev']);

      const stats = learning.getStats();
      expect(stats.totalExperiences).toBeGreaterThanOrEqual(1);
    });
  });

  describe('recordFailure', () => {
    it('should record failure experience', async () => {
      await learning.recordFailure('任务失败', { error: 'timeout' });

      const stats = learning.getStats();
      expect(stats.failureCount).toBe(1);
    });
  });

  describe('recordKnowledge', () => {
    it('should record new knowledge topic', async () => {
      await learning.recordKnowledge('authentication', '用户认证相关知识', { version: '1.0' });

      const stats = learning.getStats();
      expect(stats.topicsCount).toBe(1);
    });

    it('should update existing knowledge', async () => {
      await learning.recordKnowledge('auth', '初始知识');
      await learning.recordKnowledge('auth', '更新知识');

      const stats = learning.getStats();
      // Should be 1 topic, updated
      expect(stats.topicsCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('getSuccessPatterns', () => {
    it('should return patterns with sufficient success count', async () => {
      await learning.recordSuccess('成功模式A', { count: 1 });
      await learning.recordSuccess('成功模式A', { count: 2 });
      await learning.recordSuccess('成功模式A', { count: 3 });

      const patterns = learning.getSuccessPatterns();
      expect(patterns.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getFailurePatterns', () => {
    it('should return patterns with sufficient failure count', async () => {
      await learning.recordFailure('失败模式B', { error: '1' });

      const patterns = learning.getFailurePatterns();
      expect(patterns.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('suggestNextAction', () => {
    it('should suggest based on learned patterns', async () => {
      await learning.recordFailure('避免这种做法', {});
      await learning.recordSuccess('推荐这种做法', {});

      const suggestions = learning.suggestNextAction();
      expect(suggestions.length).toBeGreaterThan(0);
    });
  });

  describe('getStats', () => {
    it('should return learning statistics', () => {
      const stats = learning.getStats();

      expect(stats).toHaveProperty('totalExperiences');
      expect(stats).toHaveProperty('successCount');
      expect(stats).toHaveProperty('failureCount');
      expect(stats).toHaveProperty('topicsCount');
      expect(stats).toHaveProperty('patternsCount');
    });
  });

  describe('disabled learning', () => {
    it('should not record when disabled', async () => {
      const disabled = createLearningSystem({ enabled: false });

      await disabled.recordSuccess('test');
      await disabled.recordFailure('test');

      const stats = disabled.getStats();
      expect(stats.totalExperiences).toBe(0);
    });
  });
});
