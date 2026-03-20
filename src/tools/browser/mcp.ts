// 浏览器 MCP 工具 - 通过 MCP 调用 chrome-devtools
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { jsonResult, errorResult } from "../types.js";

// MCP 客户端缓存
let mcpClient: Client | null = null;
let mcpTools: Map<string, any> = new Map();

/**
 * 重置 MCP 客户端（用于错误恢复）
 */
function resetMcpClient() {
  mcpClient = null;
  mcpTools.clear();
}

/**
 * 初始化 MCP 客户端
 */
async function getMcpClient(): Promise<Client> {
  if (mcpClient) {
    return mcpClient;
  }

  console.log('[Browser MCP] Starting MCP client...');

  mcpClient = new Client(
    {
      name: 'mul-agent-browser',
      version: '1.0.0',
    },
    {
      capabilities: {},
    }
  );

  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['-y', 'chrome-devtools-mcp', '--isolated'],
  });

  await mcpClient.connect(transport);

  // 获取可用工具
  const tools = await mcpClient.listTools();
  console.log(`[Browser MCP] Loaded ${tools.tools.length} tools`);
  for (const tool of tools.tools) {
    mcpTools.set(tool.name, tool);
  }

  return mcpClient;
}

/**
 * 调用 MCP 工具（带重试）
 */
async function callMcpTool(toolName: string, args: Record<string, unknown>, retry = true): Promise<any> {
  try {
    const client = await getMcpClient();
    const result = await client.callTool({
      name: toolName,
      arguments: args,
    });
    return result;
  } catch (error) {
    // 如果是连接错误且允许重试，重置客户端并重试一次
    if (retry && error instanceof Error && error.message.includes('connection')) {
      console.log('[Browser MCP] Connection error, resetting and retrying...');
      resetMcpClient();
      return callMcpTool(toolName, args, false);
    }
    throw error;
  }
}

// ============ 工具定义 ============

export function createBrowserMcpTool() {
  return {
    label: "Browser MCP",
    name: "browser_mcp",
    description: "Control browser via MCP - take screenshots, navigate, click, fill forms, etc.",
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["list_pages", "new_page", "navigate", "screenshot", "snapshot", "click", "fill", "close_page", "list"],
          description: "Browser action to perform"
        },
        url: { type: "string", description: "URL for navigate/new_page actions" },
        pageId: { type: "number", description: "Page ID for actions on specific page" },
        uid: { type: "string", description: "Element UID for click/fill actions" },
        value: { type: "string", description: "Value to fill for fill action" },
        query: { type: "string", description: "Query for snapshot action" },
      },
      required: ["action"],
    },
    execute: async (_toolCallId: string, params: {
      action: string;
      url?: string;
      pageId?: number;
      uid?: string;
      value?: string;
      query?: string;
    }) => {
      try {
        const { action, url, pageId, uid, value, query } = params;

        // 获取页面列表
        if (action === "list" || action === "list_pages") {
          const result = await callMcpTool('list_pages', {});
          return jsonResult(result);
        }

        // 打开新页面
        if (action === "new_page") {
          if (!url) {
            return errorResult("url is required for new_page action");
          }
          const result = await callMcpTool('new_page', { url });
          return jsonResult(result);
        }

        // 导航
        if (action === "navigate") {
          if (!url) {
            return errorResult("url is required for navigate action");
          }
          const result = await callMcpTool('navigate_page', { type: 'url', url });
          return jsonResult(result);
        }

        // 截图
        if (action === "screenshot") {
          const args: Record<string, unknown> = {};
          if (pageId) args.pageId = pageId;
          const result = await callMcpTool('take_screenshot', args);
          return jsonResult(result);
        }

        // 页面快照
        if (action === "snapshot") {
          const args: Record<string, unknown> = {};
          if (pageId) args.pageId = pageId;
          if (query) args.query = query;
          const result = await callMcpTool('take_snapshot', args);
          return jsonResult(result);
        }

        // 点击元素
        if (action === "click") {
          if (!uid) {
            return errorResult("uid is required for click action");
          }
          const result = await callMcpTool('click', { uid });
          return jsonResult(result);
        }

        // 填写表单
        if (action === "fill") {
          if (!uid || value === undefined) {
            return errorResult("uid and value are required for fill action");
          }
          const result = await callMcpTool('fill', { uid, value });
          return jsonResult(result);
        }

        // 关闭页面
        if (action === "close_page") {
          if (!pageId) {
            return errorResult("pageId is required for close_page action");
          }
          const result = await callMcpTool('close_page', { pageId });
          return jsonResult(result);
        }

        return errorResult(`Unknown action: ${action}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return errorResult(`Browser MCP error: ${message}`);
      }
    },
  };
}
