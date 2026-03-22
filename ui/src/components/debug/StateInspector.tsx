/**
 * StateInspector - Checkpoint 状态检查器
 *
 * 显示 Checkpoint 的状态快照：
 * - 消息历史
 * - 系统 Prompt
 * - 工具调用记录
 * - 指标信息
 * - 支持时间旅行和差异比较
 */

import { useState, useEffect } from 'react';
import { RotateCcw, GitBranch, ArrowRight, ChevronDown, ChevronUp, ChevronRight, FileText, MessageSquare, Wrench, BarChart3 } from 'lucide-react';
import { checkpointApi } from '../../services/api';

interface Checkpoint {
  id: string;
  iteration: number;
  conversationRound: number;
  reason: string;
  timestamp: number;
  messagesCount: number;
  toolCallsCount: number;
  inputTokens: number;
  outputTokens: number;
}

interface Message {
  role: string;
  content: string;
  tool_calls?: Array<{ id: string; name: string; input: Record<string, unknown> }>;
  tool_call_id?: string;
}

interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  output?: string;
  duration?: number;
}

interface StateInspectorProps {
  sessionId: string;
  onTimeTravel?: (checkpointId: string) => void;
}

// API
async function fetchCheckpoints(sessionId: string): Promise<Checkpoint[]> {
  try {
    const response = await checkpointApi.searchCheckpoints(sessionId);
    return (response.data.checkpoints as Checkpoint[]) || [];
  } catch {
    return [];
  }
}

async function fetchCheckpointDetail(checkpointId: string): Promise<{
  messages: Message[];
  toolCalls: ToolCall[];
  systemPrompt: string;
} | null> {
  try {
    const response = await checkpointApi.getCheckpoint(checkpointId);
    return response.data as { messages: Message[]; toolCalls: ToolCall[]; systemPrompt: string };
  } catch {
    return null;
  }
}

async function fetchBranches(sessionId: string): Promise<{ name: string; checkpointId: string }[]> {
  try {
    const response = await checkpointApi.getBranches(sessionId);
    return (response.data.branches as { name: string; checkpointId: string }[]) || [];
  } catch {
    return [];
  }
}

async function timeTravel(sessionId: string, checkpointId: string, branchName?: string) {
  try {
    const response = await checkpointApi.timeTravel(sessionId, { checkpointId, branchName });
    return response.data;
  } catch {
    throw new Error('Time travel failed');
  }
}

