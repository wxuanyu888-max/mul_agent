// Tools 模块 - 统一导出
// OpenClaw 核心扩展工具

export * from "./types";

// Task tool (for subagents)
export { createTaskTool, isTaskTool } from "./task.js";

// Task System tools (task graph)
export {
  createTaskCreateTool,
  createTaskUpdateTool,
  createTaskListTool,
  createTaskGetTool,
} from "./tasks/index.js";

// Compact tool (context compression)
export { createCompactTool } from "./compact.js";
export { createWorkspaceRefreshTool } from "./workspace.js";

// Load tool (skill/MCP loading)
export { createLoadTool } from "./load.js";

// Web tools
export { createWebSearchTool, createWebFetchTool } from "./web/index.js";

// Browser MCP tools
export { createBrowserMcpTool } from "./browser/index.js";

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

// Media tools (browser, canvas, nodes, tts, image, pdf, video)
export {
  createBrowserTool,
  createCanvasTool,
  createNodesTool,
  createTtsTool,
  createImageTool,
  createPdfTool,
  createVideoTool,
} from "./media/index.js";

// File tools (read, write, edit, grep, find, ls)
export {
  createReadTool,
  createWriteTool,
  createEditTool,
  createGrepTool,
  syncWorkspaceToMemory,
  createFindTool,
  createLsTool,
} from "./file/index.js";

// Bash tools (exec, process, background)
export {
  createExecTool,
  createProcessTool,
  createBackgroundRunTool,
  createBackgroundCheckTool,
  createBackgroundListTool,
  createBackgroundKillTool,
} from "./bash/index.js";

// Autonomous tools (s11)
export {
  createClaimTaskTool,
  createTeamListTool,
} from "../agents/autonomous.js";

// Teammate tools (s09)
export {
  createTeammateSpawnTool,
  createTeammateSendTool,
  createTeammateInboxTool,
  createTeammateBroadcastTool,
  createTeammateListTool,
  createTeammateDelegateTool,
  createTeammateDelegationStatusTool,
  createTeammateAskTool,
} from "./teammate/index.js";

// 工具注册表 - 默认加载的工具
import { createTaskTool } from "./task.js";
import { createTaskCreateTool, createTaskUpdateTool, createTaskListTool, createTaskGetTool } from "./tasks/index.js";
import { createCompactTool } from "./compact.js";
import { createWorkspaceRefreshTool } from "./workspace.js";
import { createWebSearchTool, createWebFetchTool } from "./web/index.js";
import { createMemoryTool, createMemorySearchTool, createMemoryGetTool } from "./memory/index.js";
import {
  createSessionsListTool,
  createSessionsHistoryTool,
  createSessionsSendTool,
  createSessionsSpawnTool,
  createSessionStatusTool,
  createSessionsTool,
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
  createVideoTool,
} from "./media/index.js";

// Browser MCP tools
import { createBrowserMcpTool } from "./browser/index.js";

// File tools
import {
  createReadTool,
  createWriteTool,
  createEditTool,
  createGrepTool,
  syncWorkspaceToMemory,
  createFindTool,
  createLsTool,
} from "./file/index.js";

// Bash tools
import {
  createExecTool,
  createProcessTool,
  createBackgroundRunTool,
  createBackgroundCheckTool,
  createBackgroundListTool,
  createBackgroundKillTool,
} from "./bash/index.js";

// Autonomous tools (s11)
import { createClaimTaskTool, createTeamListTool } from "../agents/autonomous.js";

// Teammate tools (s09)
import {
  createTeammateSpawnTool,
  createTeammateSendTool,
  createTeammateInboxTool,
  createTeammateBroadcastTool,
  createTeammateListTool,
  createTeammateDelegateTool,
  createTeammateDelegationStatusTool,
  createTeammateAskTool,
} from "./teammate/index.js";

export interface ToolOptions {
  sessionId?: string;
  config?: Record<string, unknown>;
  agentId?: string;
}

/**
 * 创建默认工具列表
 * 可以根据选项选择性加载工具
 */
export function createDefaultTools(options?: ToolOptions) {
  const { sessionId } = options || {};
  const tools = [
    // ===== 核心工具 =====

    // Task (统一入口：run, create, update, list, get)
    createTaskTool(),

    // Compact (context compression)
    createCompactTool(),
    createWorkspaceRefreshTool(),

    // Web
    createWebSearchTool(),
    createWebFetchTool(sessionId),

    // Video
    createVideoTool(sessionId),

    // Browser MCP
    createBrowserMcpTool(),

    // Memory (统一入口：search, get, write)
    createMemoryTool(),

    // Sessions (统一入口：list, history, send, spawn, status)
    createSessionsTool(),

    // System
    createCronTool(),
    createSubagentsTool(),
    createAgentsListTool(),

    // File tools
    createReadTool(),
    createWriteTool(),
    createEditTool(),
    createGrepTool(),
    createFindTool(),
    createLsTool(),

    // Bash
    createExecTool(),

    // ===== 以下暂不加载 =====

    // Message - 暂时不需要
    // createMessageTool(),

    // Gateway - 暂时不需要
    // createGatewayTool(),

    // Media - 非核心
    // createBrowserTool(),
    // createCanvasTool(),
    // createNodesTool(),
    // createTtsTool(),
    // createImageTool(),
    // createPdfTool(),

    // Process - exec 可以替代
    // createProcessTool(),

    // Background - exec 可以替代
    // createBackgroundRunTool(),
    // createBackgroundCheckTool(),
    // createBackgroundListTool(),
    // createBackgroundKillTool(),

    // Autonomous - 可以合并到 system
    // createClaimTaskTool(),
    // createTeamListTool(),

    // Autonomous tools (s11)
    createClaimTaskTool(),
    createTeamListTool(),

    // Teammate tools (s09)
    createTeammateSpawnTool(),
    createTeammateSendTool(),
    createTeammateInboxTool(),
    createTeammateBroadcastTool(),
    createTeammateListTool(),
    createTeammateDelegateTool(),
    createTeammateDelegationStatusTool(),
    createTeammateAskTool(),

    // Task 详细功能 - 已合并到 task 统一入口
    // createTaskCreateTool(),
    // createTaskUpdateTool(),
    // createTaskListTool(),
    // createTaskGetTool(),
  ];

  return tools;
}

/**
 * 创建最小工具集（仅核心功能）
 */
export function createMinimalTools(_options?: ToolOptions) {
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
  // Task tool (for subagents)
  task: "Spawn a subagent with fresh context to handle a subtask",
  // Task System tools
  task_create: "Create a new task in the task graph",
  task_update: "Update a task (status, dependencies, details)",
  task_list: "List all tasks with optional status filter",
  task_get: "Get detailed information about a specific task",
  // Compact tool
  compact: "Manually trigger context compaction to reduce token usage",
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
  // Background tools (s08)
  background_run: "Run command in background, results injected before next LLM call",
  background_check: "Check status of a background task",
  background_list: "List all background tasks",
  background_kill: "Kill a running background task",
  // Autonomous tools (s11)
  claim_task: "Claim an unassigned task from the task board",
  team_list: "List all team members and their status",
  // Teammate tools (s09)
  teammate_spawn: "Create a new teammate agent with a specific role",
  teammate_send: "Send a message to a specific teammate",
  teammate_inbox: "Read and clear a teammate's inbox",
  teammate_broadcast: "Broadcast a message to all teammates",
  teammate_list: "List all teammates and their status",
  teammate_delegate: "Delegate a task to a teammate with tracking",
  teammate_delegation_status: "Check the status of a delegated task",
  teammate_ask: "Ask a teammate a question and wait for response synchronously",
};
