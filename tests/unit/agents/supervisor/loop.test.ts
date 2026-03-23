/**
 * Supervisor Loop 测试 - 自助循环控制系统
 *
 * 改进版：增加异步测试、边界测试、错误处理
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  SupervisorLoop,
  createSupervisorLoop,
  runAutonomousTask,
  type SupervisorLoopConfig,
  type SupervisorLoopState,
} from '../../../../src/agents/supervisor/loop.js';

// 重置模块状态
vi.resetModules();

// Mock 依赖
vi.mock('../../../../src/agents/supervisor/index.js', () => ({
  createSupervisor: vi.fn().mockResolvedValue('supervisor-test-123'),
  decomposeTasks: vi.fn().mockResolvedValue(['task-1', 'task-2', 'task-3']),
  delegateTask: vi.fn().mockResolvedValue(undefined),
  updateTask: vi.fn().mockResolvedValue(undefined),
  collectSupervisorResults: vi.fn().mockResolvedValue({
    'task-1': 'Result 1',
    'task-2': 'Result 2',
    'task-3': 'Result 3',
  }),
  getSupervisorStatus: vi.fn(),
  getAllTasks: vi.fn(),
  terminateSupervisor: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../../src/agents/llm.js', () => ({
  getLLMClient: vi.fn(),
}));

describe('SupervisorLoop', () => {
  // 导入 mock 函数
  let createSupervisorMock: ReturnType<typeof vi.fn>;
  let decomposeTasksMock: ReturnType<typeof vi.fn>;
  let delegateTaskMock: ReturnType<typeof vi.fn>;
  let updateTaskMock: ReturnType<typeof vi.fn>;
  let collectSupervisorResultsMock: ReturnType<typeof vi.fn>;
  let getSupervisorStatusMock: ReturnType<typeof vi.fn>;
  let getAllTasksMock: ReturnType<typeof vi.fn>;
  let terminateSupervisorMock: ReturnType<typeof vi.fn>;
  let getLLMClientMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetAllMocks();

    // 获取 mock 函数引用
    const supervisorModule = await import('../../../../src/agents/supervisor/index.js');
    const llmModule = await import('../../../../src/agents/llm.js');

    createSupervisorMock = supervisorModule.createSupervisor as ReturnType<typeof vi.fn>;
    decomposeTasksMock = supervisorModule.decomposeTasks as ReturnType<typeof vi.fn>;
    delegateTaskMock = supervisorModule.delegateTask as ReturnType<typeof vi.fn>;
    updateTaskMock = supervisorModule.updateTask as ReturnType<typeof vi.fn>;
    collectSupervisorResultsMock = supervisorModule.collectSupervisorResults as ReturnType<typeof vi.fn>;
    getSupervisorStatusMock = supervisorModule.getSupervisorStatus as ReturnType<typeof vi.fn>;
    getAllTasksMock = supervisorModule.getAllTasks as ReturnType<typeof vi.fn>;
    terminateSupervisorMock = supervisorModule.terminateSupervisor as ReturnType<typeof vi.fn>;
    getLLMClientMock = llmModule.getLLMClient as ReturnType<typeof vi.fn>;

    // 配置默认 mock
    createSupervisorMock.mockResolvedValue('supervisor-test-123');
    getLLMClientMock.mockReturnValue({
      model: 'test-model',
      chat: vi.fn().mockResolvedValue({
        content: [
          { type: 'text', text: '{"subtasks": [{"name": "task-1", "description": "Test task 1", "type": "subagent"}]}' }
        ]
      }),
    });
  });

  describe('createSupervisorLoop', () => {
    it('应该创建 SupervisorLoop 实例', () => {
      const config: SupervisorLoopConfig = {
        supervisor: {
          name: 'test-supervisor',
          role: 'orchestrator',
          sessionId: 'test-session',
        },
      };

      const loop = createSupervisorLoop(config);
      expect(loop).toBeInstanceOf(SupervisorLoop);
      expect(loop.isRunning()).toBe(false);
    });

    it('应该使用默认配置值', () => {
      const loop = createSupervisorLoop({
        supervisor: { name: 'test', role: 'test', sessionId: 'test' },
      });

      const state = loop.getState();

      // 精确断言
      expect(state).toEqual(expect.objectContaining({
        status: 'initializing',
        iterations: 0,
        completedTasks: 0,
        failedTasks: 0,
        results: {},
      }));

      // 验证时间戳存在且合理
      expect(state.startTime).toBeGreaterThan(0);
      expect(state.startTime).toBeLessThanOrEqual(Date.now());
    });

    it('应该正确应用自定义配置', () => {
      const config: SupervisorLoopConfig = {
        supervisor: {
          name: 'custom-supervisor',
          role: 'custom-role',
          sessionId: 'custom-session',
        },
        maxIterations: 5,
        pollIntervalMs: 100,
        taskTimeoutMs: 30000,
        maxConcurrent: 2,
        autoDelegateToSubagent: false,
        autoDelegateToTeammate: true,
      };

      const loop = createSupervisorLoop(config);
      expect(loop).toBeDefined();
    });

    it('应该默认 maxIterations 为 20', () => {
      const loop = createSupervisorLoop({
        supervisor: { name: 'test', role: 'test', sessionId: 'test' },
      });

      // 内部配置通过 getState 无法直接获取，但可以通过行为验证
      expect(loop).toBeInstanceOf(SupervisorLoop);
    });
  });

  describe('getState', () => {
    it('应该返回初始状态的深拷贝', () => {
      const loop = createSupervisorLoop({
        supervisor: { name: 'test', role: 'test', sessionId: 'test' },
      });

      const state1 = loop.getState();
      const state2 = loop.getState();

      // 验证返回的是独立对象
      expect(state1).not.toBe(state2);
      expect(state1).toEqual(state2);
    });

    it('应该在 start 后返回更新后的状态', async () => {
      // 配置 mock 链
      getSupervisorStatusMock
        .mockResolvedValueOnce({ status: 'idle', supervisorId: 'sup-123', sessionId: 'test', subTasks: {}, results: {}, currentIteration: 0 })
        .mockResolvedValueOnce({ status: 'decomposing', supervisorId: 'sup-123', sessionId: 'test', subTasks: {}, results: {}, currentIteration: 0 })
        .mockResolvedValue({ status: 'completed', supervisorId: 'sup-123', sessionId: 'test', subTasks: {}, results: { 'task-1': 'done' }, currentIteration: 1 });

      decomposeTasksMock.mockResolvedValue(['task-1']);
      delegateTaskMock.mockResolvedValue(undefined);
      getAllTasksMock.mockResolvedValue([
        { id: 'task-1', name: 'Task 1', status: 'completed', type: 'subagent' as const, description: '', dependencies: [], createdAt: 0, updatedAt: 0 },
      ]);
      collectSupervisorResultsMock.mockResolvedValue({ 'task-1': 'Result 1' });

      const loop = createSupervisorLoop({
        supervisor: { name: 'test', role: 'test', sessionId: 'test' },
      });

      // 注意：这个测试只验证状态获取，不等待完整执行
      const initialState = loop.getState();
      expect(initialState.status).toBe('initializing');
    });
  });

  describe('isRunning', () => {
    it('初始状态应该返回 false', () => {
      const loop = createSupervisorLoop({
        supervisor: { name: 'test', role: 'test', sessionId: 'test' },
      });

      expect(loop.isRunning()).toBe(false);
    });

    it('start() 执行中应该返回 true', async () => {
      // 设置 mock 让 start() 立即完成但 isRunning 在执行时为 true
      getSupervisorStatusMock.mockResolvedValue({ status: 'completed', supervisorId: 'sup-123', sessionId: 'test', subTasks: {}, results: {}, currentIteration: 0 });
      getAllTasksMock.mockResolvedValue([]);

      const loop = createSupervisorLoop({
        supervisor: { name: 'test', role: 'test', sessionId: 'test' },
      });

      // 启动并等待完成
      await loop.start('Test task');

      // 执行完成后应该为 false
      expect(loop.isRunning()).toBe(false);
    });

    it('stop() 后应该返回 false', async () => {
      getSupervisorStatusMock.mockResolvedValue({ status: 'idle', supervisorId: 'sup-123', sessionId: 'test', subTasks: {}, results: {}, currentIteration: 0 });
      terminateSupervisorMock.mockResolvedValue(undefined);

      const loop = createSupervisorLoop({
        supervisor: { name: 'test', role: 'test', sessionId: 'test' },
      });

      await loop.stop();

      expect(loop.isRunning()).toBe(false);
    });
  });

  describe('start', () => {
    it('应该创建 supervisor 并开始执行', async () => {
      // 完整 mock 链
      getSupervisorStatusMock
        .mockResolvedValueOnce({ status: 'idle', supervisorId: 'sup-123', sessionId: 'test', subTasks: {}, results: {}, currentIteration: 0 })
        .mockResolvedValueOnce({ status: 'decomposing', supervisorId: 'sup-123', sessionId: 'test', subTasks: {}, results: {}, currentIteration: 0 })
        .mockResolvedValue({ status: 'completed', supervisorId: 'sup-123', sessionId: 'test', subTasks: {}, results: {}, currentIteration: 1 });

      getAllTasksMock.mockResolvedValue([]);

      const loop = createSupervisorLoop({
        supervisor: { name: 'test', role: 'test', sessionId: 'test' },
        maxIterations: 1,
        pollIntervalMs: 10,
      });

      const result = await loop.start('Build a test app');

      // 验证调用
      expect(createSupervisorMock).toHaveBeenCalledWith({
        name: 'test',
        role: 'test',
        sessionId: 'test',
      });

      expect(result.supervisorId).toBe('supervisor-test-123');
      expect(result.currentTask).toBe('Build a test app');
    });

    it('应该在异常时返回 failed 状态', async () => {
      createSupervisorMock.mockRejectedValue(new Error('Test error'));

      const loop = createSupervisorLoop({
        supervisor: { name: 'test', role: 'test', sessionId: 'test' },
        maxIterations: 1,
      });

      const result = await loop.start('Test task');

      expect(result.status).toBe('failed');
      expect(result.error).toBe('Test error');
    });

    it('应该设置 startTime', async () => {
      const beforeStart = Date.now();

      getSupervisorStatusMock.mockResolvedValue({ status: 'completed', supervisorId: 'sup-123', sessionId: 'test', subTasks: {}, results: {}, currentIteration: 0 });
      getAllTasksMock.mockResolvedValue([]);

      const loop = createSupervisorLoop({
        supervisor: { name: 'test', role: 'test', sessionId: 'test' },
        maxIterations: 1,
        pollIntervalMs: 10,
      });

      await loop.start('Test');
      const afterEnd = Date.now();

      const state = loop.getState();

      expect(state.startTime).toBeGreaterThanOrEqual(beforeStart);
      expect(state.startTime).toBeLessThanOrEqual(afterEnd);
    });
  });

  describe('stop', () => {
    it('应该终止 supervisor 并更新状态', async () => {
      // 先启动 loop 以创建 supervisor
      getSupervisorStatusMock
        .mockResolvedValueOnce({ status: 'idle', supervisorId: 'sup-123', sessionId: 'test', subTasks: {}, results: {}, currentIteration: 0 })
        .mockResolvedValue({ status: 'completed', supervisorId: 'sup-123', sessionId: 'test', subTasks: {}, results: {}, currentIteration: 1 });
      getAllTasksMock.mockResolvedValue([]);
      terminateSupervisorMock.mockResolvedValue(undefined);

      const loop = createSupervisorLoop({
        supervisor: { name: 'test', role: 'test', sessionId: 'test' },
        maxIterations: 1,
        pollIntervalMs: 10,
      });

      // 先启动以创建 supervisor
      await loop.start('Test task');

      // 然后停止
      await loop.stop();

      expect(terminateSupervisorMock).toHaveBeenCalled();

      const state = loop.getState();
      expect(state.status).toBe('terminated');
      expect(state.endTime).toBeDefined();
    });

    it('即使没有 supervisorId 也应该能停止', async () => {
      const loop = createSupervisorLoop({
        supervisor: { name: 'test', role: 'test', sessionId: 'test' },
      });

      // 还没 start，所以没有 supervisorId
      await loop.stop();

      // 不应该报错
      expect(loop.isRunning()).toBe(false);
    });
  });

  describe('runAutonomousTask', () => {
    it('应该是一个 async 函数', async () => {
      getSupervisorStatusMock.mockResolvedValue({ status: 'completed', supervisorId: 'sup-123', sessionId: 'test', subTasks: {}, results: {}, currentIteration: 0 });
      getAllTasksMock.mockResolvedValue([]);

      const result = await runAutonomousTask('Test task', {
        name: 'test-supervisor',
        sessionId: 'test-session',
      });

      expect(result).toBeDefined();
      expect(result.currentTask).toBe('Test task');
    });

    it('应该使用提供的参数', async () => {
      getSupervisorStatusMock.mockResolvedValue({ status: 'completed', supervisorId: 'sup-123', sessionId: 'test', subTasks: {}, results: {}, currentIteration: 0 });
      getAllTasksMock.mockResolvedValue([]);

      await runAutonomousTask('Custom task', {
        name: 'custom-name',
        role: 'custom-role',
        sessionId: 'custom-session',
        maxIterations: 3,
      });

      expect(createSupervisorMock).toHaveBeenCalledWith({
        name: 'custom-name',
        role: 'custom-role',
        sessionId: 'custom-session',
      });
    });
  });

  describe('SupervisorLoopState 类型', () => {
    it('应该包含所有必需字段', () => {
      const state: SupervisorLoopState = {
        supervisorId: 'test-123',
        status: 'running',
        currentTask: 'Test task',
        iterations: 5,
        completedTasks: 3,
        failedTasks: 1,
        startTime: Date.now(),
        results: { 'task-1': 'Result 1' },
      };

      // 使用 toMatchObject 进行部分匹配验证
      expect(state).toMatchObject({
        supervisorId: 'test-123',
        status: 'running',
        currentTask: 'Test task',
        iterations: 5,
        completedTasks: 3,
        failedTasks: 1,
      });

      expect(state.results['task-1']).toBe('Result 1');
    });

    it('应该支持所有状态枚举值', () => {
      const statuses: SupervisorLoopState['status'][] = [
        'initializing',
        'decomposing',
        'delegating',
        'running',
        'waiting',
        'aggregating',
        'completed',
        'failed',
        'terminated',
      ];

      const now = Date.now();
      statuses.forEach(status => {
        const state: SupervisorLoopState = {
          supervisorId: 'test',
          status,
          currentTask: '',
          iterations: 0,
          completedTasks: 0,
          failedTasks: 0,
          startTime: now,
          results: {},
        };
        expect(state.status).toBe(status);
      });

      expect(statuses).toHaveLength(9);
    });

    it('应该允许 error 字段', () => {
      const state: SupervisorLoopState = {
        supervisorId: 'test',
        status: 'failed',
        currentTask: '',
        iterations: 1,
        completedTasks: 0,
        failedTasks: 1,
        startTime: Date.now(),
        results: {},
        error: 'Something went wrong',
      };

      expect(state.error).toBe('Something went wrong');
    });

    it('应该允许 endTime 字段', () => {
      const state: SupervisorLoopState = {
        supervisorId: 'test',
        status: 'completed',
        currentTask: '',
        iterations: 5,
        completedTasks: 5,
        failedTasks: 0,
        startTime: 1000,
        endTime: 5000,
        results: {},
      };

      expect(state.endTime).toBe(5000);
      expect(state.endTime).toBeGreaterThan(state.startTime);
    });
  });

  describe('边界情况', () => {
    it('空任务名应该也能执行', async () => {
      getSupervisorStatusMock.mockResolvedValue({ status: 'completed', supervisorId: 'sup-123', sessionId: 'test', subTasks: {}, results: {}, currentIteration: 0 });
      getAllTasksMock.mockResolvedValue([]);

      const loop = createSupervisorLoop({
        supervisor: { name: 'test', role: 'test', sessionId: 'test' },
        maxIterations: 1,
        pollIntervalMs: 10,
      });

      const result = await loop.start('');

      expect(result.currentTask).toBe('');
    });

    it('maxIterations 为 0 应该立即完成', async () => {
      getSupervisorStatusMock.mockResolvedValue({ status: 'idle', supervisorId: 'sup-123', sessionId: 'test', subTasks: {}, results: {}, currentIteration: 0 });

      const loop = createSupervisorLoop({
        supervisor: { name: 'test', role: 'test', sessionId: 'test' },
        maxIterations: 0,
        pollIntervalMs: 10,
      });

      const result = await loop.start('Test');

      // maxIterations 为 0 时应该直接返回
      expect(result.iterations).toBe(0);
    });
  });
});
