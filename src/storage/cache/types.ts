/**
 * Storage Cache 类型定义
 */

export interface StorageCacheOptions {
  /** 最大缓存数量 */
  maxSize?: number;
  /** 刷新间隔（毫秒） */
  flushInterval?: number;
}

export interface CacheEntry<T> {
  data: T;
  dirty: boolean;
  pinned: boolean;
}

export interface CacheStats {
  size: number;
  pending: number;
}
