/**
 * HTTP Request Tool - 通用 HTTP 请求工具
 *
 * 支持 GET/POST/PUT/DELETE/PATCH 请求
 */

import { jsonResult, errorResult } from './types.js';

export interface HttpParams {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: string | Record<string, unknown>;
  timeout?: number;
}

export function createHttpTool() {
  return {
    label: 'HTTP',
    name: 'http_request',
    description: '发送 HTTP 请求：GET/POST/PUT/DELETE/PATCH，支持 JSON 和自定义 Headers',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: '请求 URL',
        },
        method: {
          type: 'string',
          enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
          description: 'HTTP 方法',
          default: 'GET',
        },
        headers: {
          type: 'object',
          description: '请求头',
          additionalProperties: { type: 'string' },
        },
        body: {
          type: 'string',
          description: '请求体 (JSON 字符串或对象)',
        },
        timeout: {
          type: 'number',
          description: '超时时间 (毫秒)',
          default: 30000,
        },
      },
      required: ['url'],
    },
    permission: 'main' as const,
    execute: async (_toolCallId: string, params: Record<string, unknown>) => {
      try {
        const url = params.url as string;
        const method = (params.method as HttpParams['method']) || 'GET';
        const headers = (params.headers as Record<string, string>) || {};
        const body = params.body as string | Record<string, unknown> | undefined;
        const timeout = (params.timeout as number) || 30000;

        // 构建请求选项
        const requestOptions: RequestInit = {
          method,
          headers: {
            'User-Agent': 'MulAgent/1.0',
            ...headers,
          },
        };

        // 处理请求体
        if (body && method !== 'GET') {
          if (typeof body === 'object') {
            requestOptions.body = JSON.stringify(body);
            if (!headers['Content-Type']) {
              (requestOptions.headers as Record<string, string>)['Content-Type'] = 'application/json';
            }
          } else {
            requestOptions.body = body;
          }
        }

        // 发送请求
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        requestOptions.signal = controller.signal;

        const response = await fetch(url, requestOptions);
        clearTimeout(timeoutId);

        // 获取响应
        const contentType = response.headers.get('content-type') || '';
        let content: string;

        if (contentType.includes('application/json')) {
          const json = await response.json();
          content = JSON.stringify(json, null, 2);
        } else {
          content = await response.text();
        }

        // 构建响应信息
        const result = {
          status: response.status,
          statusText: response.statusText,
          headers: Array.from(response.headers.keys()).reduce((acc, key) => {
            acc[key] = response.headers.get(key);
            return acc;
          }, {} as Record<string, string | null>),
          body: content,
        };

        return jsonResult(result);
      } catch (error: any) {
        const reqTimeout = (params.timeout as number) || 30000;
        const errorMessage = error.name === 'AbortError'
          ? `Request timeout after ${reqTimeout}ms`
          : error.message || String(error);

        return errorResult(errorMessage);
      }
    },
  };
}
