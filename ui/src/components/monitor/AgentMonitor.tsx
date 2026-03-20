/**
 * AgentMonitor - Agent 状态监控面板
 *
 * 显示所有 Agent 的状态：
 * - 队友列表和状态
 * - 自治 Agent 状态
 * - 控制操作（启动/停止/重启）
 */

import { useState, useEffect } from 'react';
import { Users, Bot, Activity, Play, Square, RefreshCw, Clock, CheckCircle2, XCircle } from 'lucide-react';

// Types
interface TeammateInfo {
  name: string;
  role: string;
  status: 'WORKING' | 'IDLE' | 'SHUTDOWN';
  createdAt: string;
}

interface TeamMember {
  name: string;
  role: string;
  team: string;
  status: 'spawning' | 'working' | 'idle' | 'shutdown' | 'error';
  current_task_id?: number;
  started_at: string;
  last_active: string;
}

// API functions
async function fetchTeammates(): Promise<TeammateInfo[]> {
  try {
    const response = await fetch('/api/teammates');
    if (!response.ok) return [];
    return await response.json();
  } catch {
    return [];
  }
}

async function fetchTeamMembers(): Promise<TeamMember[]> {
  try {
    const response = await fetch('/api/agents/team');
    if (!response.ok) return [];
    return await response.json();
  } catch {
    return [];
  }
}

