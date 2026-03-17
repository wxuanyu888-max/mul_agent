/**
 * Memory API Routes
 *
 * Reuses the memory routes from src/memory/routes.ts
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';

// Types matching the frontend
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

// In-memory storage
const memoryStore: Map<string, MemoryEntry[]> = new Map();

function getAgentMemories(agentId: string): MemoryEntry[] {
  const key = agentId || 'core_brain';
  if (!memoryStore.has(key)) {
    memoryStore.set(key, []);
  }
  return memoryStore.get(key)!;
}

export function createMemoryRouter(): Router {
  const router = Router();

  // GET /memory/short-term
  router.get('/memory/short-term', (req: Request, res: Response) => {
    const agentId = (req.query.agent_id as string) || 'core_brain';
    const limit = parseInt(req.query.limit as string) || 20;

    const memories = getAgentMemories(agentId).filter(m => m.type === 'short_term');
    const sorted = [...memories].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    res.json({
      memories: sorted.slice(0, limit),
      total: sorted.length
    });
  });

  // GET /memory/long-term
  router.get('/memory/long-term', (req: Request, res: Response) => {
    const agentId = (req.query.agent_id as string) || 'core_brain';
    const limit = parseInt(req.query.limit as string) || 20;

    const memories = getAgentMemories(agentId).filter(m => m.type === 'long_term');
    const sorted = [...memories].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    res.json({
      memories: sorted.slice(0, limit),
      total: sorted.length
    });
  });

  // GET /memory/handover
  router.get('/memory/handover', (req: Request, res: Response) => {
    const agentId = (req.query.agent_id as string) || 'core_brain';
    const memories = getAgentMemories(agentId).filter(m => m.type === 'handover');

    res.json({ memories });
  });

  // GET /memory/stats
  router.get('/memory/stats', (req: Request, res: Response) => {
    const agentId = (req.query.agent_id as string) || 'core_brain';
    const memories = getAgentMemories(agentId);

    res.json({
      agent_id: agentId,
      stats: {
        total_count: memories.length,
        short_term_count: memories.filter(m => m.type === 'short_term').length,
        long_term_count: memories.filter(m => m.type === 'long_term').length,
        handover_count: memories.filter(m => m.type === 'handover').length
      }
    });
  });

  // GET /memory/status
  router.get('/memory/status', (req: Request, res: Response) => {
    const agentId = (req.query.agent_id as string) || 'core_brain';

    res.json({
      agent_id: agentId,
      status: {
        backend: 'builtin',
        provider: 'none',
        chunks: 0,
        files: 0,
        dirty: false,
        vector: { enabled: false, available: false },
        fts: { enabled: true, available: true }
      }
    });
  });

  // GET /memory/search
  router.get('/memory/search', (req: Request, res: Response) => {
    const query = req.query.query as string;
    if (!query) {
      res.status(400).json({ error: 'Query is required' });
      return;
    }

    const agentId = (req.query.agent_id as string) || 'core_brain';
    const memoryType = req.query.memory_type as string;
    const limit = parseInt(req.query.limit as string) || 20;

    let memories = getAgentMemories(agentId);

    if (memoryType) {
      memories = memories.filter(m => m.type === memoryType);
    }

    // Simple text search
    const queryLower = query.toLowerCase();
    const results = memories
      .filter(m => m.content.value.toLowerCase().includes(queryLower))
      .map(m => ({
        memory_id: m.id,
        relevance: m.content.value.toLowerCase().indexOf(queryLower) === 0 ? 1 : 0.5,
        content: m.content,
        created_at: m.created_at
      }))
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, limit);

    res.json({
      query,
      results,
      total: results.length
    });
  });

  // GET /memory/summary
  router.get('/memory/summary', (req: Request, res: Response) => {
    const agentId = (req.query.agent_id as string) || 'core_brain';
    const memoryType = (req.query.memory_type as string) || 'short_term';

    const memories = getAgentMemories(agentId).filter(m => m.type === memoryType);
    const topics = [...new Set(memories.map(m => m.content.key).filter(Boolean))];

    res.json({
      status: 'success',
      memory_type: memoryType,
      memory_count: memories.length,
      topics
    });
  });

  // POST /memory/write
  router.post('/memory/write', (req: Request, res: Response) => {
    const { content, agent_id, memory_type, metadata } = req.body;

    if (!content) {
      res.status(400).json({ error: 'Content is required' });
      return;
    }

    const agentId = agent_id || 'core_brain';
    const type = memory_type || 'short_term';

    const memory: MemoryEntry = {
      id: crypto.randomUUID(),
      agent_id: agentId,
      type,
      content: {
        value: content,
        metadata
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const memories = getAgentMemories(agentId);

    // Limit short-term memory size
    if (type === 'short_term' && memories.filter(m => m.type === 'short_term').length >= 100) {
      const oldestIdx = memories
        .filter(m => m.type === 'short_term')
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        .findIndex(m => m.id);
      if (oldestIdx >= 0) {
        memories.splice(oldestIdx, 1);
      }
    }

    memories.push(memory);

    res.json({
      status: 'success',
      memory_id: memory.id,
      path: `storage/memory/${agentId}_${type}.json`
    });
  });

  // DELETE /memory/:memoryId
  router.delete('/memory/:memoryId', (req: Request, res: Response) => {
    const memoryId = req.params.memoryId as string;
    const agentId = (req.query.agent_id as string) || 'core_brain';

    const memories = getAgentMemories(agentId);
    const index = memories.findIndex(m => m.id === memoryId);

    if (index === -1) {
      res.status(404).json({ error: 'Memory not found' });
      return;
    }

    memories.splice(index, 1);

    res.json({
      status: 'success',
      message: 'Memory deleted'
    });
  });

  return router;
}
