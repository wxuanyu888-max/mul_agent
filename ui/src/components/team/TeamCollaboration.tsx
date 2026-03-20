/**
 * TeamCollaboration - 团队协作视图
 *
 * 显示团队协作信息：
 * - 队友列表和状态
 * - 消息流
 * - 协作关系
 */

import { useState, useEffect } from 'react';
import { Users, MessageSquare, Send, Inbox, Network, RefreshCw, Search } from 'lucide-react';

// Types
interface TeammateInfo {
  name: string;
  role: string;
  status: 'WORKING' | 'IDLE' | 'SHUTDOWN';
  createdAt: string;
}

interface Message {
  id: string;
  from: string;
  to: string;
  content: string;
  type?: string;
  timestamp: number;
}

interface TeamMemoryEntry {
  id: string;
  agent: string;
  content: string;
  tags: string[];
  createdAt: number;
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

async function fetchMessages(teammate?: string): Promise<Message[]> {
  try {
    const url = teammate ? `/api/teammates/${teammate}/inbox` : '/api/teammates/messages';
    const response = await fetch(url);
    if (!response.ok) return [];
    return await response.json();
  } catch {
    return [];
  }
}

async function fetchTeamMemory(query?: string): Promise<TeamMemoryEntry[]> {
  try {
    const url = query ? `/api/memory/team?query=${encodeURIComponent(query)}` : '/api/memory/team';
    const response = await fetch(url);
    if (!response.ok) return [];
    return await response.json();
  } catch {
    return [];
  }
}

async function sendMessage(to: string, content: string): Promise<boolean> {
  try {
    const response = await fetch('/api/teammates/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, content }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

// Status config
const statusConfig: Record<string, { color: string; label: string }> = {
  WORKING: { color: 'bg-green-500', label: 'Working' },
  IDLE: { color: 'bg-yellow-500', label: 'Idle' },
  SHUTDOWN: { color: 'bg-gray-400', label: 'Shutdown' },
};

interface TeamMemberCardProps {
  teammate: TeammateInfo;
  onSelect: () => void;
  isSelected: boolean;
}

function TeamMemberCard({ teammate, onSelect, isSelected }: TeamMemberCardProps) {
  const status = statusConfig[teammate.status] || statusConfig.SHUTDOWN;

  return (
    <div
      onClick={onSelect}
      className={`p-3 rounded-lg border cursor-pointer transition-all ${
        isSelected
          ? 'border-purple-500 bg-purple-50'
          : 'border-gray-200 bg-white hover:border-gray-300'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
            <Users className="w-5 h-5 text-purple-600" />
          </div>
          <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ${status.color} border-2 border-white`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-gray-900 truncate">{teammate.name}</div>
          <div className="text-xs text-gray-500 truncate">{teammate.role}</div>
        </div>
      </div>
    </div>
  );
}

interface MessageItemProps {
  message: Message;
  isOwn: boolean;
}

function MessageItem({ message, isOwn }: MessageItemProps) {
  const isDelegation = message.type === 'delegation';
  const isAsk = message.type === 'ask';

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[80%] p-3 rounded-lg ${
        isDelegation
          ? 'bg-orange-50 border border-orange-200'
          : isAsk
            ? 'bg-blue-50 border border-blue-200'
            : isOwn
              ? 'bg-purple-100 border border-purple-200'
              : 'bg-gray-100 border border-gray-200'
      }`}>
        <div className="text-xs text-gray-500 mb-1">
          {isOwn ? 'You' : message.from} → {message.to}
        </div>
        <div className="text-sm text-gray-800 whitespace-pre-wrap line-clamp-4">
          {message.content}
        </div>
        <div className="text-xs text-gray-400 mt-1">
          {new Date(message.timestamp).toLocaleString()}
        </div>
      </div>
    </div>
  );
}

interface MemoryItemProps {
  entry: TeamMemoryEntry;
}

function MemoryItem({ entry }: MemoryItemProps) {
  return (
    <div className="p-3 border-b border-gray-100 last:border-0">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-medium text-purple-600">@{entry.agent}</span>
        {entry.tags.map(tag => (
          <span key={tag} className="px-1.5 py-0.5 text-xs bg-gray-100 rounded">
            {tag}
          </span>
        ))}
      </div>
      <div className="text-sm text-gray-700 line-clamp-2">{entry.content}</div>
      <div className="text-xs text-gray-400 mt-1">
        {new Date(entry.createdAt).toLocaleString()}
      </div>
    </div>
  );
}

export default function TeamCollaboration() {
  const [teammates, setTeammates] = useState<TeammateInfo[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [teamMemory, setTeamMemory] = useState<TeamMemoryEntry[]>([]);
  const [selectedTeammate, setSelectedTeammate] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'members' | 'messages' | 'memory'>('members');
  const [loading, setLoading] = useState(true);
  const [messageInput, setMessageInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchData = async () => {
    setLoading(true);
    const [tm, mem] = await Promise.all([
      fetchTeammates(),
      fetchTeamMemory(searchQuery || undefined),
    ]);
    setTeammates(tm);
    setTeamMemory(mem);

    // Fetch messages for selected teammate
    if (selectedTeammate) {
      const msgs = await fetchMessages(selectedTeammate);
      setMessages(msgs);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [selectedTeammate, searchQuery]);

  const handleSendMessage = async () => {
    if (!selectedTeammate || !messageInput.trim()) return;
    const success = await sendMessage(selectedTeammate, messageInput);
    if (success) {
      setMessageInput('');
      fetchData();
    }
  };

  const activeTeammates = teammates.filter(t => t.status !== 'SHUTDOWN');

  if (loading && teammates.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex">
      {/* Left Sidebar - Team Members */}
      <div className="w-64 border-r border-gray-200 flex flex-col bg-gray-50">
        <div className="p-4 border-b border-gray-200 bg-white">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-600" />
            <span className="font-semibold text-gray-900">Team</span>
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {activeTeammates.length} active members
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {teammates.map(teammate => (
            <TeamMemberCard
              key={teammate.name}
              teammate={teammate}
              isSelected={selectedTeammate === teammate.name}
              onSelect={() => setSelectedTeammate(
                selectedTeammate === teammate.name ? null : teammate.name
              )}
            />
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Tabs */}
        <div className="p-4 border-b border-gray-200 bg-white">
          <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
            <button
              onClick={() => setActiveTab('members')}
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'members'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Users className="w-4 h-4 inline mr-1" />
              Members
            </button>
            <button
              onClick={() => setActiveTab('messages')}
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'messages'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <MessageSquare className="w-4 h-4 inline mr-1" />
              Messages
            </button>
            <button
              onClick={() => setActiveTab('memory')}
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'memory'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Inbox className="w-4 h-4 inline mr-1" />
              Memory
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'members' && (
            <div className="p-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {teammates.map(teammate => {
                  const status = statusConfig[teammate.status] || statusConfig.SHUTDOWN;
                  return (
                    <div key={teammate.name} className="p-4 rounded-lg border border-gray-200 bg-white">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                          <Users className="w-6 h-6 text-purple-600" />
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{teammate.name}</div>
                          <div className="text-sm text-gray-500">{teammate.role}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${status.color}`} />
                        <span className="text-sm text-gray-600">{status.label}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'messages' && (
            <div className="flex flex-col h-full">
              {selectedTeammate ? (
                <>
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {messages.length === 0 ? (
                      <div className="text-center py-8 text-gray-400">
                        <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>No messages yet</p>
                      </div>
                    ) : (
                      messages.map(msg => (
                        <MessageItem
                          key={msg.id}
                          message={msg}
                          isOwn={msg.from === 'lead'}
                        />
                      ))
                    )}
                  </div>
                  <div className="p-4 border-t border-gray-200 bg-white">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={messageInput}
                        onChange={(e) => setMessageInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                        placeholder={`Message ${selectedTeammate}...`}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      />
                      <button
                        onClick={handleSendMessage}
                        disabled={!messageInput.trim()}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-gray-400">
                  <div className="text-center">
                    <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Select a teammate to view messages</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'memory' && (
            <div className="p-4">
              {/* Search */}
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search team memory..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              {/* Memory List */}
              {teamMemory.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <Inbox className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No team memories</p>
                  <p className="text-sm mt-1">Team members can write memories to share knowledge</p>
                </div>
              ) : (
                <div className="bg-white rounded-lg border border-gray-200">
                  {teamMemory.map(entry => (
                    <MemoryItem key={entry.id} entry={entry} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Collaboration Graph Placeholder */}
        {activeTab === 'members' && (
          <div className="p-4 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center gap-2 mb-2">
              <Network className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Collaboration Network</span>
            </div>
            <div className="h-24 bg-white rounded-lg border border-gray-200 flex items-center justify-center text-gray-400 text-sm">
              {teammates.length > 1
                ? `${teammates.length} members - ${teammates.length * (teammates.length - 1) / 2} possible connections`
                : 'Add more teammates to see collaboration network'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
