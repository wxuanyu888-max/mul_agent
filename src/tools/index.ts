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

// Teammate tools (s09) - 简化版，只保留 spawn 和 send
export {
  createTeammateSpawnTool,
  createTeammateSendTool,
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
  // createSessionsTool, // 已禁用
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

// Teammate tools (s09) - 简化版
import {
  createTeammateSpawnTool,
  createTeammateSendTool,
  // createTeammateInboxTool, // 已禁用
  // createTeammateBroadcastTool, // 已禁用
  // createTeammateListTool, // 已禁用，列表默认加载到提示词
  // createTeammateDelegateTool, // 已禁用
  // createTeammateDelegationStatusTool, // 已禁用
  // createTeammateAskTool, // 已禁用
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
    // createTaskTool(), // 暂时禁用，用 task_create 替代

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
    // createSessionsTool(), // 已禁用，不暴露给 Agent

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

    // Teammate tools (s09) - 简化版，只保留核心功能
    createTeammateSpawnTool(),
    createTeammateSendTool(),
    // createTeammateInboxTool(), // 已禁用
    // createTeammateBroadcastTool(), // 已禁用
    // createTeammateListTool(), // 已禁用，列表默认加载到提示词
    // createTeammateDelegateTool(), // 已禁用
    // createTeammateDelegationStatusTool(), // 已禁用
    // createTeammateAskTool(), // 已禁用

    // Task 详细功能 - 使用 task_create 创建任务
    createTaskCreateTool(),
    // createTaskUpdateTool(), // 已禁用，请使用 write 工具更新进度
    // createTaskListTool(), // 已禁用
    // createTaskGetTool(), // 已禁用
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
 * 工具描述映射 - 统一格式：工具名：解释。使用场景。
 */
export const TOOL_DESCRIPTIONS: Record<string, string> = {
  // 核心工具
  compact: "手动触发上下文压缩。保存完整对话到磁盘并生成摘要以减少 token 使用。当对话变得太长时使用。",
  workspace_refresh: "刷新系统提示中生成的文件列表。当你想确保文件列表是最新的时使用。",

  // 任务工具
  task_create: "创建新任务。用于在任务看板中创建需要完成的工作项。",

  // Web 工具
  web_search: "搜索网络信息。需要 BRAVE_API_KEY 环境变量。当你需要获取最新信息或查找资料时使用。",
  web_fetch: "获取网页内容并保存到工作空间文件。LLM 可以随后读取具体文件。当你需要分析网页内容时使用。",

  // 视频工具
  video: "分析视频：下载在线视频或处理本地视频，提取音频并转录语音。当你需要从视频中提取信息时使用。",

  // 浏览器工具
  browser_mcp: "通过 MCP 控制浏览器。截图、导航、点击、填写表单等。当你需要自动化浏览器操作时使用。",

  // 记忆工具（统一入口）
  memory: "记忆管理。支持搜索、读取、写入操作。当你需要跨会话记住重要信息或查找之前讨论的内容时使用。",

  // 会话工具（统一入口）- 已禁用
  // sessions: "...", // 已禁用，不暴露给 Agent

  // 消息工具
  message: "发送消息到渠道。支持主动发送和渠道操作（投票、反应等）。当你需要向用户发送通知或主动推送消息时使用。",

  // 系统工具
  cron: "管理定时任务和唤醒事件。创建、列出或删除计划任务。当你需要设置定时提醒或周期性任务时使用。",
  subagents: "列出、引导或终止子代理运行。当你需要管理子代理时使用。",
  agents_list: "列出可用的代理 ID。当你需要查看系统中有哪些代理时使用。",

  // 媒体工具
  browser_tool: "控制网页浏览器。截图、导航、点击、填写表单。当你需要浏览器自动化时使用。",
  canvas: "展示或快照 canvas。当你需要在界面上展示可视化内容时使用。",
  nodes: "控制配对设备。当你需要与配对的移动设备交互时使用。",
  tts: "文字转语音。将文本转换为语音输出。当你需要语音播报时使用。",
  image: "分析图片。当你需要理解图片内容时使用。",
  pdf: "处理 PDF 文件。当你需要读取或分析 PDF 文档时使用。",

  // 文件工具
  read: "读取文件内容。返回文件的字符串形式。当你需要查看文件内容时使用。",
  write: "写入内容到文件。如果文件不存在则创建，存在则覆盖。当你需要创建或修改文件时使用。",
  edit: "通过字符串替换编辑文件。用于对文件进行精确修改。当你需要修改文件内容时使用。",
  grep: "使用语义搜索在工作空间文件中搜索信息。返回带上下文的片段。当你需要查找代码或实现细节时使用。",
  find: "按名称模式在目录树中查找文件。当你需要快速定位文件时使用。",
  ls: "列出目录内容，可选详细信息。当你需要查看目录结构时使用。",

  // Bash 工具
  exec: "执行 shell 命令并返回输出。命令在持久的 tmux 会话中运行。当你需要运行系统命令时使用。",

  // 后台工具
  background_run: "在后台运行命令，结果在下次 LLM 调用前注入。当你需要运行耗时命令不阻塞时使用。",
  background_check: "检查后台任务状态。当你需要查看后台任务进度时使用。",
  background_list: "列出所有后台任务。当你需要查看正在运行的后台任务时使用。",
  background_kill: "终止正在运行的后台任务。当你需要停止后台任务时使用。",

  // 自主任务工具
  claim_task: "认领任务看板上未分配的任务。只认领 pending 状态且无所有者的任务。当你需要开始处理任务时使用。",
  team_list: "列出所有团队成员及其当前状态。当你需要查看团队情况时使用。",

  // 队友工具
  teammate_spawn: "创建具有特定角色的新队友代理。队友将独立运行并可以接收其他队友的消息。当你需要创建助手处理特定任务时使用。",
  teammate_send: "向特定队友发送消息。消息将传递到他们的收件箱。当你需要与队友协作时使用。",

  // 加载工具
  load: "加载 skill 或 MCP 到当前对话上下文中。加载后可以在后续对话中直接使用，新的 load 会覆盖之前相同名称的加载。当你需要使用特定技能或 MCP 时使用。",
};
