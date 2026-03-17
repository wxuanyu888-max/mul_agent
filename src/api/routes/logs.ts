/**
 * Logs API Routes
 */

import { Router, Request, Response } from 'express';

interface LogEntry {
  message: string;
  level?: string;
  source?: string;
  datetime?: string;
}

// In-memory logs storage
const logsStore: LogEntry[] = [];

export function createLogsRouter(): Router {
  const router = Router();

  // GET /logs
  router.get('/logs', (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 100;
    const level = req.query.level as string;
    const keyword = req.query.keyword as string;
    const source = req.query.source as string;

    let logs = [...logsStore];

    // Filter by level
    if (level) {
      logs = logs.filter(log => log.level === level);
    }

    // Filter by keyword
    if (keyword) {
      const lower = keyword.toLowerCase();
      logs = logs.filter(log => log.message.toLowerCase().includes(lower));
    }

    // Filter by source
    if (source) {
      logs = logs.filter(log => log.source === source);
    }

    res.json({
      logs: logs.slice(-limit),
      total: logs.length
    });
  });

  // GET /logs/stats
  router.get('/logs/stats', (req: Request, res: Response) => {
    const stats = {
      total: logsStore.length,
      by_level: {} as Record<string, number>,
      by_source: {} as Record<string, number>
    };

    for (const log of logsStore) {
      const level = log.level || 'unknown';
      const src = log.source || 'unknown';

      stats.by_level[level] = (stats.by_level[level] || 0) + 1;
      stats.by_source[src] = (stats.by_source[src] || 0) + 1;
    }

    res.json(stats);
  });

  // GET /logs/files
  router.get('/logs/files', (req: Request, res: Response) => {
    res.json({
      files: [
        {
          filename: 'app.log',
          path: 'storage/logs/app.log',
          size: 0,
          modified: new Date().toISOString()
        }
      ]
    });
  });

  return router;
}
