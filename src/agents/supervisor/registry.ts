/**
 * NodeRegistry - 节点注册表
 *
 * 基于 SessionManager 的缓存+批量写入模式
 * 存储路径: storage/sessions/{sessionId}/nodes/
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import {
  type NodeInfo,
  type NodeStatus,
  type SupervisorState,
  type NodeIndex,
} from './types.js';
import { getSessionsPath } from '../../utils/path.js';
import { atomicReadJson, atomicWriteJson, ensureDir, withFileLock } from '../../utils/file-lock.js';

const NODES_DIR = 'nodes';

/**
 * 获取 session 的节点目录
 */
function getNodesDir(sessionId: string): string {
  return path.join(getSessionsPath(sessionId), NODES_DIR);
}

/**
 * 获取节点索引文件路径
 */
function getIndexPath(sessionId: string): string {
  return path.join(getNodesDir(sessionId), 'index.json');
}

/**
 * 获取单个节点文件路径
 */
function getNodePath(sessionId: string, nodeId: string): string {
  return path.join(getNodesDir(sessionId), `${nodeId}.json`);
}

/**
 * 获取 supervisor 状态文件路径
 */
function getSupervisorStatePath(sessionId: string, supervisorId: string): string {
  return path.join(getNodesDir(sessionId), supervisorId, 'state.json');
}

// ============================================================================
// 缓存
// ============================================================================

interface CacheEntry {
  node: NodeInfo;
  dirty: boolean;
}

class NodeCache {
  private cache = new Map<string, CacheEntry>();
  private pendingFlush = new Set<string>();
  private indexCache: Record<string, NodeIndex> = {};

  /**
   * 获取节点（优先从缓存）
   */
  async get(sessionId: string, nodeId: string): Promise<NodeInfo | null> {
    const key = `${sessionId}:${nodeId}`;
    const entry = this.cache.get(key);
    if (entry) {
      return entry.node;
    }

    // 从磁盘读取
    const node = await atomicReadJson<NodeInfo>(getNodePath(sessionId, nodeId));
    if (node) {
      this.set(sessionId, node, false);
      return node;
    }
    return null;
  }

  /**
   * 设置节点到缓存
   */
  set(sessionId: string, node: NodeInfo, dirty = true): void {
    const key = `${sessionId}:${node.id}`;
    const entry = this.cache.get(key);
    if (entry) {
      entry.node = node;
      entry.dirty = entry.dirty || dirty;
    } else {
      this.cache.set(key, { node, dirty });
    }

    if (dirty) {
      this.pendingFlush.add(key);
    }
  }

  /**
   * 刷新脏节点到磁盘
   */
  async flush(sessionId: string, nodeId: string): Promise<void> {
    const key = `${sessionId}:${nodeId}`;
    const entry = this.cache.get(key);
    if (!entry || !entry.dirty) {
      this.pendingFlush.delete(key);
      return;
    }

    const { node } = entry;
    await ensureDir(getNodesDir(sessionId));
    await atomicWriteJson(getNodePath(sessionId, node.id), node);

    entry.dirty = false;
    this.pendingFlush.delete(key);
  }

  /**
   * 刷新所有脏节点
   */
  async flushAll(sessionId: string): Promise<void> {
    const keys = Array.from(this.pendingFlush).filter(k => k.startsWith(`${sessionId}:`));
    await Promise.all(keys.map(key => {
      const [, nodeId] = key.split(':');
      return this.flush(sessionId, nodeId);
    }));
  }

  /**
   * 删除节点
   */
  delete(sessionId: string, nodeId: string): void {
    const key = `${sessionId}:${nodeId}`;
    this.cache.delete(key);
    this.pendingFlush.delete(key);
  }

  /**
   * 获取索引
   */
  async getIndex(sessionId: string): Promise<NodeIndex> {
    if (!this.indexCache[sessionId]) {
      const data = await atomicReadJson<NodeIndex>(getIndexPath(sessionId));
      this.indexCache[sessionId] = data || { nodes: {}, lastUpdated: Date.now() };
    }
    return this.indexCache[sessionId];
  }

  /**
   * 更新索引缓存
   */
  updateIndexCache(sessionId: string, index: NodeIndex): void {
    this.indexCache[sessionId] = index;
  }

  /**
   * 待刷新数量
   */
  pendingCount(): number {
    return this.pendingFlush.size;
  }
}

// 全局缓存实例
const globalCache = new NodeCache();

// ============================================================================
// NodeRegistry
// ============================================================================

/**
 * 节点注册表
 *
 * 提供节点的注册、注销、查询和状态管理
 */
export class NodeRegistry {
  /**
   * 注册节点
   */
  async register(node: NodeInfo): Promise<void> {
    const { sessionId } = node;

    await ensureDir(getNodesDir(sessionId));

    // 保存到缓存
    globalCache.set(sessionId, node, true);

    // 立即写入以确保持久化
    await atomicWriteJson(getNodePath(sessionId, node.id), node);

    // 更新索引
    await this.updateIndex(sessionId, node);
  }

