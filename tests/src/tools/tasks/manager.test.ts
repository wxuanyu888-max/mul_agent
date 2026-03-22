/**
 * Task Manager 测试
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { TaskManager, type Task, type TaskCreateParams, type TaskUpdateParams } from '../../../../src/tools/tasks/manager.js';

describe('TaskManager', () => {
  const testDir = path.join(import.meta.dirname, 'test-tasks');

  beforeEach(() => {
    // Create test directory
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Cleanup test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('constructor', () => {
    it('should create manager with default directory', () => {
      const manager = new TaskManager();
      expect(manager).toBeDefined();
    });

    it('should create manager with custom directory', () => {
      const manager = new TaskManager(testDir);
      expect(manager).toBeDefined();
    });

    it('should create directory if not exists', () => {
      const customDir = path.join(testDir, 'subdir');
      new TaskManager(customDir);
      expect(fs.existsSync(customDir)).toBe(true);
    });
  });

  describe('create', () => {
    it('should create task with required fields', () => {
      const manager = new TaskManager(testDir);

      const task = manager.create({ subject: 'Test Task' });

      expect(task.id).toBe(1);
      expect(task.subject).toBe('Test Task');
      expect(task.status).toBe('pending');
      expect(task.priority).toBe(100);
    });

    it('should create task with description', () => {
      const manager = new TaskManager(testDir);

      const task = manager.create({
        subject: 'Test',
        description: 'Task description',
      });

      expect(task.description).toBe('Task description');
    });

    it('should create task with owner', () => {
      const manager = new TaskManager(testDir);

      const task = manager.create({
        subject: 'Test',
        owner: 'user1',
      });

      expect(task.owner).toBe('user1');
    });

    it('should create task with priority', () => {
      const manager = new TaskManager(testDir);

      const task = manager.create({
        subject: 'Test',
        priority: 10,
      });

      expect(task.priority).toBe(10);
    });

    it('should create task with dependencies', () => {
      const manager = new TaskManager(testDir);

      // First create a task to depend on
      const depTask = manager.create({ subject: 'Dependent Task' });

      // Create task that depends on it
      const task = manager.create({
        subject: 'Blocking Task',
        blockedBy: [depTask.id],
      });

      expect(task.blockedBy).toContain(depTask.id);
    });

    it('should increment task ID', () => {
      const manager = new TaskManager(testDir);

      const task1 = manager.create({ subject: 'Task 1' });
      const task2 = manager.create({ subject: 'Task 2' });

      expect(task2.id).toBe(task1.id + 1);
    });

    it('should set timestamps', () => {
      const manager = new TaskManager(testDir);
      const before = Date.now();

      const task = manager.create({ subject: 'Test' });

      expect(task.createdAt).toBeGreaterThanOrEqual(before);
      expect(task.updatedAt).toBeGreaterThanOrEqual(before);
    });
  });

  describe('get', () => {
    it('should return task by ID', () => {
      const manager = new TaskManager(testDir);
      const created = manager.create({ subject: 'Test Task' });

      const task = manager.get(created.id);

      expect(task).not.toBeNull();
      expect(task?.subject).toBe('Test Task');
    });

    it('should return null for non-existent task', () => {
      const manager = new TaskManager(testDir);

      const task = manager.get(999);

      expect(task).toBeNull();
    });
  });

  describe('list', () => {
    it('should return empty array when no tasks', () => {
      const manager = new TaskManager(testDir);

      const tasks = manager.list();

      expect(tasks).toEqual([]);
    });

    it('should return all tasks sorted by ID', () => {
      const manager = new TaskManager(testDir);
      manager.create({ subject: 'Task 1' });
      manager.create({ subject: 'Task 2' });
      manager.create({ subject: 'Task 3' });

      const tasks = manager.list();

      expect(tasks).toHaveLength(3);
      expect(tasks[0].subject).toBe('Task 1');
    });
  });

  describe('update', () => {
    it('should update task status', () => {
      const manager = new TaskManager(testDir);
      const task = manager.create({ subject: 'Test' });

      const updated = manager.update({ task_id: task.id, status: 'in_progress' });

      expect(updated?.status).toBe('in_progress');
    });

    it('should update task subject', () => {
      const manager = new TaskManager(testDir);
      const task = manager.create({ subject: 'Old Subject' });

      const updated = manager.update({ task_id: task.id, subject: 'New Subject' });

      expect(updated?.subject).toBe('New Subject');
    });

    it('should update task description', () => {
      const manager = new TaskManager(testDir);
      const task = manager.create({ subject: 'Test', description: 'Old' });

      const updated = manager.update({ task_id: task.id, description: 'New description' });

      expect(updated?.description).toBe('New description');
    });

    it('should update task owner', () => {
      const manager = new TaskManager(testDir);
      const task = manager.create({ subject: 'Test', owner: 'user1' });

      const updated = manager.update({ task_id: task.id, owner: 'user2' });

      expect(updated?.owner).toBe('user2');
    });

    it('should add blockedBy', () => {
      const manager = new TaskManager(testDir);
      const task = manager.create({ subject: 'Test' });
      const blocker = manager.create({ subject: 'Blocker' });

      const updated = manager.update({
        task_id: task.id,
        add_blocked_by: [blocker.id],
      });

      expect(updated?.blockedBy).toContain(blocker.id);
    });

    it('should remove blockedBy', () => {
      const manager = new TaskManager(testDir);
      const task = manager.create({ subject: 'Test', blockedBy: [1, 2, 3] });

      const updated = manager.update({
        task_id: task.id,
        remove_blocked_by: [2],
      });

      expect(updated?.blockedBy).not.toContain(2);
    });

    it('should return null for non-existent task', () => {
      const manager = new TaskManager(testDir);

      const updated = manager.update({ task_id: 999, status: 'completed' });

      expect(updated).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete task', () => {
      const manager = new TaskManager(testDir);
      const task = manager.create({ subject: 'Test' });

      const result = manager.delete(task.id);

      expect(result).toBe(true);
      expect(manager.get(task.id)).toBeNull();
    });

    it('should return false for non-existent task', () => {
      const manager = new TaskManager(testDir);

      const result = manager.delete(999);

      expect(result).toBe(false);
    });
  });

  describe('listRunnable', () => {
    it('should return pending tasks with no blockers', () => {
      const manager = new TaskManager(testDir);
      manager.create({ subject: 'Ready Task' });
      manager.create({ subject: 'Blocked Task', blockedBy: [1] });

      const ready = manager.listRunnable();

      expect(ready).toHaveLength(1);
      expect(ready[0].subject).toBe('Ready Task');
    });

    it('should exclude in_progress tasks', () => {
      const manager = new TaskManager(testDir);
      const task = manager.create({ subject: 'In Progress' });
      manager.update({ task_id: task.id, status: 'in_progress' });

      const ready = manager.listRunnable();

      expect(ready).toHaveLength(0);
    });
  });

  describe('Task Types', () => {
    it('should accept valid status values', () => {
      const statuses: Task['status'][] = ['pending', 'in_progress', 'completed'];

      statuses.forEach(status => {
        const manager = new TaskManager(testDir);
        const task = manager.create({ subject: 'Test' });
        const updated = manager.update({ task_id: task.id, status });
        expect(updated?.status).toBe(status);
      });
    });
  });
});
