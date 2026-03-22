// Session 管理器
// 负责 Session 的创建、存储、查询和管理
//
// 性能优化：
// 1. 内存缓存 - 减少磁盘读写
// 2. 批量写入 - 合并多次更新为一次写入
// 3. 脏标记 - 仅写入变更的数据
// 4. 定期刷新 - 后台定时保存

import fs from 'node:fs/promises';
import path from 'node:path';
import {
  type Session,
  type SessionMetadata,
  type Message,
  type ToolCall,
  type TokenUsage,
  type CreateSessionOptions,
  type QuerySessionsOptions,
  type SessionStatus,
} from './types.js';
import { getSessionsPath } from '../utils/path.js';
import { withFileLock, atomicReadJson, atomicWriteJson, ensureDir } from '../utils/file-lock.js';

const STORAGE_DIR = getSessionsPath();
const FLUSH_INTERVAL_MS = 5000; // 5秒定期刷新
const MAX_CACHE_SIZE = 100; // 最大缓存会话数

/**
 * 生成唯一 Session ID
 */
function generateSessionId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 9);
  return `${timestamp}_${random}`;
}

/**
 * 确保存储目录存在
 */
async function ensureStorageDir(): Promise<void> {
  await ensureDir(STORAGE_DIR);
}

/**
 * Session 文件路径
 */
function getSessionPath(sessionId: string): string {
  return path.join(STORAGE_DIR, `${sessionId}.json`);
}

/**
 * Session 索引文件路径
 */
function getIndexPath(): string {
  return path.join(STORAGE_DIR, 'index.json');
}

// ============================================================================
// 缓存和批量写入
// ============================================================================

interface CacheEntry {
  session: Session;
  dirty: boolean;
  pinned: boolean; // 防止被驱逐
}

class SessionCache {
  private cache = new Map<string, CacheEntry>();
  private indexCache: Record<string, SessionMetadata> = {};
  private flushTimer: NodeJS.Timeout | null = null;
  private pendingFlush: Set<string> = new Set();

  /**
   * 获取会话（优先从缓存）
   */
  async get(sessionId: string): Promise<Session | null> {
    const entry = this.cache.get(sessionId);
    if (entry) {
      return entry.session;
    }

    // 从磁盘读取
    const session = await atomicReadJson<Session>(getSessionPath(sessionId));
    if (session) {
      this.set(session, false);
      return session;
    }
    return null;
  }

  /**
   * 设置会话
   */
  set(session: Session, dirty = true): void {
    const entry = this.cache.get(session.id);
    if (entry) {
      entry.session = session;
      entry.dirty = entry.dirty || dirty;
    } else {
      // 缓存满了，驱逐一个不脏的条目
      if (this.cache.size >= MAX_CACHE_SIZE) {
        this.evictOne();
      }
      this.cache.set(session.id, { session, dirty, pinned: false });
    }

    if (dirty) {
      this.pendingFlush.add(session.id);
    }
  }

  /**
   * 驱逐一个不脏的缓存条目
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
   * 标记会话为脏
   */
  markDirty(sessionId: string): void {
    const entry = this.cache.get(sessionId);
    if (entry) {
      entry.dirty = true;
    }
    this.pendingFlush.add(sessionId);
  }

  /**
   * 删除会话
   */
  delete(sessionId: string): void {
    this.cache.delete(sessionId);
    this.pendingFlush.delete(sessionId);
    delete this.indexCache[sessionId];
  }

  /**
   * 刷新脏会话到磁盘
   */
  async flush(): Promise<void> {
    if (this.pendingFlush.size === 0) {
      return;
    }

    await ensureStorageDir();

    // 批量写入会话文件
    const promises: Promise<void>[] = [];
    for (const sessionId of this.pendingFlush) {
      const entry = this.cache.get(sessionId);
      if (entry && entry.dirty) {
        promises.push(
          atomicWriteJson(getSessionPath(sessionId), entry.session)
            .then(() => {
              entry.dirty = false;
            })
        );
      }
    }

    // 同时刷新索引
    promises.push(this.flushIndex());

    await Promise.all(promises);
    this.pendingFlush.clear();
  }