async function spawnTeammate(name: string, role: string): Promise<boolean> {
  try {
    const response = await fetch('/api/teammates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, role }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function shutdownTeammate(name: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/teammates/${name}`, {
      method: 'DELETE',
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function shutdownAgent(name: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/agents/autonomous/${name}`, {
      method: 'DELETE',
    });
    return response.ok;
  } catch {
    return false;
  }
}

// Status config
const statusConfig: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  WORKING: { icon: <Activity className="w-4 h-4" />, color: 'text-green-500', label: 'Working' },
  IDLE: { icon: <Clock className="w-4 h-4" />, color: 'text-yellow-500', label: 'Idle' },
  SHUTDOWN: { icon: <XCircle className="w-4 h-4" />, color: 'text-gray-400', label: 'Shutdown' },
  spawning: { icon: <RefreshCw className="w-4 h-4 animate-spin" />, color: 'text-blue-500', label: 'Spawning' },
  working: { icon: <Activity className="w-4 h-4" />, color: 'text-green-500', label: 'Working' },
  idle: { icon: <Clock className="w-4 h-4" />, color: 'text-yellow-500', label: 'Idle' },
  shutdown: { icon: <XCircle className="w-4 h-4" />, color: 'text-gray-400', label: 'Shutdown' },
  error: { icon: <XCircle className="w-4 h-4" />, color: 'text-red-500', label: 'Error' },
};

interface AgentCardProps {
  agent: TeammateInfo | TeamMember;
  type: 'teammate' | 'autonomous';
  onAction?: (action: 'stop' | 'restart') => void;
}

function AgentCard({ agent, type, onAction }: AgentCardProps) {
  const status = statusConfig[agent.status] || statusConfig.shutdown;

  return (
    <div className="p-4 rounded-lg border border-gray-200 bg-white hover:border-gray-300 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          {type === 'teammate' ? (
            <Users className="w-5 h-5 text-purple-500" />
          ) : (
            <Bot className="w-5 h-5 text-blue-500" />
          )}
          <div>
            <div className="font-medium text-gray-900">{agent.name}</div>
            <div className="text-sm text-gray-500">{(agent as TeammateInfo).role || (agent as TeamMember).role}</div>
          </div>
        </div>
        <div className={`flex items-center gap-1 ${status.color}`}>
          {status.icon}
          <span className="text-xs">{status.label}</span>
        </div>
      </div>

      {'current_task_id' in agent && agent.current_task_id && (
        <div className="mt-3 text-xs text-gray-500">
          Task #{agent.current_task_id}
        </div>
      )}

      {'createdAt' in agent && (
        <div className="mt-2 text-xs text-gray-400">
          Created: {new Date(agent.createdAt).toLocaleString()}
        </div>
      )}

      {'started_at' in agent && (
        <div className="mt-2 text-xs text-gray-400">
          Started: {new Date(agent.started_at).toLocaleString()}
        </div>
      )}

      {onAction && agent.status !== 'SHUTDOWN' && agent.status !== 'shutdown' && (
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => onAction('stop')}
            className="flex items-center gap-1 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <Square className="w-3 h-3" />
            Stop
          </button>
          <button
            onClick={() => onAction('restart')}
            className="flex items-center gap-1 px-3 py-1.5 text-xs text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Restart
          </button>
        </div>
      )}
    </div>
  );
}

interface SpawnFormProps {
  onSubmit: (name: string, role: string) => void;
  onCancel: () => void;
}

function SpawnForm({ onSubmit, onCancel }: SpawnFormProps) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !role.trim()) return;
    onSubmit(name, role);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
          placeholder="agent-name"
          autoFocus
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
        <input
          type="text"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
          placeholder="e.g., Code Reviewer"
        />
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!name.trim() || !role.trim()}
          className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
        >
          Spawn
        </button>
      </div>
    </form>
  );
}

export default function AgentMonitor() {
  const [teammates, setTeammates] = useState<TeammateInfo[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSpawnForm, setShowSpawnForm] = useState(false);
  const [activeTab, setActiveTab] = useState<'teammates' | 'autonomous'>('teammates');

  const fetchData = async () => {
    setLoading(true);
    const [tm, mb] = await Promise.all([
      fetchTeammates(),
      fetchTeamMembers(),
    ]);
    setTeammates(tm);
    setTeamMembers(mb);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    // 定时刷新
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleSpawn = async (name: string, role: string) => {
    const success = await spawnTeammate(name, role);
    if (success) {
      setShowSpawnForm(false);
      fetchData();
    }
  };

  const handleStop = async (name: string, type: 'teammate' | 'autonomous') => {
    if (type === 'teammate') {
      await shutdownTeammate(name);
    } else {
      await shutdownAgent(name);
    }
    fetchData();
  };

  const handleRestart = async (name: string, type: 'teammate' | 'autonomous') => {
    // 先停止
    await handleStop(name, type);
    // TODO: 重新启动
    fetchData();
  };

  const allAgents = [
    ...teammates.map(t => ({ ...t, type: 'teammate' as const })),
    ...teamMembers.map(t => ({ ...t, type: 'autonomous' as const })),
  ];

  const working = allAgents.filter(a => a.status === 'WORKING' || a.status === 'working').length;
  const idle = allAgents.filter(a => a.status === 'IDLE' || a.status === 'idle').length;

  if (loading && allAgents.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-purple-600" />
            <span className="font-semibold text-gray-900">Agent Monitor</span>
          </div>
          <button
            onClick={() => setShowSpawnForm(true)}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            <Play className="w-4 h-4" />
            New Agent
          </button>
        </div>

        {/* Stats */}
        <div className="flex gap-4 text-sm">
          <div className="flex items-center gap-1 text-gray-500">
            <Users className="w-4 h-4" />
            <span>{allAgents.length} total</span>
          </div>
          <div className="flex items-center gap-1 text-green-600">
            <Activity className="w-4 h-4" />
            <span>{working} working</span>
          </div>
          <div className="flex items-center gap-1 text-yellow-600">
            <Clock className="w-4 h-4" />
            <span>{idle} idle</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-4 p-1 bg-gray-100 rounded-lg">
          <button
            onClick={() => setActiveTab('teammates')}
            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'teammates'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Users className="w-4 h-4 inline mr-1" />
            Teammates ({teammates.length})
          </button>
          <button
            onClick={() => setActiveTab('autonomous')}
            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'autonomous'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Bot className="w-4 h-4 inline mr-1" />
            Autonomous ({teamMembers.length})
          </button>
        </div>
      </div>

      {/* Agent List */}
      <div className="flex-1 overflow-y-auto p-4">
        {showSpawnForm ? (
          <div className="max-w-md mx-auto">
            <div className="p-4 bg-white rounded-lg border border-gray-200">
              <h3 className="text-lg font-semibold mb-4">Spawn New Agent</h3>
              <SpawnForm
                onSubmit={handleSpawn}
                onCancel={() => setShowSpawnForm(false)}
              />
            </div>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {(activeTab === 'teammates' ? teammates : teamMembers).map((agent) => (
              <AgentCard
                key={agent.name}
                agent={agent}
                type={activeTab === 'teammates' ? 'teammate' : 'autonomous'}
                onAction={(action) => handleStop(agent.name, activeTab === 'teammates' ? 'teammate' : 'autonomous')}
              />
            ))}
            {(activeTab === 'teammates' ? teammates : teamMembers).length === 0 && (
              <div className="col-span-full text-center py-8 text-gray-400">
                <Bot className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No {activeTab} agents</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Refresh button */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <button
          onClick={fetchData}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>
    </div>
  );
}
