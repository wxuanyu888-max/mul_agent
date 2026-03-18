// Skills 管理配置
// 控制哪些 skills 在提示词中显示

export interface SkillCategory {
  name: string;
  skills: string[];
  enabled: boolean;
}

// Skills 分类配置
export const skillCategories: SkillCategory[] = [
  {
    name: '开发相关',
    skills: [
      'coding-agent',
      'github',
      'gh-issues',
      'gifgrep',
      'session-logs',
      'skill-creator',
      'model-usage',
      'mul-agent-core',
      'tmux',
    ],
    enabled: true, // 默认启用
  },
  {
    name: '笔记/知识库',
    skills: [
      'notion',
      'obsidian',
      'apple-notes',
      'bear-notes',
    ],
    enabled: false,
  },
  {
    name: '待办/任务',
    skills: [
      'apple-reminders',
      'things-mac',
      'trello',
    ],
    enabled: false,
  },
  {
    name: '通讯',
    skills: [
      'discord',
      'slack',
      'imsg',
      'blogwatcher',
    ],
    enabled: false,
  },
  {
    name: '音乐/媒体',
    skills: [
      'spotify-player',
      'sonoscli',
      'songsee',
      'openai-whisper',
      'voice-call',
      'video-frames',
    ],
    enabled: false,
  },
  {
    name: '智能家居',
    skills: [
      'openhue',
      'blucli',
    ],
    enabled: false,
  },
  {
    name: '其他',
    skills: [
      'weather',
      '1password',
      'gemini',
      'canvas',
      'clawhub',
      'eightctl',
      'gog',
      'goplaces',
      'healthcheck',
      'himalaya',
      'mcporter',
      'nano-banana-pro',
      'nano-pdf',
      'openai-image-gen',
      'openai-whisper-api',
      'oracle',
      'ordercli',
      'peekaboo',
      'sag',
      'wacli',
      'xurl',
      'bluebubbles',
      'camsnap',
    ],
    enabled: false,
  },
];

/**
 * 获取所有启用的 skills
 */
export function getEnabledSkills(): string[] {
  return skillCategories
    .filter(cat => cat.enabled)
    .flatMap(cat => cat.skills);
}

/**
 * 根据名称启用/禁用 category
 */
export function setCategoryEnabled(categoryName: string, enabled: boolean): void {
  const category = skillCategories.find(cat => cat.name === categoryName);
  if (category) {
    category.enabled = enabled;
  }
}

/**
 * 根据 skill 名称启用/禁用
 */
export function setSkillEnabled(skillName: string, enabled: boolean): void {
  for (const category of skillCategories) {
    const index = category.skills.indexOf(skillName);
    if (index !== -1) {
      // 如果要启用，需要确保所属 category 也是启用的
      if (enabled && !category.enabled) {
        category.enabled = true;
      }
      break;
    }
  }
}
