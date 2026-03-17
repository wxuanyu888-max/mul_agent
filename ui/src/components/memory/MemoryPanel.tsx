import { useState, useEffect, useCallback } from 'react';
import {
  Database,
  RefreshCw,
  Trash2,
  Plus,
  Clock,
  FileText,
  Brain,
  HardDrive,
  ArrowRightLeft,
  Search,
  Settings,
  Loader2,
  Sparkles,
  CheckCircle,
  AlertCircle,
  Beaker,
} from 'lucide-react';
import { memoryApi } from '../../services/api';
import type { MemorySearchResult } from '../../services/endpoints/memory';

type MemoryType = 'short' | 'long' | 'handover';

export function MemoryPanel() {
  // Memory data - use any to avoid type conflicts with backend
  const [shortTermMemories, setShortTermMemories] = useState<any[]>([]);
  const [longTermMemories, setLongTermMemories] = useState<any[]>([]);
  const [handoverMemories, setHandoverMemories] = useState<any[]>([]);

  // UI state
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [activeType, setActiveType] = useState<MemoryType>('short');
  const [newMemory, setNewMemory] = useState('');
  const [memoryKey, setMemoryKey] = useState('');
  const [agentId, setAgentId] = useState('core_brain');

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MemorySearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);

  // Stats
  const [stats, setStats] = useState<any>(null);
  const [status, setStatus] = useState<any>(null);

  // Panel state
  const [activePanel, setActivePanel] = useState<'memories' | 'search' | 'status'>('memories');

  const fetchMemories = useCallback(async () => {
    setLoading(true);
    try {
      const [shortRes, longRes, handoverRes, statsRes, statusRes] = await Promise.all([
        memoryApi.getShortTerm(agentId, 50),
        memoryApi.getLongTerm(agentId, 50),
        memoryApi.getHandover(agentId),
        memoryApi.getStats(agentId).catch(() => ({ data: null })),
        memoryApi.getStatus(agentId).catch(() => ({ data: null })),
      ]);

      setShortTermMemories(shortRes.data?.memories || []);
      setLongTermMemories(longRes.data?.memories || []);
      setHandoverMemories(handoverRes.data?.memories || []);
      setStats(statsRes.data?.stats || null);
      setStatus(statusRes.data?.status || null);
    } catch (err) {
      console.error('Failed to fetch memories:', err);
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    fetchMemories();
    const interval = setInterval(fetchMemories, 30000);
    return () => clearInterval(interval);
  }, [fetchMemories]);

  const writeMemory = async () => {
    if (!newMemory.trim()) return;

    try {
      await memoryApi.write(
        newMemory,
        agentId,
        activeType === 'short' ? 'short_term' : activeType === 'long' ? 'long_term' : 'handover'
      );
      setNewMemory('');
      setMemoryKey('');
      fetchMemories();
    } catch (err) {
      console.error('Failed to write memory:', err);
    }
  };

  const deleteMemory = async (memoryId: string) => {
    try {
      await memoryApi.delete(memoryId, agentId);
      fetchMemories();
    } catch (err) {
      console.error('Failed to delete memory:', err);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setShowSearchResults(true);
    try {
      const res = await memoryApi.search(searchQuery, agentId);
      setSearchResults(res.data?.results || []);
    } catch (err) {
      console.error('Failed to search memories:', err);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const syncIndex = async () => {
    setSyncing(true);
    try {
      await fetch('/api/v1/memory/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_id: agentId }),
      });
      await fetchMemories();
    } catch (err) {
      console.error('Failed to sync index:', err);
    } finally {
      setSyncing(false);
    }
  };

  const getMemories = () => {
    switch (activeType) {
      case 'short': return shortTermMemories;
      case 'long': return longTermMemories;
      case 'handover': return handoverMemories;
    }
  };

  const memories = getMemories();

  // Helper to get content value
  const getContentValue = (content: any) => {
    if (typeof content === 'string') return content;
    return content?.value || '';
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-100 to-pink-200 flex items-center justify-center">
              <Database className="w-5 h-5 text-pink-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Memory RAG</h2>
              <p className="text-sm text-gray-500">
                {stats ? `${stats.total_count || 0} total memories` : 'Loading...'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
            >
              <option value="core_brain">Core Brain</option>
              <option value="my_clone">My Clone</option>
            </select>

            <button
              onClick={syncIndex}
              disabled={syncing}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500 disabled:opacity-50"
              title="Sync Index"
            >
              <RefreshCw className={`w-5 h-5 ${syncing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Panel Tabs */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActivePanel('memories')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
              activePanel === 'memories'
                ? 'bg-pink-100 text-pink-700'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Brain className="w-4 h-4" />
            Memories
          </button>
          <button
            onClick={() => setActivePanel('search')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
              activePanel === 'search'
                ? 'bg-purple-100 text-purple-700'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Search className="w-4 h-4" />
            RAG Search
          </button>
          <button
            onClick={() => setActivePanel('status')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
              activePanel === 'status'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Settings className="w-4 h-4" />
            Status
          </button>
        </div>

        {/* Memory Type Tabs (only for memories panel) */}
        {activePanel === 'memories' && (
          <div className="flex gap-2">
            {(['short', 'long', 'handover'] as MemoryType[]).map((type) => {
              const icons: Record<MemoryType, any> = { short: Brain, long: HardDrive, handover: ArrowRightLeft };
              const labels: Record<MemoryType, string> = { short: 'Short-term', long: 'Long-term', handover: 'Handover' };
              const counts: Record<MemoryType, number> = {
                short: shortTermMemories.length,
                long: longTermMemories.length,
                handover: handoverMemories.length
              };
              const Icon = icons[type];
              return (
                <button
                  key={type}
                  onClick={() => setActiveType(type)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    activeType === type
                      ? 'bg-pink-100 text-pink-700'
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {labels[type]}
                  <span className="bg-white/50 px-2 py-0.5 rounded-full text-xs">
                    {counts[type]}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {/* Memories Panel */}
        {activePanel === 'memories' && (
          <>
            {/* Write Memory */}
            {(activeType === 'short' || activeType === 'long') && (
              <div className="px-6 py-4 border-b border-gray-100 bg-pink-50">
                <div className="flex items-start gap-3">
                  <Plus className="w-5 h-5 text-pink-600 mt-1" />
                  <div className="flex-1 space-y-2">
                    <input
                      type="text"
                      value={memoryKey}
                      onChange={(e) => setMemoryKey(e.target.value)}
                      placeholder="Key (optional)"
                      className="w-full bg-white border border-pink-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
                    />
                    <textarea
                      value={newMemory}
                      onChange={(e) => setNewMemory(e.target.value)}
                      placeholder={`Add new ${activeType === 'short' ? 'short-term' : 'long-term'} memory...`}
                      rows={2}
                      className="w-full resize-none bg-white border border-pink-200 rounded-xl px-4 py-3 text-gray-700 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
                    />
                    <button
                      onClick={writeMemory}
                      disabled={!newMemory.trim()}
                      className="px-4 py-2 bg-pink-600 hover:bg-pink-700 disabled:bg-gray-300 text-white rounded-lg font-medium text-sm transition-all disabled:cursor-not-allowed"
                    >
                      Add Memory
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Memories List */}
            <div className="flex-1 overflow-y-auto px-6 py-4 bg-gray-50 h-[calc(100vh-380px)]">
              {loading && memories.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
                </div>
              ) : memories.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                  <Database className="w-16 h-16 mb-4 opacity-20" />
                  <p className="text-lg font-medium">No memories</p>
                  <p className="text-sm mt-1">Add a new memory to get started</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {memories.map((memory: any, index: number) => (
                    <div
                      key={memory.id || index}
                      className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <FileText className="w-4 h-4 text-pink-500" />
                            {memory.content?.key && (
                              <span className="text-xs font-medium text-purple-600 bg-purple-50 px-2 py-0.5 rounded">
                                {memory.content.key}
                              </span>
                            )}
                            <span className="text-xs text-gray-400">
                              {memory.created_at ? new Date(memory.created_at).toLocaleString() : ''}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">
                            {getContentValue(memory.content)}
                          </p>
                        </div>
                        {(activeType === 'short' || activeType === 'long') && (
                          <button
                            onClick={() => deleteMemory(memory.id)}
                            className="p-1.5 hover:bg-red-50 rounded-lg transition-colors text-gray-400 hover:text-red-500"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Search Panel */}
        {activePanel === 'search' && (
          <div className="flex flex-col h-full">
            <div className="px-6 py-4 border-b border-gray-100 bg-purple-50">
              <div className="flex items-center gap-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="Search memories with RAG..."
                    className="w-full pl-10 pr-4 py-3 bg-white border border-purple-200 rounded-xl text-gray-700 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <button
                  onClick={handleSearch}
                  disabled={isSearching || !searchQuery.trim()}
                  className="px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 text-white rounded-xl font-medium text-sm transition-all disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSearching ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  Search
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 bg-gray-50">
              {showSearchResults ? (
                isSearching ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500">
                    <Search className="w-16 h-16 mb-4 opacity-20" />
                    <p className="text-lg font-medium">No results found</p>
                    <p className="text-sm mt-1">Try a different search query</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-gray-500 mb-4">
                      Found {searchResults.length} results
                    </p>
                    {searchResults.map((result, index) => (
                      <div
                        key={index}
                        className="bg-white border border-purple-200 rounded-xl p-4 shadow-sm"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-medium text-purple-600 bg-purple-50 px-2 py-0.5 rounded">
                            Score: {(result.relevance * 100).toFixed(1)}%
                          </span>
                          {result.content?.key && (
                            <span className="text-xs text-gray-500">
                              Key: {result.content.key}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">
                          {result.content?.value || ''}
                        </p>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                  <Sparkles className="w-16 h-16 mb-4 opacity-20" />
                  <p className="text-lg font-medium">RAG Search</p>
                  <p className="text-sm mt-1">Enter a query to search your memories</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Status Panel */}
        {activePanel === 'status' && (
          <div className="flex-1 overflow-y-auto px-6 py-4 bg-gray-50">
            <div className="space-y-4">
              {/* Memory Stats */}
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Memory Statistics</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-pink-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Brain className="w-4 h-4 text-pink-600" />
                      <span className="text-xs text-gray-600">Short-term</span>
                    </div>
                    <p className="text-2xl font-bold text-pink-600">{stats?.short_term_count || 0}</p>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <HardDrive className="w-4 h-4 text-blue-600" />
                      <span className="text-xs text-gray-600">Long-term</span>
                    </div>
                    <p className="text-2xl font-bold text-blue-600">{stats?.long_term_count || 0}</p>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <ArrowRightLeft className="w-4 h-4 text-purple-600" />
                      <span className="text-xs text-gray-600">Handover</span>
                    </div>
                    <p className="text-2xl font-bold text-purple-600">{stats?.handover_count || 0}</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Database className="w-4 h-4 text-green-600" />
                      <span className="text-xs text-gray-600">Total</span>
                    </div>
                    <p className="text-2xl font-bold text-green-600">{stats?.total_count || 0}</p>
                  </div>
                </div>
              </div>

              {/* RAG Index Status */}
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">RAG Index Status</h3>
                {status ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Backend</span>
                      <span className="text-sm font-medium text-gray-900">{status.backend || 'N/A'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Provider</span>
                      <span className="text-sm font-medium text-gray-900">{status.provider || 'N/A'}</span>
                    </div>
                    {status.model && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Model</span>
                        <span className="text-sm font-medium text-gray-900">{status.model}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Indexed Chunks</span>
                      <span className="text-sm font-medium text-gray-900">{status.chunks || 0}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Files</span>
                      <span className="text-sm font-medium text-gray-900">{status.files || 0}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Vector Search</span>
                      <span className={`flex items-center gap-1 text-sm font-medium ${status.vector?.available ? 'text-green-600' : 'text-red-600'}`}>
                        {status.vector?.available ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                        {status.vector?.available ? 'Available' : 'Unavailable'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Full-text Search</span>
                      <span className={`flex items-center gap-1 text-sm font-medium ${status.fts?.available ? 'text-green-600' : 'text-red-600'}`}>
                        {status.fts?.available ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                        {status.fts?.available ? 'Available' : 'Unavailable'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Beaker className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Index status unavailable</p>
                    <p className="text-xs mt-1">Sync to initialize</p>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Actions</h3>
                <button
                  onClick={syncIndex}
                  disabled={syncing}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-pink-600 hover:bg-pink-700 disabled:bg-gray-300 text-white rounded-lg font-medium text-sm transition-all"
                >
                  <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                  {syncing ? 'Syncing...' : 'Sync Index'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default MemoryPanel;
