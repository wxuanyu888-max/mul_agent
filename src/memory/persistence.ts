/**
 * Memory Persistence Layer
 *
 * Provides persistent storage for memory entries.
 * Implements Repository interface for consistent data access.
 */

import path from 'node:path';
import { getMemoryPath } from '../utils/path.js';
import { atomicWriteJson, atomicReadJson, ensureDir, withFileLock } from '../utils/file-lock.js';
import { Repository, createStorageError, StorageErrorCode } from '../storage/repository.js';

export interface MemoryEntry {
  id: string;
  agent_id: string;
  type: 'short_term' | 'long_term' | 'handover';
  content: {
    key?: string;
    value: string;
    metadata?: Record<string, unknown>;
  };
  created_at: string;
  updated_at: string;
}

const DEFAULT_AGENT_ID = 'core_brain';
const DEFAULT_MEMORY_DIR = getMemoryPath();

/**
 * Get the memory file path for an agent
 */
function getMemoryFilePath(agentId: string): string {
  return path.join(DEFAULT_MEMORY_DIR, `memories_${agentId}.json`);
}

/**
 * Ensure memory directory exists
 */
async function ensureMemoryDir(): Promise<void> {
  await ensureDir(DEFAULT_MEMORY_DIR);
}

/**
 * Load memories for an agent
 */
async function loadMemories(agentId: string): Promise<MemoryEntry[]> {
  await ensureMemoryDir();
  const data = await atomicReadJson<MemoryEntry[]>(getMemoryFilePath(agentId));
  return data || [];
}

/**
 * Save memories for an agent
 */
async function saveMemories(agentId: string, memories: MemoryEntry[]): Promise<void> {
  await ensureMemoryDir();
  await atomicWriteJson(getMemoryFilePath(agentId), memories);
}

/**
 * Memory Persistence Manager
 * Implements Repository interface for consistent data access
 */
export class MemoryPersistence implements Repository<MemoryEntry> {
  private agentId: string;

  constructor(agentId: string) {
    this.agentId = agentId || DEFAULT_AGENT_ID;
  }

  /**
   * Find memory by ID (implements Repository.findById)
   */
  async findById(id: string): Promise<MemoryEntry | null> {
    return this.getById(id);
  }

  /**
   * Find all memories (implements Repository.findAll)
   */
  async findAll(): Promise<MemoryEntry[]> {
    return this.getAll();
  }

  /**
   * Save a memory (implements Repository.save)
   * Note: This saves the entire memory list, not a single entity
   */
  async save(entity: MemoryEntry): Promise<void> {
    await withFileLock(getMemoryFilePath(this.agentId), async () => {
      const memories = await this.getAll();
      const index = memories.findIndex((m) => m.id === entity.id);
      if (index >= 0) {
        memories[index] = entity;
      } else {
        memories.push(entity);
      }
      await saveMemories(this.agentId, memories);
    });
  }

  /**
   * Delete a memory by ID (implements Repository.delete)
   */
  async delete(id: string): Promise<void> {
    await withFileLock(getMemoryFilePath(this.agentId), async () => {
      const memories = await loadMemories(this.agentId);
      const filtered = memories.filter((m) => m.id !== id);

      if (filtered.length === memories.length) {
        throw createStorageError('NOT_FOUND', `Memory ${id} not found`, { memoryId: id });
      }

      await saveMemories(this.agentId, filtered);
    });
  }

  /**
   * Get all memories for this agent
   */
  async getAll(): Promise<MemoryEntry[]> {
    return loadMemories(this.agentId);
  }

  /**
   * Get memories by type
   */
  async getByType(type: 'short_term' | 'long_term' | 'handover'): Promise<MemoryEntry[]> {
    const memories = await this.getAll();
    return memories.filter((m) => m.type === type);
  }

  /**
   * Get a single memory by ID
   */
  async getById(memoryId: string): Promise<MemoryEntry | null> {
    const memories = await this.getAll();
    return memories.find((m) => m.id === memoryId) || null;
  }

