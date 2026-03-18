// Tools 模块 - 统一导出
// OpenClaw 核心扩展工具

export * from "./types";

// Task tool (for subagents)
export { createTaskTool, isTaskTool } from "./task.js";

// Web tools
export { createWebSearchTool, createWebFetchTool } from "./web/index.js";

// Memory tools
export { createMemorySearchTool, createMemoryGetTool } from "./memory/index.js";

// Session tools
export {
  createSessionsListTool,
  createSessionsHistoryTool,
  createSessionsSendTool,
  createSessionsSpawnTool,
  createSessionStatusTool,
} from "./session/index.js";

// Message tool
export { createMessageTool } from "./message/index.js";

// System tools (cron, gateway, subagents, agents_list)
export {
  createCronTool,
  createGatewayTool,
  createSubagentsTool,
  createAgentsListTool,
} from "./system/index.js";

// Media tools (browser, canvas, nodes, tts, image, pdf)
export {
  createBrowserTool,
  createCanvasTool,
  createNodesTool,
  createTtsTool,
  createImageTool,
  createPdfTool,
} from "./media/index.js";

// File tools (read, write, edit, grep, find, ls)
export {
  createReadTool,
  createWriteTool,
  createEditTool,
  createGrepTool,
  createFindTool,
  createLsTool,
} from "./file/index.js";

// Bash tools (exec, process)
export {
  createExecTool,
  createProcessTool,
} from "./bash/index.js";

// 工具注册表 - 默认加载的工具
import { createTaskTool } from "./task.js";
import { createWebSearchTool, createWebFetchTool } from "./web/index.js";
import { createMemorySearchTool, createMemoryGetTool } from "./memory/index.js";
import {
  createSessionsListTool,
  createSessionsHistoryTool,
  createSessionsSendTool,
  createSessionsSpawnTool,
  createSessionStatusTool,
} from "./session/index.js";
import { createMessageTool } from "./message/index.js";
import {
  createCronTool,
  createGatewayTool,
  createSubagentsTool,
  createAgentsListTool,
} from "./system/index.js";
import {
  createBrowserTool,
  createCanvasTool,
  createNodesTool,
  createTtsTool,
  createImageTool,
  createPdfTool,
} from "./media/index.js";

// File tools
import {
  createReadTool,
  createWriteTool,
  createEditTool,
  createGrepTool,
  createFindTool,
  createLsTool,
} from "./file/index.js";

// Bash tools
import {
  createExecTool,
  createProcessTool,
} from "./bash/index.js";

export interface ToolOptions {
  sessionKey?: string;
  config?: any;
  agentId?: string;
}

/**
 * 创建默认工具列表
 * 可以根据选项选择性加载工具
 */
export function createDefaultTools(options?: ToolOptions) {
  const tools = [
    // Task (for delegating to subagents)
    createTaskTool(),
    // Web
    createWebSearchTool(),
    createWebFetchTool(),
    // Memory
    createMemorySearchTool(),
    createMemoryGetTool(),
    // Sessions
    createSessionsListTool(),
    createSessionsHistoryTool(),
    createSessionsSendTool(),
    createSessionsSpawnTool(),
    createSessionStatusTool(),
    // Message
    createMessageTool(),
    // System
    createCronTool(),
    createGatewayTool(),
    createSubagentsTool(),
    createAgentsListTool(),
    // Media
    createBrowserTool(),
    createCanvasTool(),
    createNodesTool(),
    createTtsTool(),
    createImageTool(),
    createPdfTool(),
    // File tools
    createReadTool(),
    createWriteTool(),
    createEditTool(),
    createGrepTool(),
    createFindTool(),
    createLsTool(),
    // Bash tools
    createExecTool(),
    createProcessTool(),
  ];

  return tools;
}

/**
 * 创建最小工具集（仅核心功能）
 */
export function createMinimalTools(options?: ToolOptions) {
  return [
    // 必须：Memory
    createMemorySearchTool(),
    createMemoryGetTool(),
    // 必须：Web
    createWebSearchTool(),
    createWebFetchTool(),
    // 必须：会话
    createSessionsSpawnTool(),
  ];
}

/**
 * 工具名称映射
 */
export const TOOL_DESCRIPTIONS: Record<string, string> = {
  // Task tool
  task: "Spawn a subagent with fresh context to handle a subtask",
  // Web tools
  web_search: "Search the web for information",
  web_fetch: "Fetch and extract content from a URL",
  memory_search: "Search memory for relevant information",
  memory_get: "Read specific memory content",
  sessions_list: "List all active sessions",
  sessions_history: "Fetch session history",
  sessions_send: "Send message to another session",
  sessions_spawn: "Create a new sub-agent session",
  session_status: "Show current session status",
  message: "Send messages to channels",
  cron: "Manage scheduled tasks",
  gateway: "Control gateway operations",
  subagents: "Manage sub-agents",
  agents_list: "List available agents",
  browser: "Control web browser",
  canvas: "Present or snapshot canvas",
  nodes: "Control paired devices",
  tts: "Text to speech",
  image: "Analyze images",
  pdf: "Process PDF files",
  // File tools
  read: "Read file contents",
  write: "Write content to a file",
  edit: "Edit file by string replacement",
  grep: "Search for text in files",
  find: "Find files by name pattern",
  ls: "List directory contents",
  // Bash tools
  exec: "Execute a shell command",
  process: "Manage background processes",
};
