/**
 * 提示词构建器
 *
 * 从 config/prompts 目录加载模板并动态组装系统提示词
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

import { getTasksPath } from '../../utils/path.js';
import { TOOL_DESCRIPTIONS } from '../../tools/index.js';

import type {
  BuildContext,
  ToolInfo,
  SkillInfo,
  ContextInfo,
} from './types.js';
import type { LoadedItem } from '../types.js';

// 队友存储目录
const TEAMMATES_DIR = join(process.cwd(), 'storage', 'teammates');

// 提示词模板目录 (使用 process.cwd() 获取项目根目录)
const PROMPTS_DIR = join(process.cwd(), 'storage/config/prompts');

/**
 * 加载提示词模板
 */
function loadTemplate(mode: 'full' | 'minimal' | 'none'): string {
  const templatePath = join(PROMPTS_DIR, 'templates', `${mode}.md`);

  if (!existsSync(templatePath)) {
    // 回退到内置模板
    return getBuiltInTemplate(mode);
  }

  return readFileSync(templatePath, 'utf-8');
}

/**
 * 加载提示词模块
 */
function loadModule(name: string): string {
  const modulePath = join(PROMPTS_DIR, 'system', `${name}.md`);

  if (!existsSync(modulePath)) {
    // 回退到内置内容
    return getBuiltInModule(name);
  }

  return readFileSync(modulePath, 'utf-8');
}

/**
 * 获取内置模板 (fallback)
 */
function getBuiltInTemplate(mode: 'full' | 'minimal' | 'none'): string {
  const templates: Record<string, string> = {
    full: `{{base}}

## Tooling
Tool availability:
{{tool_list}}

{{tool_call_style}}

{{safety}}

{{skills}}

{{memory}}

{{workspace}}

{{runtime}}

{{documentation}}

{{tasks_info}}

{{teammates_info}}`,
    minimal: `{{base}}

## Tooling
{{tool_list}}

{{workspace}}`,
    none: `{{base}}`,
  };
  return templates[mode] || templates.full;
}

/**
 * 获取内置模块内容 (fallback)
 */
function getBuiltInModule(name: string): string {
  const modules: Record<string, string> = {
    base: `你是运行在 MulAgent 中的个人助理。

你的目标是利用可用工具帮助用户完成任务。`,
    safety: `## 安全规范
- 优先考虑安全和人类监督
- 如果指令与安全冲突，暂停并询问`,
    tool_call_style: `## 工具调用规范
- 使用 JSON 格式在 \`tool_use\` 块中调用工具`,
    skills: `## 可用技能
使用技能来完成相应任务。`,
    memory: `## 记忆
使用记忆工具查找之前的信息。`,
    workspace: `## 工作空间
你的工作目录是：{{workspace}}`,
    heartbeats: `## 心跳
如果收到心跳轮询且没有需要处理的事项，请回复：
HEARTBEAT_OK`,
    runtime: `## 运行时信息
{{runtime_info}}`,
    documentation: `## 文档
更多信息请查阅文档。`,
    // 额外的内置模块
    'model-aliases': '',
    sandbox: '',
    'reply-tags': '',
    messaging: '',
    'silent-replies': '',
    reactions: '',
    'reasoning-format': '',
  };
  return modules[name] || '';
}

/**
 * 构建完整提示词
 */
export function buildSystemPrompt(context: BuildContext): string {
  const { config, tools, skills: _skills, runtime: _runtime, context: _ctx, loadedItems, isReviewRound } = context;
  const mode = config.promptMode ?? 'full';

  // 加载模板
  const template = loadTemplate(mode);

  // 加载各模块
  const modules = loadAllModules(context);

  // 构建动态变量
  const dynamicVars = buildDynamicVariables(context);

  // 格式化已加载的 skills
  const loadedSkillsContent = formatLoadedSkills(loadedItems || []);

  // 格式化审查提示
  const reviewPrompt = formatReviewPrompt(isReviewRound || false, loadedItems || []);

  // 替换占位符
  return parseTemplate(template, {
    ...modules,
    ...dynamicVars,
    tool_list: formatToolList(tools),
    loaded_skills: loadedSkillsContent,
    review_prompt: reviewPrompt,
  });
}

