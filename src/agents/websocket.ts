// WebSocket 支持
// 用于实时通信和事件推送

/**
 * WebSocket 消息类型
 */
export type WSMessageType =
  | 'connect'
  | 'disconnect'
  | 'message'
  | 'ping'
  | 'pong'
  | 'error'
  | 'agent_event'
  | 'session_update'
  | 'tool_call'
  | 'tool_result';

/**
 * WebSocket 消息
 */
export interface WSMessage {
  type: WSMessageType;
  payload: any;
  timestamp?: number;
  id?: string;
}

/**
 * WebSocket 连接状态
 */
export type WSConnectionState = 'connecting' | 'connected' | 'disconnecting' | 'disconnected' | 'error';

/**
 * WebSocket 客户端配置
 */
export interface WSClientConfig {
  url: string;
  reconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  pingInterval?: number;
}

/**
 * WebSocket 事件处理器
 */
export interface WSEventHandlers {
  onOpen?: () => void;
  onClose?: (code: number, reason: string) => void;
  onError?: (error: Error) => void;
  onMessage?: (message: WSMessage) => void;
  onReconnect?: (attempt: number) => void;
  onMaxReconnectAttemptsReached?: () => void;
}

/**
 * 生成消息 ID
 */
function generateMessageId(): string {
  return `msg_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * 创建 WebSocket 客户端
 *
 * 注意：这是浏览器环境版本，在 Node.js 环境中需要使用 ws 库
 */
export function createWSClient(config: WSClientConfig, handlers: WSEventHandlers = {}) {
  let ws: WebSocket | null = null;
  let state: WSConnectionState = 'disconnected';
  let reconnectAttempt = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let pingTimer: ReturnType<typeof setInterval> | null = null;

  const {
    url,
    reconnect = true,
    reconnectInterval = 3000,
    maxReconnectAttempts = 5,
    pingInterval = 30000,
  } = config;

  /**
   * 更新状态
   */
  function setState(newState: WSConnectionState) {
    state = newState;
  }

  /**
   * 处理错误
   */
  function handleError(error: Error) {
    setState('error');
    handlers.onError?.(error);
  }

  /**
   * 处理关闭
   */
  function handleClose(code: number, reason: string) {
    setState('disconnecting');
    stopPing();

    if (ws) {
      ws.close();
      ws = null;
    }

    setState('disconnected');
    handlers.onClose?.(code, reason);

    // 尝试重连
    if (reconnect && reconnectAttempt < maxReconnectAttempts) {
      scheduleReconnect();
    } else if (reconnectAttempt >= maxReconnectAttempts) {
      handlers.onMaxReconnectAttemptsReached?.();
    }
  }

  /**
   * 安排重连
   */
  function scheduleReconnect() {
    reconnectAttempt++;
    const delay = reconnectInterval * reconnectAttempt;

    handlers.onReconnect?.(reconnectAttempt);

    reconnectTimer = setTimeout(() => {
      connect().catch((err) => {
        console.error('Reconnect failed:', err);
      });
    }, delay);
  }

  /**
   * 停止重连
   */
  function stopReconnect() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    reconnectAttempt = 0;
  }

  /**
   * 开始 ping
   */
  function startPing() {
    pingTimer = setInterval(() => {
      if (ws && state === 'connected') {
        ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
      }
    }, pingInterval);
  }

  /**
   * 停止 ping
   */
  function stopPing() {
    if (pingTimer) {
      clearInterval(pingTimer);
      pingTimer = null;
    }
  }

  /**
   * 处理消息
   */
  function handleMessage(event: MessageEvent) {
    try {
      const message: WSMessage = JSON.parse(event.data);
      handlers.onMessage?.(message);
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  }

  /**
   * 连接
   */
  async function connect(): Promise<void> {
    if (ws && (state === 'connected' || state === 'connecting')) {
      return;
    }

    setState('connecting');

    return new Promise((resolve, reject) => {
      try {
        ws = new WebSocket(url);

        ws.onopen = () => {
          setState('connected');
          stopReconnect();
          startPing();
          handlers.onOpen?.();
          resolve();
        };

        ws.onclose = (event) => {
          handleClose(event.code, event.reason);
        };

        ws.onerror = () => {
          handleError(new Error('WebSocket error'));
        };

        ws.onmessage = (event) => {
          handleMessage(event);
        };
      } catch (error) {
        setState('error');
        reject(error);
      }
    });
  }

  /**
   * 断开连接
   */
  async function disconnect(): Promise<void> {
    stopReconnect();
    stopPing();

    if (ws) {
      setState('disconnecting');
      ws.close(1000, 'Client disconnect');
      ws = null;
    }

    setState('disconnected');
  }

  /**
   * 发送消息
   */
  function send(message: WSMessage) {
    const msg = {
      ...message,
      id: message.id || generateMessageId(),
      timestamp: message.timestamp || Date.now(),
    };

    if (ws && state === 'connected') {
      ws.send(JSON.stringify(msg));
    } else {
      console.warn('WebSocket is not connected');
    }
  }

  /**
   * 检查是否已连接
   */
  function isConnected(): boolean {
    return state === 'connected';
  }

  return {
    get state() {
      return state;
    },
    get url() {
      return url;
    },
    connect,
    disconnect,
    send,
    isConnected,
  };
}

/**
 * 事件发射器
 */
export class EventEmitter<T = any> {
  private listeners: Map<string, Set<(data: T) => void>> = new Map();

  /**
   * 订阅事件
   */
  on(event: string, handler: (data: T) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);

    return () => {
      this.listeners.get(event)?.delete(handler);
    };
  }

  /**
   * 订阅一次
   */
  once(event: string, handler: (data: T) => void): () => void {
    const wrapper = (data: T) => {
      handler(data);
      this.off(event, wrapper);
    };
    return this.on(event, wrapper);
  }

  /**
   * 取消订阅
   */
  off(event: string, handler?: (data: T) => void) {
    if (!handler) {
      this.listeners.delete(event);
    } else {
      this.listeners.get(event)?.delete(handler);
    }
  }

  /**
   * 发射事件
   */
  emit(event: string, data: T) {
    this.listeners.get(event)?.forEach((handler) => {
      try {
        handler(data);
      } catch (error) {
        console.error(`Error in event handler for ${event}:`, error);
      }
    });
  }
}

/**
 * Agent 事件类型
 */
export type AgentEventType = 'start' | 'stop' | 'error' | 'message' | 'tool_call' | 'tool_result';

/**
 * Agent 事件
 */
export interface AgentEvent {
  agentId: string;
  eventType: AgentEventType;
  data: any;
  timestamp: number;
}

/**
 * 创建 Agent 事件发射器
 */
export function createAgentEventEmitter() {
  const emitter = new EventEmitter<AgentEvent>();

  /**
   * 发射 Agent 事件
   */
  function emitAgentEvent(agentId: string, eventType: AgentEventType, data: any) {
    emitter.emit('agent_event', {
      agentId,
      eventType,
      data,
      timestamp: Date.now(),
    });
  }

  return {
    emitter,
    emitAgentEvent,
  };
}