export function StateInspector({ sessionId, onTimeTravel }: StateInspectorProps) {
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [selectedCheckpoint, setSelectedCheckpoint] = useState<string | null>(null);
  const [detail, setDetail] = useState<{
    messages: Message[];
    toolCalls: ToolCall[];
    systemPrompt: string;
  } | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['messages']));
  const [branches, setBranches] = useState<{ name: string; headCheckpointId: string }[]>([]);
  const [showBranches, setShowBranches] = useState(false);
  const [timeTravelTarget, setTimeTravelTarget] = useState<string | null>(null);

  // 加载数据
  useEffect(() => {
    fetchCheckpoints(sessionId).then(setCheckpoints);
    fetchBranches(sessionId).then(data => setBranches(data.map(b => ({ name: b.name, headCheckpointId: b.checkpointId }))));
  }, [sessionId]);

  // 加载详情
  useEffect(() => {
    if (!selectedCheckpoint) {
      setDetail(null);
      return;
    }

    fetchCheckpointDetail(selectedCheckpoint).then(setDetail);
  }, [selectedCheckpoint]);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const handleTimeTravel = async (checkpointId: string) => {
    if (!confirm('确定要时间旅行到这个 Checkpoint 吗？')) return;

    try {
      await timeTravel(sessionId, checkpointId);
      onTimeTravel?.(checkpointId);
    } catch (error) {
      alert(`时间旅行失败: ${error}`);
    }
  };

  const totalTokens = checkpoints.reduce(
    (sum, cp) => sum + cp.inputTokens + cp.outputTokens,
    0
  );

  return (
    <div className="flex flex-col h-full bg-gray-900 text-gray-100">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700">
        <div className="flex items-center gap-4">
          <h3 className="font-semibold">状态检查器</h3>
          <span className="text-sm text-gray-400">
            {checkpoints.length} Checkpoints
          </span>
          <span className="text-sm text-gray-400">
            {totalTokens.toLocaleString()} tokens
          </span>
        </div>
        <button
          onClick={() => setShowBranches(!showBranches)}
          className="flex items-center gap-1 px-2 py-1 text-sm bg-gray-700 rounded hover:bg-gray-600"
        >
          <GitBranch size={14} />
          分支 ({branches.length})
        </button>
      </div>

      {/* Branches Panel */}
      {showBranches && (
        <div className="px-4 py-2 bg-gray-800 border-b border-gray-700">
          <div className="flex flex-wrap gap-2">
            {branches.map(branch => (
              <button
                key={branch.name}
                onClick={() => {
                  const cp = checkpoints.find(c => c.id === branch.headCheckpointId);
                  if (cp) setSelectedCheckpoint(cp.id);
                }}
                className="px-2 py-1 text-xs bg-purple-900 text-purple-200 rounded hover:bg-purple-800"
              >
                {branch.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Checkpoint List */}
      <div className="flex-1 overflow-auto">
        {checkpoints.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            暂无 Checkpoints
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {checkpoints.map((cp) => (
              <div
                key={cp.id}
                className={`p-3 cursor-pointer hover:bg-gray-800 ${
                  selectedCheckpoint === cp.id ? 'bg-gray-800' : ''
                }`}
                onClick={() => setSelectedCheckpoint(cp.id)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs text-gray-400">
                      #{cp.iteration} · {cp.conversationRound}轮
                    </span>
                    <span className="ml-2 px-1.5 py-0.5 text-xs bg-gray-700 rounded">
                      {cp.reason}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">
                      {cp.messagesCount} msgs · {cp.toolCallsCount} tools
                    </span>
                    <span className="text-xs text-gray-400">
                      {(cp.inputTokens + cp.outputTokens).toLocaleString()} tokens
                    </span>
                  </div>
                </div>

                {/* Time Travel Button */}
                {selectedCheckpoint === cp.id && (
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTimeTravel(cp.id);
                      }}
                      className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-900 text-blue-200 rounded hover:bg-blue-800"
                    >
                      <RotateCcw size={12} />
                      时间旅行
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setTimeTravelTarget(cp.id);
                      }}
                      className="flex items-center gap-1 px-2 py-1 text-xs bg-purple-900 text-purple-200 rounded hover:bg-purple-800"
                    >
                      <GitBranch size={12} />
                      创建分支
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail Panel */}
      {detail && selectedCheckpoint && (
        <div className="border-t border-gray-700 max-h-96 overflow-auto">
          {/* Sections */}
          <div className="divide-y divide-gray-800">
            {/* Messages */}
            <div>
              <button
                onClick={() => toggleSection('messages')}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm font-medium hover:bg-gray-800"
              >
                {expandedSections.has('messages') ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <MessageSquare size={14} />
                消息 ({detail.messages.length})
              </button>
              {expandedSections.has('messages') && (
                <div className="px-4 pb-2 space-y-2">
                  {detail.messages.map((msg, i) => (
                    <div key={i} className={`p-2 rounded text-xs ${
                      msg.role === 'user' ? 'bg-blue-900/30' :
                      msg.role === 'assistant' ? 'bg-green-900/30' :
                      'bg-gray-800'
                    }`}>
                      <div className="font-medium text-gray-400">{msg.role}</div>
                      <pre className="mt-1 whitespace-pre-wrap truncate max-h-20">
                        {typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Tool Calls */}
            <div>
              <button
                onClick={() => toggleSection('tools')}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm font-medium hover:bg-gray-800"
              >
                {expandedSections.has('tools') ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <Wrench size={14} />
                工具调用 ({detail.toolCalls.length})
              </button>
              {expandedSections.has('tools') && (
                <div className="px-4 pb-2 space-y-2">
                  {detail.toolCalls.map((tc, i) => (
                    <div key={i} className="p-2 rounded bg-gray-800 text-xs">
                      <div className="font-medium">{tc.name}</div>
                      <pre className="mt-1 text-gray-400">
                        {JSON.stringify(tc.input, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* System Prompt */}
            <div>
              <button
                onClick={() => toggleSection('system')}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm font-medium hover:bg-gray-800"
              >
                {expandedSections.has('system') ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <FileText size={14} />
                系统提示词
              </button>
              {expandedSections.has('system') && (
                <div className="px-4 pb-2">
                  <pre className="p-2 rounded bg-gray-800 text-xs whitespace-pre-wrap max-h-40 overflow-auto">
                    {detail.systemPrompt}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Time Travel Modal */}
      {timeTravelTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-4 w-80">
            <h4 className="font-semibold mb-4">创建分支</h4>
            <input
              type="text"
              placeholder="分支名称"
              className="w-full px-3 py-2 bg-gray-700 rounded mb-4"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleTimeTravel(timeTravelTarget);
                  setTimeTravelTarget(null);
                }
              }}
            />
            <div className="flex gap-2">
              <button
                onClick={() => setTimeTravelTarget(null)}
                className="flex-1 px-3 py-2 bg-gray-700 rounded hover:bg-gray-600"
              >
                取消
              </button>
              <button
                onClick={() => {
                  handleTimeTravel(timeTravelTarget);
                  setTimeTravelTarget(null);
                }}
                className="flex-1 px-3 py-2 bg-blue-600 rounded hover:bg-blue-500"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default StateInspector;
