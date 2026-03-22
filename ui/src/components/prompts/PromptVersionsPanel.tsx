/**
 * PromptVersionsPanel - 提示词版本管理面板
 *
 * 功能：
 * - 查看/创建提示词模板
 * - 版本管理
 * - A/B 测试
 * - 版本对比
 */

import { useState, useEffect } from 'react';
import { Plus, GitBranch, Play, Pause, History, Trash2, X, ArrowRight, FileText, FlaskConical } from 'lucide-react';
import { promptsApi, type PromptTemplate, type PromptVersion } from '../../services/api';

export function PromptVersionsPanel() {
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<PromptTemplate | null>(null);
  const [versions, setVersions] = useState<PromptVersion[]>([]);
  const [activeVersion, setActiveVersion] = useState<PromptVersion | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showVersionCreate, setShowVersionCreate] = useState(false);
  const [newTemplate, setNewTemplate] = useState({ name: '', description: '', content: '', tags: '' });
  const [newVersion, setNewVersion] = useState({ name: '', content: '', description: '' });

  // 加载模板列表
  const loadTemplates = async () => {
    setLoading(true);
    try {
      const res = await promptsApi.listTemplates();
      setTemplates(res.data.templates || []);
    } catch (err) {
      console.error('Failed to load templates:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  // 加载选中模板的详情
  useEffect(() => {
    if (!selectedTemplate) {
      setVersions([]);
      setActiveVersion(null);
      return;
    }
    loadTemplateDetails(selectedTemplate.id);
  }, [selectedTemplate]);

  const loadTemplateDetails = async (templateId: string) => {
    try {
      const [templateRes, activeRes] = await Promise.all([
        promptsApi.getTemplate(templateId),
        promptsApi.getActiveVersion(templateId),
      ]);
      setVersions(templateRes.data.template?.versions || []);
      setActiveVersion(activeRes.data.version || null);
    } catch (err) {
      console.error('Failed to load details:', err);
    }
  };

  // 创建模板
  const handleCreateTemplate = async () => {
    if (!newTemplate.name || !newTemplate.content) return;
    try {
      await promptsApi.createTemplate({
        name: newTemplate.name,
        description: newTemplate.description,
        content: newTemplate.content,
        tags: newTemplate.tags.split(',').map(t => t.trim()).filter(Boolean),
      });
      setShowCreate(false);
      setNewTemplate({ name: '', description: '', content: '', tags: '' });
      loadTemplates();
    } catch (err) {
      console.error('Failed to create template:', err);
    }
  };

  // 创建版本
  const handleCreateVersion = async () => {
    if (!selectedTemplate || !newVersion.name || !newVersion.content) return;
    try {
      await promptsApi.createVersion(selectedTemplate.id, {
        name: newVersion.name,
        content: newVersion.content,
        description: newVersion.description,
      });
      setShowVersionCreate(false);
      setNewVersion({ name: '', content: '', description: '' });
      loadTemplateDetails(selectedTemplate.id);
    } catch (err) {
      console.error('Failed to create version:', err);
    }
  };

  // 设置当前版本
  const handleSetActive = async (versionId: string) => {
    if (!selectedTemplate) return;
    try {
      await promptsApi.setCurrentVersion(selectedTemplate.id, versionId);
      loadTemplateDetails(selectedTemplate.id);
    } catch (err) {
      console.error('Failed to set active version:', err);
    }
  };

  // 删除模板
  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('确定删除这个模板吗？')) return;
    try {
      await promptsApi.deleteTemplate(id);
      if (selectedTemplate?.id === id) setSelectedTemplate(null);
      loadTemplates();
    } catch (err) {
      console.error('Failed to delete template:', err);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-purple-500" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">提示词版本</h2>
              <p className="text-sm text-gray-500">提示词模板管理</p>
            </div>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            <Plus size={16} />
            新建模板
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Template List */}
        <div className="w-72 border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-gray-500">加载中...</div>
          ) : templates.length === 0 ? (
            <div className="p-4 text-center text-gray-500">暂无模板</div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {templates.map((t) => (
                <div
                  key={t.id}
                  className={`p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 ${
                    selectedTemplate?.id === t.id ? 'bg-purple-50 dark:bg-purple-900/20' : ''
                  }`}
                  onClick={() => setSelectedTemplate(t)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">{t.name}</div>
                      <div className="text-xs text-gray-500">{t.versionCount} 个版本</div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteTemplate(t.id);
                      }}
                      className="p-1 text-red-500 hover:bg-red-50 rounded"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  {t.description && (
                    <div className="text-xs text-gray-500 mt-1">{t.description}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Version List */}
        <div className="flex-1 overflow-y-auto p-4">
          {selectedTemplate ? (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">{selectedTemplate.name} - 版本列表</h3>
                <button
                  onClick={() => setShowVersionCreate(true)}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200"
                >
                  <Plus size={14} />
                  新建版本
                </button>
              </div>

              {/* Active Version */}
              {activeVersion && (
                <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <div className="flex items-center gap-2 text-green-700 dark:text-green-300 mb-2">
                    <Play size={16} />
                    <span className="font-medium">当前活跃版本</span>
                  </div>
                  <div className="text-sm">{activeVersion.name}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    创建于 {new Date(activeVersion.createdAt).toLocaleString()}
                  </div>
                </div>
              )}

              {/* Version List */}
              <div className="space-y-2">
                {versions.map((v) => (
                  <div
                    key={v.id}
                    className={`p-4 border rounded-lg ${
                      activeVersion?.id === v.id
                        ? 'border-green-500 bg-green-50 dark:bg-green-900/10'
                        : 'border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">{v.name}</div>
                        {v.description && (
                          <div className="text-sm text-gray-500">{v.description}</div>
                        )}
                        <div className="text-xs text-gray-400 mt-1">
                          创建于 {new Date(v.createdAt).toLocaleString()}
                        </div>
                      </div>
                      {activeVersion?.id !== v.id && (
                        <button
                          onClick={() => handleSetActive(v.id)}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                        >
                          <Play size={14} />
                          设为活跃
                        </button>
                      )}
                    </div>
                    <details className="mt-2">
                      <summary className="text-sm text-gray-500 cursor-pointer">查看内容</summary>
                      <pre className="mt-2 p-3 bg-gray-50 dark:bg-gray-800 rounded text-xs overflow-x-auto max-h-48">
                        {v.content}
                      </pre>
                    </details>
                  </div>
                ))}
              </div>

              {versions.length === 0 && (
                <div className="text-center py-8 text-gray-500">暂无版本</div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              选择一个模板查看版本
            </div>
          )}
        </div>
      </div>

      {/* Create Template Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-[600px] max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">创建提示词模板</h3>
              <button onClick={() => setShowCreate(false)} className="p-1 hover:bg-gray-100 rounded">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  名称 *
                </label>
                <input
                  type="text"
                  value={newTemplate.name}
                  onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  placeholder="例如: 代码审查提示词"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  描述
                </label>
                <input
                  type="text"
                  value={newTemplate.description}
                  onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  内容 *
                </label>
                <textarea
                  value={newTemplate.content}
                  onChange={(e) => setNewTemplate({ ...newTemplate, content: e.target.value })}
                  rows={10}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 font-mono text-sm"
                  placeholder="输入提示词内容..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  标签（逗号分隔）
                </label>
                <input
                  type="text"
                  value={newTemplate.tags}
                  onChange={(e) => setNewTemplate({ ...newTemplate, tags: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  placeholder="例如: coding, review"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleCreateTemplate}
                disabled={!newTemplate.name || !newTemplate.content}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Version Modal */}
      {showVersionCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-[600px] max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">创建新版本</h3>
              <button onClick={() => setShowVersionCreate(false)} className="p-1 hover:bg-gray-100 rounded">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  版本名称 *
                </label>
                <input
                  type="text"
                  value={newVersion.name}
                  onChange={(e) => setNewVersion({ ...newVersion, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  placeholder="例如: v1.0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  描述
                </label>
                <input
                  type="text"
                  value={newVersion.description}
                  onChange={(e) => setNewVersion({ ...newVersion, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  内容 *
                </label>
                <textarea
                  value={newVersion.content}
                  onChange={(e) => setNewVersion({ ...newVersion, content: e.target.value })}
                  rows={10}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 font-mono text-sm"
                  placeholder="输入提示词内容..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowVersionCreate(false)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleCreateVersion}
                disabled={!newVersion.name || !newVersion.content}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                创建版本
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PromptVersionsPanel;
