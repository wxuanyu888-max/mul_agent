/**
 * 提示词构建器类型定义
 */

import type { Tool } from '../types.js';

/**
 * 提示词构建配置
 */
export interface PromptBuilderConfig {
  /** 工作目录 */
  workspaceDir: string;
  /** 额外系统提示 */
  extraSystemPrompt?: string;
  /** 提示模式 */
  promptMode?: 'full' | 'minimal' | 'none';
  /** 时区 */
  userTimezone?: string;
  /** 文档路径 */
  docsPath?: string;
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
}
