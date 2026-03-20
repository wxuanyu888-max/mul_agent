/**
 * 记忆系统分层架构设计
 *
 * 四层记忆架构：
 * 1. Short Memory - 当前会话上下文
 * 2. Remote Memory - 直接加载的长期信息
 * 3. Vector Memory - 语义搜索的记忆
 * 4. Workspace - 工作文件（Agent 主动读取）
 */

import { getSession, addMessage } from '../session/index.js';
import { MemoryIndexManager, getMemoryIndexManager } from './manager.js';
import type { MemorySearchConfig, MemorySearchResult } from './types.js';

/**
 * 记忆类型枚举
 */
export enum MemoryTier {
  /** 短期记忆 - 当前会话 */
  SHORT = 'short',
  /** 远程记忆 - 直接加载 */
  REMOTE = 'remote',
  /** 向量记忆 - 语义搜索 */
  VECTOR = 'vector',
  /** 工作文件 - Agent 主动读取 */
  WORKSPACE = 'workspace',
}

/**
 * 记忆项接口
 */
export interface MemoryItem {
  id: string;
  tier: MemoryTier;
  content: string;
  metadata?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

/**
 * 短期记忆配置
 */
export interface ShortMemoryConfig {
  /** 最大消息数量 */
  maxMessages: number;
  /** 压缩阈值 */
  compactThreshold: number;
}

/**
 * 远程记忆配置
 */
export interface RemoteMemoryConfig {
  /** 远程记忆文件路径 */
  filePath: string;
  /** 每次加载的最大字符数 */
  maxChars: number;
  /** 要排除的 key */
  excludeKeys?: string[];
}

/**
 * 向量记忆配置
 */
export interface VectorMemoryConfig {
  /** 搜索返回的最大结果数 */
  maxResults: number;
  /** 最小相似度分数 */
  minScore: number;
}

/**
 * 工作区配置
 */
export interface WorkspaceConfig {
  /** 工作区目录 */
  directory: string;
  /** 要监控的文件类型 */
  extensions?: string[];
  /** 最大文件大小 (bytes) */
  maxFileSize?: number;
}

/**
 * 统一记忆配置
 */
export interface UnifiedMemoryConfig {
  short: ShortMemoryConfig;
  remote: RemoteMemoryConfig;
  vector: VectorMemoryConfig;
  workspace: WorkspaceConfig;
  /** 是否启用各层记忆 */
  enabled: {
    short: boolean;
    remote: boolean;
    vector: boolean;
    workspace: boolean;
  };
}

/**
 * 默认配置
 */
export const DEFAULT_UNIFIED_MEMORY_CONFIG: UnifiedMemoryConfig = {
  short: {
    maxMessages: 100,
    compactThreshold: 150,
  },
  remote: {
    filePath: 'storage/memory/remote.json',
    maxChars: 8000,
  },
  vector: {
    maxResults: 5,
    minScore: 0.5,
  },
  workspace: {
    directory: 'storage/workspace',
    extensions: ['.md', '.txt', '.json', '.ts', '.js', '.py'],
    maxFileSize: 1024 * 1024, // 1MB
  },
  enabled: {
    short: true,
    remote: true,
    vector: true,
    workspace: true,
  },
};

/**
 * 统一记忆管理器
 */
export class UnifiedMemoryManager {
  private config: UnifiedMemoryConfig;
  private vectorManager: MemoryIndexManager | null = null;
  private remoteCache: string = '';
  private readonly baseDir: string;

  constructor(config: Partial<UnifiedMemoryConfig> = {}) {
    this.config = { ...DEFAULT_UNIFIED_MEMORY_CONFIG, ...config };
    this.baseDir = process.cwd();
  }

  /**
   * 验证路径是否在允许的目录内（防止路径遍历攻击）
   */
  private validatePath(filePath: string): string {
    const path = require('node:path');
    const normalized = path.normalize(filePath);
    const resolved = path.resolve(this.baseDir, normalized);
    const allowedDir = path.resolve(this.baseDir, 'storage', 'memory');

    if (!resolved.startsWith(allowedDir)) {
      throw new Error('Invalid file path: outside allowed directory');
    }
    return resolved;
  }

  /**
   * 初始化向量管理器
   */
  async initVectorManager(workspaceDir: string, memoryConfig: MemorySearchConfig): Promise<void> {
    if (this.config.enabled.vector) {
      this.vectorManager = await getMemoryIndexManager({
        agentId: 'core_brain',
        workspaceDir,
        config: memoryConfig,
      });
    }
  }

  /**
   * 获取短期记忆 (Short Memory)
   * - 来源: 当前会话消息
   * - 加载方式: 直接追加到上下文
   */
  async getShortMemory(sessionKey: string): Promise<string> {
    if (!this.config.enabled.short) {
      return '';
    }

    const { maxMessages } = this.config.short;
    const session = await getSession(sessionKey);

    if (!session) {
      return '';
    }

    const messages = (session.messages || []).slice(-maxMessages);

    // 格式化为可读文本
    const formatted = messages
      .map((m) => {
        const role = m.role === 'user' ? 'User' : m.role === 'assistant' ? 'Assistant' : 'System';
        const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
        return `[${role}]: ${content}`;
      })
      .join('\n\n');

    return formatted;
  }

