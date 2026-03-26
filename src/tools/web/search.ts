// Web Search 工具
import { jsonResult, errorResult } from "../types.js";

export interface WebSearchOptions {
  apiKey?: string;
  baseUrl?: string;
}

/**
 * Web Search 工具
 * 支持 Brave Search API 或兼容的搜索 API
 *
 * 使用方式:
 * - 设置 BRAVE_API_KEY 环境变量
 * - 或在创建工具时传入 apiKey
 */
export function createWebSearchTool(options?: WebSearchOptions) {
  const apiKey = options?.apiKey || process.env.BRAVE_API_KEY;
  const baseUrl = options?.baseUrl || process.env.BRAVE_BASE_URL || 'https://api.search.brave.com/res/v1/web/search';

  return {
    label: "Web Search",
    name: "web_search",
    description: "Search the web for current information, news, or answers to questions. Use when you need up-to-date information that may not be in your training data, or when you need to find online resources. Requires BRAVE_API_KEY environment variable.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query. Be specific for better results, e.g., 'TypeScript type inference vs explicit types 2024' instead of just 'TypeScript types'" },
        count: { type: "number", description: "Number of results to return (default: 10, max: 20)", default: 10 },
      },
      required: ["query"],
    },
    execute: async (_toolCallId: string, params: { query: string; count?: number }) => {
      try {
        const { query, count = 10 } = params;

        if (!apiKey) {
          return errorResult(
            'Web search requires BRAVE_API_KEY environment variable. ' +
            'Sign up at https://brave.com/search/api/'
          );
        }

        const url = new URL(baseUrl);
        url.searchParams.set('q', query);
        url.searchParams.set('count', String(Math.min(count, 20)));

        const response = await fetch(url.toString(), {
          headers: {
            'Accept': 'application/json',
            'X-Subscription-Token': apiKey,
          },
        });

        if (!response.ok) {
          return errorResult(`Search failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json() as Record<string, unknown>;

        // 提取结果
        const web = data.web as Record<string, unknown> | undefined;
        const results = web?.results as Array<{
          title?: string;
          url?: string;
          description?: string;
        }> | undefined;

        return jsonResult({
          results: results?.slice(0, count).map(r => ({
            title: r.title || 'Untitled',
            url: r.url || '',
            description: r.description || '',
          })) || [],
          query,
          count,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return errorResult(`Search failed: ${message}`);
      }
    },
  };
}
