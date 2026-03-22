import { create } from 'zustand';

type TabType = 'chat' | 'voice' | 'workflow' | 'tasks' | 'logs' | 'memory' | 'token' | 'keys' | 'prompts' | 'humaninloop' | 'checkpoint';

interface UIState {
  activeTab: TabType;
  showSessionList: boolean;

  // Actions
  setActiveTab: (tab: TabType) => void;
  toggleSessionList: () => void;
  setSessionList: (show: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeTab: 'chat',
  showSessionList: false,

  setActiveTab: (tab) => set({ activeTab: tab }),

  toggleSessionList: () => set((state) => ({ showSessionList: !state.showSessionList })),

  setSessionList: (show) => set({ showSessionList: show }),
}));
