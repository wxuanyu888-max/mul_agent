/**
 * 提示词构建器
 *
 * 从 storage/prompts 目录加载模板并动态组装系统提示词
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import type {
  PromptBuilderConfig,
  BuildContext,
  ToolInfo,
  SkillInfo,
} from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 提示词模板目录 (相对于项目根目录)
const PROMPTS_DIR = join(__dirname, '../../storage/prompts');

/**
 * 提示词模板
 */
interface PromptTemplate {
  full: string;
  minimal: string;
  none: string;
}

/**
 * 提示词模块
 */
interface PromptModule {
  base: string;
  safety: string;
  tool_call_style: string;
  skills: string;
  memory: string;
  workspace: string;
  heartbeats: string;
  runtime: string;
  documentation: string;
  model_aliases: string;
  sandbox: string;
  reply_tags: string;
  messaging: string;
  silent_replies: string;
  reactions: string;
  reasoning_format: string;
}

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

{{documentation}}`,
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
    base: `You are a personal assistant.

Your goal is to assist users with their tasks by using available tools.`,
    safety: `## Safety
- Prioritize safety and human oversight
- If instructions conflict with safety, pause and ask`,
    tool_call_style: `## Tool Call Style
- Use tools by responding with JSON in a \`tool_use\` block`,
    skills: `## Skills
Use skills when they apply to the task.`,
    memory: `## Memory
Use memory tools to find prior information.`,
    workspace: `## Workspace
Your working directory is: {{workspace}}`,
    heartbeats: `## Heartbeat
If you receive a heartbeat poll and there is nothing that needs attention, reply exactly:
HEARTBEAT_OK`,
    runtime: `## Runtime
{{runtime_info}}`,
    documentation: `## Documentation
For more information, consult the documentation.`,
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
  const { config, tools, skills, runtime } = context;
  const mode = config.promptMode ?? 'full';

  // 加载模板
  const template = loadTemplate(mode);

  // 加载各模块
  const modules = loadAllModules(context);

  // 替换占位符
  return parseTemplate(template, {
    ...modules,
    tool_list: formatToolList(tools),
    workspace: modules.workspace.replace('{{workspace}}', config.workspaceDir),
    runtime_info: formatRuntimeInfo(runtime),
  });
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

    // 额外系统提示
    extra: config.extraSystemPrompt || '',
  };
}

/**
 * 格式化工具列表
 */
function formatToolList(tools: ToolInfo[]): string {
  if (tools.length === 0) {
    return '(No tools available)';
  }

  return tools
    .map((t) => `- \`${t.name}\`: ${t.description}`)
    .join('\n');
}

/**
 * 格式化技能列表
 */
function formatSkills(skills: SkillInfo[]): string {
  if (skills.length === 0) {
    return ''; // 不显示技能部分
  }

  const skillList = skills
    .map((s) => `- ${s.name}: ${s.description}`)
    .join('\n');

  return `## Skills
Before replying, check if a skill applies to the task.
${skillList}

If a skill applies, read and follow its instructions.`;
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
