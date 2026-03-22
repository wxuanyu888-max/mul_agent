/**
 * Checkpoint 时间旅行 API 路由
 */

import { Router } from 'express';
import {
  getTimelineView,
  timeTravel,
  diffCheckpoint,
  searchCheckpoints,
  garbageCollect,
  getCheckpointChain,
  formatCheckpointBrief,
  getBranches,
  createBranch,
  deleteBranch,
} from '../../agents/checkpoint/index.js';

const router: Router = Router();

/**
 * 获取会话的时间线视图
 */
router.get('/sessions/:sessionId/timeline', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const timeline = await getTimelineView(sessionId);
    res.json({ timeline });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

/**
 * 获取分支列表
 */
router.get('/sessions/:sessionId/branches', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const branches = await getBranches(sessionId);
    res.json({ branches });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

/**
 * 创建新分支
 */
router.post('/sessions/:sessionId/branches', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { name, fromCheckpointId, description } = req.body;

    if (!name || !fromCheckpointId) {
      return res.status(400).json({ error: 'name and fromCheckpointId are required' });
    }

    const branch = await createBranch(sessionId, name, fromCheckpointId, description);
    res.json({ branch });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

/**
 * 删除分支
 */
router.delete('/sessions/:sessionId/branches/:name', async (req, res) => {
  try {
    const { sessionId, name } = req.params;
    await deleteBranch(sessionId, name);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

/**
 * 时间旅行
 */
router.post('/sessions/:sessionId/time-travel', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { checkpointId, branchName, preserveCurrent, description } = req.body;

    if (!checkpointId) {
      return res.status(400).json({ error: 'checkpointId is required' });
    }

    const result = await timeTravel({
      checkpointId,
      branchName,
      preserveCurrent,
      description,
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

/**
 * 比较两个 Checkpoint
 */
router.get('/checkpoints/:idA/diff/:idB', async (req, res) => {
  try {
    const { idA, idB } = req.params;
    const diff = await diffCheckpoint(idA, idB);
    res.json({ diff });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

/**
 * 搜索 Checkpoints
 */
router.get('/sessions/:sessionId/checkpoints', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const {
      branch,
      reason,
      minIteration,
      maxIteration,
      since,
      until,
      limit,
      offset,
    } = req.query;

    const checkpoints = await searchCheckpoints({
      sessionId,
      branch: branch as string | undefined,
      reason: reason as string | undefined,
      minIteration: minIteration ? parseInt(minIteration as string, 10) : undefined,
      maxIteration: maxIteration ? parseInt(maxIteration as string, 10) : undefined,
      since: since ? parseInt(since as string, 10) : undefined,
      until: until ? parseInt(until as string, 10) : undefined,
      limit: limit ? parseInt(limit as string, 10) : 50,
      offset: offset ? parseInt(offset as string, 10) : 0,
    });

    res.json({
      checkpoints: checkpoints.map(cp => ({
        brief: formatCheckpointBrief(cp),
        id: cp.id,
        iteration: cp.metadata.iteration,
        reason: cp.metadata.reason,
        timestamp: cp.metadata.timestamp,
        messagesCount: cp.messages.length,
        toolCallsCount: cp.completedToolCalls.length,
      })),
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

/**
 * 获取 Checkpoint 链
 */
router.get('/checkpoints/:id/chain', async (req, res) => {
  try {
    const { id } = req.params;
    const chain = await getCheckpointChain(id);
    res.json({
      chain: chain.map(cp => ({
        id: cp.id,
        iteration: cp.metadata.iteration,
        reason: cp.metadata.reason,
        timestamp: cp.metadata.timestamp,
      })),
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

/**
 * 垃圾回收
 */
router.delete('/sessions/:sessionId/checkpoints/gc', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { maxCheckpoints, maxAgeMs, keepReasons } = req.query;

    const deleted = await garbageCollect(sessionId, {
      maxCheckpoints: maxCheckpoints ? parseInt(maxCheckpoints as string, 10) : 50,
      maxAgeMs: maxAgeMs ? parseInt(maxAgeMs as string, 10) : undefined,
      keepReasons: keepReasons
        ? (keepReasons as string).split(',')
        : ['manual'],
    });

    res.json({ deleted });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

export const createCheckpointTimeTravelRouter = (): typeof router => router;
