import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Message } from '../types';

interface ExecutionStep {
  id: string;
  type: 'status' | 'action' | 'tool' | 'result' | 'error';
  status: 'pending' | 'running' | 'completed' | 'error';
  title: string;
  description?: string;
  details?: unknown;
  timestamp: number;
  expanded?: boolean;
}

interface ChatState {
  messages: Message[];
  currentSessionId: string;
  isLoading: boolean;
  executionSteps: ExecutionStep[];
  showExecutionSteps: boolean;

  // Actions
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  clearMessages: () => void;
  setCurrentSessionId: (sessionId: string) => void;
  setLoading: (loading: boolean) => void;
  setExecutionSteps: (steps: ExecutionStep[]) => void;
  addExecutionStep: (step: ExecutionStep) => void;
  updateExecutionStep: (id: string, updates: Partial<ExecutionStep>) => void;
  clearExecutionSteps: () => void;
  toggleExecutionSteps: () => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      messages: [],
      currentSessionId: '',
      isLoading: false,
      executionSteps: [],
      showExecutionSteps: true,

      setMessages: (messages) => set({ messages }),

      addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),

      clearMessages: () => set({ messages: [] }),

      setCurrentSessionId: (sessionId) => set({ currentSessionId: sessionId }),

      setLoading: (isLoading) => set({ isLoading }),

      setExecutionSteps: (steps) => set({ executionSteps: steps }),

      addExecutionStep: (step) =>
        set((state) => ({ executionSteps: [...state.executionSteps, step] })),

      updateExecutionStep: (id, updates) =>
        set((state) => ({
          executionSteps: state.executionSteps.map((step) =>
            step.id === id ? { ...step, ...updates } : step
          ),
        })),

      clearExecutionSteps: () => set({ executionSteps: [] }),

      toggleExecutionSteps: () =>
        set((state) => ({ showExecutionSteps: !state.showExecutionSteps })),
    }),
    {
      name: 'chat-storage',
      partialize: (state) => ({
        currentSessionId: state.currentSessionId,
        messages: state.messages,
      }),
    }
  )
);
