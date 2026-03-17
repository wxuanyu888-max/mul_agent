import type { Memory } from '../../types';
import client from './client';

// Search result type
export interface MemorySearchResult {
  memory_id: string;
  relevance: number;
  content: {
    key?: string;
    value: string;
    metadata?: Record<string, unknown>;
  };
  created_at: string;
}

// Status type
export interface MemoryStatus {
  agent_id: string;
  status?: {
    backend: string;
    provider: string;
    model?: string;
    chunks?: number;
    files?: number;
    dirty?: boolean;
    vector?: {
      enabled: boolean;
      available?: boolean;
    };
    fts?: {
      enabled: boolean;
      available: boolean;
    };
  };
}

export const memoryApi = {
  getShortTerm: (agentId: string = 'core_brain', limit: number = 20) =>
    client.get<{ memories: Memory[]; total: number }>('/memory/short-term', { params: { agent_id: agentId, limit } }),

  getLongTerm: (agentId: string = 'core_brain', limit: number = 20) =>
    client.get<{ memories: Memory[]; total: number }>('/memory/long-term', { params: { agent_id: agentId, limit } }),

  getHandover: (agentId: string = 'core_brain') =>
    client.get<{ memories: Memory[] }>('/memory/handover', { params: { agent_id: agentId } }),

  getStats: (agentId: string = 'core_brain') =>
    client.get<{ agent_id: string; stats: Record<string, unknown> }>('/memory/stats', { params: { agent_id: agentId } }),

  getStatus: (agentId: string = 'core_brain') =>
    client.get<MemoryStatus>('/memory/status', { params: { agent_id: agentId } }),

  search: (query: string, agentId: string = 'core_brain', memoryType?: string, limit: number = 20) =>
    client.get<{ query: string; results: MemorySearchResult[]; total: number }>('/memory/search', {
      params: { agent_id: agentId, query, memory_type: memoryType, limit }
    }),

  getSummary: (agentId: string = 'core_brain', memoryType: string = 'short_term') =>
    client.get<{ status: string; memory_type: string; memory_count: number; topics: string[] }>('/memory/summary', {
      params: { agent_id: agentId, memory_type: memoryType }
    }),

  write: (content: string, agentId: string = 'core_brain', memoryType: string = 'short_term', metadata?: Record<string, unknown>) =>
    client.post<{ status: string; memory_id: string; path: string }>('/memory/write', {
      content,
      agent_id: agentId,
      memory_type: memoryType,
      metadata,
    }),

  delete: (memoryId: string, agentId: string = 'core_brain', memoryType: string = 'short_term') =>
    client.delete(`/memory/${memoryId}`, { params: { agent_id: agentId, memory_type: memoryType } }),
};
