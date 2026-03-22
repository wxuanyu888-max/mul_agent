/**
 * File Lock and Atomic Write Utilities
 *
 * Provides:
 * - File locking for concurrent access control
 * - Atomic write operations (write to temp file, then rename)
 * - Atomic JSON read/write operations
 * - Atomic read-modify-write operations
 */

import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { createStorageError, StorageErrorCode } from '../storage/repository.js';

const LOCK_STALE_MS = 30000; // 30 seconds stale detection
const LOCK_EXTENSION = '.lock';

/**
 * Simple file lock implementation using .lock files.
 * Uses a cooperative locking scheme with stale detection.
 */
export class FileLock {
  private lockPath: string;
  private locked = false;

  constructor(filePath: string) {
    this.lockPath = filePath + LOCK_EXTENSION;
  }

  /**
   * Check if file exists using fs.access
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Acquire the lock with timeout
   */
  async acquire(timeoutMs = 5000): Promise<boolean> {
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      try {
        // Check if lock file exists
        const exists = await this.fileExists(this.lockPath);

        if (exists) {
          // Lock exists, check if it's stale by reading its content
          try {
            const content = await fs.readFile(this.lockPath, 'utf-8');
            const lockAge = Date.now() - parseInt(content, 10);

            if (lockAge > LOCK_STALE_MS) {
              // Lock is stale, try to remove it
              try {
                await fs.unlink(this.lockPath);
              } catch {
                // Another process might have removed it
              }
            }
          } catch {
            // Can't read lock file, might be being modified, wait a bit
            await this.sleep(50);
            continue;
          }

          // Lock exists and not stale, wait a bit before retrying
          await this.sleep(50);
          continue;
        }

        // Lock doesn't exist, try to create it
        try {
          await fs.writeFile(this.lockPath, String(Date.now()));
          this.locked = true;
          return true;
        } catch (error: unknown) {
          if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
            // Another process created it, continue waiting
            await this.sleep(50);
            continue;
          }
          // Some other error, wait a bit
          await this.sleep(50);
        }
      } catch {
        // Unexpected error, wait a bit
        await this.sleep(50);
      }
    }

    return false;
  }

  /**
   * Release the lock
   */
  async release(): Promise<void> {
    if (!this.locked) return;

    try {
      await fs.unlink(this.lockPath);
    } catch {
      // Ignore errors when releasing
    }
    this.locked = false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Execute a function with file lock protection
 */
export async function withFileLock<T>(
  filePath: string,
  fn: () => Promise<T>,
  timeoutMs = 5000
): Promise<T> {
  const lock = new FileLock(filePath);
  const acquired = await lock.acquire(timeoutMs);

  if (!acquired) {
    throw createStorageError(
      'LOCK_ERROR',
      `Failed to acquire lock for ${filePath} within ${timeoutMs}ms`,
      { filePath, timeoutMs }
    );
  }

  try {
    return await fn();
  } finally {
    await lock.release();
  }
}

/**
 * Atomic write: write content to file using temp file + rename
 * Uses the atomic rename operation to ensure the file is never partially written.
 * This guarantees that either the old file contents remain or the new contents are fully written.
 */
export async function atomicWrite(
  filePath: string,
  content: string,
  _options?: { encoding?: BufferEncoding }
): Promise<void> {
  const dir = path.dirname(filePath);
  const basename = path.basename(filePath);
  const tmpName = `.tmp_${basename}_${randomBytes(8).toString('hex')}`;
  const tmpPath = path.join(dir, tmpName);

  try {
    // Write to temp file first
    await fs.writeFile(tmpPath, content);

    // Ensure temp file is synced to disk
    const fd = await fs.open(tmpPath, 'r');
    await fd.sync();
    await fd.close();

    // Atomic rename (POSIX guarantees atomicity for rename within same filesystem)
    await fs.rename(tmpPath, filePath);
  } catch (error) {
    // Clean up temp file on error
    try {
      await fs.unlink(tmpPath);
    } catch {
      // Ignore cleanup error
    }
    throw error;
  }
}

/**
 * Atomic write JSON with formatting
 */
export async function atomicWriteJson(
  filePath: string,
  data: unknown,
  options?: { spaces?: number }
): Promise<void> {
  const content = JSON.stringify(data, null, options?.spaces ?? 2);
  await atomicWrite(filePath, content);
}

/**
 * Atomic read JSON file
 */
export async function atomicReadJson<T>(filePath: string): Promise<T | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

/**
 * Atomic read-modify-write operation on JSON file
 */
export async function updateJsonFile<T>(
  filePath: string,
  updater: (data: T | null) => T,
  options?: { spaces?: number }
): Promise<T> {
  return withFileLock(filePath, async () => {
    const current = await atomicReadJson<T>(filePath);
    const updated = updater(current);
    await atomicWriteJson(filePath, updated, options);
    return updated;
  });
}

/**
 * Ensure directory exists
 */
export async function ensureDir(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw error;
    }
  }
}

/**
 * Synchronous version for use in constructors
 */
export function ensureDirSync(dirPath: string): void {
  if (!fsSync.existsSync(dirPath)) {
    fsSync.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Check if file exists
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
