/**
 * HumanInLoopPanel - 人工介入审批面板
 *
 * 功能：
 * - 查看待处理的干预请求
 * - 审批/拒绝/修改请求
 * - 查看干预历史
 * - 管理中断配置
 */

import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, AlertTriangle, History, Settings, Plus, X, ToggleLeft, ToggleRight } from 'lucide-react';
import { humanInLoopApi, type Intervention, type InterruptConfig, type InterventionStats } from '../../services/api';

type Tab = 'pending' | 'history' | 'config';

export function HumanInLoopPanel() {
  const [activeTab, setActiveTab] = useState<Tab>('pending');
  const [pending, setPending] = useState<Intervention[]>([]);
  const [history, setHistory] = useState<Intervention[]>([]);
  const [configs, setConfigs] = useState<InterruptConfig[]>([]);
  const [stats, setStats] = useState<InterventionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedIntervention, setSelectedIntervention] = useState<Intervention | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [newConfig, setNewConfig] = useState<Partial<InterruptConfig>>({
    id: '',
    type: 'confirmation',
    trigger: '',
    message: '',
  });

  // 加载数据
  const loadData = async () => {
    setLoading(true);
    try {
      const [pendingRes, historyRes, configsRes, statsRes] = await Promise.all([
        humanInLoopApi.getPending(),
        humanInLoopApi.getHistory(undefined, 50),
        humanInLoopApi.getConfigs(),
        humanInLoopApi.getStats(),
      ]);
      setPending(pendingRes.data.interventions || []);
      setHistory(historyRes.data.interventions || []);
      setConfigs(configsRes.data.configs || []);
      setStats(statsRes.data.stats || null);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // 定时刷新待处理项
    const interval = setInterval(() => {
      humanInLoopApi.getPending().then(res => setPending(res.data.interventions || []));
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // 响应干预
  const handleRespond = async (id: string, action: 'approve' | 'reject' | 'modify', response?: string) => {
    try {
      await humanInLoopApi.respond(id, { action, response });
      loadData();
      setSelectedIntervention(null);
    } catch (err) {
      console.error('Failed to respond:', err);
    }
  };

  // 创建配置
  const handleCreateConfig = async () => {
    if (!newConfig.id || !newConfig.trigger || !newConfig.message) return;
    try {
      await humanInLoopApi.createConfig(newConfig as { id: string; type: string; trigger: string; message: string });
      setShowConfigModal(false);
      setNewConfig({ id: '', type: 'confirmation', trigger: '', message: '' });
      loadData();
    } catch (err) {
      console.error('Failed to create config:', err);
    }
  };

  // 切换配置
  const handleToggleConfig = async (id: string, enabled: boolean) => {
    try {
      await humanInLoopApi.toggleConfig(id, enabled);
      loadData();
    } catch (err) {
      console.error('Failed to toggle config:', err);
    }
  };

  // 删除配置
  const handleDeleteConfig = async (id: string) => {
    if (!confirm('确定删除这个配置吗？')) return;
    try {
      await humanInLoopApi.deleteConfig(id);
      loadData();
    } catch (err) {
      console.error('Failed to delete config:', err);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20';
      case 'approved': return 'text-green-600 bg-green-50 dark:bg-green-900/20';
      case 'rejected': return 'text-red-600 bg-red-50 dark:bg-red-900/20';
      case 'modified': return 'text-blue-600 bg-blue-50 dark:bg-blue-900/20';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-500" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">人工介入</h2>
              <p className="text-sm text-gray-500">干预请求审批</p>
            </div>
          </div>
          {stats && (
            <div className="flex gap-4 text-sm">
              <span className="text-yellow-600">待处理: {stats.pending}</span>
              <span className="text-green-600">已批准: {stats.approved}</span>
              <span className="text-red-600">已拒绝: {stats.rejected}</span>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mt-4 border-b border-gray-200 dark:border-gray-700">
          {[
            { id: 'pending' as Tab, label: '待处理', icon: AlertTriangle, count: pending.length },
            { id: 'history' as Tab, label: '历史', icon: History, count: history.length },
            { id: 'config' as Tab, label: '配置', icon: Settings, count: configs.length },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 border-b-2 -mb-px ${
                activeTab === tab.id
                  ? 'border-yellow-500 text-yellow-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
              {tab.count > 0 && (
                <span className="px-1.5 py-0.5 text-xs bg-gray-200 dark:bg-gray-700 rounded-full">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="text-center py-8 text-gray-500">加载中...</div>
        ) : activeTab === 'pending' && (
          <div>
            {pending.length === 0 ? (
              <div className="text-center py-8 text-gray-500">暂无待处理的干预请求</div>
            ) : (
              <div className="space-y-3">
                {pending.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 border border-yellow-200 dark:border-yellow-800 rounded-lg bg-yellow-50 dark:bg-yellow-900/10"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-medium text-gray-900 dark:text-white">{item.type}</span>
                          <span className="text-xs text-gray-500">
                            {new Date(item.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <div className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                          {item.message}
                        </div>
                        {item.trigger && (
                          <div className="text-xs text-gray-500">
                            触发条件: {item.trigger}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={() => handleRespond(item.id, 'approve')}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                        >
                          <CheckCircle size={14} />
                          批准
                        </button>
                        <button
                          onClick={() => handleRespond(item.id, 'reject')}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                        >
                          <XCircle size={14} />
                          拒绝
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div>
            {history.length === 0 ? (
              <div className="text-center py-8 text-gray-500">暂无历史记录</div>
            ) : (
              <div className="space-y-2">
                {history.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium text-gray-900 dark:text-white">{item.type}</span>
                        <span className={`ml-2 px-2 py-0.5 text-xs rounded ${getStatusColor(item.status)}`}>
                          {item.status}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {new Date(item.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {item.message}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'config' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">中断配置</h3>
              <button
                onClick={() => setShowConfigModal(true)}
                className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200"
              >
                <Plus size={16} />
                新建配置
              </button>
            </div>

            {configs.length === 0 ? (
              <div className="text-center py-8 text-gray-500">暂无配置</div>
            ) : (
              <div className="space-y-3">
                {configs.map((config) => (
                  <div
                    key={config.id}
                    className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleToggleConfig(config.id, !config.enabled)}
                          className="text-gray-500 hover:text-gray-700"
                        >
                          {config.enabled ? (
                            <ToggleRight size={24} className="text-green-500" />
                          ) : (
                            <ToggleLeft size={24} />
                          )}
                        </button>
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">{config.id}</div>
                          <div className="text-sm text-gray-500">{config.type} - {config.trigger}</div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteConfig(config.id)}
                        className="p-1 text-red-500 hover:bg-red-50 rounded"
                      >
                        <X size={16} />
                      </button>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                      {config.message}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Config Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-[480px]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">创建中断配置</h3>
              <button onClick={() => setShowConfigModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  ID *
                </label>
                <input
                  type="text"
                  value={newConfig.id}
                  onChange={(e) => setNewConfig({ ...newConfig, id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  placeholder="例如: code_review"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  类型
                </label>
                <select
                  value={newConfig.type}
                  onChange={(e) => setNewConfig({ ...newConfig, type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                >
                  <option value="confirmation">确认</option>
                  <option value="approval">审批</option>
                  <option value="choice">选择</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  触发条件 *
                </label>
                <input
                  type="text"
                  value={newConfig.trigger}
                  onChange={(e) => setNewConfig({ ...newConfig, trigger: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  placeholder="例如: delete_file"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  消息 *
                </label>
                <textarea
                  value={newConfig.message}
                  onChange={(e) => setNewConfig({ ...newConfig, message: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  placeholder="输入提示消息..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowConfigModal(false)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleCreateConfig}
                disabled={!newConfig.id || !newConfig.trigger || !newConfig.message}
                className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50"
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default HumanInLoopPanel;
