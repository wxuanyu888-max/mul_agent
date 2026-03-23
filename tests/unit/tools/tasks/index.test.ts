/**
 * Task Tool 测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTaskTool, type TaskTool } from '../../../../../src/tools/tasks/index.js';

describe('TaskTool', () => {
  let taskTool: TaskTool;

  beforeEach(() => {
    taskTool = createTaskTool();
  });

  describe('createTaskTool', () => {
    it('should create task tool', () => {
      expect(taskTool).toBeDefined();
      expect(taskTool.name).toBe('task');
    });

    it('should have correct metadata', () => {
      expect(taskTool.label).toBe('Task');
      expect(taskTool.description).toBeDefined();
    });

    it('should have required parameters', () => {
      expect(taskTool.parameters.required).toContain('action');
    });
  });

  describe('execute', () => {
    it('should create task', async () => {
      const result = await taskTool.execute('call-1', {
        action: 'create',
        subject: 'Test Task',
      });

      expect(result.error).toBeNull();
      expect(result.content).toContain('id');
    });

    it('should list tasks', async () => {
      const result = await taskTool.execute('call-1', {
        action: 'list',
      });

      expect(result.error).toBeNull();
      expect(result.content).toBeDefined();
    });

    it('should get task', async () => {
      // First create a task
      const createResult = await taskTool.execute('call-1', {
        action: 'create',
        subject: 'Get Test',
      });

      // Extract task ID from result
      const content = JSON.parse(createResult.content);
      const taskId = content.id;

      // Get the task
      const getResult = await taskTool.execute('call-2', {
        action: 'get',
        task_id: taskId,
      });

      expect(getResult.error).toBeNull();
      expect(getResult.content).toContain('Get Test');
    });

    it('should update task status', async () => {
      // Create task
      const createResult = await taskTool.execute('call-1', {
        action: 'create',
        subject: 'Update Test',
      });

      const content = JSON.parse(createResult.content);
      const taskId = content.id;

      // Update status
      const updateResult = await taskTool.execute('call-2', {
        action: 'update',
        task_id: taskId,
        status: 'completed',
      });

      expect(updateResult.error).toBeNull();
    });

    it('should delete task', async () => {
      // Create task
      const createResult = await taskTool.execute('call-1', {
        action: 'create',
        subject: 'Delete Test',
      });

      const content = JSON.parse(createResult.content);
      const taskId = content.id;

      // Delete task
      const deleteResult = await taskTool.execute('call-2', {
        action: 'delete',
        task_id: taskId,
      });

      expect(deleteResult.error).toBeNull();
    });

    it('should handle ready action', async () => {
      const result = await taskTool.execute('call-1', {
        action: 'ready',
      });

      expect(result.error).toBeNull();
      expect(result.content).toBeDefined();
    });

    it('should return error for invalid action', async () => {
      const result = await taskTool.execute('call-1', {
        action: 'invalid_action',
      });

      expect(result.error).toBeDefined();
    });
  });
});