/**
 * 加载进行中的任务
 */
function loadActiveTasks(): string {
  try {
    const tasksDir = getTasksPath();

    if (!existsSync(tasksDir)) {
      return '';
    }

    const files = readdirSync(tasksDir).filter(f => f.startsWith('task_') && f.endsWith('.json'));

    if (files.length === 0) {
      return '';
    }

    const tasks: string[] = [];

    for (const file of files) {
      const content = readFileSync(join(tasksDir, file), 'utf-8');
      const task = JSON.parse(content);

      // 只显示进行中的任务
      if (task.status === 'pending' || task.status === 'in_progress') {
        const blockedBy = task.blockedBy?.length > 0 ? ` (blocked by: ${task.blockedBy.join(', ')})` : '';
        tasks.push(`- [${task.status}] ${task.subject}${blockedBy}`);
      }
    }

    if (tasks.length === 0) {
      return '';
    }

    return `## Active Tasks\n${tasks.join('\n')}`;
  } catch {
    return '';
  }
}

/**
 * 加载活跃队友列表
 */
function loadActiveTeammates(): string {
  try {
    const configPath = join(TEAMMATES_DIR, 'config.json');

    if (!existsSync(configPath)) {
      return '';
    }

    const content = readFileSync(configPath, 'utf-8');
    const data = JSON.parse(content);

    if (!data.teammates || data.teammates.length === 0) {
      return '';
    }

    // 只显示非 SHUTDOWN 状态的队友
    const activeTeammates = data.teammates.filter(
      (t: { status: string }) => t.status !== 'SHUTDOWN'
    );

    if (activeTeammates.length === 0) {
      return '';
    }

    const teammateList = activeTeammates
      .map((t: { name: string; role: string; status: string }) =>
        `- **${t.name}** (${t.role}) [${t.status}]`
      )
      .join('\n');

    return `## Active Teammates\n${teammateList}`;
  } catch {
    return '';
  }
}

/**
 * 构建动态变量
 */