  /**
   * 刷新索引到磁盘
   */
  async flushIndex(): Promise<void> {
    await atomicWriteJson(getIndexPath(), this.indexCache);
  }

  /**
   * 更新索引缓存
   */
  updateIndex(sessionId: string, metadata: SessionMetadata): void {
    this.indexCache[sessionId] = metadata;
    this.pendingFlush.add(sessionId); // 索引也需要刷新
  }

  /**
   * 获取索引（从缓存或磁盘）
   */
  async getIndex(): Promise<Record<string, SessionMetadata>> {
    if (Object.keys(this.indexCache).length === 0) {
      const data = await atomicReadJson<Record<string, SessionMetadata>>(getIndexPath());
      this.indexCache = data || {};
    }
    return this.indexCache;
  }

  /**
   * 启动定期刷新
   */
  startFlushTimer(): void {
    if (this.flushTimer) {
      return;
    }
    this.flushTimer = setInterval(() => {
      this.flush().catch(console.error);
    }, FLUSH_INTERVAL_MS);
  }

  /**
   * 停止定期刷新并执行最终保存
   */
  async stop(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flush();
  }

  /**
   * 缓存大小
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * 待刷新数量
   */
  pendingCount(): number {
    return this.pendingFlush.size;
  }
}

// 全局缓存实例
const globalCache = new SessionCache();

// 启动定期刷新
globalCache.startFlushTimer();

/**
 * 读取 Session 索引
 */
