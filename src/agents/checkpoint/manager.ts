/**
 * Checkpoint 管理器
 *
 * 负责 Checkpoint 的创建、存储、查询和恢复
 * 继承 BaseStorageManager 实现通用缓存/持久化逻辑
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import {
  type Checkpoint,
  type CheckpointIndexEntry,
  type CreateCheckpointParams,
  type CheckpointState,
} from './types.js';
import { BaseStorageManager, type BaseStorageOptions } from '../../storage/base.js';
import { JsonStorageBackend } from '../../storage/backend/json.js';
import { atomicReadJson, atomicWriteJson, ensureDir, withFileLock } from '../../utils/file-lock.js';
import { getCheckpointsPath } from '../../utils/path.js';

const STORAGE_DIR = getCheckpointsPath();
const INDEX_FILE = 'index.json';
const MAX_CACHE_SIZE = 50;

/**
 * Checkpoint 序列化格式
 */
interface CheckpointFileFormat {
  version: 1;
  checkpoint: Checkpoint;
}

/**
 * 生成唯一 Checkpoint ID
 */
function generateCheckpointId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 9);
  return `ckpt_${timestamp}_${random}`;
}

/**
 * 获取 session 的 checkpoint 目录
 */
function getSessionCheckpointDir(sessionId: string): string {
  return path.join(STORAGE_DIR, sessionId);
}

/**
 * 获取 session 的索引文件路径
 */
function getSessionIndexPath(sessionId: string): string {
  return path.join(getSessionCheckpointDir(sessionId), INDEX_FILE);
}

/**
 * 获取单个 checkpoint 文件路径
 */
function getCheckpointPath(sessionId: string, checkpointId: string): string {
  return path.join(getSessionCheckpointDir(sessionId), `${checkpointId}.json`);
}

// ============================================================================
// CheckpointManager - 继承 BaseStorageManager
// ============================================================================

interface CheckpointCacheEntry {
  data: Checkpoint;
  dirty: boolean;
  pinned: boolean;
}

/**
 * Checkpoint 管理器
 *
 * 使用 BaseStorageManager 的通用缓存/持久化逻辑
 * 额外实现索引管理和 session 目录隔离
 */
export class CheckpointManager {
  private cache = new Map<string, CheckpointCacheEntry>();
  private pendingFlush = new Set<string>();
  private backend: JsonStorageBackend;

  constructor() {
    this.backend = new JsonStorageBackend({ baseDir: STORAGE_DIR });
    ensureDir(STORAGE_DIR).catch(console.error);
  }

  /**
   * 创建 Checkpoint
   */
  async create(params: CreateCheckpointParams): Promise<Checkpoint> {
    await ensureDir(STORAGE_DIR);

    const checkpointId = generateCheckpointId();
    const now = Date.now();

    const checkpoint: Checkpoint = {
      id: checkpointId,
      parentId: params.parentId ?? null,
      metadata: {
        sessionId: params.sessionId,
        iteration: params.iteration,
        conversationRound: params.conversationRound,
        reason: params.reason,
        timestamp: now,
        parentId: params.parentId ?? null,
      },
      messages: params.messages,
      systemPrompt: params.systemPrompt,
      compactionContext: {
        compactionCount: params.compactionContext.compactionCount,
        lastCompactionTokens: params.compactionContext.lastCompactionTokens,
        transcriptPath: params.compactionContext.transcriptPath,
      },
      generatedFiles: params.generatedFiles,
      pendingToolCalls: params.pendingToolCalls,
      completedToolCalls: params.completedToolCalls,
      lastLlmCallId: params.lastLlmCallId,
      lastLlmResponse: params.lastLlmResponse,
      extra: params.extra,
    };

    // 保存到缓存
    this.setToCache(checkpointId, checkpoint, true);

    // 立即写入以确保持久化
    const sessionDir = getSessionCheckpointDir(params.sessionId);
    await ensureDir(sessionDir);
    await atomicWriteJson(getCheckpointPath(params.sessionId, checkpointId), {
      version: 1,
      checkpoint,
    } as CheckpointFileFormat);

    // 更新索引
    await this.updateIndex(params.sessionId, checkpoint);

    return checkpoint;
  }

