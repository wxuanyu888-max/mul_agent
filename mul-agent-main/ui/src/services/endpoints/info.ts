import type { Agent, AgentSummary, Route, Interaction } from '../../types';
import client from './client';

export const infoApi = {
  getSummary: () =>
    client.get<AgentSummary>('/info/summary'),

  getRoutes: () =>
    client.get<{ routes: Route[] }>('/info/routes'),

  getRuns: (limit: number = 10) =>
    client.get<{ runs: Array<Record<string, unknown>> }>('/info/runs', { params: { limit } }),

  getCurrentWorkflow: () =>
    client.get<{
      active: boolean;
      run_id?: string;
      input?: string;
      status?: string;
      phase?: string;
      sub_agents?: Array<Record<string, unknown>>;
      flow?: Array<Record<string, unknown>>;
    }>('/info/workflow/current'),

  getLatestWorkflow: (limit: number = 5) =>
    client.get<{ runs: Array<Record<string, unknown>> }>('/info/workflow/latest', { params: { limit } }),

  getThinkingModes: () =>
    client.get<{ modes: Array<{ value: string; name: string; description: string }> }>('/info/thinking/modes'),

  getThoughtProcess: (sessionId: string) =>
    client.get<{
      session_id: string;
      steps: Array<{
        id: string;
        type: string;
        description: string;
        status: string;
        duration_ms: number | null;
        result: string | null;
      }>;
      is_complete: boolean;
      total_duration_ms: number;
    }>(`/info/thoughts/${sessionId}`),

  setThinkingConfig: (config: { mode?: string; enable_tracking?: boolean }) =>
    client.post<{ status: string; mode?: string; enable_tracking?: boolean }>('/info/thinking/config', config),

  // Agent Team API
  getAgentTeam: (projectId?: string) =>
    client.get<{
      agents: Agent[];
      active_sub_agents: Record<string, unknown>;
      current_task: { active: boolean; input: string | null; status: string | null };
    }>('/info/agent-team', { params: { project_id: projectId } }),

  getAgentDetails: (agentId: string, projectId?: string) =>
    client.get<{
      agent_id: string;
      name: string;
      description: string;
      role: string;
      soul: string;
      skill: string;
      memory: string;
      current_task: { task: string; status: string; type: string } | null;
      sub_agents: Array<{ agent_id: string; agent_type: string; status: string; input: string }>;
      status: string;
      project_id?: string;
    }>(`/info/agent/${agentId}/details`, { params: { project_id: projectId } }),

  getLoadedDocs: (agentId: string) =>
    client.get<{
      agent_id: string;
      loaded_docs: Record<string, { content: string; attributes: Record<string, unknown> }>;
      doc_count: number;
    }>(`/info/agent/${agentId}/loaded-docs`),

  getInteractions: (limit: number = 20, timeWindow?: number) =>
    client.get<{ interactions: Interaction[] }>('/info/interactions', { params: { limit, time_window: timeWindow } }),

  getAgentInteractions: (source: string, target: string, timeWindow?: number, limit?: number) =>
    client.get<{ interactions: Interaction[] }>(`/info/interactions/${source}/${target}`, {
      params: { time_window: timeWindow, limit }
    }),

  getFilesBatch: (filePaths: string[]) =>
    client.post<{ files: Record<string, { content: string; size?: number; exists?: boolean; error?: string }> }>(
      '/info/files/batch',
      { file_paths: filePaths }
    ),
};