function buildDynamicVariables(context: BuildContext): Record<string, string> {
  const { config, runtime, context: ctx } = context;

  // 格式化时间
  const timeInfo = config.currentTime || new Date().toLocaleString('zh-CN', {
    timeZone: config.userTimezone || 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'long',
  });

  // 格式化工作目录相关变量
  const sessionWorkspaceDir = config.sessionId
    ? join('agent/sessions', config.sessionId, 'workspace').replace(/\\/g, '/')
    : '';

  // 格式化生成的文件列表
  const generatedFilesList = config.generatedFiles && config.generatedFiles.length > 0
    ? config.generatedFiles.map(f => `- ${f.name}: ${f.path}`).join('\n')
    : '(暂无)';

  const workspaceVars = {
    workspace_dir: config.workspaceDir,
    workspace_session_dir: sessionWorkspaceDir || '（无 - 使用全局工作空间）',
    workspace_guidance: config.sessionId
      ? `你可以在会话工作空间中读取、写入和执行文件：${sessionWorkspaceDir}`
      : '你可以在此目录中读取、写入和执行文件。',
    workspace_notes: '',
    generated_files: generatedFilesList,
  };

  // 格式化沙箱相关变量
  const sandboxVars = {
    sandbox_info: '沙箱环境',
    sandbox_container_workspace: '容器工作空间已启用。',
    sandbox_workspace_access: '你可以完全访问容器文件系统。',
    sandbox_browser_info: '浏览器自动化可用。',
    sandbox_elevated_info: '你拥有提升的权限。',
  };

  // 格式化心跳变量
  const heartbeatVars = {
    heartbeat_prompt: '如果没有需要处理的事项，请回复：HEARTBEAT_OK',
  };

  // 格式化模型别名变量
  const modelAliasVars = {
    model_alias_lines: '',
  };

  // 格式化消息变量
  const messagingVars = {
    message_channel_options: '',
    message_tool_hints: '',
    inline_buttons_hint: '',
  };

  // 格式化推理变量
  const reasoningVars = {
    reasoning_format_hint: '',
    reasoning_level: 'off',
  };

  // 格式化回复标签变量
  const replyTagVars = {
    reply_tag_guidance: '',
  };

  // 格式化静默回复变量
  const silentReplyVars = {
    silent_reply_guidance: '',
  };

  // 格式化反应变量
  const reactionVars = {
    reaction_guidance: '',
  };

  // 格式化运行时信息
  const runtimeInfo = formatRuntimeInfo(runtime);

  // 格式化上下文文件
  const contextFiles = formatContextFiles(ctx);

  // 加载任务信息
  const tasksInfo = loadActiveTasks();

  // 加载队友信息
  const teammatesInfo = loadActiveTeammates();

  return {
    // 核心变量
    workspace: loadModule('workspace'),
    runtime_info: runtimeInfo,

    // 工作目录变量（会替换 workspace 中的 {{workspace_dir}} 等占位符）
    ...workspaceVars,

    // 沙箱变量
    ...sandboxVars,

    // 心跳变量
    ...heartbeatVars,

    // 模型别名变量
    ...modelAliasVars,

    // 消息变量
    ...messagingVars,

    // 推理变量
    ...reasoningVars,

    // 回复标签变量
    ...replyTagVars,

    // 静默回复变量
    ...silentReplyVars,

    // 反应变量
    ...reactionVars,

    // 动态变量
    owner_info: config.ownerInfo || '授权用户：用户',
    time_info: timeInfo,
    context_files: contextFiles,
    docs_url: config.docsUrl || config.docsPath || '',
    voice: config.voiceConfig || '',

    // 任务变量
    tasks_info: tasksInfo,

    // 队友变量
    teammates_info: teammatesInfo,
  };
}

/**
 * 加载所有模块
 */
function loadAllModules(context: BuildContext): Record<string, string> {
  const { config, skills } = context;

  return {
    // 核心模块
    base: loadModule('base'),
    safety: loadModule('safety'),
    tool_call_style: loadModule('tool_call_style'),
    skills: formatSkills(skills),
    memory: loadModule('memory'),
    workspace: loadModule('workspace'),
    heartbeats: loadModule('heartbeats'),
    runtime: loadModule('runtime'),
    documentation: loadModule('documentation'),

    // 额外模块（从 storage/prompts/system 加载）
    model_aliases: loadModule('model-aliases'),
    sandbox: loadModule('sandbox'),
    reply_tags: loadModule('reply-tags'),
    messaging: loadModule('messaging'),
    silent_replies: loadModule('silent-replies'),
    reactions: loadModule('reactions'),
    reasoning_format: loadModule('reasoning-format'),

    // 动态占位符（需要运行时数据）
    owner_info: '',
    time_info: '',
    context_files: '',
    docs_url: '',
    voice: '',
    loaded_skills: '',
    review_prompt: '',

    // 额外系统提示
    extra: config.extraSystemPrompt || '',
  };
}

/**
 * 格式化工具列表 - 使用统一描述格式
 */
function formatToolList(tools: ToolInfo[]): string {
  if (tools.length === 0) {
    return '(No tools available)';
  }

  return tools
    .map((t) => {
      // 优先使用 TOOL_DESCRIPTIONS 中的统一格式
      const unifiedDesc = TOOL_DESCRIPTIONS[t.name];
      const desc = unifiedDesc || t.description;
      return `- \`${t.name}\`: ${desc}`;
    })
    .join('\n');
}

/**
 * 格式化技能列表 - 简化版本，只显示核心技能
 */
