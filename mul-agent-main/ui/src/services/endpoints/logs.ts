import type { LogEntry } from '../../types';
import client from './client';

export const logsApi = {
  getLogs: (limit: number = 100, level?: string, keyword?: string, source?: string) =>
    client.get<{ logs: LogEntry[]; total: number }>('/logs', { params: { limit, level, keyword, source } }),

  getStats: () =>
    client.get<Record<string, unknown>>('/logs/stats'),

  getFiles: () =>
    client.get<{ files: Array<{ filename: string; path: string; size: number; modified: string }> }>('/logs/files'),
};
