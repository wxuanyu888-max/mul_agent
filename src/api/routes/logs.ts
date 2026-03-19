/**
 * Logs API Routes
 */

import { Router, Request, Response } from 'express';
import { queryLogs } from '../../logger/manager.js';
import fs from 'node:fs/promises';
import path from 'node:path';

const STORAGE_DIR = path.join(process.cwd(), 'storage', 'logs');

interface LogEntry {
  message: string;
  level?: string;
  source?: string;
  datetime?: string;
  id?: string;
  timestamp?: number;
}

export function createLogsRouter(): Router {
  const router = Router();

  // GET /logs
  router.get('/logs', async (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 100;
    const level = req.query.level as string;
    const keyword = req.query.keyword as string;
    const source = req.query.source as string;

    try {
      const logs = await queryLogs({
        limit,
        filter: {
          level: level as 'debug' | 'info' | 'warn' | 'error',
          search: keyword,
          agentId: source || undefined,
        },
      });

      // 转换为前端格式
      const formattedLogs: LogEntry[] = logs.map(log => ({
        message: log.message,
        level: log.level,
        source: log.agentId,
        datetime: log.timestamp ? new Date(log.timestamp).toISOString() : undefined,
        id: log.id,
      }));

      res.json({
        logs: formattedLogs,
        total: formattedLogs.length
      });
    } catch (error) {
      console.error('Error fetching logs:', error);
      res.json({
        logs: [],
        total: 0
      });
    }
  });

  // GET /logs/stats
  router.get('/logs/stats', async (req: Request, res: Response) => {
    try {
      const logs = await queryLogs({ limit: 1000 });

      const stats = {
        total: logs.length,
        by_level: {} as Record<string, number>,
        by_source: {} as Record<string, number>
      };

      for (const log of logs) {
        const level = log.level || 'unknown';
        const src = log.agentId || 'unknown';

        stats.by_level[level] = (stats.by_level[level] || 0) + 1;
        stats.by_source[src] = (stats.by_source[src] || 0) + 1;
      }

      res.json(stats);
    } catch (error) {
      res.json({
        total: 0,
        by_level: {},
        by_source: {}
      });
    }
  });

  // GET /logs/files
  router.get('/logs/files', async (req: Request, res: Response) => {
    try {
      await fs.mkdir(STORAGE_DIR, { recursive: true });
      const entries = await fs.readdir(STORAGE_DIR, { withFileTypes: true });

      const files = [];

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const agentDir = path.join(STORAGE_DIR, entry.name);
          const agentFiles = await fs.readdir(agentDir);

          for (const file of agentFiles) {
            if (file.endsWith('.log')) {
              const filePath = path.join(agentDir, file);
              const stat = await fs.stat(filePath);
              files.push({
                filename: file,
                path: filePath,
                size: stat.size,
                modified: stat.mtime.toISOString()
              });
            }
          }
        }
      }

      res.json({ files });
    } catch (error) {
      res.json({ files: [] });
    }
  });

  return router;
}
