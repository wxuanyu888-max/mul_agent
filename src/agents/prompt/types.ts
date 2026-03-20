/**
 * 提示词构建器类型定义
 */

import type { LoadedItem } from '../types.js';

/**
 * 提示词构建配置
 */
export interface PromptBuilderConfig {
  /** 工作目录 */
  workspaceDir: string;
  /** Session ID（用于工作区划分） */
  sessionId?: string;
  /** 当前会话生成的文件 */
  generatedFiles?: Array<{ path: string; name: string; timestamp: number }>;
  /** 额外系统提示 */
  extraSystemPrompt?: string;
  /** 提示模式 */
  promptMode?: 'full' | 'minimal' | 'none';
  /** 时区 */
  userTimezone?: string;
  /** 文档路径 */
  docsPath?: string;
  /** 所有者信息 */
  ownerInfo?: string;
  /** 当前时间 */
  currentTime?: string;
  /** 文档URL */
  docsUrl?: string;
  /** 语音配置 */
  voiceConfig?: string;
  /** 技能描述 */
  skillDescriptions?: Record<string, string>;
}

/**
 * 工具信息
 */
export interface ToolInfo {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

/**
 * 技能信息
 */
export interface SkillInfo {
  id: string;
  name: string;
  description: string;
  location?: string;
  content?: string;    // 已加载的完整内容
  isLoaded?: boolean;  // 是否已加载
}

/**
 * 上下文信息
 */
export interface ContextInfo {
  files?: Array<{ path: string; content: string }>;
  summary?: string;
}

/**
 * 运行时信息
 */
export interface RuntimeInfo {
  channel?: string;
  capabilities?: string[];
}

/**
 * 构建上下文
 */
export interface BuildContext {
  config: PromptBuilderConfig;
  tools: ToolInfo[];
  skills: SkillInfo[];
  context?: ContextInfo;
  runtime?: RuntimeInfo;
  sessionKey?: string;
  messageCount?: number;
  loadedItems?: LoadedItem[];  // 已加载的 skill/MCP 内容
  isReviewRound?: boolean;     // 是否是审查轮次
}
