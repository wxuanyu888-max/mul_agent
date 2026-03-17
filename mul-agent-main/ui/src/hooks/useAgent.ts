import { useEffect } from 'react';
import { useAgentStore } from '../stores';

export function useAgent() {
  const {
    agents,
    selectedAgent,
    isLoading,
    error,
    setAgents,
    setSelectedAgent,
    setLoading,
    setError,
    fetchAgents,
  } = useAgentStore();

  useEffect(() => {
    fetchAgents();
  }, []);

  const selectedAgentData = agents.find((a) => a.agent_id === selectedAgent);

  return {
    agents,
    selectedAgent,
    selectedAgentData,
    isLoading,
    error,
    setSelectedAgent,
    fetchAgents,
  };
}
