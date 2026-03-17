/**
 * Message Queue Types
 */

export interface QueuedMessage {
  id: string;
  sessionKey: string;
  content: string;
  timestamp: number;
  status: 'pending' | 'processing' | 'completed';
}

export interface QueueStatus {
  pending: number;
  processing: number;
  completed: number;
  total: number;
}

export interface EnqueueResult {
  message_id: string;
  status: 'queued';
  queue_status: QueueStatus;
}
