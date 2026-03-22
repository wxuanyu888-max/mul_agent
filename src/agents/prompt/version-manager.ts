/**
 * Prompt 版本管理器
 *
 * 管理 Prompt 模板的版本化，支持 A/B 测试和性能追踪
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  PromptTemplate,
  PromptVersion,
  VersionMetricsRecord,
  VersionComparison,
  CreateVersionRequest,
  ABTestRequest,
} from './versions.js';

const STORAGE_DIR = '/Users/agent/PycharmProjects/mul_agent/storage/prompts/versions';

/**
 * 获取模板存储路径
 */
function getTemplatePath(templateId: string): string {
  return path.join(STORAGE_DIR, `${templateId}.json`);
}

/**
 * 获取指标记录路径
 */
function getMetricsPath(): string {
  return path.join(STORAGE_DIR, 'metrics.json');
}

/**
 * 模板缓存
 */
class TemplateCache {
  private templates: Map<string, PromptTemplate> = new Map();
  private metrics: VersionMetricsRecord[] = [];

  async load(templateId: string): Promise<PromptTemplate | null> {
    if (this.templates.has(templateId)) {
      return this.templates.get(templateId)!;
    }

    try {
      const data = await fs.readFile(getTemplatePath(templateId), 'utf-8');
      const template = JSON.parse(data) as PromptTemplate;
      this.templates.set(templateId, template);
      return template;
    } catch {
      return null;
    }
  }

  async save(template: PromptTemplate): Promise<void> {
    await fs.mkdir(STORAGE_DIR, { recursive: true });
    await fs.writeFile(
      getTemplatePath(template.id),
      JSON.stringify(template, null, 2)
    );
    this.templates.set(template.id, template);
  }

  async loadAll(): Promise<PromptTemplate[]> {
    await fs.mkdir(STORAGE_DIR, { recursive: true });

    try {
      const files = await fs.readdir(STORAGE_DIR);
      const templates: PromptTemplate[] = [];

      for (const file of files) {
        if (!file.endsWith('.json') || file === 'metrics.json') continue;

        try {
          const data = await fs.readFile(path.join(STORAGE_DIR, file), 'utf-8');
          const template = JSON.parse(data) as PromptTemplate;
          templates.push(template);
          this.templates.set(template.id, template);
        } catch {
          // 跳过无效文件
        }
      }

      return templates;
    } catch {
      return [];
    }
  }

  async loadMetrics(): Promise<VersionMetricsRecord[]> {
    try {
      const data = await fs.readFile(getMetricsPath(), 'utf-8');
      this.metrics = JSON.parse(data);
    } catch {
      this.metrics = [];
    }
    return this.metrics;
  }

  async saveMetrics(): Promise<void> {
    await fs.writeFile(getMetricsPath(), JSON.stringify(this.metrics, null, 2));
  }

  addMetric(record: VersionMetricsRecord): void {
    this.metrics.push(record);
  }

  getMetrics(versionId: string): VersionMetricsRecord[] {
    return this.metrics.filter(m => m.versionId === versionId);
  }
}

const cache = new TemplateCache();

/**
 * 创建 Prompt 模板
 */