  /**
   * 更新索引
   */
  private async updateIndex(sessionId: string, node: NodeInfo): Promise<void> {
    const indexPath = getIndexPath(sessionId);

    await withFileLock(indexPath, async () => {
      const index = await globalCache.getIndex(sessionId);

      index.nodes[node.id] = {
        ...node,
        updatedAt: Date.now(),
      };
      index.lastUpdated = Date.now();

      await atomicWriteJson(indexPath, index);
      globalCache.updateIndexCache(sessionId, index);
    });
  }

  /**
   * 注销节点
   */
  async unregister(nodeId: string, sessionId: string): Promise<void> {
    const indexPath = getIndexPath(sessionId);

    // 从缓存删除
    globalCache.delete(sessionId, nodeId);

    // 从索引删除
    await withFileLock(indexPath, async () => {
      const index = await globalCache.getIndex(sessionId);
      delete index.nodes[nodeId];
      index.lastUpdated = Date.now();
      await atomicWriteJson(indexPath, index);
      globalCache.updateIndexCache(sessionId, index);
    });

    // 删除节点文件
    try {
      await fs.unlink(getNodePath(sessionId, nodeId));
    } catch {
      // 忽略文件不存在错误
    }
  }

  /**
   * 获取节点
   */
  async get(nodeId: string, sessionId: string): Promise<NodeInfo | null> {
    return globalCache.get(sessionId, nodeId);
  }

  /**
   * 更新节点状态
   */
  async updateStatus(nodeId: string, sessionId: string, status: NodeStatus): Promise<void> {
    const node = await this.get(nodeId, sessionId);
    if (!node) {
      throw new Error(`Node ${nodeId} not found`);
    }

    const updatedNode: NodeInfo = {
      ...node,
      status,
      updatedAt: Date.now(),
    };

    // 保存到缓存
    globalCache.set(sessionId, updatedNode, true);

    // 立即写入
    await atomicWriteJson(getNodePath(sessionId, updatedNode.id), updatedNode);

    // 更新索引
    await this.updateIndex(sessionId, updatedNode);
  }

  /**
   * 按 session 列出节点
   */
  async listBySession(sessionId: string): Promise<NodeInfo[]> {
    const index = await globalCache.getIndex(sessionId);
    const nodes: NodeInfo[] = [];

    for (const nodeId of Object.keys(index.nodes)) {
      const node = await this.get(nodeId, sessionId);
      if (node) {
        nodes.push(node);
      }
    }

    return nodes;
  }

  /**
   * 按 parent 列出子节点
   */
  async listChildren(parentId: string, sessionId: string): Promise<NodeInfo[]> {
    const allNodes = await this.listBySession(sessionId);
    return allNodes.filter(node => node.parentId === parentId);
  }

  /**
   * 保存 supervisor 状态
   */
  async saveState(state: SupervisorState): Promise<void> {
    const { sessionId, supervisorId } = state;
    const stateDir = path.join(getNodesDir(sessionId), supervisorId);

    await ensureDir(stateDir);
    await atomicWriteJson(getSupervisorStatePath(sessionId, supervisorId), {
      version: 1,
      state,
      savedAt: Date.now(),
    });
  }

  /**
   * 恢复 supervisor 状态
   */
  async restoreState(supervisorId: string, sessionId: string): Promise<SupervisorState | null> {
    const statePath = getSupervisorStatePath(sessionId, supervisorId);
    const data = await atomicReadJson<{ version: number; state: SupervisorState; savedAt: number }>(statePath);
    return data?.state ?? null;
  }

  /**
   * 刷新所有脏数据到磁盘
   */
  async flush(sessionId: string): Promise<void> {
    await globalCache.flushAll(sessionId);
  }

  /**
   * 列出所有有节点目录的 session
   * 用于恢复 supervisor 时查找所有可能的 session
   */
  async listAllSessions(): Promise<string[]> {
    const sessionsPath = getSessionsPath();
    const sessionIds: string[] = [];

    try {
      const entries = await fs.readdir(sessionsPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          // 检查是否有 nodes 子目录
          const nodesDir = path.join(sessionsPath, entry.name, NODES_DIR);
          try {
            await fs.access(nodesDir);
            // nodes 目录存在，这是一个有节点的 session
            sessionIds.push(entry.name);
          } catch {
            // nodes 目录不存在，跳过
          }
        }
      }
    } catch {
      // 目录不存在，返回空数组
    }

    return sessionIds;
  }
}

// 全局单例
let globalRegistry: NodeRegistry | null = null;

/**
 * 获取 NodeRegistry 单例
 */
export function getNodeRegistry(): NodeRegistry {
  if (!globalRegistry) {
    globalRegistry = new NodeRegistry();
  }
  return globalRegistry;
}
