/**
 * Teammates API Routes
 *
 * 提供 teammate 列表、状态查询等 API
 */

import { Router, Request, Response } from 'express';
import { listTeammates, getTeammateStatus, checkTeammateInbox, updateTeammate } from '../../agents/teammate.js';

export function createTeammatesRouter(): Router {
  const router = Router();

  // GET /teammates - 列出所有 teammates
  router.get('/teammates', (_req: Request, res: Response) => {
    try {
      const teammates = listTeammates();
      res.json({ data: teammates });
    } catch (error) {
      console.error('[TeammatesAPI] Failed to list teammates:', error);
      res.status(500).json({ error: 'Failed to list teammates' });
    }
  });

  // GET /teammates/:name - 获取指定 teammate 状态
  router.get('/teammates/:name', (req: Request, res: Response) => {
    try {
      const name = req.params.name as string;
      const status = getTeammateStatus(name);

      if (!status) {
        res.status(404).json({ error: `Teammate "${name}" not found` });
        return;
      }

      res.json({ data: status });
    } catch (error) {
      console.error('[TeammatesAPI] Failed to get teammate status:', error);
      res.status(500).json({ error: 'Failed to get teammate status' });
    }
  });

  // PUT /teammates/:name - 更新 teammate 配置
  router.put('/teammates/:name', (req: Request, res: Response) => {
    try {
      const name = req.params.name as string;
      const { role, prompt } = req.body;

      const updated = updateTeammate(name, { role, prompt });

      if (!updated) {
        res.status(404).json({ error: `Teammate "${name}" not found` });
        return;
      }

      res.json({ data: updated, message: 'Teammate updated successfully' });
    } catch (error) {
      console.error('[TeammatesAPI] Failed to update teammate:', error);
      res.status(500).json({ error: 'Failed to update teammate' });
    }
  });

  // GET /teammates/:name/inbox - 获取收件箱消息
  router.get('/teammates/:name/inbox', (req: Request, res: Response) => {
    try {
      const name = req.params.name as string;
      const messages = checkTeammateInbox(name);

      res.json({ data: JSON.parse(messages) });
    } catch (error) {
      console.error('[TeammatesAPI] Failed to get inbox:', error);
      res.status(500).json({ error: 'Failed to get inbox' });
    }
  });

  return router;
}
