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
  SESSIONS: 'sessions',
  TASKS: 'tasks',
  MEMORY: 'memory',
  PROMPTS: 'prompts',
  LOGS: 'logs',
  WORKSPACE: 'workspace',
  CHECKPOINTS: 'checkpoints',
  CRON_JOBS: 'cron-jobs',
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
 * Get workspace storage path
 */
export function getWorkspacePath(...segments: string[]): string {
  return getStoragePath(STORAGE_DIRS.WORKSPACE, ...segments);
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
