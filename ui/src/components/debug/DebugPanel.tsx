/**
 * DebugPanel - 调试面板主入口
 *
 * 整合所有调试功能：
 * - 执行时间线
 * - 状态检查器
 * - Token 消耗分析
 */

import { useState } from 'react';
import { Activity, Database, BarChart3, Settings, X } from 'lucide-react';
import { AgentTimeline } from './AgentTimeline';
import { StateInspector } from './StateInspector';
import { TokenBreakdown } from './TokenBreakdown';

type Tab = 'timeline' | 'state' | 'tokens';

interface DebugPanelProps {
  sessionId: string;
  onClose?: () => void;
  initialTab?: Tab;
}

export function DebugPanel({ sessionId, onClose, initialTab = 'timeline' }: DebugPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);

  const tabs: { id: Tab; label: string; icon: typeof Activity }[] = [
    { id: 'timeline', label: '时间线', icon: Activity },
    { id: 'state', label: '状态', icon: Database },
    { id: 'tokens', label: 'Token', icon: BarChart3 },
  ];

  return (
    <div className="flex flex-col h-full bg-gray-900 border-l border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700">
        <h2 className="font-semibold">调试面板</h2>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-700 rounded"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-700">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-blue-500 text-blue-400 bg-gray-800'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'timeline' && (
          <AgentTimeline sessionId={sessionId} />
        )}
        {activeTab === 'state' && (
          <StateInspector sessionId={sessionId} />
        )}
        {activeTab === 'tokens' && (
          <TokenBreakdown sessionId={sessionId} />
        )}
      </div>
    </div>
  );
}

// 独立的 Debug 按钮组件
interface DebugButtonProps {
  sessionId: string;
}

export function DebugButton({ sessionId }: DebugButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 p-3 bg-blue-600 hover:bg-blue-500 rounded-full shadow-lg z-50"
        title="打开调试面板"
      >
        <Activity size={20} />
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => setIsOpen(false)}
      />

      {/* Panel */}
      <div className="relative w-[600px] h-full shadow-xl">
        <DebugPanel
          sessionId={sessionId}
          onClose={() => setIsOpen(false)}
        />
      </div>
    </div>
  );
}

export default DebugPanel;