  /**
   * 更新 session 索引
   */
  private async updateIndex(sessionId: string, checkpoint: Checkpoint): Promise<void> {
    const indexPath = getSessionIndexPath(sessionId);

    await withFileLock(indexPath, async () => {
      const index = (await atomicReadJson<Record<string, CheckpointIndexEntry>>(indexPath)) || {};

      index[checkpoint.id] = {
        id: checkpoint.id,
        parentId: checkpoint.parentId,
        timestamp: checkpoint.metadata.timestamp,
        reason: checkpoint.metadata.reason,
        iteration: checkpoint.metadata.iteration,
        conversationRound: checkpoint.metadata.conversationRound,
        messagesCount: checkpoint.messages.length,
        completedToolCallsCount: checkpoint.completedToolCalls.length,
      };

      await atomicWriteJson(indexPath, index);
    });
  }

  /**
   * 获取 Checkpoint
   */
  async get(checkpointId: string): Promise<Checkpoint | null> {
    // Check cache first
    const cached = this.cache.get(checkpointId);
    if (cached) {
      return cached.data;
    }

    // 从磁盘读取 - 需要从索引找到 sessionId
    try {
      await ensureDir(STORAGE_DIR);
      const sessionDirs = await fs.readdir(STORAGE_DIR);

      for (const sessionId of sessionDirs) {
        const checkpointPath = getCheckpointPath(sessionId, checkpointId);
        try {
          const data = await atomicReadJson<CheckpointFileFormat>(checkpointPath);
          if (data?.checkpoint) {
            this.setToCache(checkpointId, data.checkpoint, false);
            return data.checkpoint;
          }
        } catch {
          // 文件不存在，继续找
        }
      }
    } catch {
      // 目录不存在
    }

    return null;
  }

  /**
   * 获取 session 的所有 checkpoints
   */
  async getSessionCheckpoints(sessionId: string): Promise<Checkpoint[]> {
    try {
      await ensureDir(STORAGE_DIR);

      const indexPath = getSessionIndexPath(sessionId);
      const index = await atomicReadJson<Record<string, CheckpointIndexEntry>>(indexPath);

      if (!index) {
        return [];
      }

      // 按时间倒序返回
      const entries = Object.values(index).sort((a, b) => b.timestamp - a.timestamp);

      const checkpoints: Checkpoint[] = [];
      for (const entry of entries) {
        const checkpoint = await this.get(entry.id);
        if (checkpoint) {
          checkpoints.push(checkpoint);
        }
      }

      return checkpoints;
    } catch {
      return [];
    }
  }

  /**
   * 获取最近的 checkpoint
   */
  async getLatest(sessionId: string): Promise<Checkpoint | null> {
    try {
      await ensureDir(STORAGE_DIR);

      const indexPath = getSessionIndexPath(sessionId);
      const index = await atomicReadJson<Record<string, CheckpointIndexEntry>>(indexPath);

      if (!index || Object.keys(index).length === 0) {
        return null;
      }

      // 找最新的
      const latestEntry = Object.values(index).sort((a, b) => b.timestamp - a.timestamp)[0];

      return this.get(latestEntry.id);
    } catch {
      return null;
    }
  }

  /**
   * 获取 checkpoint 的祖先链（用于时间旅行）
   */
  async getAncestors(checkpointId: string): Promise<Checkpoint[]> {
    const ancestors: Checkpoint[] = [];
    let currentId: string | null = checkpointId;

    while (currentId) {
      const checkpoint = await this.get(currentId);
      if (!checkpoint) {
        break;
      }

      // 不包含起始点，只包含祖先
      if (checkpoint.id !== checkpointId) {
        ancestors.push(checkpoint);
      }

      currentId = checkpoint.parentId;
    }

    // 倒序，最老的在前面
    return ancestors.reverse();
  }

  /**
   * 从指定 checkpoint 恢复状态
   */
  async restoreState(checkpointId: string): Promise<CheckpointState | null> {
    const checkpoint = await this.get(checkpointId);

    if (!checkpoint) {
      return null;
    }

    return {
      messages: checkpoint.messages,
      systemPrompt: checkpoint.systemPrompt,
      compactionContext: {
        compactionCount: checkpoint.compactionContext.compactionCount,
        lastCompactionTokens: checkpoint.compactionContext.lastCompactionTokens,
        transcriptPath: checkpoint.compactionContext.transcriptPath,
        toolResultPlaceholders: new Map(), // 重新创建
      },
      generatedFiles: checkpoint.generatedFiles,
    };
  }