export async function createTemplate(
  name: string,
  description: string,
  initialContent: string,
  createdBy: string,
  tags: string[] = []
): Promise<PromptTemplate> {
  const templateId = `tpl_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const now = Date.now();

  const template: PromptTemplate = {
    id: templateId,
    name,
    description,
    tags,
    versions: [{
      id: `pv_${now}`,
      version: 1,
      name: 'v1.0',
      content: initialContent,
      variables: extractVariables(initialContent),
      createdAt: now,
      createdBy,
      metrics: {
        avgLatencyMs: 0,
        avgTokens: 0,
        successRate: 0,
        sampleCount: 0,
      },
    }],
    currentVersionId: `pv_${now}`,
    createdAt: now,
    updatedAt: now,
  };

  await cache.save(template);
  return template;
}

/**
 * 获取模板
 */
export async function getTemplate(templateId: string): Promise<PromptTemplate | null> {
  return cache.load(templateId);
}

/**
 * 获取所有模板
 */
export async function listTemplates(): Promise<PromptTemplate[]> {
  return cache.loadAll();
}

/**
 * 获取当前活跃版本（支持 A/B 流量分配）
 */
export async function getActiveVersion(templateId: string): Promise<PromptVersion | null> {
  const template = await cache.load(templateId);
  if (!template) return null;

  // 检查是否有启用的 A/B 测试版本
  const testVersion = template.versions.find(
    v => v.testConfig?.enabled && Math.random() < (v.testConfig.trafficSplit || 0.1)
  );

  if (testVersion) {
    return testVersion;
  }

  // 返回当前版本
  return template.versions.find(v => v.id === template.currentVersionId) || template.versions[0];
}

/**
 * 创建新版本
 */
export async function createVersion(request: CreateVersionRequest): Promise<PromptVersion> {
  const template = await cache.load(request.templateId);
  if (!template) {
    throw new Error(`Template not found: ${request.templateId}`);
  }

  const now = Date.now();
  const newVersion: PromptVersion = {
    id: `pv_${now}`,
    version: template.versions.length + 1,
    name: request.name,
    content: request.content,
    variables: extractVariables(request.content),
    createdAt: now,
    createdBy: request.createdBy,
    description: request.description,
    metrics: {
      avgLatencyMs: 0,
      avgTokens: 0,
      successRate: 0,
      sampleCount: 0,
    },
  };

  template.versions.push(newVersion);
  template.currentVersionId = newVersion.id;
  template.updatedAt = now;

  await cache.save(template);
  return newVersion;
}

/**
 * 设置当前版本
 */
export async function setCurrentVersion(
  templateId: string,
  versionId: string
): Promise<void> {
  const template = await cache.load(templateId);
  if (!template) {
    throw new Error(`Template not found: ${templateId}`);
  }

  const version = template.versions.find(v => v.id === versionId);
  if (!version) {
    throw new Error(`Version not found: ${versionId}`);
  }

  // 禁用该版本的 A/B 测试
  if (version.testConfig) {
    version.testConfig.enabled = false;
  }

  template.currentVersionId = versionId;
  template.updatedAt = Date.now();

  await cache.save(template);
}

/**
 * 启动 A/B 测试
 */
export async function startABTest(request: ABTestRequest): Promise<void> {
  const template = await cache.load(request.templateId);
  if (!template) {
    throw new Error(`Template not found: ${request.templateId}`);
  }

  const version = template.versions.find(v => v.id === request.versionId);
  if (!version) {
    throw new Error(`Version not found: ${request.versionId}`);
  }

  // 禁用其他版本的 A/B 测试
  for (const v of template.versions) {
    if (v.testConfig) {
      v.testConfig.enabled = false;
    }
  }

  // 启用新版本
  version.testConfig = {
    enabled: true,
    trafficSplit: request.trafficSplit,
    metricToOptimize: request.metricToOptimize,
    startedAt: Date.now(),
  };

  template.updatedAt = Date.now();
  await cache.save(template);
}

/**
 * 停止 A/B 测试
 */
export async function stopABTest(templateId: string, versionId: string): Promise<void> {
  const template = await cache.load(templateId);
  if (!template) {
    throw new Error(`Template not found: ${templateId}`);
  }

  const version = template.versions.find(v => v.id === versionId);
  if (version?.testConfig) {
    version.testConfig.enabled = false;
    version.testConfig.endedAt = Date.now();
  }

  template.updatedAt = Date.now();
  await cache.save(template);
}

/**
 * 记录版本性能指标
 */
export async function recordVersionMetrics(
  record: VersionMetricsRecord
): Promise<void> {
  await cache.loadMetrics();
  cache.addMetric(record);
  await cache.saveMetrics();

  // 更新版本的聚合指标
  const metrics = cache.getMetrics(record.versionId);
  const template = await findTemplateByVersionId(record.versionId);
  if (!template) return;

  const version = template.versions.find(v => v.id === record.versionId);
  if (!version || !version.metrics) return;

  const m = version.metrics;
  m.sampleCount++;

  // 增量更新
  m.avgLatencyMs = ((m.avgLatencyMs || 0) * (m.sampleCount - 1) + record.latencyMs) / m.sampleCount;
  m.avgTokens = ((m.avgTokens || 0) * (m.sampleCount - 1) + record.tokens) / m.sampleCount;
  m.successRate = ((m.successRate || 0) * (m.sampleCount - 1) + (record.success ? 1 : 0)) / m.sampleCount;

  await cache.save(template);
}

/**
 * 根据版本 ID 查找模板
 */
async function findTemplateByVersionId(versionId: string): Promise<PromptTemplate | null> {
  const templates = await cache.loadAll();
  return templates.find(t => t.versions.some(v => v.id === versionId)) || null;
}

/**
 * 比较两个版本
 */
export async function compareVersions(
  versionIdA: string,
  versionIdB: string
): Promise<VersionComparison> {
  await cache.loadMetrics();

  const metricsA = cache.getMetrics(versionIdA);
  const metricsB = cache.getMetrics(versionIdB);

  const calcAvg = (records: VersionMetricsRecord[]) => {
    if (records.length === 0) return { latency: 0, tokens: 0, success: 0 };
    return {
      latency: records.reduce((a, r) => a + r.latencyMs, 0) / records.length,
      tokens: records.reduce((a, r) => a + r.tokens, 0) / records.length,
      success: records.filter(r => r.success).length / records.length,
    };
  };

  const a = calcAvg(metricsA);
  const b = calcAvg(metricsB);

  return {
    versionA: versionIdA,
    versionB: versionIdB,
    latencyDiff: b.latency - a.latency,
    tokensDiff: b.tokens - a.tokens,
    successRateDiff: b.success - a.success,
    sampleCountA: metricsA.length,
    sampleCountB: metricsB.length,
  };
}

/**
 * 删除模板
 */
export async function deleteTemplate(templateId: string): Promise<void> {
  await fs.unlink(getTemplatePath(templateId));
  // 从缓存中移除
}

/**
 * 提取变量
 */
function extractVariables(content: string): string[] {
  const matches = content.match(/\{(\w+)\}/g) || [];
  return [...new Set(matches.map(m => m.slice(1, -1)))];
}
