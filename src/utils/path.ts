/**
 * Unified Path Management
 *
 * Provides consistent path resolution across the application.
 * All storage paths should go through this module to ensure
 * consistency and easy configuration.
 */

import path from 'node:path';

/**
 * Get the project root directory.
 * Handles both development (src/) and production (dist/) scenarios.
 */
export function getProjectRoot(): string {
  const cwd = process.cwd();

  // If we're running from src/ or dist/, go up to project root
  if (cwd.includes('/src/') || cwd.includes('/dist/')) {
    return path.resolve(cwd, '..');
  }

  // If cwd already points to project root
  if (cwd.includes('mul_agent') || cwd.endsWith('mul_agent')) {
    return cwd;
  }

  // Default to current directory
  return cwd;
}

/**
 * Storage directory names
 */
export const STORAGE_DIRS = {
  SESSIONS: 'agent/sessions',
  TASKS: 'agent/sessions', // tasks 在 session 目录下
  MEMORY: 'memory/memory',
  PROMPTS: 'config/prompts',
  LOGS: 'runtime/logs',
  WORKSPACE: 'agent/sessions', // session workspace 在 session 目录下
  GLOBAL_WORKSPACE: 'runtime/workspace', // 全局 workspace（工具默认使用）
  CHECKPOINTS: 'runtime/checkpoints',
  SKILLS: 'config/skills',
  TEAMMATES: 'config/teammates',
  LLM_LOGS: 'runtime/llm_logs',
  LLM_USE: 'runtime/llm_use',
  CONFIG: 'config',
  CRON_JOBS: 'agent/cron-jobs', // 定时任务（agent 级别全局）
} as const;

/**
 * Get the storage base path
 */
export function getStoragePath(...segments: string[]): string {
  return path.join(getProjectRoot(), 'storage', ...segments);
}

/**
 * Get sessions storage path
 */
export function getSessionsPath(...segments: string[]): string {
  return getStoragePath(STORAGE_DIRS.SESSIONS, ...segments);
}

/**
 * Get tasks storage path
 */
export function getTasksPath(...segments: string[]): string {
  return getStoragePath(STORAGE_DIRS.TASKS, ...segments);
}

/**
 * Get memory storage path
 */
export function getMemoryPath(...segments: string[]): string {
  return getStoragePath(STORAGE_DIRS.MEMORY, ...segments);
}

/**
 * Get prompts storage path
 */
export function getPromptsPath(...segments: string[]): string {
  return getStoragePath(STORAGE_DIRS.PROMPTS, ...segments);
}

/**
 * Get logs storage path
 */
export function getLogsPath(...segments: string[]): string {
  return getStoragePath(STORAGE_DIRS.LOGS, ...segments);
}

/**
 * Get session workspace storage path (在 session 目录下)
 */
export function getSessionWorkspacePath(sessionId: string, ...segments: string[]): string {
  return getStoragePath(STORAGE_DIRS.SESSIONS, sessionId, 'workspace', ...segments);
}

/**
 * Get session tasks storage path (在 session 目录下)
 */
export function getSessionTasksPath(sessionId: string, ...segments: string[]): string {
  return getStoragePath(STORAGE_DIRS.SESSIONS, sessionId, 'tasks', ...segments);
}

/**
 * Get global workspace storage path (运行时全局工作区)
 */
export function getGlobalWorkspacePath(...segments: string[]): string {
  return getStoragePath(STORAGE_DIRS.GLOBAL_WORKSPACE, ...segments);
}

// 保留原有函数用于向后兼容
export function getWorkspacePath(...segments: string[]): string {
  return getGlobalWorkspacePath(...segments);
}

/**
 * Get checkpoints storage path
 */
export function getCheckpointsPath(...segments: string[]): string {
  return getStoragePath(STORAGE_DIRS.CHECKPOINTS, ...segments);
}

/**
 * Get cron jobs storage path
 */
export function getCronPath(...segments: string[]): string {
  return getStoragePath(STORAGE_DIRS.CRON_JOBS, ...segments);
}
