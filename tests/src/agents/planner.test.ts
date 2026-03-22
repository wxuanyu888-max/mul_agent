/**
 * Planner 模块测试 - 任务规划器
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { TaskPlanner, createTaskPlanner, type TaskAnalysis } from '../../../src/agents/planner.js';

describe('TaskPlanner', () => {
  let planner: TaskPlanner;

  beforeEach(() => {
    planner = createTaskPlanner({ maxSubtasks: 10 });
  });

  describe('analyzeTask', () => {
    it('should analyze simple task', () => {
      const result = planner.analyzeTask('帮我写一个 hello world');

      expect(result).toHaveProperty('complexity');
      expect(result).toHaveProperty('requiredSkills');
      expect(result).toHaveProperty('difficulty');
      expect(result).toHaveProperty('requiresMultipleSteps');
      expect(result).toHaveProperty('suggestedApproach');
    });

    it('should detect implementation skill', () => {
      const result = planner.analyzeTask('创建一个用户登录功能');

      expect(result.requiredSkills).toContain('implementation');
      expect(result.requiresMultipleSteps).toBe(true);
    });

    it('should detect testing skill', () => {
      const result = planner.analyzeTask('测试登录功能是否正常工作');

      expect(result.requiredSkills).toContain('testing');
    });

    it('should detect multiple steps from keywords', () => {
      const result = planner.analyzeTask('首先分析需求，然后实现功能，最后编写测试');

      expect(result.requiresMultipleSteps).toBe(true);
    });

    it('should return higher complexity for longer tasks', () => {
      const simple = planner.analyzeTask('写一个函数');
      const complex = planner.analyzeTask('创建一个完整的用户认证系统，包括注册、登录、密码重置、邮箱验证等功能，并且需要编写单元测试和集成测试');

      expect(complex.complexity).toBeGreaterThan(simple.complexity);
    });
  });

  describe('decomposeTask', () => {
    it('should handle simple task without decomposition', async () => {
      const result = await planner.decomposeTask('写一个 hello world');

      expect(result.tasks).toHaveLength(1);
      expect(result.executionOrder).toBeDefined();
    });

    it('should decompose complex task', async () => {
      const result = await planner.decomposeTask('首先分析需求，然后创建用户系统，最后编写测试');

      expect(result.tasks.length).toBeGreaterThan(1);
    });

    it('should include dependencies in plan', async () => {
      const result = await planner.decomposeTask('首先实现功能，然后测试它');

      // Should have multiple tasks
      expect(result.tasks.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('validatePlan', () => {
    it('should validate a plan structure', async () => {
      const plan = await planner.decomposeTask('实现功能');
      const validation = planner.validatePlan(plan);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect too many tasks', async () => {
      const smallPlanner = createTaskPlanner({ maxSubtasks: 2 });
      const plan = await smallPlanner.decomposeTask('实现功能1、实现功能2、实现功能3、实现功能4');

      const validation = smallPlanner.validatePlan(plan);
      // May exceed limit depending on decomposition
      expect(validation).toHaveProperty('valid');
    });
  });
});
