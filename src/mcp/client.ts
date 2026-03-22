/**
 * MCP (Model Context Protocol) Client
 *
 * 实现 MCP 协议客户端，支持：
 * - 连接 MCP 服务器
 * - 工具调用
 * - 资源访问
 * - 提示词模板
 */

import EventEmitter from 'events';

/**
 * MCP 工具
 */
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

/**
 * MCP 资源
 */
export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

/**
 * MCP 提示词
 */
export interface MCPPrompt {
  name: string;
  description: string;
  arguments?: Array<{
    name: string;
    description: string;
    required: boolean;
  }>;
}

/**
 * MCP 客户端配置
 */
export interface MCPClientConfig {
  /** 服务器 URL */
  url: string;
  /** 认证 token */
  token?: string;
  /** 连接超时 (ms) */
  timeout?: number;
}

/**
 * MCP 客户端
 */
export class MCPClient extends EventEmitter {
  private config: MCPClientConfig;
  private connected: boolean = false;
  private tools: Map<string, MCPTool> = new Map();
  private resources: Map<string, MCPResource> = new Map();
  private prompts: Map<string, MCPPrompt> = new Map();

  constructor(config: MCPClientConfig) {
    super();
    this.config = {
      timeout: 30000,
      ...config,
    };
  }

  /**
   * 连接到 MCP 服务器
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, this.config.timeout);

      try {
        const ws = new (globalThis as any).WebSocket(this.config.url);

        ws.onopen = () => {
          clearTimeout(timeout);
          this.connected = true;
          this.emit('connected');
          resolve();
        };

        ws.onmessage = (event: MessageEvent) => {
          try {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
          } catch {
            // Ignore parse errors
          }
        };

        ws.onerror = (error: Event) => {
          clearTimeout(timeout);
          this.emit('error', error);
          reject(error);
        };

        ws.onclose = () => {
          this.connected = false;
          this.emit('disconnected');
        };
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    this.connected = false;
  }

  /**
   * 处理消息
   */
  private handleMessage(message: Record<string, unknown>): void {
    const method = message.method as string;

    switch (method) {
      case 'tools/listChanged':
        this.emit('toolsChanged');
        break;
      case 'notifications/resourcesUpdated':
        this.emit('resourcesChanged');
        break;
      default:
        this.emit('message', message);
    }
  }

  /**
   * 获取可用工具
   */
  getTools(): MCPTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * 获取可用资源
   */
  getResources(): MCPResource[] {
    return Array.from(this.resources.values());
  }

  /**
   * 获取可用提示词
   */
  getPrompts(): MCPPrompt[] {
    return Array.from(this.prompts.values());
  }

  /**
   * 是否已连接
   */
  isConnected(): boolean {
    return this.connected;
  }
}

/**
 * MCP 服务器管理器
 */
export class MCPServerManager {
  private clients: Map<string, MCPClient> = new Map();

  /**
   * 添加服务器
   */
  async addServer(name: string, config: MCPClientConfig): Promise<MCPClient> {
    const client = new MCPClient(config);
    await client.connect();
    this.clients.set(name, client);
    return client;
  }

  /**
   * 获取客户端
   */
  getClient(name: string): MCPClient | undefined {
    return this.clients.get(name);
  }

  /**
   * 移除服务器
   */
  removeServer(name: string): void {
    const client = this.clients.get(name);
    if (client) {
      client.disconnect();
      this.clients.delete(name);
    }
  }

  /**
   * 列出所有服务器
   */
  listServers(): string[] {
    return Array.from(this.clients.keys());
  }

  /**
   * 全部断开
   */
  disconnectAll(): void {
    for (const client of this.clients.values()) {
      client.disconnect();
    }
    this.clients.clear();
  }
}

// 全局管理器
let globalManager: MCPServerManager | null = null;

export function getGlobalMCPServerManager(): MCPServerManager {
  if (!globalManager) {
    globalManager = new MCPServerManager();
  }
  return globalManager;
}
