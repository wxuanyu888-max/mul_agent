/**
 * Cron API Routes
 */

import { Router, Request, Response } from 'express';
import { getCronManager } from '../../tools/system/cron-manager.js';
import { notificationSystem } from '../../tools/system/notification.js';

// 初始化 cron 管理器（延迟加载）
getCronManager();

export function createCronRouter(): Router {
  const router = Router();

  // GET /cron/jobs - 列出所有定时任务
  router.get('/cron/jobs', (req: Request, res: Response) => {
    try {
      const manager = getCronManager();
      const jobs = manager.listJobs();

      res.json({
        success: true,
        jobs: jobs.map((job) => ({
          id: job.id,
          label: job.label,
          schedule: job.schedule,
          task: job.task,
          nextRun: new Date(job.nextRun).toISOString(),
          enabled: job.enabled,
          sessionId: job.sessionId || null,
          agentId: job.agentId || null,
        })),
      });
    } catch (error) {
      console.error('Failed to list cron jobs:', error);
      res.status(500).json({ success: false, error: 'Failed to list cron jobs' });
    }
  });

  // GET /cron/pending - 获取待执行的定时任务（用于前端轮询）
  router.get('/cron/pending', (req: Request, res: Response) => {
    try {
      const manager = getCronManager();
      const jobs = manager.listJobs();
      const now = Date.now();

      const pending = jobs.filter((job) => job.enabled && job.nextRun <= now);

      res.json({
        success: true,
        pending: pending.map((job) => ({
          id: job.id,
          label: job.label,
          task: job.task,
          scheduledFor: new Date(job.nextRun).toISOString(),
          sessionId: job.sessionId || null,
          agentId: job.agentId || null,
        })),
      });
    } catch (error) {
      console.error('Failed to get pending cron jobs:', error);
      res.status(500).json({ success: false, error: 'Failed to get pending jobs' });
    }
  });

  // DELETE /cron/jobs/:id - 删除定时任务
  router.delete('/cron/jobs/:id', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const manager = getCronManager();
      const deleted = manager.deleteJob(id);

      if (!deleted) {
        res.status(404).json({ success: false, error: 'Job not found' });
        return;
      }

      res.json({ success: true, message: `Job ${id} deleted` });
    } catch (error) {
      console.error('Failed to delete cron job:', error);
      res.status(500).json({ success: false, error: 'Failed to delete cron job' });
    }
  });

  // GET /notifications - 获取通知列表
  router.get('/notifications', (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const notifications = notificationSystem.getAll(limit);

      res.json({
        success: true,
        notifications: notifications.map(n => ({
          id: n.id,
          type: n.type,
          title: n.title,
          content: n.content,
          createdAt: new Date(n.createdAt).toISOString(),
          read: n.read,
        })),
        unreadCount: notificationSystem.getUnreadCount(),
      });
    } catch (error) {
      console.error('Failed to get notifications:', error);
      res.status(500).json({ success: false, error: 'Failed to get notifications' });
    }
  });

  // GET /notifications/unread - 获取未读通知
  router.get('/notifications/unread', (req: Request, res: Response) => {
    try {
      const notifications = notificationSystem.getUnread();

      res.json({
        success: true,
        notifications: notifications.map(n => ({
          id: n.id,
          type: n.type,
          title: n.title,
          content: n.content,
          createdAt: new Date(n.createdAt).toISOString(),
        })),
      });
    } catch (error) {
      console.error('Failed to get unread notifications:', error);
      res.status(500).json({ success: false, error: 'Failed to get unread notifications' });
    }
  });

  // POST /notifications/:id/read - 标记通知为已读
  router.post('/notifications/:id/read', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const marked = notificationSystem.markAsRead(id);

      if (!marked) {
        res.status(404).json({ success: false, error: 'Notification not found' });
        return;
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      res.status(500).json({ success: false, error: 'Failed to mark notification as read' });
    }
  });

  // POST /notifications/read-all - 全部标记为已读
  router.post('/notifications/read-all', (req: Request, res: Response) => {
    try {
      const count = notificationSystem.markAllAsRead();
      res.json({ success: true, markedCount: count });
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
      res.status(500).json({ success: false, error: 'Failed to mark all as read' });
    }
  });

  return router;
}
