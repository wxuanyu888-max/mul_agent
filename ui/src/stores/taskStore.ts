import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Task, TaskFormData, TaskStatus } from '../types';
import * as tasksApi from '../services/endpoints/tasks';

interface TaskState {
  tasks: Task[];
  selectedTaskId: string | null;
  filter: 'all' | TaskStatus;
  isLoading: boolean;

  // Actions
  fetchTasks: () => Promise<void>;
  addTask: (data: TaskFormData) => Promise<Task>;
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  setTaskStatus: (id: string, status: TaskStatus) => Promise<void>;
  setSelectedTaskId: (id: string | null) => void;
  setFilter: (filter: 'all' | TaskStatus) => void;
  getTask: (id: string) => Task | undefined;
  getFilteredTasks: () => Task[];
}

function generateId(): string {
  return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export const useTaskStore = create<TaskState>()(
  persist(
    (set, get) => ({
      tasks: [],
      selectedTaskId: null,
      filter: 'all',
      isLoading: false,

      fetchTasks: async () => {
        set({ isLoading: true });
        try {
          const tasks = await tasksApi.getTasks();
          set({ tasks, isLoading: false });
        } catch (error) {
          console.error('Failed to fetch tasks:', error);
          set({ isLoading: false });
        }
      },

      addTask: async (data: TaskFormData) => {
        // Optimistic update
        const now = Date.now();
        const tempId = generateId();
        const optimisticTask: Task = {
          id: tempId,
          subject: data.subject,
          description: data.description,
          status: 'pending',
          priority: data.priority ?? 100,
          owner: data.owner,
          blockedBy: data.blockedBy || [],
          blocks: [],
          createdAt: now,
          updatedAt: now,
        };

        set((state) => {
          const blockedByIds = data.blockedBy || [];
          const updatedTasks = state.tasks.map((t) =>
            blockedByIds.includes(t.id)
              ? { ...t, blocks: [...t.blocks, tempId] }
              : t
          );
          return { tasks: [...updatedTasks, optimisticTask] };
        });

        try {
          // Call API
          const newTask = await tasksApi.createTask(data);
          // Replace optimistic task with real task
          set((state) => ({
            tasks: state.tasks.map(t => t.id === tempId ? newTask : t)
          }));
          return newTask;
        } catch (error) {
          // Rollback on error
          set((state) => ({
            tasks: state.tasks.filter(t => t.id !== tempId)
          }));
          console.error('Failed to create task:', error);
          throw error;
        }
      },

      updateTask: async (id: string, updates: Partial<Task>) => {
        // Optimistic update
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === id
              ? { ...task, ...updates, updatedAt: Date.now() }
              : task
          ),
        }));

        try {
          await tasksApi.updateTask(id, updates);
        } catch (error) {
          console.error('Failed to update task:', error);
          throw error;
        }
      },

      deleteTask: async (id: string) => {
        // Optimistic update
        set((state) => {
          const updatedTasks = state.tasks
            .map((t) => ({
              ...t,
              blockedBy: t.blockedBy.filter((bid) => bid !== id),
              blocks: t.blocks.filter((bid) => bid !== id),
            }))
            .filter((t) => t.id !== id);

          return {
            tasks: updatedTasks,
            selectedTaskId: state.selectedTaskId === id ? null : state.selectedTaskId,
          };
        });

        try {
          await tasksApi.deleteTask(id);
        } catch (error) {
          console.error('Failed to delete task:', error);
          throw error;
        }
      },

      setTaskStatus: async (id: string, status: TaskStatus) => {
        // Optimistic update
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === id
              ? { ...task, status, updatedAt: Date.now() }
              : task
          ),
        }));

        try {
          await tasksApi.updateTaskStatus(id, status);
        } catch (error) {
          console.error('Failed to update task status:', error);
          throw error;
        }
      },

      setSelectedTaskId: (id: string | null) =>
        set({ selectedTaskId: id }),

      setFilter: (filter: 'all' | TaskStatus) =>
        set({ filter }),

      getTask: (id: string) =>
        get().tasks.find((task) => task.id === id),

      getFilteredTasks: () => {
        const { tasks, filter } = get();
        if (filter === 'all') return tasks;
        return tasks.filter((task) => task.status === filter);
      },
    }),
    {
      name: 'task-storage',
      partialize: (state) => ({
        selectedTaskId: state.selectedTaskId,
      }),
    }
  )
);
