import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Agent } from '../types';

interface AgentState {
  agents: Agent[];
  selectedAgent: string;
  isLoading: boolean;
  error: string | null;

  // Actions
  setAgents: (agents: Agent[]) => void;
  setSelectedAgent: (agentId: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  fetchAgents: () => Promise<void>;
}

export const useAgentStore = create<AgentState>()(
  persist(
    (set, get) => ({
      agents: [],
      selectedAgent: '',
      isLoading: false,
      error: null,

      setAgents: (agents) => set({ agents }),

      setSelectedAgent: (agentId) => set({ selectedAgent: agentId }),

      setLoading: (isLoading) => set({ isLoading }),

      setError: (error) => set({ error }),

      fetchAgents: async () => {
        const { setLoading, setError, setAgents, selectedAgent } = get();
        setLoading(true);
        setError(null);

        try {
          const { infoApi } = await import('../services/api');
          const res = await infoApi.getAgentTeam();
          const agentsList = res.data.agents || [];
          setAgents(agentsList);

          // Auto-select first agent if none selected
          if (!selectedAgent && agentsList.length > 0) {
            set({ selectedAgent: agentsList[0].agent_id });
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to fetch agents');
        } finally {
          setLoading(false);
        }
      },
    }),
    {
      name: 'agent-storage',
      partialize: (state) => ({ selectedAgent: state.selectedAgent }),
    }
  )
);
