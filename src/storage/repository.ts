/**
 * Storage Repository Interface
 *
 * Provides a consistent interface for data access across the application.
 */

export interface Repository<T> {
  /**
   * Find an entity by its ID
   */
  findById(id: string): Promise<T | null>;

  /**
   * Find all entities
   */
  findAll(): Promise<T[]>;

  /**
   * Save an entity (create or update)
   */
  save(entity: T): Promise<void>;

  /**
   * Delete an entity by ID
   */
  delete(id: string): Promise<void>;
}

export interface StorageOptions {
  /** Base directory for storage */
  basePath: string;
  /** Time to live for cached items (ms) */
  ttl?: number;
  /** Interval for periodic flush (ms) */
  flushInterval?: number;
  /** Maximum cache size */
  maxCacheSize?: number;
}

/**
 * Storage Error with code for programmatic handling
 */
export class StorageError extends Error {
  constructor(
    message: string,
    public code: StorageErrorCode,
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'StorageError';
  }
}

export type StorageErrorCode =
  | 'NOT_FOUND'
  | 'ALREADY_EXISTS'
  | 'VALIDATION_ERROR'
  | 'IO_ERROR'
  | 'LOCK_ERROR'
  | 'UNKNOWN';

export function isStorageError(error: unknown): error is StorageError {
  return error instanceof StorageError;
}

/**
 * Create a StorageError with context
 */
export function createStorageError(
  code: StorageErrorCode,
  message: string,
  context?: Record<string, unknown>
): StorageError {
  return new StorageError(message, code, context);
}