async function readIndex(): Promise<Record<string, SessionMetadata>> {
  return globalCache.getIndex();
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function writeIndex(index: Record<string, SessionMetadata>): Promise<void> {
  globalCache.updateIndex('_all_', index as unknown as SessionMetadata);
}

/**
 * 创建新 Session
 */
export async function createSession(options?: CreateSessionOptions): Promise<Session> {
  await ensureStorageDir();

  const now = Date.now();
  const sessionId = options?.id || generateSessionId();

  const session: Session = {
    id: sessionId,
    label: options?.label,
    parentId: options?.parentId,
    createdAt: now,
    updatedAt: now,
    status: 'active',
    config: {
      runtime: options?.config?.runtime || 'main',
      model: options?.config?.model || 'claude-sonnet-4-20250514',
      temperature: options?.config?.temperature ?? 1.0,
      maxTokens: options?.config?.maxTokens,
      systemPrompt: options?.config?.systemPrompt,
      tools: options?.config?.tools || [],
      timeoutSeconds: options?.config?.timeoutSeconds,
    },
    messages: [],
    toolCalls: [],
    usage: {
      input: 0,
      output: 0,
      total: 0,
    },
  };

  // 保存到缓存（标记为脏，等待定期刷新）
  globalCache.set(session, true);

  // 立即写入以确保持久化（create 是关键操作）
  await atomicWriteJson(getSessionPath(sessionId), session);

  // 使用文件锁更新索引，防止并发冲突
  await withFileLock(getIndexPath(), async () => {
    const index = await atomicReadJson<Record<string, SessionMetadata>>(getIndexPath()) || {};
    index[sessionId] = {
      id: sessionId,
      label: session.label,
      parentId: session.parentId,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      status: session.status,
      config: session.config,
    };
    await atomicWriteJson(getIndexPath(), index);
    // 同时更新缓存
    globalCache.updateIndex(sessionId, index[sessionId]);
  });

  return session;
}

/**
 * 获取 Session（优先从缓存）
 */
export async function getSession(sessionId: string): Promise<Session | null> {
  return globalCache.get(sessionId);
}

/**
 * 更新 Session（批量写入优化）
 */
export async function updateSession(
  sessionId: string,
  updates: Partial<Session>,
): Promise<Session | null> {
  const session = await globalCache.get(sessionId);
  if (!session) return null;

  const updated: Session = {
    ...session,
    ...updates,
    updatedAt: Date.now(),
  };

  // 更新缓存（标记为脏）
  globalCache.set(updated, true);

  // 使用文件锁更新索引，防止并发冲突
  await withFileLock(getIndexPath(), async () => {
    const index = await atomicReadJson<Record<string, SessionMetadata>>(getIndexPath()) || {};
    if (index[sessionId]) {
      index[sessionId] = {
        id: updated.id,
        label: updated.label,
        parentId: updated.parentId,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
        status: updated.status,
        config: updated.config,
      };
      await atomicWriteJson(getIndexPath(), index);
    }
  });

  return updated;
}

/**
 * 添加消息到 Session（批量写入优化）
 */
export async function addMessage(
  sessionId: string,
  message: Message,
): Promise<Session | null> {
  const session = await globalCache.get(sessionId);
  if (!session) return null;

  const messageWithTimestamp = {
    ...message,
    timestamp: message.timestamp || Date.now(),
  };

  return updateSession(sessionId, {
    messages: [...session.messages, messageWithTimestamp],
  });
}

/**
 * 添加工具调用记录（批量写入优化）
 */
export async function addToolCall(
  sessionId: string,
  toolCall: ToolCall,
): Promise<Session | null> {
  const session = await globalCache.get(sessionId);
  if (!session) return null;

  return updateSession(sessionId, {
    toolCalls: [...session.toolCalls, toolCall],
  });
}

/**
 * 更新 Token 使用量（批量写入优化）
 */
export async function updateUsage(
  sessionId: string,
  usage: TokenUsage,
): Promise<Session | null> {
  const session = await globalCache.get(sessionId);
  if (!session) return null;

  const currentUsage = session.usage || { input: 0, output: 0, total: 0 };
  return updateSession(sessionId, {
    usage: {
      input: currentUsage.input + usage.input,
      output: currentUsage.output + usage.output,
      total: currentUsage.total + usage.total,
    },
  });
}

/**
 * 查询 Sessions
 */
export async function querySessions(options?: QuerySessionsOptions): Promise<SessionMetadata[]> {
  const index = await readIndex();

  let sessions = Object.values(index);

  // 按更新时间倒序
  sessions.sort((a, b) => b.updatedAt - a.updatedAt);

  // 过滤
  if (options?.status) {
    sessions = sessions.filter((s) => s.status === options.status);
  }
  // 只有在传递了有效的 parentId（非空字符串）时才过滤
  if (options?.parentId && options.parentId.trim()) {
    // 优先匹配 parentId，同时也返回没有 parentId 的 session（兼容旧数据）
    sessions = sessions.filter((s) => s.parentId === options.parentId || !s.parentId);
  }
  if (options?.label) {
    sessions = sessions.filter((s) => s.label?.includes(options.label!));
  }

  // 分页
  if (options?.offset) {
    sessions = sessions.slice(options.offset);
  }
  if (options?.limit) {
    sessions = sessions.slice(0, options.limit);
  }

  return sessions;
}

/**
 * 获取所有活跃 Sessions
 */
export async function getActiveSessions(): Promise<SessionMetadata[]> {
  return querySessions({ status: 'active' });
}

/**
 * 删除 Session
 */
export async function deleteSession(sessionId: string): Promise<boolean> {
  try {
    await globalCache.flush(); // 先刷新以确保没有待写入的数据
    await fs.unlink(getSessionPath(sessionId));

    // 使用文件锁删除索引，防止并发冲突
    await withFileLock(getIndexPath(), async () => {
      const index = await atomicReadJson<Record<string, SessionMetadata>>(getIndexPath()) || {};
      delete index[sessionId];
      await atomicWriteJson(getIndexPath(), index);
    });

    globalCache.delete(sessionId);

    return true;
  } catch {
    return false;
  }
}

/**
 * 更新 Session 状态
 */
export async function updateSessionStatus(
  sessionId: string,
  status: SessionStatus,
): Promise<Session | null> {
  return updateSession(sessionId, { status });
}

/**
 * 刷新所有缓存到磁盘（手动触发）
 */
export async function flushSessions(): Promise<void> {
  await globalCache.flush();
}

/**
 * 获取缓存统计信息
 */
export function getCacheStats(): { size: number; pending: number } {
  return {
    size: globalCache.size(),
    pending: globalCache.pendingCount(),
  };
}

/**
 * 关闭会话管理器（清理资源）
 */
export async function closeSessionManager(): Promise<void> {
  await globalCache.stop();
}
