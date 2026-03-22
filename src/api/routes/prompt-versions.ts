/**
 * Prompt 版本管理 API 路由
 */

import { Router } from 'express';
import {
  createTemplate,
  getTemplate,
  listTemplates,
  getActiveVersion,
  createVersion,
  setCurrentVersion,
  startABTest,
  stopABTest,
  recordVersionMetrics,
  compareVersions,
  deleteTemplate,
} from '../../agents/prompt/version-manager.js';

const router: Router = Router();

/**
 * 创建模板
 */
router.post('/templates', async (req, res) => {
  try {
    const { name, description, content, tags, createdBy } = req.body;

    if (!name || !content) {
      return res.status(400).json({ error: 'name and content are required' });
    }

    const template = await createTemplate(
      name,
      description || '',
      content,
      createdBy || 'system',
      tags || []
    );

    res.json({ template });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

/**
 * 获取所有模板
 */
router.get('/templates', async (req, res) => {
  try {
    const templates = await listTemplates();
    res.json({
      templates: templates.map(t => ({
        id: t.id,
        name: t.name,
        description: t.description,
        tags: t.tags,
        versionCount: t.versions.length,
        currentVersion: t.currentVersionId,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      })),
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

/**
 * 获取单个模板
 */
router.get('/templates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const template = await getTemplate(id);

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json({ template });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

/**
 * 获取当前活跃版本
 */
router.get('/templates/:id/active', async (req, res) => {
  try {
    const { id } = req.params;
    const version = await getActiveVersion(id);

    if (!version) {
      return res.status(404).json({ error: 'No active version found' });
    }

    res.json({ version });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

/**
 * 创建新版本
 */
router.post('/templates/:id/versions', async (req, res) => {
  try {
    const { id } = req.params;
    const { content, name, description, createdBy } = req.body;

    if (!content || !name) {
      return res.status(400).json({ error: 'content and name are required' });
    }

    const version = await createVersion({
      templateId: id,
      content,
      name,
      description,
      createdBy: createdBy || 'system',
    });

    res.json({ version });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

/**
 * 设置当前版本
 */
router.patch('/templates/:id/current', async (req, res) => {
  try {
    const { id } = req.params;
    const { versionId } = req.body;

    if (!versionId) {
      return res.status(400).json({ error: 'versionId is required' });
    }

    await setCurrentVersion(id, versionId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

/**
 * 启动 A/B 测试
 */
router.post('/templates/:id/abtest', async (req, res) => {
  try {
    const { id } = req.params;
    const { versionId, trafficSplit, metricToOptimize } = req.body;

    if (!versionId) {
      return res.status(400).json({ error: 'versionId is required' });
    }

    await startABTest({
      templateId: id,
      versionId,
      trafficSplit: trafficSplit || 0.1,
      metricToOptimize: metricToOptimize || 'successRate',
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

/**
 * 停止 A/B 测试
 */
router.delete('/templates/:id/abtest/:versionId', async (req, res) => {
  try {
    const { id, versionId } = req.params;
    await stopABTest(id, versionId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

/**
 * 记录指标
 */
router.post('/metrics', async (req, res) => {
  try {
    const record = req.body;

    if (!record.versionId || !record.sessionId) {
      return res.status(400).json({ error: 'versionId and sessionId are required' });
    }

    await recordVersionMetrics({
      versionId: record.versionId,
      sessionId: record.sessionId,
      timestamp: Date.now(),
      latencyMs: record.latencyMs || 0,
      tokens: record.tokens || 0,
      success: record.success ?? true,
      error: record.error,
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

/**
 * 比较版本
 */
router.get('/versions/:idA/compare/:idB', async (req, res) => {
  try {
    const { idA, idB } = req.params;
    const comparison = await compareVersions(idA, idB);
    res.json({ comparison });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

/**
 * 删除模板
 */
router.delete('/templates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await deleteTemplate(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

export const createPromptVersionsRouter = (): Router => router;
