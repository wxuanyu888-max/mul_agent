/**
 * Base Storage Manager
 *
 *抽取公共存储逻辑：
 * - 缓存管理 (Map + dirty flag)
 * - 自动刷新机制
 * - LRU 驱逐策略
 * - 文件锁并发控制
 */

import { ensureDir } from '../utils/file-lock.js';

export interface CacheEntry<T> {
  data: T;
  dirty: boolean;
  pinned: boolean;
}

export interface BaseStorageOptions {
  /** Storage directory path */
  storageDir: string;
  /** Max cache size (default: 100) */
  maxCacheSize?: number;
  /** Flush interval in ms (default: 5000, 0 to disable) */
  flushInterval?: number;
}

export abstract class BaseStorageManager<T> {
  protected cache = new Map<string, CacheEntry<T>>();
  protected pendingFlush = new Set<string>();
  protected flushTimer: NodeJS.Timeout | null = null;
  protected storageDir: string;
  protected maxCacheSize: number;
  protected flushInterval: number;

  constructor(options: BaseStorageOptions) {
    this.storageDir = options.storageDir;
    this.maxCacheSize = options.maxCacheSize ?? 100;
    this.flushInterval = options.flushInterval ?? 5000;

    // Ensure storage directory exists
    ensureDir(this.storageDir).catch(console.error);

    // Start flush timer if interval > 0
    if (this.flushInterval > 0) {
      this.startFlushTimer();
    }
  }

  /**
   * Get storage directory path
   */
  getStorageDir(): string {
    return this.storageDir;
  }

  /**
   * Abstract method to get file path for an entity
   */
  protected abstract getFilePath(id: string): string;

  /**
   * Abstract method to serialize entity to JSON
   */
  protected abstract serialize(entity: T): Record<string, unknown>;

  /**
   * Abstract method to deserialize JSON to entity
   */
  protected abstract deserialize(data: Record<string, unknown>): T;

  /**
   * Get entity by ID (cache-first)
   */
  async get(id: string): Promise<T | null> {
    // Check cache first
    const cached = this.cache.get(id);
    if (cached) {
      return cached.data;
    }

    // Load from disk
    try {
      const filePath = this.getFilePath(id);
      const data = await this.loadJson(filePath);
      if (data) {
        const entity = this.deserialize(data);
        this.setToCache(id, entity, false);
        return entity;
      }
    } catch {
      // File doesn't exist or read error
    }

    return null;
  }

  /**
   * Set entity (mark as dirty for batch write)
   */
  async set(id: string, entity: T, dirty = true): Promise<void> {
    const existing = this.cache.get(id);

    if (existing) {
      existing.data = entity;
      existing.dirty = existing.dirty || dirty;
    } else {
      // Evict if cache is full
      if (this.cache.size >= this.maxCacheSize) {
        this.evictOne();
      }
      this.cache.set(id, { data: entity, dirty, pinned: false });
    }

    if (dirty) {
      this.pendingFlush.add(id);
    }
  }

  /**
   * Delete entity from cache and disk
   */
  async delete(id: string): Promise<boolean> {
    this.cache.delete(id);
    this.pendingFlush.delete(id);

    try {
      const filePath = this.getFilePath(id);
      await this.removeFile(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Flush all dirty entries to disk
   */
  async flush(): Promise<void> {
    if (this.pendingFlush.size === 0) {
      return;
    }

    await ensureDir(this.storageDir);

    const promises: Promise<void>[] = [];
    for (const id of this.pendingFlush) {
      const entry = this.cache.get(id);
      if (entry && entry.dirty) {
        promises.push(this.flushOne(id));
      }
    }

    await Promise.all(promises);
    this.pendingFlush.clear();
  }

  /**
   * Flush a single entry to disk
   */
  protected async flushOne(id: string): Promise<void> {
    const entry = this.cache.get(id);
    if (!entry || !entry.dirty) {
      this.pendingFlush.delete(id);
      return;
    }

    const filePath = this.getFilePath(id);
    await this.writeJson(filePath, this.serialize(entry.data));

    entry.dirty = false;
    this.pendingFlush.delete(id);
  }

  /**
   * Mark entry as dirty
   */
  markDirty(id: string): void {
    const entry = this.cache.get(id);
    if (entry) {
      entry.dirty = true;
      this.pendingFlush.add(id);
    }
  }

  /**
   * Pin entry to prevent eviction
   */
  pin(id: string): void {
    const entry = this.cache.get(id);
    if (entry) {
      entry.pinned = true;
    }
  }

  /**
   * Unpin entry
   */
  unpin(id: string): void {
    const entry = this.cache.get(id);
    if (entry) {
      entry.pinned = false;
    }
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Get pending flush count
   */
  pendingCount(): number {
    return this.pendingFlush.size;
  }

  /**
   * Check if entry is cached
   */
  has(id: string): boolean {
    return this.cache.has(id);
  }

  /**
   * Start periodic flush timer
   */
  protected startFlushTimer(): void {
    if (this.flushTimer) {
      return;
    }
    this.flushTimer = setInterval(() => {
      this.flush().catch(console.error);
    }, this.flushInterval);
  }

  /**
   * Stop flush timer and do final flush
   */
  async stop(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flush();
  }

  /**
   * Evict one non-dirty, non-pinned entry
   */
  protected evictOne(): void {
    // First pass: try to evict non-dirty, non-pinned
    for (const [id, entry] of this.cache) {
      if (!entry.dirty && !entry.pinned) {
        this.cache.delete(id);
        return;
      }
    }

    // Second pass: evict any non-pinned (even if dirty)
    for (const [id, entry] of this.cache) {
      if (!entry.pinned) {
        this.cache.delete(id);
        return;
      }
    }

    // If all pinned, evict the first one anyway (shouldn't happen in practice)
    const firstKey = this.cache.keys().next().value;
    if (firstKey) {
      this.cache.delete(firstKey);
    }
  }

  /**
   * Set entity to cache without marking dirty
   */
  protected setToCache(id: string, entity: T, dirty: boolean): void {
    if (this.cache.size >= this.maxCacheSize) {
      this.evictOne();
    }
    this.cache.set(id, { data: entity, dirty, pinned: false });
  }

  /**
   * Load JSON from file (to be implemented with atomic read)
   */
  protected abstract loadJson(filePath: string): Promise<Record<string, unknown> | null>;

  /**
   * Write JSON to file (to be implemented with atomic write)
   */
  protected abstract writeJson(filePath: string, data: Record<string, unknown>): Promise<void>;

  /**
   * Remove file
   */
  protected abstract removeFile(filePath: string): Promise<void>;
}
