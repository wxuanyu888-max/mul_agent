/**
 * Human-in-the-Loop API 路由
 *
 * 提供干预请求的 CRUD 接口
 */

import { Router } from 'express';
import { getHumanInLoopManager, type InterruptConfig } from '../../agents/human-in-loop/index.js';

const router = Router();
const manager = getHumanInLoopManager();

/**
 * 获取待处理的干预列表
 */
router.get('/pending', (req, res) => {
  const { sessionId } = req.query;
  const pending = manager.getPending(sessionId as string | undefined);
  res.json({ interventions: pending });
});

/**
 * 获取干预历史
 */
router.get('/history', (req, res) => {
  const { sessionId, limit } = req.query;
  const history = manager.getHistory(
    sessionId as string | undefined,
    limit ? parseInt(limit as string, 10) : 50
  );
  res.json({ interventions: history });
});

/**
 * 获取单个干预详情
 */
router.get('/:id', (req, res) => {
  const { id } = req.params;
  const intervention = manager.getIntervention(id);

  if (!intervention) {
    return res.status(404).json({ error: 'Intervention not found' });
  }

  res.json({ intervention });
});

/**
 * 响应干预请求
 */
router.post('/:id/respond', (req, res) => {
  const { id } = req.params;
  const { action, response, modifiedInput } = req.body;

  if (!action || !['approve', 'reject', 'modify', 'timeout'].includes(action)) {
    return res.status(400).json({ error: 'Invalid action' });
  }

  manager.respond({
    interventionId: id,
    action,
    response,
    modifiedInput,
  });

  res.json({ success: true });
});

/**
 * 获取中断配置列表
 */
router.get('/config', (req, res) => {
  const configs = manager.getInterruptConfigs();
  res.json({ configs });
});

/**
 * 注册中断配置
 */
router.post('/config', (req, res) => {
  const config = req.body;

  if (!config.id || !config.trigger || !config.type || !config.message) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  manager.registerInterrupt(config);
  res.json({ success: true, config });
});

/**
 * 更新中断配置
 */
router.put('/config/:id', (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  const configs = manager.getInterruptConfigs();
  const existing = configs.find((c: InterruptConfig) => c.id === id);

  if (!existing) {
    return res.status(404).json({ error: 'Config not found' });
  }

  manager.registerInterrupt({ ...existing, ...updates });
  res.json({ success: true });
});

/**
 * 删除中断配置
 */
router.delete('/config/:id', (req, res) => {
  const { id } = req.params;
  manager.unregisterInterrupt(id);
  res.json({ success: true });
});

/**
 * 启用/禁用中断配置
 */
router.patch('/config/:id/toggle', (req, res) => {
  const { id } = req.params;
  const { enabled } = req.body;

  manager.toggleInterrupt(id, enabled);
  res.json({ success: true });
});

/**
 * 获取统计信息
 */
router.get('/stats', (req, res) => {
  const stats = manager.getStats();
  res.json({ stats });
});

/**
 * 清空历史记录
 */
router.delete('/history', (req, res) => {
  manager.clearHistory();
  res.json({ success: true });
});

export const createHumanInLoopRouter = (): Router => router;
