/**
 * Storage Cache 通用缓存类
 *
 * 提供通用的内存缓存能力，支持：
 * - LRU 驱逐策略
 * - 脏标记和批量刷新
 * - 定时自动刷新
 * - 固定（pinned）条目防止被驱逐
 */

import type { StorageCacheOptions, CacheEntry, CacheStats } from './types.js';

const DEFAULT_MAX_SIZE = 100;
const DEFAULT_FLUSH_INTERVAL = 5000;

/**
 * 通用存储缓存
 *
 * @example
 * ```typescript
 * const cache = new StorageCache<Session>({
 *   maxSize: 100,
 *   flushInterval: 5000
 * });
 * cache.start();
 * ```
 */
export class StorageCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private flushTimer: NodeJS.Timeout | null = null;
  private pendingFlush: Set<string> = new Set();
  private maxSize: number;
  private flushInterval: number;

  /**
   * 创建缓存实例
   */
  constructor(options: StorageCacheOptions = {}) {
    this.maxSize = options.maxSize ?? DEFAULT_MAX_SIZE;
    this.flushInterval = options.flushInterval ?? DEFAULT_FLUSH_INTERVAL;
  }

  /**
   * 获取缓存条目
   */
  async get(id: string): Promise<T | null> {
    const entry = this.cache.get(id);
    return entry?.data ?? null;
  }

  /**
   * 设置缓存条目
   * @param id - 缓存键
   * @param data - 缓存数据
   * @param dirty - 是否标记为脏
   */
  set(id: string, data: T, dirty = true): void {

    const entry = this.cache.get(id);
    if (entry) {
      entry.data = data;
      entry.dirty = entry.dirty || dirty;
    } else {
      // 缓存满了，驱逐一个条目
      if (this.cache.size >= this.maxSize) {
        this.evictOne();
      }
      this.cache.set(id, { data, dirty, pinned: false });
    }

    if (dirty) {
      this.pendingFlush.add(id);
    }
  }

  /**
   * 标记为脏（需要刷新）
   */
  markDirty(id: string): void {
    const entry = this.cache.get(id);
    if (entry) {
      entry.dirty = true;
    }
    this.pendingFlush.add(id);
  }

  /**
   * 删除缓存条目
   */
  delete(id: string): void {
    this.cache.delete(id);
    this.pendingFlush.delete(id);
  }

  /**
   * 固定缓存条目（防止被驱逐）
   */
  pin(id: string): void {
    const entry = this.cache.get(id);
    if (entry) {
      entry.pinned = true;
    }
  }

  /**
   * 取消固定缓存条目
   */
  unpin(id: string): void {
    const entry = this.cache.get(id);
    if (entry) {
      entry.pinned = false;
    }
  }

  /**
   * 驱逐一个非脏非固定的缓存条目
   */
  private evictOne(): void {
    for (const [id, entry] of this.cache) {
      if (!entry.dirty && !entry.pinned) {
        this.cache.delete(id);
        return;
      }
    }
    // 如果所有条目都是脏的或被钉住，驱逐最早的非钉住条目
    for (const [id, entry] of this.cache) {
      if (!entry.pinned) {
        this.cache.delete(id);
        return;
      }
    }
  }

  /**
   * 刷新所有脏条目到存储
   * 子类重写此方法实现具体存储逻辑
   */
  async flush(): Promise<void> {
    if (this.pendingFlush.size === 0) {
      return;
    }

    // 标记所有待刷新条目为非脏
    for (const id of this.pendingFlush) {
      const entry = this.cache.get(id);
      if (entry) {
        entry.dirty = false;
      }
    }
    this.pendingFlush.clear();
  }

  /**
   * 启动定时刷新
   */
  start(): void {
    if (this.flushTimer) {
      return;
    }
    this.flushTimer = setInterval(() => {
      this.flush().catch(console.error);
    }, this.flushInterval);
  }

  /**
   * 停止定时刷新并执行最终保存
   */
  async stop(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flush();
  }

  /**
   * 获取缓存大小
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * 获取待刷新数量
   */
  pendingCount(): number {
    return this.pendingFlush.size;
  }

  /**
   * 检查是否包含指定 id
   */
  has(id: string): boolean {
    return this.cache.has(id);
  }

  /**
   * 获取所有脏条目
   */
  getDirtyEntries(): Map<string, T> {
    const dirty = new Map<string, T>();
    for (const id of this.pendingFlush) {
      const entry = this.cache.get(id);
      if (entry && entry.dirty) {
        dirty.set(id, entry.data);
      }
    }
    return dirty;
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): CacheStats {
    return {
      size: this.size(),
      pending: this.pendingCount(),
    };
  }

  /**
   * 清空缓存
   */
  clear(): void {
    this.cache.clear();
    this.pendingFlush.clear();
  }
}

export type { StorageCacheOptions, CacheEntry, CacheStats } from './types.js';
