// Skills 加载器
// 从文件系统加载 skill 定义

import fs from 'node:fs/promises';
import path from 'node:path';
import {
  type ParsedSkillFrontmatter,
  type Skill,
  type SkillEntry,
  type OpenClawSkillMetadata,
  type SkillInvocationPolicy,
} from './types.js';

/**
 * 解析 frontmatter
 */
export function parseFrontmatter(content: string): ParsedSkillFrontmatter {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return { data: {}, content };
  }

  const frontmatterStr = match[1];
  const data: Record<string, any> = {};

  frontmatterRegex.lastIndex = 0;
  const lines = frontmatterStr.split('\n');
  let currentKey = '';
  let currentValue: any = '';

  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex !== -1) {
      if (currentKey) {
        data[currentKey.trim()] = currentValue.trim();
      }
      const key = line.slice(0, colonIndex).trim();
      const value = line.slice(colonIndex + 1).trim();

      if (value.startsWith('"') || value.startsWith("'")) {
        currentKey = key;
        currentValue = value.slice(1, -1);
      } else if (value === 'true') {
        data[key] = true;
        currentKey = '';
      } else if (value === 'false') {
        data[key] = false;
        currentKey = '';
      } else if (value === '') {
        currentKey = key;
        currentValue = '';
      } else {
        data[key] = value;
      }
    } else if (currentKey && line.startsWith('  ')) {
      currentValue += '\n' + line.trim();
    }
  }

  if (currentKey) {
    data[currentKey] = currentValue.trim();
  }

  const markdownContent = content.slice(match[0].length).trim();

  return { data, content: markdownContent };
}

/**
 * 解析 frontmatter 中的 OpenClaw 元数据
 */
export function resolveOpenClawMetadata(
  frontmatter: ParsedSkillFrontmatter,
): OpenClawSkillMetadata | undefined {
  const data = frontmatter.data;

  if (!data || Object.keys(data).length === 0) {
    return undefined;
  }

  const metadata: OpenClawSkillMetadata = {};

  if (typeof data.always === 'boolean') {
    metadata.always = data.always;
  }
  if (typeof data.emoji === 'string') {
    metadata.emoji = data.emoji;
  }
  if (typeof data.homepage === 'string') {
    metadata.homepage = data.homepage;
  }
  if (typeof data.skillKey === 'string') {
    metadata.skillKey = data.skillKey;
  }
  if (typeof data.primaryEnv === 'string') {
    metadata.primaryEnv = data.primaryEnv;
  }
  if (data.os) {
    metadata.os = Array.isArray(data.os) ? data.os : [data.os];
  }
  if (data.requires) {
    metadata.requires = parseRequirement(data.requires);
  }
  if (data.install) {
    metadata.install = parseInstallSpec(data.install);
  }

  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

function parseRequirement(requires: any): Array<{ type: 'env' | 'tool' | 'feature'; name: string; description?: string }> {
  if (!requires) return [];
  if (Array.isArray(requires)) {
    return requires.map((r: any) => {
      if (typeof r === 'string') {
        const parts = r.split(':');
        return { type: (parts[0] || 'tool') as 'env' | 'tool' | 'feature', name: parts[1] || r };
      }
      return { type: (r.type || 'tool') as 'env' | 'tool' | 'feature', name: r.name };
    });
  }
  return [];
}

function parseInstallSpec(install: any): any[] {
  if (!install) return [];
  if (Array.isArray(install)) {
    return install;
  }
  return [install];
}

/**
 * 解析调用策略
 */
export function resolveSkillInvocationPolicy(
  frontmatter: ParsedSkillFrontmatter,
): SkillInvocationPolicy {
  const data = frontmatter.data;

  return {
    userInvocable: data['user-invocable'] !== false,
    disableModelInvocation: data['disable-model-invocation'] === true,
  };
}

/**
 * 从文件内容创建 Skill 对象
 */
export function createSkillFromContent(filePath: string, content: string): Skill {
  const { data, content: markdownContent } = parseFrontmatter(content);

  const skillName = data.name || path.basename(filePath, path.extname(filePath));

  return {
    name: skillName,
    description: data.description || '',
    content: markdownContent,
    frontmatter: data,
  };
}

// Load skills from skills/*/SKILL.md directories
export async function loadSkillsFromDir(dirPath: string): Promise<SkillEntry[]> {
  const skills: SkillEntry[] = [];

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      // 如果是目录，递归查找 SKILL.md
      if (entry.isDirectory()) {
        const skillDir = path.join(dirPath, entry.name);
        const skillFilePath = path.join(skillDir, 'SKILL.md');
        try {
          const stat = await fs.stat(skillFilePath);
          if (stat.isFile()) {
            const content = await fs.readFile(skillFilePath, 'utf-8');
            if (content.startsWith('---')) {
              const skill = createSkillFromContent(skillFilePath, content);
              const frontmatter = parseFrontmatter(content);
              const skillEntry: SkillEntry = {
                skill,
                frontmatter,
                metadata: resolveOpenClawMetadata(frontmatter),
                invocation: resolveSkillInvocationPolicy(frontmatter),
              };
              skills.push(skillEntry);
            }
          }
        } catch {}
        continue;
      }

      // 如果是文件，直接处理
      if (!entry.isFile()) continue;

      const ext = path.extname(entry.name);
      if (ext !== '.md' && ext !== '.mdx') continue;

      const filePath = path.join(dirPath, entry.name);
      const content = await fs.readFile(filePath, 'utf-8');

      if (!content.startsWith('---')) continue;

      const skill = createSkillFromContent(filePath, content);
      const frontmatter = parseFrontmatter(content);

      const skillEntry: SkillEntry = {
        skill,
        frontmatter,
        metadata: resolveOpenClawMetadata(frontmatter),
        invocation: resolveSkillInvocationPolicy(frontmatter),
      };

      skills.push(skillEntry);
    }
  } catch (error) {
    console.error(`Failed to load skills from ${dirPath}:`, error);
  }

  return skills;
}

/**
 * 根据 skill key 查找 skill
 */
export function findSkillByKey(skills: SkillEntry[], key: string): SkillEntry | undefined {
  return skills.find(
    (entry) =>
      entry.skill.name.toLowerCase() === key.toLowerCase() ||
      entry.metadata?.skillKey?.toLowerCase() === key.toLowerCase(),
  );
}

/**
 * 获取所有 user-invocable skills
 */
export function getUserInvocableSkills(skills: SkillEntry[]): SkillEntry[] {
  return skills.filter((entry) => entry.invocation?.userInvocable !== false);
}
