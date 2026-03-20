/**
 * Team Memory - 团队共享记忆
 *
 * 提供团队级别的知识共享：
 * - 队友可写入经验/事实
 * - 队友可查询历史
 * - 自动过期清理
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

const getStorageDir = (): string => {
  // 支持环境变量自定义目录
  if (process.env.TEAM_MEMORY_DIR) {
    return process.env.TEAM_MEMORY_DIR;
  }
  return path.join(process.cwd(), 'storage', 'team_memory');
};

/**
 * 记忆条目
 */
export interface TeamMemoryEntry {
  id: string;
  agent: string;
  content: string;
  tags: string[];
  createdAt: number;
  expiresAt?: number;
}

/**
 * 确保存储目录存在
 */
function ensureStorageDir(): void {
  if (!fs.existsSync(getStorageDir())) {
    fs.mkdirSync(getStorageDir(), { recursive: true });
  }
}

/**
 * 保存记忆
 */
function saveMemory(entry: TeamMemoryEntry): void {
  ensureStorageDir();
  const filePath = path.join(getStorageDir(), `${entry.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(entry, null, 2), 'utf-8');
}

/**
 * 加载记忆
 */
function loadMemory(id: string): TeamMemoryEntry | null {
  const filePath = path.join(getStorageDir(), `${id}.json`);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as TeamMemoryEntry;
  } catch {
    return null;
  }
}

/**
 * 获取所有记忆
 */
function getAllMemories(): TeamMemoryEntry[] {
  ensureStorageDir();
  const files = fs.readdirSync(getStorageDir()).filter(f => f.endsWith('.json'));
  const memories: TeamMemoryEntry[] = [];

  for (const file of files) {
    const id = file.replace('.json', '');
    const memory = loadMemory(id);
    if (memory) {
      memories.push(memory);
    }
  }

  return memories.sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * 团队记忆管理器
 */
class TeamMemoryManager {
  private static instance: TeamMemoryManager;
  private defaultTtlMs: number = 7 * 24 * 60 * 60 * 1000; // 默认 7 天

  private constructor() {}

  static getInstance(): TeamMemoryManager {
    if (!TeamMemoryManager.instance) {
      TeamMemoryManager.instance = new TeamMemoryManager();
    }
    return TeamMemoryManager.instance;
  }

  /**
   * 设置默认 TTL
   */
  setDefaultTtl(ttlMs: number): void {
    this.defaultTtlMs = ttlMs;
  }

  /**
   * 写入记忆
   */
  write(agent: string, content: string, tags: string[] = [], ttlMs?: number): string {
    const entry: TeamMemoryEntry = {
      id: `mem_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      agent,
      content,
      tags,
      createdAt: Date.now(),
      expiresAt: ttlMs ? Date.now() + ttlMs : (Date.now() + this.defaultTtlMs),
    };

    saveMemory(entry);
    return entry.id;
  }

  /**
   * 读取/查询记忆
   */
  read(query: string, limit: number = 10): TeamMemoryEntry[] {
    const all = getAllMemories();
    const now = Date.now();

    // 过滤掉过期的
    const valid = all.filter(m => !m.expiresAt || m.expiresAt > now);

    if (!query) {
      return valid.slice(0, limit);
    }

    // 简单关键词匹配
    const keywords = query.toLowerCase().split(/\s+/);
    const scored = valid.map(m => {
      let score = 0;
      const contentLower = m.content.toLowerCase();

      for (const kw of keywords) {
        if (contentLower.includes(kw)) {
          score += 1;
        }
        if (m.tags.some(t => t.toLowerCase().includes(kw))) {
          score += 2; // 标签匹配权重更高
        }
      }

      return { entry: m, score };
    });

    // 按分数排序
    return scored
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(s => s.entry)
      .slice(0, limit);
  }

  /**
   * 列出所有记忆
   */
  list(limit: number = 50): TeamMemoryEntry[] {
    const all = getAllMemories();
    const now = Date.now();

    // 过滤掉过期的
    const valid = all.filter(m => !m.expiresAt || m.expiresAt > now);
    return valid.slice(0, limit);
  }

  /**
   * 获取特定 agent 的记忆
   */
  listByAgent(agent: string, limit: number = 20): TeamMemoryEntry[] {
    const all = getAllMemories();
    const now = Date.now();

    return all
      .filter(m => m.agent === agent && (!m.expiresAt || m.expiresAt > now))
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);
  }

  /**
   * 删除记忆
   */
  delete(id: string): boolean {
    const filePath = path.join(getStorageDir(), `${id}.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  }

  /**
   * 清理过期记忆
   */
  cleanup(): number {
    const all = getAllMemories();
    const now = Date.now();
    let count = 0;

    for (const m of all) {
      if (m.expiresAt && m.expiresAt <= now) {
        this.delete(m.id);
        count++;
      }
    }

    return count;
  }

  /**
   * 获取统计信息
   */
  getStats(): { total: number; expired: number; byAgent: Record<string, number> } {
    const all = getAllMemories();
    const now = Date.now();
    const byAgent: Record<string, number> = {};

    let expired = 0;
    for (const m of all) {
      if (m.expiresAt && m.expiresAt <= now) {
        expired++;
      }
      byAgent[m.agent] = (byAgent[m.agent] || 0) + 1;
    }

    return {
      total: all.length,
      expired,
      byAgent,
    };
  }
}

/**
 * 获取团队记忆管理器
 */
export function getTeamMemoryManager(): TeamMemoryManager {
  return TeamMemoryManager.getInstance();
}

// 便捷函数
export function teamMemoryWrite(agent: string, content: string, tags?: string[]): string {
  return getTeamMemoryManager().write(agent, content, tags);
}

export function teamMemoryRead(query: string, limit?: number): TeamMemoryEntry[] {
  return getTeamMemoryManager().read(query, limit);
}

export function teamMemoryList(limit?: number): TeamMemoryEntry[] {
  return getTeamMemoryManager().list(limit);
}

export function teamMemoryListByAgent(agent: string, limit?: number): TeamMemoryEntry[] {
  return getTeamMemoryManager().listByAgent(agent, limit);
}

export function teamMemoryDelete(id: string): boolean {
  return getTeamMemoryManager().delete(id);
}

export function teamMemoryCleanup(): number {
  return getTeamMemoryManager().cleanup();
}

export function teamMemoryStats() {
  return getTeamMemoryManager().getStats();
}
