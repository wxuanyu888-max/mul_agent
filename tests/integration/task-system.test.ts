// Task System 集成测试 - 测试任务图功能
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { TaskManager, getTaskManager, resetTaskManager } from "../../src/tools/tasks/manager.js";
import path from 'path';
import fs from 'fs';

describe("Task System Integration", () => {
  let taskManager: TaskManager;
  const testDir = path.join(process.cwd(), 'storage', 'tasks-test');

  beforeEach(() => {
    // 创建测试目录
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    taskManager = new TaskManager(testDir);
  });

  afterEach(() => {
    // 清理测试目录
    if (fs.existsSync(testDir)) {
      const files = fs.readdirSync(testDir);
      for (const file of files) {
        fs.unlinkSync(path.join(testDir, file));
      }
      fs.rmdirSync(testDir);
    }
  });

  describe("Task Creation", () => {
    it("should create a task with basic fields", () => {
      const task = taskManager.create({
        subject: "Test Task",
        description: "This is a test task",
      });

      expect(task.id).toBe(1);
      expect(task.subject).toBe("Test Task");
      expect(task.description).toBe("This is a test task");
      expect(task.status).toBe("pending");
      expect(task.blockedBy).toEqual([]);
      expect(task.blocks).toEqual([]);
    });

    it("should auto-increment task IDs", () => {
      const task1 = taskManager.create({ subject: "Task 1" });
      const task2 = taskManager.create({ subject: "Task 2" });
      const task3 = taskManager.create({ subject: "Task 3" });

      expect(task1.id).toBe(1);
      expect(task2.id).toBe(2);
      expect(task3.id).toBe(3);
    });

    it("should create tasks with dependencies", () => {
      const task1 = taskManager.create({ subject: "Task 1" });
      const task2 = taskManager.create({ subject: "Task 2", blockedBy: [1] });

      expect(task2.blockedBy).toEqual([1]);

      // Check that task1 has blocks relationship
      const updatedTask1 = taskManager.get(1);
      expect(updatedTask1?.blocks).toContain(2);
    });
  });

  describe("Task Retrieval", () => {
    it("should get a task by ID", () => {
      taskManager.create({ subject: "Test Task" });
      const task = taskManager.get(1);

      expect(task).not.toBeNull();
      expect(task?.subject).toBe("Test Task");
    });

    it("should return null for non-existent task", () => {
      const task = taskManager.get(999);
      expect(task).toBeNull();
    });

    it("should list all tasks", () => {
      taskManager.create({ subject: "Task 1" });
      taskManager.create({ subject: "Task 2" });
      taskManager.create({ subject: "Task 3" });

      const tasks = taskManager.list();
      expect(tasks.length).toBe(3);
    });
  });

  describe("Task Update", () => {
    it("should update task status", () => {
      taskManager.create({ subject: "Test Task" });

      const updated = taskManager.update({
        task_id: 1,
        status: 'in_progress',
      });

      expect(updated?.status).toBe('in_progress');
    });

    it("should update task details", () => {
      taskManager.create({ subject: "Original" });

      const updated = taskManager.update({
        task_id: 1,
        subject: "Updated",
        description: "New description",
        owner: "test-user",
      });

      expect(updated?.subject).toBe("Updated");
      expect(updated?.description).toBe("New description");
      expect(updated?.owner).toBe("test-user");
    });

    it("should add dependencies", () => {
      taskManager.create({ subject: "Task 1" });
      taskManager.create({ subject: "Task 2" });

      taskManager.update({
        task_id: 2,
        add_blocked_by: [1],
      });

      const task = taskManager.get(2);
      expect(task?.blockedBy).toContain(1);
    });

    it("should remove dependencies", () => {
      taskManager.create({ subject: "Task 1" });
      taskManager.create({ subject: "Task 2", blockedBy: [1] });

      taskManager.update({
        task_id: 2,
        remove_blocked_by: [1],
      });

      const task = taskManager.get(2);
      expect(task?.blockedBy).not.toContain(1);
    });
  });

  describe("Dependency Management", () => {
    it("should auto-clear dependencies when task is completed", () => {
      const task1 = taskManager.create({ subject: "Task 1" });
      const task2 = taskManager.create({ subject: "Task 2", blockedBy: [1] });
      const task3 = taskManager.create({ subject: "Task 3", blockedBy: [1] });

      // Complete task 1
      taskManager.update({ task_id: 1, status: 'completed' });

      // Task 2 and 3 should have blockedBy cleared
      const updatedTask2 = taskManager.get(2);
      const updatedTask3 = taskManager.get(3);

      expect(updatedTask2?.blockedBy).not.toContain(1);
      expect(updatedTask3?.blockedBy).not.toContain(1);

      // Task 1 should have blocks cleared
      const updatedTask1 = taskManager.get(1);
      expect(updatedTask1?.blocks).toEqual([]);
    });

    it("should track complex dependency chains", () => {
      // Create: 1 -> 2 -> 4 and 1 -> 3 -> 4
      taskManager.create({ subject: "Task 1" });
      taskManager.create({ subject: "Task 2", blockedBy: [1] });
      taskManager.create({ subject: "Task 3", blockedBy: [1] });
      taskManager.create({ subject: "Task 4", blockedBy: [2, 3] });

      const task4 = taskManager.get(4);
      expect(task4?.blockedBy).toEqual(expect.arrayContaining([2, 3]));

      // Complete task 1 should clear task 2 and 3's blockedBy
      taskManager.update({ task_id: 1, status: 'completed' });

      const task2 = taskManager.get(2);
      const task3 = taskManager.get(3);
      expect(task2?.blockedBy).not.toContain(1);
      expect(task3?.blockedBy).not.toContain(1);

      // But task 4 should still be blocked (by 2 and 3 which are not completed)
      const task4After = taskManager.get(4);
      expect(task4After?.blockedBy).toEqual(expect.arrayContaining([2, 3]));
    });
  });

  describe("Task Queries", () => {
    it("should list runnable tasks", () => {
      taskManager.create({ subject: "Task 1" });
      taskManager.create({ subject: "Task 2", blockedBy: [1] });
      taskManager.create({ subject: "Task 3" });

      const runnable = taskManager.listRunnable();
      // Only task 1 and 3 are runnable (not blocked)
      expect(runnable.length).toBe(2);
    });

    it("should list blocked tasks", () => {
      taskManager.create({ subject: "Task 1" });
      taskManager.create({ subject: "Task 2", blockedBy: [1] });
      taskManager.create({ subject: "Task 3", blockedBy: [1] });

      const blocked = taskManager.listBlocked();
      expect(blocked.length).toBe(2);
    });

    it("should get task statistics", () => {
      taskManager.create({ subject: "Task 1" });
      taskManager.create({ subject: "Task 2" });
      taskManager.update({ task_id: 1, status: 'in_progress' });
      taskManager.update({ task_id: 2, status: 'completed' });

      const stats = taskManager.getStats();
      expect(stats.total).toBe(2);
      expect(stats.pending).toBe(0);
      expect(stats.inProgress).toBe(1);
      expect(stats.completed).toBe(1);
    });
  });

  describe("Task Deletion", () => {
    it("should delete a task", () => {
      taskManager.create({ subject: "Task 1" });
      taskManager.create({ subject: "Task 2", blockedBy: [1] });

      const deleted = taskManager.delete(1);
      expect(deleted).toBe(true);

      const task = taskManager.get(1);
      expect(task).toBeNull();

      // Task 2 should have blockedBy cleared
      const task2 = taskManager.get(2);
      expect(task2?.blockedBy).not.toContain(1);
    });

    it("should return false for non-existent task", () => {
      const deleted = taskManager.delete(999);
      expect(deleted).toBe(false);
    });
  });
});

describe("Task Tools", () => {
  it("should export task tool creators", async () => {
    const {
      createTaskCreateTool,
      createTaskUpdateTool,
      createTaskListTool,
      createTaskGetTool,
    } = await import("../../src/tools/tasks/index.js");

    expect(typeof createTaskCreateTool).toBe('function');
    expect(typeof createTaskUpdateTool).toBe('function');
    expect(typeof createTaskListTool).toBe('function');
    expect(typeof createTaskGetTool).toBe('function');
  });

  it("should create tools with correct names", async () => {
    const { createTaskCreateTool, createTaskUpdateTool, createTaskListTool, createTaskGetTool } = await import("../../src/tools/tasks/index.js");

    expect(createTaskCreateTool().name).toBe('task_create');
    expect(createTaskUpdateTool().name).toBe('task_update');
    expect(createTaskListTool().name).toBe('task_list');
    expect(createTaskGetTool().name).toBe('task_get');
  });
});
