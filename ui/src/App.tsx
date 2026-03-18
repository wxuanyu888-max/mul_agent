import { lazy, Suspense } from 'react';
import { useUIStore } from './stores';
import { MessageSquare, Activity, FileText, Database, Bot, BarChart3, Key, Loader2 } from 'lucide-react';

// Lazy load all panels except Chat (Chat stays always loaded for UX)
const ChatPanel = lazy(() => import('./components/chat/ChatPanel').then(m => ({ default: m.ChatPanel })));
const WorkflowCanvas = lazy(() => import('./components/workflow/WorkflowCanvas').then(m => ({ default: m.WorkflowCanvas })));
const LogViewer = lazy(() => import('./components/logs/LogViewer').then(m => ({ default: m.LogViewer })));
const MemoryPanel = lazy(() => import('./components/memory/MemoryPanel').then(m => ({ default: m.MemoryPanel })));
const TokenUsagePanel = lazy(() => import('./components/token/TokenUsagePanel').then(m => ({ default: m.default })));
const IntegrationList = lazy(() => import('./components/settings/IntegrationList').then(m => ({ default: m.default })));

type TabType = 'chat' | 'workflow' | 'logs' | 'memory' | 'token' | 'keys';

interface NavItem {
  id: TabType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'workflow', label: 'Workflow', icon: Activity },
  { id: 'logs', label: 'Logs', icon: FileText },
  { id: 'memory', label: 'Memory', icon: Database },
  { id: 'token', label: 'Token', icon: BarChart3 },
  { id: 'keys', label: 'Settings', icon: Key },
];

// Loading fallback component
function PanelLoader() {
  return (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
    </div>
  );
}

function App() {
  const { activeTab, setActiveTab } = useUIStore();

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-20 bg-white border-r border-gray-200 flex flex-col items-center py-4">
        {/* Logo */}
        <div className="mb-6 p-2">
          <Bot className="w-8 h-8 text-purple-600" />
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-14 h-14 rounded-xl flex items-center justify-center transition-all ${
                  activeTab === item.id
                    ? 'bg-purple-100 text-purple-600 shadow-md'
                    : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
                }`}
                title={item.label}
              >
                <Icon className="w-6 h-6" />
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="pt-4 border-t border-gray-200">
          <div className="text-xs text-gray-400 text-center">
            MUL
            <br />
            Agent
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {/* Header */}
        <div className="h-14 bg-white border-b border-gray-200 flex items-center px-6">
          <h1 className="text-lg font-semibold text-gray-900">
            {navItems.find((item) => item.id === activeTab)?.label}
          </h1>
        </div>

        {/* Content Area */}
        <div className="h-[calc(100vh-8.5rem)] overflow-auto">
          {/* Chat - always mounted */}
          <div className={`h-full ${activeTab === 'chat' ? '' : 'hidden'}`}>
            <ChatPanel />
          </div>

          {/* Lazy loaded panels */}
          <div className={`h-full ${activeTab === 'workflow' ? '' : 'hidden'}`}>
            <Suspense fallback={<PanelLoader />}>
              <WorkflowCanvas />
            </Suspense>
          </div>
          <div className={`h-full ${activeTab === 'logs' ? '' : 'hidden'}`}>
            <Suspense fallback={<PanelLoader />}>
              <LogViewer />
            </Suspense>
          </div>
          <div className={`h-full ${activeTab === 'memory' ? '' : 'hidden'}`}>
            <Suspense fallback={<PanelLoader />}>
              <MemoryPanel />
            </Suspense>
          </div>
          <div className={`h-full ${activeTab === 'token' ? '' : 'hidden'}`}>
            <Suspense fallback={<PanelLoader />}>
              <TokenUsagePanel />
            </Suspense>
          </div>
          <div className={`h-full ${activeTab === 'keys' ? '' : 'hidden'}`}>
            <Suspense fallback={<PanelLoader />}>
              <IntegrationList />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
