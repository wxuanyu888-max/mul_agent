/**
 * CheckpointPanel - 检查点时间旅行面板
 *
 * 功能：
 * - 查看会话的检查点列表
 * - 检查点详情查看
 * - 时间旅行（回滚到指定检查点）
 * - 分支管理
 * - 检查点比较
 */

import { useState, useEffect } from 'react';
import { GitBranch, RotateCcw, ChevronDown, ChevronRight, Trash2, Plus, X, ArrowRight, History } from 'lucide-react';
import { checkpointApi, type CheckpointBrief, type Branch } from '../../services/api';
import { chatApi } from '../../services/api';

interface CheckpointDetail {
  messages: unknown[];
  toolCalls: unknown[];
  systemPrompt: string;
}

interface CheckpointPanelProps {
  sessionId?: string;
}

export function CheckpointPanel({ sessionId: propSessionId }: CheckpointPanelProps) {
  // 优先使用 props 传入的 sessionId，否则从 localStorage 获取
  const [sessionId, setSessionId] = useState<string>(() => {
    if (propSessionId) return propSessionId;
    return localStorage.getItem('chat_currentSessionId') || '';
  });

  // 当 sessionId 为空时，从后端获取最近的 session
  const [initialized, setInitialized] = useState(false);
  useEffect(() => {
    if (!initialized && !sessionId) {
      setInitialized(true);
      const fetchRecentSession = async () => {
        try {
          const res = await chatApi.getSessions();
          const sessions = res.data.sessions || [];
          if (sessions.length > 0) {
            const recentSessionId = sessions[0].session_id;
            setSessionId(recentSessionId);
            localStorage.setItem('chat_currentSessionId', recentSessionId);
          }
        } catch (err) {
          console.error('[CheckpointPanel] Failed to fetch recent session:', err);
        }
      };
      fetchRecentSession();
    }
  }, [initialized, sessionId]);

  const [checkpoints, setCheckpoints] = useState<CheckpointBrief[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedCheckpoint, setSelectedCheckpoint] = useState<string | null>(null);
  const [detail, setDetail] = useState<CheckpointDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['messages']));
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [newBranch, setNewBranch] = useState({ name: '', fromCheckpointId: '' });
  const [compareFrom, setCompareFrom] = useState('');
  const [compareTo, setCompareTo] = useState('');
  const [compareResult, setCompareResult] = useState<{ added: unknown[]; removed: unknown[]; modified: unknown[] } | null>(null);

  // 监听 localStorage 变化（跨 Tab 同步）
  useEffect(() => {
    const handleStorageChange = () => {
      const localSessionId = localStorage.getItem('chat_currentSessionId') || '';
      setSessionId(localSessionId);
    };
    window.addEventListener('storage', handleStorageChange);

    // 轮询 localStorage 变化（同一个 Tab 内不会触发 storage 事件）
    const pollInterval = setInterval(() => {
      const localSessionId = localStorage.getItem('chat_currentSessionId') || '';
      setSessionId(prev => {
        if (prev !== localSessionId) {
          return localSessionId;
        }
        return prev;
      });
    }, 1000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(pollInterval);
    };
  }, []);

  // 当 sessionId 变化时重新加载数据
  useEffect(() => {
    console.log('[CheckpointPanel] sessionId changed:', sessionId);
    if (sessionId) {
      loadData(sessionId);
    } else {
      setCheckpoints([]);
      setBranches([]);
      setLoading(false);
    }
  }, [sessionId]);

  // 加载数据 - 使用闭包避免 stale sessionId
  const loadData = async (sid: string) => {
    console.log('[CheckpointPanel] loadData called with sessionId:', sid);
    setLoading(true);
    try {
      const [cpRes, branchRes] = await Promise.all([
        checkpointApi.searchCheckpoints(sid),
        checkpointApi.getBranches(sid),
      ]);
      console.log('[CheckpointPanel] checkpoints response:', cpRes.data);
      console.log('[CheckpointPanel] branches response:', branchRes.data);
      setCheckpoints(cpRes.data.checkpoints || []);
      setBranches(branchRes.data.branches || []);
    } catch (err) {
      console.error('Failed to load checkpoints:', err);
    } finally {
      setLoading(false);
    }
  };

  // 加载详情
  useEffect(() => {
    if (!selectedCheckpoint) {
      setDetail(null);
      return;
    }
    checkpointApi.getCheckpoint(selectedCheckpoint).then(res => setDetail(res.data as CheckpointDetail));
  }, [selectedCheckpoint]);

  // 时间旅行
  const handleTimeTravel = async (checkpointId: string) => {
    if (!sessionId) return;
    if (!confirm('确定要时间旅行到这个检查点吗？当前状态将会改变。')) return;
    try {
      await checkpointApi.timeTravel(sessionId, { checkpointId });
      alert('时间旅行成功！');
      loadData(sessionId);
    } catch (err) {
      alert(`时间旅行失败: ${err}`);
    }
  };

  // 创建分支
  const handleCreateBranch = async () => {
    if (!sessionId || !newBranch.name || !newBranch.fromCheckpointId) return;
    try {
      await checkpointApi.createBranch(sessionId, {
        name: newBranch.name,
        fromCheckpointId: newBranch.fromCheckpointId,
      });
      setShowBranchModal(false);
      setNewBranch({ name: '', fromCheckpointId: '' });
      loadData(sessionId);
    } catch (err) {
      alert(`创建分支失败: ${err}`);
    }
  };

  // 比较检查点
  const handleCompare = async () => {
    if (!compareFrom || !compareTo) return;
    try {
      const res = await checkpointApi.diffCheckpoints(compareFrom, compareTo);
      setCompareResult(res.data.diff);
    } catch (err) {
      alert(`比较失败: ${err}`);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-500" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">检查点</h2>
              <p className="text-sm text-gray-500">时间旅行与版本管理</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowCompareModal(true)}
              className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200"
            >
              <ArrowRight size={16} />
              比较
            </button>
            <button
              onClick={() => setShowBranchModal(true)}
              className="flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              <GitBranch size={16} />
              新建分支
            </button>
          </div>
        </div>

        {/* Branches */}
        {branches.length > 0 && (
          <div className="flex gap-2 mt-4">
            {branches.map(branch => (
              <button
                key={branch.name}
                onClick={() => {
                  const cp = checkpoints.find(c => c.id === branch.checkpointId);
                  if (cp) setSelectedCheckpoint(cp.id);
                }}
                className="px-2 py-1 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full hover:bg-purple-200"
              >
                <GitBranch size={12} className="inline mr-1" />
                {branch.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Checkpoint List */}
        <div className="w-80 border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-gray-500">加载中...</div>
          ) : checkpoints.length === 0 ? (
            <div className="p-4 text-center text-gray-500">暂无检查点</div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {checkpoints.map((cp) => (
                <div
                  key={cp.id}
                  className={`p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 ${
                    selectedCheckpoint === cp.id ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''
                  }`}
                  onClick={() => setSelectedCheckpoint(cp.id)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          #{cp.iteration}
                        </span>
                        <span className="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">
                          {cp.reason}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {formatTime(cp.timestamp)}
                      </div>
                    </div>
                    <div className="text-xs text-gray-400">
                      {cp.messagesCount} msgs
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Detail */}
        <div className="flex-1 overflow-y-auto">
          {selectedCheckpoint && detail ? (
            <div>
              {/* Actions */}
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => handleTimeTravel(selectedCheckpoint)}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  <RotateCcw size={16} />
                  时间旅行到此点
                </button>
              </div>

              {/* Sections */}
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {/* Messages */}
                <div>
                  <button
                    onClick={() => toggleSection('messages')}
                    className="w-full flex items-center gap-2 px-4 py-3 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    {expandedSections.has('messages') ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    消息 ({detail.messages?.length || 0})
                  </button>
                  {expandedSections.has('messages') && (
                    <div className="px-4 pb-4 space-y-2">
                      {(detail.messages as Array<{ role: string; content: string }>)?.map((msg, i) => (
                        <div key={i} className={`p-3 rounded text-xs ${
                          msg.role === 'user' ? 'bg-blue-50 dark:bg-blue-900/20' :
                          msg.role === 'assistant' ? 'bg-green-50 dark:bg-green-900/20' :
                          'bg-gray-50 dark:bg-gray-800'
                        }`}>
                          <div className="font-medium text-gray-500 mb-1">{msg.role}</div>
                          <div className="whitespace-pre-wrap">{String(msg.content).slice(0, 500)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Tool Calls */}
                <div>
                  <button
                    onClick={() => toggleSection('tools')}
                    className="w-full flex items-center gap-2 px-4 py-3 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    {expandedSections.has('tools') ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    工具调用 ({detail.toolCalls?.length || 0})
                  </button>
                  {expandedSections.has('tools') && (
                    <div className="px-4 pb-4 space-y-2">
                      {(detail.toolCalls as Array<{ name: string; input: unknown }>)?.map((tc, i) => (
                        <div key={i} className="p-3 bg-gray-50 dark:bg-gray-800 rounded text-xs">
                          <div className="font-medium">{String(tc.name)}</div>
                          <pre className="mt-1 text-gray-500">{JSON.stringify(tc.input, null, 2)}</pre>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* System Prompt */}
                <div>
                  <button
                    onClick={() => toggleSection('system')}
                    className="w-full flex items-center gap-2 px-4 py-3 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    {expandedSections.has('system') ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    系统提示词
                  </button>
                  {expandedSections.has('system') && (
                    <div className="px-4 pb-4">
                      <pre className="p-3 bg-gray-50 dark:bg-gray-800 rounded text-xs whitespace-pre-wrap max-h-48 overflow-y-auto">
                        {detail.systemPrompt}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              选择一个检查点查看详情
            </div>
          )}
        </div>
      </div>

      {/* Create Branch Modal */}
      {showBranchModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-[400px]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">新建分支</h3>
              <button onClick={() => setShowBranchModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  分支名称 *
                </label>
                <input
                  type="text"
                  value={newBranch.name}
                  onChange={(e) => setNewBranch({ ...newBranch, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  placeholder="例如: experiment-v1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  基于检查点 *
                </label>
                <select
                  value={newBranch.fromCheckpointId}
                  onChange={(e) => setNewBranch({ ...newBranch, fromCheckpointId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                >
                  <option value="">选择检查点</option>
                  {checkpoints.map(cp => (
                    <option key={cp.id} value={cp.id}>
                      #{cp.iteration} - {cp.reason}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowBranchModal(false)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleCreateBranch}
                disabled={!newBranch.name || !newBranch.fromCheckpointId}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Compare Modal */}
      {showCompareModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-[500px] max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">比较检查点</h3>
              <button onClick={() => setShowCompareModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    检查点 A
                  </label>
                  <select
                    value={compareFrom}
                    onChange={(e) => setCompareFrom(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  >
                    <option value="">选择</option>
                    {checkpoints.map(cp => (
                      <option key={cp.id} value={cp.id}>#{cp.iteration}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    检查点 B
                  </label>
                  <select
                    value={compareTo}
                    onChange={(e) => setCompareTo(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  >
                    <option value="">选择</option>
                    {checkpoints.map(cp => (
                      <option key={cp.id} value={cp.id}>#{cp.iteration}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                onClick={handleCompare}
                disabled={!compareFrom || !compareTo}
                className="w-full py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                比较
              </button>

              {compareResult && (
                <div className="space-y-3 mt-4">
                  {compareResult.added.length > 0 && (
                    <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded">
                      <div className="text-sm font-medium text-green-700">新增 ({compareResult.added.length})</div>
                      <pre className="mt-1 text-xs overflow-x-auto">{JSON.stringify(compareResult.added, null, 2)}</pre>
                    </div>
                  )}
                  {compareResult.removed.length > 0 && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded">
                      <div className="text-sm font-medium text-red-700">删除 ({compareResult.removed.length})</div>
                      <pre className="mt-1 text-xs overflow-x-auto">{JSON.stringify(compareResult.removed, null, 2)}</pre>
                    </div>
                  )}
                  {compareResult.modified.length > 0 && (
                    <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded">
                      <div className="text-sm font-medium text-yellow-700">修改 ({compareResult.modified.length})</div>
                      <pre className="mt-1 text-xs overflow-x-auto">{JSON.stringify(compareResult.modified, null, 2)}</pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CheckpointPanel;
