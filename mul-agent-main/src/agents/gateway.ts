/**
 * Gateway 调用模块
 *
 * 负责与 OpenClaw Gateway 通信
 */

import type { GatewayCallParams, GatewayCallResult } from './types.js';

/**
 * Gateway 配置
 */
export interface GatewayConfig {
  baseUrl?: string;
  timeout?: number;
  apiKey?: string;
}

/**
 * 默认 Gateway 配置
 */
const DEFAULT_CONFIG: Required<GatewayConfig> = {
  baseUrl: process.env.OPENCLAW_GATEWAY_URL ?? 'http://localhost:3000',
  timeout: 30000,
  apiKey: process.env.OPENCLAW_API_KEY ?? '',
};

/**
 * Gateway 客户端
 */
export class GatewayClient {
  private config: Required<GatewayConfig>;

  constructor(config: GatewayConfig = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };
  }

  /**
   * 调用 Gateway 方法
   */
  async call<T = unknown>(params: GatewayCallParams): Promise<GatewayCallResult<T>> {
    const { method, params: methodParams, timeoutMs } = params;
    const timeout = timeoutMs ?? this.config.timeout;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(`${this.config.baseUrl}/api/${method}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey ? { 'Authorization': `Bearer ${this.config.apiKey}` } : {}),
        },
        body: JSON.stringify(methodParams),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const data = await response.json() as T;

      return {
        success: true,
        data,
      };
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          return {
            success: false,
            error: 'Request timeout',
          };
        }
        return {
          success: false,
          error: error.message,
        };
      }

      return {
        success: false,
        error: String(error),
      };
    }
  }

  /**
   * 设置 API Key
   */
  setApiKey(apiKey: string): void {
    this.config.apiKey = apiKey;
  }

  /**
   * 设置基础 URL
   */
  setBaseUrl(baseUrl: string): void {
    this.config.baseUrl = baseUrl;
  }
}

// 全局 Gateway 客户端实例
let globalGateway: GatewayClient | null = null;

/**
 * 获取全局 Gateway 客户端
 */
export function getGlobalGateway(): GatewayClient {
  if (!globalGateway) {
    globalGateway = new GatewayClient();
  }
  return globalGateway;
}

/**
 * 设置全局 Gateway 客户端
 */
export function setGlobalGateway(gateway: GatewayClient): void {
  globalGateway = gateway;
}

/**
 * 便捷的 Gateway 调用函数
 */
export async function callGateway<T = unknown>(
  params: GatewayCallParams
): Promise<T | undefined> {
  const gateway = getGlobalGateway();
  const result = await gateway.call<T>(params);

  if (!result.success) {
    console.error(`Gateway call failed: ${result.error}`);
    return undefined;
  }

  return result.data;
}

/**
 * 创建 Gateway 客户端
 */
export function createGateway(config?: GatewayConfig): GatewayClient {
  return new GatewayClient(config);
}
