import client from './client';
import type { Task, TaskStatus } from '../../types';

export interface TaskFormData {
  subject: string;
  description: string;
  priority?: number;
  owner?: string;
  blockedBy?: string[];
}

export async function getTasks(filter?: 'all' | TaskStatus): Promise<Task[]> {
  const params = filter && filter !== 'all' ? `?filter=${filter}` : '';
  const response = await client.get(`/tasks${params}`);
  return response.data.tasks;
}

export async function getTask(id: string): Promise<Task> {
  const response = await client.get(`/tasks/${id}`);
  return response.data.task;
}

export async function createTask(data: TaskFormData): Promise<Task> {
  const response = await client.post('/tasks', data);
  return response.data.task;
}

export async function updateTask(id: string, data: Partial<TaskFormData & { status: TaskStatus }>): Promise<Task> {
  const response = await client.put(`/tasks/${id}`, data);
  return response.data.task;
}

export async function updateTaskStatus(id: string, status: TaskStatus): Promise<Task> {
  const response = await client.patch(`/tasks/${id}/status`, { status });
  return response.data.task;
}

export async function deleteTask(id: string): Promise<void> {
  await client.delete(`/tasks/${id}`);
}
