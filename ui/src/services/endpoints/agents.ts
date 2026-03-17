import type { Agent, AgentConfig } from '../../types';
import client from './client';

export const agentsApi = {
  list: () =>
    client.get<{ agents: Agent[] }>('/agents'),

  get: (agentId: string) =>
    client.get<{
      agent_id: string;
      soul: AgentConfig;
      user: AgentConfig;
      skill: AgentConfig;
      memory: AgentConfig;
    }>(`/agents/${agentId}`),

  getConfig: (agentId: string, configType: string = 'all') =>
    client.get<Record<string, AgentConfig>>(`/agents/${agentId}/config`, { params: { config_type: configType } }),

  updateConfig: (agentId: string, configType: string, content: string, metadata?: Record<string, unknown>) =>
    client.put(`/agents/${agentId}/config`, { config_type: configType, content, metadata }),

  getStatus: (agentId: string) =>
    client.get<{ agent_id: string; status: string; session_id: string | null }>(`/agents/${agentId}/status`),
};