  /**
   * 获取远程记忆 (Remote Memory)
   * - 来源: 固定文件 (remote.json)
   * - 加载方式: 每次会话开始时加载
   * - 典型内容: Agent 角色定义、系统扩展、用户偏好
   */
  async getRemoteMemory(): Promise<string> {
    if (!this.config.enabled.remote) {
      return '';
    }

    // 如果有缓存，直接返回
    if (this.remoteCache) {
      return this.remoteCache;
    }

    try {
      const fs = await import('node:fs/promises');
      const safePath = this.validatePath(this.config.remote.filePath);
      const content = await fs.readFile(safePath, 'utf-8');
      const data = JSON.parse(content);

      // 过滤排除的 key
      const { excludeKeys, maxChars } = this.config.remote;
      let filtered = data;

      if (excludeKeys && excludeKeys.length > 0) {
        filtered = Object.fromEntries(
          Object.entries(data).filter(([key]) => !excludeKeys.includes(key))
        );
      }

      // 限制长度
      let text = JSON.stringify(filtered, null, 2);
      if (text.length > maxChars) {
        text = text.substring(0, maxChars) + '...';
      }

      this.remoteCache = text;
      return text;
    } catch (error) {
      console.warn('Failed to read remote memory:', error);
      return '';
    }
  }

  /**
   * 更新远程记忆
   */
  async setRemoteMemory(key: string, value: unknown): Promise<void> {
    try {
      const fs = await import('node:fs/promises');
      const path = await import('node:path');

      let data: Record<string, unknown> = {};
      try {
        const safePath = this.validatePath(this.config.remote.filePath);
        const content = await fs.readFile(safePath, 'utf-8');
        data = JSON.parse(content);
      } catch {
        // 文件不存在，使用空对象
      }

      data[key] = value;

      const safePath = this.validatePath(this.config.remote.filePath);
      await fs.mkdir(path.dirname(safePath), { recursive: true });
      await fs.writeFile(safePath, JSON.stringify(data, null, 2), 'utf-8');

      // 清除缓存
      this.remoteCache = '';
    } catch (error) {
      console.error('Failed to set remote memory:', error);
    }
  }

  /**
   * 获取向量记忆 (Vector Memory)
   * - 来源: 向量数据库
   * - 加载方式: 按需 semantic search
   * - 典型内容: 重要决策、项目架构、代码模式
   */
  async getVectorMemory(query: string): Promise<MemorySearchResult[]> {
    if (!this.config.enabled.vector || !this.vectorManager) {
      return [];
    }

    const { maxResults, minScore } = this.config.vector;
    const results = await this.vectorManager.search(query, { maxResults });

    return results.filter((r) => r.score >= minScore);
  }

  /**
   * 写入向量记忆
   * - 内容会被分块、向量化、存入向量库
   */
  async addVectorMemory(content: string, _metadata?: Record<string, unknown>): Promise<void> {
    if (!this.config.enabled.vector || !this.vectorManager) {
      return;
    }

    // 生成文件名
    const fileName = `vector_${Date.now()}.md`;
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const fullPath = path.join('storage/memory', fileName);

    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content, 'utf-8');

    // 触发同步
    await this.vectorManager.sync({ reason: 'vector_memory_add', force: true });
  }

  /**
   * 获取工作区文件列表 (Workspace)
   * - Agent 需要主动读取这些文件
   * - 典型内容: 原始数据、日志、文档
   */
  async listWorkspaceFiles(): Promise<string[]> {
    if (!this.config.enabled.workspace) {
      return [];
    }

    const { directory, extensions, maxFileSize } = this.config.workspace;
    const fs = await import('node:fs/promises');
    const path = await import('node:path');

    const files: string[] = [];

    try {
      const entries = await fs.readdir(directory, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isFile()) continue;

        const ext = path.extname(entry.name);
        if (extensions && !extensions.includes(ext)) continue;

        const stats = await fs.stat(path.join(directory, entry.name));
        if (maxFileSize && stats.size > maxFileSize) continue;

        files.push(path.join(directory, entry.name));
      }
    } catch (_error) {
      // 目录不存在，忽略
    }

    return files;
  }

  /**
   * 读取工作区文件
   */
  async readWorkspaceFile(relPath: string): Promise<string> {
    const fs = await import('node:fs/promises');
    return fs.readFile(relPath, 'utf-8');
  }

  /**
   * 构建完整的上下文
   * - 按优先级组装所有记忆层
   */
  async buildContext(sessionKey: string, query: string): Promise<string> {
    const parts: string[] = [];

    // 1. 远程记忆 (最高优先级，每次都加载)
    const remote = await this.getRemoteMemory();
    if (remote) {
      parts.push(`=== REMOTE MEMORY ===\n${remote}`);
    }

    // 2. 短期记忆 (直接追加)
    const short = await this.getShortMemory(sessionKey);
    if (short) {
      parts.push(`=== SHORT MEMORY (Current Session) ===\n${short}`);
    }

    // 3. 向量记忆 (按需搜索)
    const vectorResults = await this.getVectorMemory(query);
    if (vectorResults.length > 0) {
      const vectorText = vectorResults
        .map((r) => `[${r.path}:${r.startLine}]\n${r.snippet}`)
        .join('\n\n---\n\n');
      parts.push(`=== RELEVANT MEMORY ===\n${vectorText}`);
    }

    // 4. 工作区文件列表 (让 Agent 自己决定是否读取)
    const workspaceFiles = await this.listWorkspaceFiles();
    if (workspaceFiles.length > 0) {
      parts.push(
        `=== WORKSPACE FILES (read if needed) ===\n${workspaceFiles.map((f) => `- ${f}`).join('\n')}`
      );
    }

    return parts.join('\n\n');
  }
}

/**
 * 创建统一记忆管理器
 */
export function createUnifiedMemoryManager(
  config?: Partial<UnifiedMemoryConfig>
): UnifiedMemoryManager {
  return new UnifiedMemoryManager(config);
}
