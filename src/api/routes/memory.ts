/**
 * Memory API Routes
 *
 * Uses MemoryPersistence for persistent storage (no more in-memory Map!)
 * Integrates with MemoryIndexManager for RAG search capabilities.
 */

import { Router, Request, Response } from 'express';
import { getMemoryPersistence, MemoryEntry } from '../../memory/persistence.js';
import { getMemoryIndexManager } from '../../memory/manager.js';
import type { MemorySearchConfig, MemorySearchResult } from '../../memory/types.js';
import path from 'node:path';

// Re-export for backwards compatibility
export type { MemoryEntry };

// Default RAG configuration - uses memory/memory workspace
const DEFAULT_WORKSPACE_DIR = 'memory/memory';

const DEFAULT_RAG_CONFIG: MemorySearchConfig = {
  enabled: true,
  provider: 'ollama',
  model: 'nomic-embed-text',
  sources: ['memory', 'sessions'],
  extraPaths: [],
  fallback: 'offline',
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

export function createMemoryRouter(): Router {
  const router = Router();

  // GET /memory/short-term
  router.get('/memory/short-term', async (req: Request, res: Response) => {
    const agentId = (req.query.agent_id as string) || 'core_brain';
    const limit = parseInt(req.query.limit as string) || 20;

    const persistence = getMemoryPersistence(agentId);
    const memories = await persistence.getByType('short_term');
    const sorted = [...memories].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    res.json({
      memories: sorted.slice(0, limit),
      total: sorted.length
    });
  });

  // GET /memory/long-term
  router.get('/memory/long-term', async (req: Request, res: Response) => {
    const agentId = (req.query.agent_id as string) || 'core_brain';
    const limit = parseInt(req.query.limit as string) || 20;

    const persistence = getMemoryPersistence(agentId);
    const memories = await persistence.getByType('long_term');
    const sorted = [...memories].sort(
      (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)
    );

    res.json({
      memories: sorted.slice(0, limit),
      total: sorted.length
    });
  });

  // GET /memory/handover
  router.get('/memory/handover', async (req: Request, res: Response) => {
    const agentId = (req.query.agent_id as string) || 'core_brain';

    const persistence = getMemoryPersistence(agentId);
    const memories = await persistence.getByType('handover');

    res.json({ memories });
  });

  // GET /memory/stats
  router.get('/memory/stats', async (req: Request, res: Response) => {
    const agentId = (req.query.agent_id as string) || 'core_brain';

    const persistence = getMemoryPersistence(agentId);
    const stats = await persistence.getStats();

    res.json({
      agent_id: agentId,
      stats: {
        total_count: stats.total,
        short_term_count: stats.short_term,
        long_term_count: stats.long_term,
        handover_count: stats.handover
      }
    });
  });

  // GET /memory/status - Get memory and RAG status
  router.get('/memory/status', async (req: Request, res: Response) => {
    const agentId = (req.query.agent_id as string) || 'core_brain';

    // Try to get RAG index status
    let ragStatus = null;
    try {
      const manager = await getMemoryIndexManager({
        agentId,
        workspaceDir: DEFAULT_WORKSPACE_DIR,
        config: DEFAULT_RAG_CONFIG,
      });
      ragStatus = manager.status();
    } catch (error) {
      console.error('Error getting RAG status:', error);
    }

    res.json({
      agent_id: agentId,
      status: ragStatus || {
        backend: 'persistence',
        provider: 'file',
        chunks: 0,
        files: 0,
        dirty: false,
        vector: { enabled: true, available: ragStatus !== null },
        fts: { enabled: true, available: true }
      },
      rag_available: ragStatus !== null
    });
  });

  // GET /memory/search - RAG search across indexed content
  router.get('/memory/search', async (req: Request, res: Response) => {
    const query = req.query.query as string;
    if (!query) {
      res.status(400).json({ error: 'Query is required' });
      return;
    }

    const agentId = (req.query.agent_id as string) || 'core_brain';
    const limit = parseInt(req.query.limit as string) || 20;
    const searchType = req.query.type as string || 'rag'; // 'rag' or 'memory'

    // Use RAG search by default - searches indexed files
    if (searchType === 'rag') {
      try {
        const manager = await getMemoryIndexManager({
          agentId,
          workspaceDir: DEFAULT_WORKSPACE_DIR,
          config: DEFAULT_RAG_CONFIG,
        });

        const results = await manager.search(query, { maxResults: limit });

        res.json({
          query,
          results: results.map((r) => ({
            memory_id: r.path,
            relevance: r.score,
            content: { value: r.snippet },
            path: r.path,
            startLine: r.startLine,
            endLine: r.endLine,
            source: r.source,
            created_at: new Date().toISOString()
          })),
          total: results.length,
          type: 'rag'
        });
        return;
      } catch (error) {
        console.error('RAG search error:', error);
        // Fall through to memory search if RAG fails
      }
    }

    // Fallback: search memory entries
    const persistence = getMemoryPersistence(agentId);
    const results = await persistence.search(query);

    res.json({
      query,
      results: results.slice(0, limit).map(m => ({
        memory_id: m.id,
        relevance: 1,
        content: m.content,
        created_at: m.created_at
      })),
      total: results.length,
      type: 'memory'
    });
  });

  // GET /memory/summary
  router.get('/memory/summary', async (req: Request, res: Response) => {
    const agentId = (req.query.agent_id as string) || 'core_brain';
    const memoryType = (req.query.memory_type as string) || 'short_term';

    const persistence = getMemoryPersistence(agentId);
    const memories = await persistence.getByType(memoryType as 'short_term' | 'long_term' | 'handover');
    const topics = [...new Set(memories.map(m => m.content.key).filter(Boolean))];

    res.json({
      status: 'success',
      memory_type: memoryType,
      memory_count: memories.length,
      topics
    });
  });

  // POST /memory/write
  router.post('/memory/write', async (req: Request, res: Response) => {
    const { content, agent_id, memory_type, metadata } = req.body;

    if (!content) {
      res.status(400).json({ error: 'Content is required' });
      return;
    }

    const agentId = agent_id || 'core_brain';
    const type = (memory_type || 'short_term') as 'short_term' | 'long_term' | 'handover';

    const persistence = getMemoryPersistence(agentId);

    const memory = await persistence.add({
      agent_id: agentId,
      type,
      content: {
        value: content,
        metadata
      }
    });

    // Enforce limits for short-term memory
    if (type === 'short_term') {
      await persistence.enforceLimits(100);
    }

    res.json({
      status: 'success',
      memory_id: memory.id,
      path: `memory/memory/${agentId}_${type}.json`
    });
  });

  // DELETE /memory/:memoryId
  router.delete('/memory/:memoryId', async (req: Request, res: Response) => {
    const memoryId = req.params.memoryId as string;
    const agentId = (req.query.agent_id as string) || 'core_brain';

    const persistence = getMemoryPersistence(agentId);
    const deleted = await persistence.remove(memoryId);

    if (!deleted) {
      res.status(404).json({ error: 'Memory not found' });
      return;
    }

    res.json({
      status: 'success',
      message: 'Memory deleted'
    });
  });

  return router;
}
