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
        // TODO: 实现实际的web fetch逻辑
        return jsonResult({
          url,
          content: `Placeholder content from: ${url}`,
          prompt: prompt || "No specific prompt",
        });
      } catch (error) {
        return errorResult(`Fetch failed: ${error}`);
      }
    },
  };
}