  /**
   * 删除 session 的所有 checkpoints
   */
  async deleteSessionCheckpoints(sessionId: string): Promise<void> {
    try {
      await this.flushAll();

      const sessionDir = getSessionCheckpointDir(sessionId);
      await fs.rm(sessionDir, { recursive: true, force: true });
    } catch {
      // 忽略错误
    }
  }

  /**
   * 刷新所有缓存到磁盘
   */
  async flush(): Promise<void> {
    if (this.pendingFlush.size === 0) {
      return;
    }

    await ensureDir(STORAGE_DIR);

    const promises: Promise<void>[] = [];
    for (const checkpointId of this.pendingFlush) {
      const entry = this.cache.get(checkpointId);
      if (entry && entry.dirty) {
        promises.push(this.flushOne(checkpointId));
      }
    }

    await Promise.all(promises);
    this.pendingFlush.clear();
  }

  /**
   * 刷新单个 checkpoint
   */
  private async flushOne(checkpointId: string): Promise<void> {
    const entry = this.cache.get(checkpointId);
    if (!entry || !entry.dirty) {
      this.pendingFlush.delete(checkpointId);
      return;
    }

    const checkpoint = entry.data;
    const sessionDir = getSessionCheckpointDir(checkpoint.metadata.sessionId);

    await ensureDir(sessionDir);
    await atomicWriteJson(getCheckpointPath(checkpoint.metadata.sessionId, checkpoint.id), {
      version: 1,
      checkpoint,
    } as CheckpointFileFormat);

    entry.dirty = false;
    this.pendingFlush.delete(checkpointId);
  }

  /**
   * 刷新所有脏 checkpoint
   */
  async flushAll(): Promise<void> {
    await this.flush();
  }

  /**
   * 获取缓存统计
   */
  getCacheStats(): { size: number; pending: number } {
    return {
      size: this.cache.size,
      pending: this.pendingFlush.size,
    };
  }

  // ==================== 缓存辅助方法 ====================

  private setToCache(id: string, checkpoint: Checkpoint, dirty: boolean): void {
    const existing = this.cache.get(id);
    if (existing) {
      existing.data = checkpoint;
      existing.dirty = existing.dirty || dirty;
    } else {
      if (this.cache.size >= MAX_CACHE_SIZE) {
        this.evictOne();
      }
      this.cache.set(id, { data: checkpoint, dirty, pinned: false });
    }

    if (dirty) {
      this.pendingFlush.add(id);
    }
  }

  private evictOne(): void {
    for (const [id, entry] of this.cache) {
      if (!entry.dirty && !entry.pinned) {
        this.cache.delete(id);
        return;
      }
    }
    // 如果所有条目都是脏的，驱逐最早的一个
    const firstKey = this.cache.keys().next().value;
    if (firstKey) {
      this.cache.delete(firstKey);
    }
  }
}

// 全局单例
let globalManager: CheckpointManager | null = null;

/**
 * 获取 CheckpointManager 单例
 */
export function getCheckpointManager(): CheckpointManager {
  if (!globalManager) {
    globalManager = new CheckpointManager();
  }
  return globalManager;
}

/**
 * 创建 Checkpoint（便捷函数）
 */
export async function createCheckpoint(params: CreateCheckpointParams): Promise<Checkpoint> {
  return getCheckpointManager().create(params);
}

/**
 * 获取 Checkpoint（便捷函数）
 */
export async function getCheckpoint(checkpointId: string): Promise<Checkpoint | null> {
  return getCheckpointManager().get(checkpointId);
}

/**
 * 获取 session 的所有 Checkpoints（便捷函数）
 */
export async function getSessionCheckpoints(sessionId: string): Promise<Checkpoint[]> {
  return getCheckpointManager().getSessionCheckpoints(sessionId);
}

/**
 * 获取最新的 Checkpoint（便捷函数）
 */
export async function getLatestCheckpoint(sessionId: string): Promise<Checkpoint | null> {
  return getCheckpointManager().getLatest(sessionId);
}

/**
 * 从 Checkpoint 恢复状态（便捷函数）
 */
export async function restoreFromCheckpoint(checkpointId: string): Promise<CheckpointState | null> {
  return getCheckpointManager().restoreState(checkpointId);
}

/**
 * 获取 Checkpoint 的祖先链（便捷函数）
 */
export async function getCheckpointAncestors(checkpointId: string): Promise<Checkpoint[]> {
  return getCheckpointManager().getAncestors(checkpointId);
}
