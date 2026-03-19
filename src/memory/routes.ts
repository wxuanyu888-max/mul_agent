/**
 * Memory API Routes
 *
 * Complete REST API endpoints for memory management.
 */

import { type Request, type Response, Router } from 'express';
import {
  type WriteMemoryRequest,
  type SearchMemoryRequest,
  type MemorySearchConfig,
} from './types.js';
import { getMemoryIndexManager, MemoryIndexManager } from './manager.js';

const DEFAULT_AGENT_ID = 'core_brain';
const DEFAULT_WORKSPACE_DIR = 'storage/memory';

// Default memory search configuration
const DEFAULT_MEMORY_CONFIG: MemorySearchConfig = {
  enabled: true,
  provider: 'auto',
  model: 'text-embedding-3-small',
  sources: ['memory', 'sessions'],
  fallback: 'none',
  vector: {
    enabled: true,
  },
  fts: {
    enabled: true,
  },
  cache: {
    enabled: true,
    maxEntries: 1000,
  },
  batch: {
    enabled: false,
    wait: true,
    concurrency: 5,
    pollIntervalMs: 1000,
    timeoutMs: 60000,
  },
};

// In-memory storage for high-level memory operations
// (In production, this would be a database)
interface MemoryEntry {
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

const memoryStore: Map<string, MemoryEntry[]> = new Map();

function getAgentMemories(agentId: string): MemoryEntry[] {
  const key = agentId || DEFAULT_AGENT_ID;
  if (!memoryStore.has(key)) {
    memoryStore.set(key, []);
  }
  return memoryStore.get(key)!;
}

// ============================================================================
// Express Router Factory
// ============================================================================

export function createMemoryRouter(): Router {
  const router = Router();

  // GET /memory/short-term - Get short-term memories
  router.get('/short-term', async (req: Request, res: Response) => {
    try {
      const agentId = (req.query.agent_id as string) || DEFAULT_AGENT_ID;
      const limit = parseInt(req.query.limit as string) || 20;

      const memories = getAgentMemories(agentId).filter((m) => m.type === 'short_term');

      // Sort by created_at descending
      const sorted = [...memories].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      res.json({
        memories: sorted.slice(0, limit),
        total: sorted.length,
      });
    } catch (error) {
      console.error('Error getting short-term memories:', error);
      res.status(500).json({ error: 'Failed to get short-term memories' });
    }
  });

  // GET /memory/long-term - Get long-term memories
  router.get('/long-term', async (req: Request, res: Response) => {
    try {
      const agentId = (req.query.agent_id as string) || DEFAULT_AGENT_ID;
      const limit = parseInt(req.query.limit as string) || 20;

      const memories = getAgentMemories(agentId).filter((m) => m.type === 'long_term');

      const sorted = [...memories].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      res.json({
        memories: sorted.slice(0, limit),
        total: sorted.length,
      });
    } catch (error) {
      console.error('Error getting long-term memories:', error);
      res.status(500).json({ error: 'Failed to get long-term memories' });
    }
  });

  // GET /memory/handover - Get handover memories
  router.get('/handover', async (req: Request, res: Response) => {
    try {
      const agentId = (req.query.agent_id as string) || DEFAULT_AGENT_ID;

      const memories = getAgentMemories(agentId).filter((m) => m.type === 'handover');

      res.json({
        memories,
      });
    } catch (error) {
      console.error('Error getting handover memories:', error);
      res.status(500).json({ error: 'Failed to get handover memories' });
    }
  });

  // GET /memory/stats - Get memory statistics
  router.get('/stats', async (req: Request, res: Response) => {
    try {
      const agentId = (req.query.agent_id as string) || DEFAULT_AGENT_ID;
      const memories = getAgentMemories(agentId);

      // Get index manager status if available
      let indexStatus = null;
      try {
        const workspaceDir = DEFAULT_WORKSPACE_DIR;
        const manager = await getMemoryIndexManager({
          agentId,
          workspaceDir,
          config: DEFAULT_MEMORY_CONFIG,
        });
        indexStatus = manager.status();
      } catch {
        // Index manager might not be available
      }

      res.json({
        agent_id: agentId,
        stats: {
          total_count: memories.length,
          short_term_count: memories.filter((m) => m.type === 'short_term').length,
          long_term_count: memories.filter((m) => m.type === 'long_term').length,
          handover_count: memories.filter((m) => m.type === 'handover').length,
          index_status: indexStatus,
        },
      });
    } catch (error) {
      console.error('Error getting memory stats:', error);
      res.status(500).json({ error: 'Failed to get memory stats' });
    }
  });

  // GET /memory/search - Search memories
  router.get('/search', async (req: Request, res: Response) => {
    try {
      const query = req.query.query as string;
      if (!query) {
        res.status(400).json({ error: 'Query is required' });
        return;
      }

      const agentId = (req.query.agent_id as string) || DEFAULT_AGENT_ID;
      const memoryType = req.query.memory_type as 'short_term' | 'long_term' | 'handover' | undefined;
      const limit = parseInt(req.query.limit as string) || 20;

      // First try text-based search
      let memories = getAgentMemories(agentId);

      if (memoryType) {
        memories = memories.filter((m) => m.type === memoryType);
      }

      // Simple text search
      const queryLower = query.toLowerCase();
      const results = memories
        .filter((m) => m.content.value.toLowerCase().includes(queryLower))
        .map((m) => ({
          memory_id: m.id,
          relevance: m.content.value.toLowerCase().indexOf(queryLower) === 0 ? 1 : 0.5,
          content: m.content,
          created_at: m.created_at,
        }))
        .sort((a, b) => b.relevance - a.relevance)
        .slice(0, limit);

      // Try vector search if available
      try {
        const workspaceDir = DEFAULT_WORKSPACE_DIR;
        const manager = await getMemoryIndexManager({
          agentId,
          workspaceDir,
          config: DEFAULT_MEMORY_CONFIG,
        });

        const searchResults = await manager.search(query, { maxResults: limit });

        // Merge with text results
        for (const sr of searchResults) {
          results.push({
            memory_id: sr.path,
            relevance: sr.score,
            content: { value: sr.snippet },
            created_at: new Date().toISOString(),
          });
        }
      } catch {
        // Vector search might not be available
      }

      res.json({
        query,
        results: results.slice(0, limit),
        total: results.length,
      });
    } catch (error) {
      console.error('Error searching memories:', error);
      res.status(500).json({ error: 'Failed to search memories' });
    }
  });

  // GET /memory/summary - Get memory summary
  router.get('/summary', async (req: Request, res: Response) => {
    try {
      const agentId = (req.query.agent_id as string) || DEFAULT_AGENT_ID;
      const memoryType = (req.query.memory_type as string) || 'short_term';

      const memories = getAgentMemories(agentId).filter((m) => m.type === memoryType);

      // Extract topics from keys
      const topics = [...new Set(memories.map((m) => m.content.key).filter(Boolean))];

      res.json({
        status: 'success',
        memory_type: memoryType,
        memory_count: memories.length,
        topics,
      });
    } catch (error) {
      console.error('Error getting memory summary:', error);
      res.status(500).json({ error: 'Failed to get memory summary' });
    }
  });

  // POST /memory/write - Write a new memory
  router.post('/write', async (req: Request, res: Response) => {
    try {
      const { content, agent_id, memory_type, metadata } = req.body as WriteMemoryRequest;

      // Input validation
      if (!content) {
        res.status(400).json({ error: 'Content is required' });
        return;
      }

      // Validate content length
      if (typeof content !== 'string' || content.length > 100000) {
        res.status(400).json({ error: 'Content must be a string with max 100000 characters' });
        return;
      }

      // Validate agent_id if provided
      if (agent_id && typeof agent_id !== 'string') {
        res.status(400).json({ error: 'agent_id must be a string' });
        return;
      }

      // Validate memory_type if provided
      if (memory_type && !['short_term', 'long_term', 'handover'].includes(memory_type)) {
        res.status(400).json({ error: 'memory_type must be short_term, long_term, or handover' });
        return;
      }

      const agentId = agent_id || DEFAULT_AGENT_ID;
      const type = memory_type || 'short_term';

      const memory: MemoryEntry = {
        id: crypto.randomUUID(),
        agent_id: agentId,
        type,
        content: {
          value: content,
          metadata,
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // For short-term memory, limit the size - use immutable pattern
      const memories = getAgentMemories(agentId);
      let updatedMemories = [...memories];

      if (type === 'short_term' && updatedMemories.filter((m) => m.type === 'short_term').length >= 100) {
        // Remove oldest short-term memory (immutable)
        const oldestMemory = updatedMemories
          .filter((m) => m.type === 'short_term')
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0];

        if (oldestMemory) {
          updatedMemories = updatedMemories.filter((m) => m.id !== oldestMemory.id);
        }
      }

      updatedMemories.push(memory);

      // Update the store (clear and set new array)
      memoryStore.set(agentId, updatedMemories);

      // Also index to vector database if available
      try {
        const workspaceDir = DEFAULT_WORKSPACE_DIR;
        const manager = await getMemoryIndexManager({
          agentId,
          workspaceDir,
          config: DEFAULT_MEMORY_CONFIG,
        });

        await manager.sync({ reason: 'memory_write' });
      } catch {
        // Index might not be available
      }

      res.json({
        status: 'success',
        memory_id: memory.id,
        path: `${DEFAULT_WORKSPACE_DIR}/${agentId}_${type}.json`,
      });
    } catch (error) {
      console.error('Error writing memory:', error);
      res.status(500).json({ error: 'Failed to write memory' });
    }
  });

  // DELETE /memory/:memoryId - Delete a memory
  router.delete('/:memoryId', async (req: Request, res: Response) => {
    try {
      const { memoryId } = req.params;
      const agentId = (req.query.agent_id as string) || DEFAULT_AGENT_ID;

      const memories = getAgentMemories(agentId);
      const memoryExists = memories.some((m) => m.id === memoryId);

      if (!memoryExists) {
        res.status(404).json({ error: 'Memory not found' });
        return;
      }

      // Use immutable pattern - filter instead of splice
      const updatedMemories = memories.filter((m) => m.id !== memoryId);
      memoryStore.set(agentId, updatedMemories);

      res.json({
        status: 'success',
        message: 'Memory deleted',
      });
    } catch (error) {
      console.error('Error deleting memory:', error);
      res.status(500).json({ error: 'Failed to delete memory' });
    }
  });

  // POST /memory/sync - Sync memory index
  router.post('/sync', async (req: Request, res: Response) => {
    try {
      const agentId = (req.query.agent_id as string) || DEFAULT_AGENT_ID;
      const workspaceDir = DEFAULT_WORKSPACE_DIR;

      const manager = await getMemoryIndexManager({
        agentId,
        workspaceDir,
        config: DEFAULT_MEMORY_CONFIG,
      });

      await manager.sync({
        reason: 'manual_sync',
        force: true,
      });

      res.json({
        status: 'success',
        message: 'Memory index synced',
      });
    } catch (error) {
      console.error('Error syncing memory index:', error);
      res.status(500).json({ error: 'Failed to sync memory index' });
    }
  });

  // POST /memory/watch - Start file watching
  router.post('/watch/start', async (req: Request, res: Response) => {
    try {
      const agentId = (req.query.agent_id as string) || DEFAULT_AGENT_ID;
      const workspaceDir = DEFAULT_WORKSPACE_DIR;

      const manager = await getMemoryIndexManager({
        agentId,
        workspaceDir,
        config: DEFAULT_MEMORY_CONFIG,
      });

      manager.startFileWatching();

      res.json({
        status: 'success',
        message: 'File watching started',
      });
    } catch (error) {
      console.error('Error starting file watching:', error);
      res.status(500).json({ error: 'Failed to start file watching' });
    }
  });

  // POST /memory/watch/stop - Stop file watching
  router.post('/watch/stop', async (req: Request, res: Response) => {
    try {
      const agentId = (req.query.agent_id as string) || DEFAULT_AGENT_ID;
      const workspaceDir = DEFAULT_WORKSPACE_DIR;

      const manager = await getMemoryIndexManager({
        agentId,
        workspaceDir,
        config: DEFAULT_MEMORY_CONFIG,
      });

      manager.stopFileWatching();

      res.json({
        status: 'success',
        message: 'File watching stopped',
      });
    } catch (error) {
      console.error('Error stopping file watching:', error);
      res.status(500).json({ error: 'Failed to stop file watching' });
    }
  });

  // GET /memory/status - Get memory system status
  router.get('/status', async (req: Request, res: Response) => {
    try {
      const agentId = (req.query.agent_id as string) || DEFAULT_AGENT_ID;
      const workspaceDir = DEFAULT_WORKSPACE_DIR;

      let status = null;

      try {
        const manager = await getMemoryIndexManager({
          agentId,
          workspaceDir,
          config: DEFAULT_MEMORY_CONFIG,
        });

        status = manager.status();
      } catch {
        // Manager might not be available
      }

      res.json({
        agent_id: agentId,
        status,
      });
    } catch (error) {
      console.error('Error getting memory status:', error);
      res.status(500).json({ error: 'Failed to get memory status' });
    }
  });

  return router;
}

// ============================================================================
// Export for compatibility
// ============================================================================

export const getShortTermMemories = async (req: Request, res: Response) => {
  const router = createMemoryRouter();
  // @ts-ignore - Express router methods
  router.handle(req, res);
};

export const getLongTermMemories = async (req: Request, res: Response) => {
  const router = createMemoryRouter();
  // @ts-ignore
  router.handle(req, res);
};

export const getHandoverMemories = async (req: Request, res: Response) => {
  const router = createMemoryRouter();
  // @ts-ignore
  router.handle(req, res);
};

export const getMemoryStats = async (req: Request, res: Response) => {
  const router = createMemoryRouter();
  // @ts-ignore
  router.handle(req, res);
};

export const searchMemories = async (req: Request, res: Response) => {
  const router = createMemoryRouter();
  // @ts-ignore
  router.handle(req, res);
};

export const getMemorySummary = async (req: Request, res: Response) => {
  const router = createMemoryRouter();
  // @ts-ignore
  router.handle(req, res);
};

export const writeMemory = async (req: Request, res: Response) => {
  const router = createMemoryRouter();
  // @ts-ignore
  router.handle(req, res);
};

export const deleteMemory = async (req: Request, res: Response) => {
  const router = createMemoryRouter();
  // @ts-ignore
  router.handle(req, res);
};