function formatSkills(skills: SkillInfo[]): string {
  if (skills.length === 0) {
    return ''; // 不显示技能部分
  }

  // 只显示最重要的 3 个技能，其他的需要时再添加
  const coreSkills = skills.filter(s =>
    s.name === 'github' || s.name === 'coding-agent' || s.name === 'gh-issues'
  );

  // 如果没有核心技能，显示前 3 个
  const displaySkills = coreSkills.length > 0 ? coreSkills : skills.slice(0, 3);

  const skillList = displaySkills
    .map((s) => `- \`${s.name}\`: ${s.description} (位置: ${s.location})`)
    .join('\n');

  return `## 可用技能
<available_skills>
${skillList}
</available_skills>

回复前：请扫描 <available_skills> <description> 条目。

- 如果只有一个技能明显适用：使用 \`read\` 读取其 SKILL.md，然后遵循
- 如果多个适用：选择最具体的一个，然后读取/遵循
- 如果没有明显适用的：不要读取任何 SKILL.md

约束：永不一次读取多个 skill；选择后再读取。

当 skill 驱动外部 API 写入时，假设有速率限制：优先选择更少但更大的写入，避免紧凑的单项循环，尽可能序列化突发流量，并遵守 429/Retry-After。`;
}

/**
 * 格式化运行时信息
 */
function formatRuntimeInfo(runtime?: { channel?: string; capabilities?: string[] }): string {
  if (!runtime) {
    return '';
  }

  const parts: string[] = [];

  if (runtime.channel) {
    parts.push(`Channel: ${runtime.channel}`);
  }

  if (runtime.capabilities && runtime.capabilities.length > 0) {
    parts.push(`Capabilities: ${runtime.capabilities.join(', ')}`);
  }

  return parts.join('\n');
}

/**
 * 格式化上下文文件
 */
function formatContextFiles(context?: ContextInfo): string {
  if (!context?.files || context.files.length === 0) {
    return '';
  }

  const fileList = context.files
    .map((f) => `### ${f.path}\n\`\`\`\n${f.content.slice(0, 1000)}\n\`\`\``)
    .join('\n\n');

  return `## Context Files\n${fileList}`;
}

/**
 * 解析模板，替换占位符
 */
function parseTemplate(
  template: string,
  variables: Record<string, string>
): string {
  let result = template;

  // 替换所有占位符
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{{${key}}}`;
    result = result.split(placeholder).join(value);
  }

  // 清理未替换的占位符和空行
  result = result
    .replace(/\{\{[^}]+\}\}/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return result;
}

/**
 * 构建心跳提示
 */
export function buildHeartbeatPrompt(): string {
  return loadModule('heartbeats');
}

/**
 * 格式化已加载的 skills/MCP 内容
 */
function formatLoadedSkills(items: LoadedItem[]): string {
  if (items.length === 0) {
    return '';
  }

  const skillItems = items.filter(i => i.type === 'skill');
  if (skillItems.length === 0) {
    return '';
  }

  const skillContent = skillItems
    .map(item => `### ${item.name}\n${item.content}`)
    .join('\n---\n');

  return `## 已加载的 Skills

${skillContent}

---
你可以在当前对话中直接使用以上已加载的 skill。`;
}

/**
 * 格式化审查提示（每 10 轮一次）
 */
function formatReviewPrompt(isReviewRound: boolean, items: LoadedItem[]): string {
  if (!isReviewRound || items.length === 0) {
    return '';
  }

  const itemList = items
    .map(item => `- ${item.name} (${item.type})`)
    .join('\n');

  return `

---

## 审查提示 (每 10 轮一次)

请审视当前已加载的 skill/MCP：

${itemList}

问题：
1. 以上加载的资源是否还在使用？
2. 是否有需要加载的新 skill/MCP？
3. 是否需要清除不再使用的加载？

**注意**：如果需要重新加载，请调用 \`load\` 工具。新的 load 会覆盖之前的。`;
}
