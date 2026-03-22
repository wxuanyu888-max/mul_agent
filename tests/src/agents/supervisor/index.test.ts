/**
 * Supervisor 模块测试 - 多 Agent 协作系统
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  type NodeInfo,
  type NodeStatus,
  type SubTask,
  type SubTaskStatus,
  type SupervisorConfig,
  type SupervisorState,
  SupervisorStatus,
} from '../../../../src/agents/supervisor/types.js';

// Mock node:crypto
vi.mock('node:crypto', () => ({
  randomUUID: vi.fn().mockReturnValue('test-uuid-1234'),
}));

// Mock node:fs/promises
vi.mock('node:fs/promises', () => ({
  default: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    unlink: vi.fn(),
    mkdir: vi.fn(),
    readdir: vi.fn(),
    rmdir: vi.fn(),
    access: vi.fn(),
  },
}));

// Mock utils/file-lock
vi.mock('../../../../src/utils/file-lock.js', () => ({
  atomicReadJson: vi.fn().mockResolvedValue(null),
  atomicWriteJson: vi.fn().mockResolvedValue(undefined),
  ensureDir: vi.fn().mockResolvedValue(undefined),
  withFileLock: vi.fn().mockImplementation(async (fn) => fn()),
}));

// Mock utils/path
vi.mock('../../../../src/utils/path.js', () => ({
  getSessionsPath: vi.fn().mockReturnValue('/mock/sessions'),
}));

describe('Supervisor Types', () => {
  describe('NodeType', () => {
    it('should allow supervisor, subagent, teammate types', () => {
      const types: NodeInfo['type'][] = ['supervisor', 'subagent', 'teammate'];
      expect(types).toContain('supervisor');
      expect(types).toContain('subagent');
      expect(types).toContain('teammate');
    });
  });

  describe('NodeStatus', () => {
    it('should allow correct status values', () => {
      const statuses: NodeStatus[] = ['registered', 'running', 'idle', 'completed', 'failed', 'terminated'];
      expect(statuses).toContain('registered');
      expect(statuses).toContain('running');
      expect(statuses).toContain('idle');
      expect(statuses).toContain('completed');
      expect(statuses).toContain('failed');
      expect(statuses).toContain('terminated');
    });
  });

  describe('SubTaskStatus', () => {
    it('should allow correct subtask status values', () => {
      const statuses: SubTaskStatus[] = ['pending', 'running', 'completed', 'failed', 'cancelled'];
      expect(statuses).toContain('pending');
      expect(statuses).toContain('running');
      expect(statuses).toContain('completed');
      expect(statuses).toContain('failed');
      expect(statuses).toContain('cancelled');
    });
  });

  describe('SupervisorStatus', () => {
    it('should allow correct supervisor status values', () => {
      const statuses: SupervisorStatus[] = ['idle', 'decomposing', 'delegating', 'waiting', 'aggregating', 'completed'];
      expect(statuses).toContain('idle');
      expect(statuses).toContain('decomposing');
      expect(statuses).toContain('delegating');
      expect(statuses).toContain('waiting');
      expect(statuses).toContain('aggregating');
      expect(statuses).toContain('completed');
    });
  });

  describe('NodeInfo', () => {
    it('should create valid node info', () => {
      const node: NodeInfo = {
        id: 'node-1',
        name: 'test-node',
        type: 'supervisor',
        status: 'registered',
        sessionId: 'session-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      expect(node.id).toBe('node-1');
      expect(node.name).toBe('test-node');
      expect(node.type).toBe('supervisor');
      expect(node.status).toBe('registered');
      expect(node.sessionId).toBe('session-1');
    });

    it('should allow optional parentId and metadata', () => {
      const node: NodeInfo = {
        id: 'node-2',
        name: 'child-node',
        type: 'subagent',
        status: 'running',
        sessionId: 'session-1',
        parentId: 'parent-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata: { key: 'value' },
      };

      expect(node.parentId).toBe('parent-1');
      expect(node.metadata).toEqual({ key: 'value' });
    });
  });

  describe('SubTask', () => {
    it('should create valid subtask', () => {
      const task: SubTask = {
        id: 'task-1',
        name: 'test-task',
        description: 'A test task',
        type: 'subagent',
        status: 'pending',
        dependencies: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      expect(task.id).toBe('task-1');
      expect(task.name).toBe('test-task');
      expect(task.type).toBe('subagent');
      expect(task.status).toBe('pending');
      expect(task.dependencies).toEqual([]);
    });

    it('should allow dependencies between tasks', () => {
      const task: SubTask = {
        id: 'task-2',
        name: 'dependent-task',
        description: 'Task with dependencies',
        type: 'teammate',
        status: 'pending',
        dependencies: ['task-1'],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      expect(task.dependencies).toEqual(['task-1']);
    });

    it('should allow result and error fields', () => {
      const task: SubTask = {
        id: 'task-3',
        name: 'completed-task',
        description: 'Task with result',
        type: 'subagent',
        status: 'completed',
        result: 'Task completed successfully',
        dependencies: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      expect(task.result).toBe('Task completed successfully');
    });
  });

  describe('SupervisorConfig', () => {
    it('should create valid supervisor config', () => {
      const config: SupervisorConfig = {
        name: 'main-supervisor',
        role: 'orchestrator',
        sessionId: 'session-1',
        maxConcurrentSubtasks: 5,
      };

      expect(config.name).toBe('main-supervisor');
      expect(config.role).toBe('orchestrator');
      expect(config.sessionId).toBe('session-1');
      expect(config.maxConcurrentSubtasks).toBe(5);
    });

    it('should allow optional maxConcurrentSubtasks', () => {
      const config: SupervisorConfig = {
        name: 'simple-supervisor',
        role: 'coordinator',
        sessionId: 'session-1',
      };

      expect(config.maxConcurrentSubtasks).toBeUndefined();
    });
  });

  describe('SupervisorState', () => {
    it('should create valid supervisor state', () => {
      const state: SupervisorState = {
        supervisorId: 'sup-1',
        sessionId: 'session-1',
        status: 'idle',
        subTasks: {},
        results: {},
        currentIteration: 0,
      };

      expect(state.supervisorId).toBe('sup-1');
      expect(state.sessionId).toBe('session-1');
      expect(state.status).toBe('idle');
      expect(state.subTasks).toEqual({});
      expect(state.results).toEqual({});
      expect(state.currentIteration).toBe(0);
    });

    it('should track subTasks and results', () => {
      const task: SubTask = {
        id: 'task-1',
        name: 'test-task',
        description: 'A test task',
        type: 'subagent',
        status: 'completed',
        result: 'result-1',
        dependencies: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const state: SupervisorState = {
        supervisorId: 'sup-1',
        sessionId: 'session-1',
        status: 'aggregating',
        subTasks: { 'task-1': task },
        results: { 'task-1': 'result-1' },
        currentIteration: 1,
      };

      expect(Object.keys(state.subTasks)).toHaveLength(1);
      expect(Object.keys(state.results)).toHaveLength(1);
      expect(state.status).toBe('aggregating');
      expect(state.currentIteration).toBe(1);
    });
  });
});

describe('Supervisor Index Exports', () => {
  it('should export createSupervisor function', async () => {
    const module = await import('../../../../src/agents/supervisor/index.js');
    expect(typeof module.createSupervisor).toBe('function');
  });

  it('should export decomposeTasks function', async () => {
    const module = await import('../../../../src/agents/supervisor/index.js');
    expect(typeof module.decomposeTasks).toBe('function');
  });

  it('should export delegateTask function', async () => {
    const module = await import('../../../../src/agents/supervisor/index.js');
    expect(typeof module.delegateTask).toBe('function');
  });

  it('should export updateTask function', async () => {
    const module = await import('../../../../src/agents/supervisor/index.js');
    expect(typeof module.updateTask).toBe('function');
  });

  it('should export getTaskStatus function', async () => {
    const module = await import('../../../../src/agents/supervisor/index.js');
    expect(typeof module.getTaskStatus).toBe('function');
  });

  it('should export getAllTasks function', async () => {
    const module = await import('../../../../src/agents/supervisor/index.js');
    expect(typeof module.getAllTasks).toBe('function');
  });

  it('should export collectSupervisorResults function', async () => {
    const module = await import('../../../../src/agents/supervisor/index.js');
    expect(typeof module.collectSupervisorResults).toBe('function');
  });

  it('should export terminateSupervisor function', async () => {
    const module = await import('../../../../src/agents/supervisor/index.js');
    expect(typeof module.terminateSupervisor).toBe('function');
  });

  it('should export getSupervisorStatus function', async () => {
    const module = await import('../../../../src/agents/supervisor/index.js');
    expect(typeof module.getSupervisorStatus).toBe('function');
  });

  it('should export SupervisorManager and NodeRegistry classes', async () => {
    const module = await import('../../../../src/agents/supervisor/index.js');
    expect(typeof module.SupervisorManager).toBe('function');
    expect(typeof module.NodeRegistry).toBe('function');
  });

  it('should export getSupervisorManager and getNodeRegistry functions', async () => {
    const module = await import('../../../../src/agents/supervisor/index.js');
    expect(typeof module.getSupervisorManager).toBe('function');
    expect(typeof module.getNodeRegistry).toBe('function');
  });
});
