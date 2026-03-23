/**
 * Degradation 模块测试 - 降级策略
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DegradationManager, createDegradationManager } from '../../../src/agents/degradation.js';

describe('DegradationManager', () => {
  let manager: DegradationManager;

  beforeEach(() => {
    manager = createDegradationManager({
      maxFailures: 2,
      autoRecovery: true,
    });
  });

  describe('registerComponent', () => {
    it('should register a component', () => {
      manager.registerComponent('test-component');

      const state = manager.getComponentState('test-component');
      expect(state).toBeDefined();
      expect(state?.name).toBe('test-component');
      expect(state?.status).toBe('healthy');
    });
  });

  describe('markFailure', () => {
    it('should mark component as failed', () => {
      manager.registerComponent('test');
      manager.markFailure('test', new Error('test error'));

      const state = manager.getComponentState('test');
      expect(state?.status).toBe('failed');
      expect(state?.failureCount).toBe(1);
    });

    it('should increment failure count', () => {
      manager.registerComponent('test');
      manager.markFailure('test');
      manager.markFailure('test');

      const state = manager.getComponentState('test');
      expect(state?.failureCount).toBe(2);
    });
  });

  describe('markRecovery', () => {
    it('should mark component as healthy', () => {
      manager.registerComponent('test');
      manager.markFailure('test');
      manager.markRecovery('test');

      const state = manager.getComponentState('test');
      expect(state?.status).toBe('healthy');
      expect(state?.failureCount).toBe(0);
    });
  });

  describe('degradation levels', () => {
    it('should start at normal level', () => {
      expect(manager.getLevel()).toBe('normal');
    });

    it('should degrade after max failures', () => {
      manager.registerComponent('test');
      manager.markFailure('test');
      manager.markFailure('test');

      // After 2 failures (maxFailures), should be degraded
      expect(manager.getLevel()).toBe('degraded');
    });

    it('should emit events on level change', () => {
      const listener = vi.fn();
      manager.onLevelChange(listener);

      manager.registerComponent('test');
      manager.markFailure('test');
      manager.markFailure('test');

      expect(listener).toHaveBeenCalled();
    });
  });

  describe('getAllComponentStates', () => {
    it('should return all component states', () => {
      manager.registerComponent('comp1');
      manager.registerComponent('comp2');

      const states = manager.getAllComponentStates();
      expect(states.length).toBe(2);
    });
  });

  describe('setLevel', () => {
    it('should manually set degradation level', () => {
      manager.setLevel('minimal');

      expect(manager.getLevel()).toBe('minimal');
    });
  });

  describe('destroy', () => {
    it('should clean up resources', () => {
      manager.registerComponent('test');
      manager.destroy();

      const states = manager.getAllComponentStates();
      expect(states.length).toBe(0);
    });
  });
});
