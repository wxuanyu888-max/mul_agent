/**
 * Storage 模块
 *
 * 提供统一的存储基础设施：
 * - Repository 接口
 * - BaseStorageManager 基类
 * - 存储后端实现
 * - 通用缓存
 */

export { Repository, StorageError, createStorageError, isStorageError } from './repository.js';
export { BaseStorageManager, type BaseStorageOptions, type CacheEntry } from './base.js';

export { JsonStorageBackend, type JsonStorageBackendOptions } from './backend/json.js';

export { StorageCache, type StorageCacheOptions, type CacheStats } from './cache/index.js';
