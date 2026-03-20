/**
 * Tasks API Routes
 *
 * 读取后端Task工具存储的任务数据
 */

import { Router, Request, Response } from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';

type TaskStatus = 'pending' | 'in_progress' | 'completed';

interface Task {
  id: number;
  subject: string;
  description: string;
  status: TaskStatus;
  priority: number;
  owner: string;
  blockedBy: number[];
  blocks: number[];
  createdAt: number;
  updatedAt: number;
}

// Tasks storage directory (same as TaskManager)
const TASKS_DIR = path.join(process.cwd(), 'storage', 'tasks');

export function createTasksRouter(): Router {
  const router = Router();

  /**
   * Load all tasks from files
   */
  async function loadTasks(): Promise<Task[]> {
    try {
      const files = await fs.readdir(TASKS_DIR);
      const tasks: Task[] = [];

      for (const file of files) {
        if (file.startsWith('task_') && file.endsWith('.json')) {
          const content = await fs.readFile(path.join(TASKS_DIR, file), 'utf-8');
          tasks.push(JSON.parse(content));
        }
      }

      return tasks.sort((a, b) => a.id - b.id);
    } catch {
      return [];
    }
  }

  // GET /tasks - Get all tasks
  router.get('/tasks', async (req: Request, res: Response) => {
    const tasks = await loadTasks();

    const filter = req.query.filter as string;
    let filteredTasks = tasks;

    if (filter && filter !== 'all') {
      filteredTasks = tasks.filter(t => t.status === filter);
    }

    // Transform to frontend format
    const transformedTasks = filteredTasks.map(t => ({
      id: `task_${t.id}`,
      subject: t.subject,
      description: t.description,
      status: t.status,
      owner: t.owner,
      blockedBy: t.blockedBy.map(id => `task_${id}`),
      blocks: t.blocks.map(id => `task_${id}`),
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }));

    const stats = {
      total: tasks.length,
      pending: tasks.filter(t => t.status === 'pending').length,
      in_progress: tasks.filter(t => t.status === 'in_progress').length,
      completed: tasks.filter(t => t.status === 'completed').length,
    };

    res.json({ tasks: transformedTasks, stats });
  });

  // GET /tasks/:id - Get single task
  router.get('/tasks/:id', async (req: Request, res: Response) => {
    const idStr = req.params.id as string;
    const taskId = parseInt(idStr.replace('task_', ''), 10);

    if (isNaN(taskId)) {
      res.status(400).json({ error: 'Invalid task ID' });
      return;
    }

    const tasks = await loadTasks();
    const task = tasks.find(t => t.id === taskId);

    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    res.json({
      task: {
        id: `task_${task.id}`,
        subject: task.subject,
        description: task.description,
        status: task.status,
        owner: task.owner,
        blockedBy: task.blockedBy.map(id => `task_${id}`),
        blocks: task.blocks.map(id => `task_${id}`),
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
      }
    });
  });

  // POST /tasks - Create new task (using TaskManager would be better, but for API compatibility)
  router.post('/tasks', async (req: Request, res: Response) => {
    const { subject, description, owner, blockedBy, priority } = req.body;

    if (!subject) {
      res.status(400).json({ error: 'Subject is required' });
      return;
    }

    // Generate new task ID
    const tasks = await loadTasks();
    const maxId = tasks.reduce((max, t) => Math.max(max, t.id), 0);
    const newId = maxId + 1;
    const now = Date.now();

    // Parse blockedBy IDs
    const parseId = (id: string): number => {
      const parsed = parseInt(String(id).replace('task_', ''), 10);
      return isNaN(parsed) ? 0 : parsed;
    };
    const blockedByIds: number[] = (blockedBy || []).map(parseId).filter((id: number) => id > 0);

    const newTask: Task = {
      id: newId,
      subject,
      description: description || '',
      status: 'pending',
      priority: priority ?? 100,
      owner: owner || '',
      blockedBy: blockedByIds,
      blocks: [],
      createdAt: now,
      updatedAt: now,
    };

    // Update blocked tasks
    for (const blockedId of blockedByIds) {
      const blockedTask = tasks.find(t => t.id === blockedId);
      if (blockedTask) {
        blockedTask.blocks.push(newId);
        blockedTask.updatedAt = now;
        await fs.writeFile(
          path.join(TASKS_DIR, `task_${blockedId}.json`),
          JSON.stringify(blockedTask, null, 2)
        );
      }
    }

    // Save new task
    await fs.writeFile(
      path.join(TASKS_DIR, `task_${newId}.json`),
      JSON.stringify(newTask, null, 2)
    );

    res.json({
      task: {
        id: `task_${newTask.id}`,
        subject: newTask.subject,
        description: newTask.description,
        status: newTask.status,
        owner: newTask.owner,
        blockedBy: newTask.blockedBy.map(id => `task_${id}`),
        blocks: [],
        createdAt: newTask.createdAt,
        updatedAt: newTask.updatedAt,
      }
    });
  });

  // PATCH /tasks/:id/status - Update task status
  router.patch('/tasks/:id/status', async (req: Request, res: Response) => {
    const idStr = req.params.id as string;
    const taskId = parseInt(idStr.replace('task_', ''), 10);
    const { status } = req.body;

    if (isNaN(taskId)) {
      res.status(400).json({ error: 'Invalid task ID' });
      return;
    }

    if (!status) {
      res.status(400).json({ error: 'Status is required' });
      return;
    }

    const tasks = await loadTasks();
    const taskIndex = tasks.findIndex(t => t.id === taskId);

    if (taskIndex === -1) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    const now = Date.now();
    tasks[taskIndex].status = status;
    tasks[taskIndex].updatedAt = now;

    // If completed, clear dependencies
    if (status === 'completed') {
      // Remove from other tasks' blockedBy and blocks
      for (const t of tasks) {
        let updated = false;
        t.blockedBy = t.blockedBy.filter(id => {
          if (id === taskId) { updated = true; return false; }
          return true;
        });
        t.blocks = t.blocks.filter(id => {
          if (id === taskId) { updated = true; return false; }
          return true;
        });
        if (updated) {
          t.updatedAt = now;
          await fs.writeFile(
            path.join(TASKS_DIR, `task_${t.id}.json`),
            JSON.stringify(t, null, 2)
          );
        }
      }
    }

    const task = tasks[taskIndex];
    await fs.writeFile(
      path.join(TASKS_DIR, `task_${taskId}.json`),
      JSON.stringify(task, null, 2)
    );

    res.json({
      task: {
        id: `task_${task.id}`,
        subject: task.subject,
        description: task.description,
        status: task.status,
        owner: task.owner,
        blockedBy: task.blockedBy.map(id => `task_${id}`),
        blocks: task.blocks.map(id => `task_${id}`),
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
      }
    });
  });

  // DELETE /tasks/:id - Delete task
  router.delete('/tasks/:id', async (req: Request, res: Response) => {
    const idStr = req.params.id as string;
    const taskId = parseInt(idStr.replace('task_', ''), 10);

    if (isNaN(taskId)) {
      res.status(400).json({ error: 'Invalid task ID' });
      return;
    }

    const tasks = await loadTasks();
    const task = tasks.find(t => t.id === taskId);

    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    // Remove from other tasks
    for (const t of tasks) {
      let updated = false;
      t.blockedBy = t.blockedBy.filter(id => {
        if (id === taskId) { updated = true; return false; }
        return true;
      });
      t.blocks = t.blocks.filter(id => {
        if (id === taskId) { updated = true; return false; }
        return true;
      });
      if (updated) {
        await fs.writeFile(
          path.join(TASKS_DIR, `task_${t.id}.json`),
          JSON.stringify(t, null, 2)
        );
      }
    }

    // Delete task file
    await fs.unlink(path.join(TASKS_DIR, `task_${taskId}.json`));

    res.json({ success: true });
  });

  return router;
}
