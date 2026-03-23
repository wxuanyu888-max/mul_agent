/**
 * Background Manager 测试
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BackgroundManager, type BackgroundTask, type BackgroundNotification } from '../../../src/agents/background.js';

describe('BackgroundManager', () => {
  let manager: BackgroundManager;

  beforeEach(() => {
    manager = new BackgroundManager();
  });

  afterEach(() => {
    // Cleanup - kill all running tasks
    for (const task of manager.listTasks()) {
      if (task.status === 'running') {
        manager.kill(task.id);
      }
    }
  });

  describe('constructor', () => {
    it('should create manager', () => {
      expect(manager).toBeDefined();
    });
  });

  describe('run', () => {
    it('should start background task', () => {
      const taskId = manager.run('echo test');

      expect(taskId).toBeDefined();
      expect(typeof taskId).toBe('string');
    });

    it('should track running task', () => {
      const taskId = manager.run('sleep 1');
      const task = manager.getStatus(taskId);

      expect(task).toBeDefined();
      expect(task?.status).toBe('running');
    });

    it('should accept custom cwd', () => {
      const taskId = manager.run('pwd', '/tmp');

      expect(taskId).toBeDefined();
    });
  });

  describe('getStatus', () => {
    it('should return task by ID', () => {
      const taskId = manager.run('echo test');
      const task = manager.getStatus(taskId);

      expect(task?.id).toBe(taskId);
    });

    it('should return undefined for non-existent task', () => {
      const task = manager.getStatus('nonexistent');

      expect(task).toBeUndefined();
    });
  });

  describe('listTasks', () => {
    it('should return empty initially', () => {
      const tasks = manager.listTasks();

      expect(tasks).toEqual([]);
    });

    it('should return all tasks', () => {
      manager.run('echo 1');
      manager.run('echo 2');

      const tasks = manager.listTasks();

      expect(tasks).toHaveLength(2);
    });
  });

  describe('kill', () => {
    it('should stop running task', async () => {
      const taskId = manager.run('sleep 10');
      const result = manager.kill(taskId);

      expect(result).toBe(true);
    });

    it('should return false for non-existent task', () => {
      const result = manager.kill('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('BackgroundTask type', () => {
    it('should have correct structure', () => {
      const task: BackgroundTask = {
        id: 'task-1',
        command: 'echo test',
        status: 'running',
        startedAt: new Date(),
        output: '',
      };

      expect(task.id).toBe('task-1');
      expect(task.status).toBe('running');
    });

    it('should accept all statuses', () => {
      const statuses: BackgroundTask['status'][] = ['running', 'completed', 'failed', 'timeout'];

      statuses.forEach(status => {
        const task: BackgroundTask = {
          id: 't1',
          command: 'echo',
          status,
          startedAt: new Date(),
          output: '',
        };
        expect(task.status).toBe(status);
      });
    });
  });

  describe('BackgroundNotification type', () => {
    it('should define notification', () => {
      const notification: BackgroundNotification = {
        taskId: 'task-1',
        status: 'completed',
        output: 'output',
      };

      expect(notification.taskId).toBe('task-1');
    });
  });
});
