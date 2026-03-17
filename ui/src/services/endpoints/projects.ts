import type { Project, ProjectDetails, Agent } from '../../types';
import client from './client';

export const projectsApi = {
  list: () =>
    client.get<{ projects: Project[] }>('/projects'),

  get: (projectId: string) =>
    client.get<ProjectDetails>(`/projects/${projectId}`),

  create: (name: string, description: string = '', project_id: string = '') =>
    client.post<{ status: string; project_id: string; message: string }>('/projects', { name, description, project_id }),

  delete: (projectId: string) =>
    client.delete<{ status: string; message: string }>(`/projects/${projectId}`),

  getAgents: (projectId: string) =>
    client.get<{ agents: Agent[] }>(`/projects/${projectId}/agents`),
};
