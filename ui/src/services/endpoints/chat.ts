import type { ChatRequest, ChatResponse } from '../../types';
import client from './client';

export const chatApi = {
  sendMessage: (request: ChatRequest) =>
    client.post<ChatResponse>('/chat', request),

  getHistory: (limit: number = 20, agentId?: string, sessionId?: string) =>
    client.get<{
      history: Array<{ role: string; content: string }>;
      total: number;
      sessions?: Array<{ session_id: string; preview: string; last_message_at: string }>;
    }>('/chat/history', { params: { limit, agent_id: agentId, session_id: sessionId } }),

  getSessions: (agentId?: string) =>
    client.get<{
      sessions: Array<{
        session_id: string;
        agent_id: string;
        created_at: string;
        last_message_at: string;
        message_count: number;
        preview: string;
      }>;
    }>('/chat/sessions', { params: { agent_id: agentId } }),

  getSessionMessages: (sessionId: string, agentId?: string, limit: number = 100) =>
    client.get<{ session_id: string; messages: Array<{ role: string; content: string; timestamp?: string }>; total: number }>(
      `/chat/session/${sessionId}`,
      { params: { agent_id: agentId, limit } }
    ),

  deleteSession: (sessionId: string, agentId?: string) =>
    client.delete<{ status: string; message: string }>(
      `/chat/session/${sessionId}`,
      { params: { agent_id: agentId } }
    ),
};
