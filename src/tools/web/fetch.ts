// Web Fetch 工具
import { jsonResult, errorResult } from "../types.js";

export function createWebFetchTool() {
  return {
    label: "Web Fetch",
    name: "web_fetch",
    description: "Fetch and extract readable content from a URL",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "URL to fetch" },
        prompt: { type: "string", description: "What to extract from the page" },
      },
      required: ["url"],
    },
    execute: async (_toolCallId: string, params: { url: string; prompt?: string }) => {
      try {
        const { url, prompt } = params;

        // 验证 URL
        let parsedUrl: URL;
        try {
          parsedUrl = new URL(url);
        } catch {
          return errorResult(`Invalid URL: ${url}`);
        }

        // 只允许 http 和 https
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
          return errorResult(`Unsupported protocol: ${parsedUrl.protocol}. Only http and https are supported.`);
        }

        // 获取网页内容
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; MulAgent/1.0)',
          },
        });

        if (!response.ok) {
          return errorResult(`Fetch failed: ${response.status} ${response.statusText}`);
        }

        const contentType = response.headers.get('content-type') || '';

        // 如果是 HTML，提取文本内容
        let content: string;
        if (contentType.includes('text/html')) {
          const html = await response.text();
          // 简单的 HTML 标签移除
          content = html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 10000); // 限制内容长度
        } else {
          content = await response.text();
        }

        return jsonResult({
          url,
          content,
          prompt: prompt || "No specific prompt",
          status: response.status,
          contentType,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return errorResult(`Fetch failed: ${message}`);
      }
    },
  };
}