  /**
   * Add a new memory
   */
  async add(memory: Omit<MemoryEntry, 'id' | 'created_at' | 'updated_at'>): Promise<MemoryEntry> {
    const newMemory: MemoryEntry = {
      ...memory,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await withFileLock(getMemoryFilePath(this.agentId), async () => {
      const memories = await this.getAll();
      memories.push(newMemory);
      await saveMemories(this.agentId, memories);
    });

    return newMemory;
  }

  /**
   * Update a memory
   */
  async update(
    memoryId: string,
    updates: Partial<Pick<MemoryEntry, 'content' | 'type'>>
  ): Promise<MemoryEntry | null> {
    let updatedMemory: MemoryEntry | null = null;

    await withFileLock(getMemoryFilePath(this.agentId), async () => {
      const memories = await this.getAll();
      const index = memories.findIndex((m) => m.id === memoryId);

      if (index === -1) {
        return;
      }

      memories[index] = {
        ...memories[index],
        ...updates,
        updated_at: new Date().toISOString(),
      };

      updatedMemory = memories[index];
      await saveMemories(this.agentId, memories);
    });

    return updatedMemory;
  }

  /**
   * Delete a memory (legacy method, returns boolean)
   */
  async remove(memoryId: string): Promise<boolean> {
    let deleted = false;

    await withFileLock(getMemoryFilePath(this.agentId), async () => {
      const memories = await loadMemories(this.agentId);
      const filtered = memories.filter((m) => m.id !== memoryId);

      if (filtered.length === memories.length) {
        return;
      }

      deleted = true;
      await saveMemories(this.agentId, filtered);
    });

    return deleted;
  }

  /**
   * Search memories by content
   */
  async search(query: string): Promise<MemoryEntry[]> {
    const memories = await this.getAll();
    const queryLower = query.toLowerCase();

    return memories
      .filter((m) => m.content.value.toLowerCase().includes(queryLower))
      .sort((a, b) => {
        // Prioritize exact matches at the start
        const aStarts = a.content.value.toLowerCase().indexOf(queryLower) === 0 ? 1 : 0;
        const bStarts = b.content.value.toLowerCase().indexOf(queryLower) === 0 ? 1 : 0;
        if (aStarts !== bStarts) return bStarts - aStarts;

        // Then by relevance score (simple text matching)
        const aIndex = a.content.value.toLowerCase().indexOf(queryLower);
        const bIndex = b.content.value.toLowerCase().indexOf(queryLower);
        if (aIndex !== bIndex) return aIndex - bIndex;

        // Then by date (newer first)
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }

  /**
   * Get statistics
   */
  async getStats(): Promise<{
    total: number;
    short_term: number;
    long_term: number;
    handover: number;
  }> {
    const memories = await this.getAll();
    return {
      total: memories.length,
      short_term: memories.filter((m) => m.type === 'short_term').length,
      long_term: memories.filter((m) => m.type === 'long_term').length,
      handover: memories.filter((m) => m.type === 'handover').length,
    };
  }

  /**
   * Enforce storage limits (e.g., max 100 short_term memories)
   */
  async enforceLimits(maxShortTerm = 100): Promise<void> {
    await withFileLock(getMemoryFilePath(this.agentId), async () => {
      const memories = await this.getAll();

      const shortTermMemories = memories.filter((m) => m.type === 'short_term');
      const otherMemories = memories.filter((m) => m.type !== 'short_term');

      if (shortTermMemories.length > maxShortTerm) {
        // Sort by created_at (oldest first) and keep only the most recent maxShortTerm
        shortTermMemories.sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        const toKeep = shortTermMemories.slice(-maxShortTerm);
        await saveMemories(this.agentId, [...toKeep, ...otherMemories]);
      }
    });
  }
}

// Global cache for persistence instances
const instances = new Map<string, MemoryPersistence>();

/**
 * Get a MemoryPersistence instance for an agent
 */
export function getMemoryPersistence(agentId?: string): MemoryPersistence {
  const id = agentId || DEFAULT_AGENT_ID;
  if (!instances.has(id)) {
    instances.set(id, new MemoryPersistence(id));
  }
  return instances.get(id)!;
}

/**
 * Reset all persistence instances (for testing)
 */
export function resetMemoryPersistence(): void {
  instances.clear();
}
