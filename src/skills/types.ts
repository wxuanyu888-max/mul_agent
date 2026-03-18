// Skills 模块类型定义
// 基于 OpenClaw 的 skill 系统设计

/**
 * Skill 基本接口
 * 对应 @mariozechner/pi-coding-agent 的 Skill 类型
 */
export interface Skill {
  name: string;
  description: string;
  content: string;
  frontmatter: SkillFrontmatter;
  commands?: SkillCommand[];
  tools?: SkillTool[];
}

/**
 * Skill frontmatter 元数据
 */
export interface SkillFrontmatter {
  name?: string;
  description?: string;
  when?: string;
  always?: boolean;
  emoji?: string;
  userInvocable?: boolean;
  disableModelInvocation?: boolean;
  skillKey?: string;
  primaryEnv?: string;
  os?: string[];
  requires?: SkillRequirement[];
  install?: SkillInstallSpec[];
  commands?: Array<{ name: string; description?: string; prompt?: string } | string>;
  tools?: Array<{ name: string; description?: string }>;
}

/**
 * Skill 命令定义
 */
export interface SkillCommand {
  name: string;
  description: string;
  prompt?: string;
}

/**
 * Skill 工具定义
 */
export interface SkillTool {
  name: string;
  description: string;
  parameters?: Record<string, any>;
}

/**
 * Skill 依赖要求
 */
export interface SkillRequirement {
  type: 'tool' | 'env' | 'feature';
  name: string;
  description?: string;
}

/**
 * Skill 安装规范
 */
export interface SkillInstallSpec {
  kind: 'brew' | 'node' | 'go' | 'uv' | 'download';
  formula?: string;
  package?: string;
  module?: string;
  url?: string;
  os?: string[];
  archive?: string;
  extract?: boolean;
  stripComponents?: number;
  targetDir?: string;
}

/**
 * Skill 条目 - 包含 skill 及其元数据
 */
export interface SkillEntry {
  skill: Skill;
  frontmatter: ParsedSkillFrontmatter;
  metadata?: OpenClawSkillMetadata;
  invocation?: SkillInvocationPolicy;
}

/**
 * 解析后的 skill frontmatter
 */
export interface ParsedSkillFrontmatter {
  data: Record<string, any>;
  content: string;
}

/**
 * OpenClaw 扩展的 skill 元数据
 */
export interface OpenClawSkillMetadata {
  always?: boolean;
  emoji?: string;
  homepage?: string;
  skillKey?: string;
  primaryEnv?: string;
  os?: string[];
  requires?: SkillRequirement[];
  install?: SkillInstallSpec[];
}

/**
 * Skill 调用策略
 */
export interface SkillInvocationPolicy {
  userInvocable: boolean;
  disableModelInvocation: boolean;
}

/**
 * Skill 命令规格
 */
export interface SkillCommandSpec {
  name: string;
  description: string;
  prompt: string;
  args?: SkillCommandArg[];
}

/**
 * Skill 命令参数
 */
export interface SkillCommandArg {
  name: string;
  description?: string;
  required?: boolean;
  default?: string;
}

/**
 * Skill 调用结果
 */
export interface SkillInvocationResult {
  success: boolean;
  output?: string;
  error?: string;
  toolCalls?: SkillToolCall[];
}

/**
 * Skill 工具调用
 */
export interface SkillToolCall {
  tool: string;
  parameters: Record<string, any>;
}
