/**
 * Learning System - 自主学习系统
 *
 * 让 Agent 能够从经验中学习：
 * - 成功模式识别
 * - 失败模式记录
 * - 知识积累
 * - 技能进化
 */

/**
 * 学习配置
 */
export interface LearningConfig {
  /** 是否启用学习 */
  enabled?: boolean;
  /** 最小成功次数触发学习 */
  minSuccessCount?: number;
  /** 最小失败次数触发学习 */
  minFailureCount?: number;
  /** 经验保存路径 */
  experiencePath?: string;
}

/**
 * 经验记录
 */
export interface Experience {
  id: string;
  type: 'success' | 'failure' | 'knowledge';
  description: string;
  context: Record<string, unknown>;
  pattern?: string;
  count: number;
  firstSeen: number;
  lastSeen: number;
  tags: string[];
}

/**
 * 学习主题
 */
export interface LearningTopic {
  id: string;
  name: string;
  description: string;
  experiences: string[];
  confidence: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * 技能进化
 */
export interface SkillEvolution {
  id: string;
  name: string;
  version: number;
  source: string;
  improvements: string[];
  performance: number;
  createdAt: number;
}

/**
 * 经验模式
 */
export interface ExperiencePattern {
  id: string;
  pattern: string;
  description: string;
  successCount: number;
  failureCount: number;
  lastMatched?: number;
}

/**
 * 学习系统
 */
export class LearningSystem {
  private config: Required<LearningConfig>;
  private experiences: Map<string, Experience> = new Map();
  private topics: Map<string, LearningTopic> = new Map();
  private patterns: Map<string, ExperiencePattern> = new Map();
  private skillEvolutions: Map<string, SkillEvolution> = new Map();

  constructor(config: LearningConfig = {}) {
    this.config = {
      enabled: config.enabled ?? true,
      minSuccessCount: config.minSuccessCount ?? 3,
      minFailureCount: config.minFailureCount ?? 2,
      experiencePath: config.experiencePath ?? './storage/learning',
    };
  }

  /**
   * 记录成功经验
   */
  async recordSuccess(
    description: string,
    context: Record<string, unknown> = {},
    tags: string[] = []
  ): Promise<void> {
    if (!this.config.enabled) return;

    // 生成模式
    const pattern = this.extractPattern(description);

    // 查找或创建经验
    const existing = this.findExperience(description, pattern, 'success');

    if (existing) {
      existing.count++;
      existing.lastSeen = Date.now();
      existing.context = { ...existing.context, ...context };
    } else {
      const experience: Experience = {
        id: `exp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        type: 'success',
        description,
        context,
        pattern,
        count: 1,
        firstSeen: Date.now(),
        lastSeen: Date.now(),
        tags,
      };
      this.experiences.set(experience.id, experience);

      // 尝试提取主题
      this.extractTopic(experience);
    }

    // 检查是否需要更新模式
    await this.updatePattern(pattern, 'success');

    // 保存到持久存储
    await this.persist();
  }

  /**
   * 记录失败经验
   */
  async recordFailure(
    description: string,
    context: Record<string, unknown> = {},
    tags: string[] = []
  ): Promise<void> {
    if (!this.config.enabled) return;

    const pattern = this.extractPattern(description);
    const existing = this.findExperience(description, pattern, 'failure');

    if (existing) {
      existing.count++;
      existing.lastSeen = Date.now();
      existing.context = { ...existing.context, ...context };
    } else {
      const experience: Experience = {
        id: `exp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        type: 'failure',
        description,
        context,
        pattern,
        count: 1,
        firstSeen: Date.now(),
        lastSeen: Date.now(),
        tags,
      };
      this.experiences.set(experience.id, experience);
    }

    await this.updatePattern(pattern, 'failure');
    await this.persist();
  }

  /**
   * 记录知识
   */
  async recordKnowledge(
    name: string,
    description: string,
    context: Record<string, unknown> = {}
  ): Promise<void> {
    if (!this.config.enabled) return;

    const existing = this.topics.get(name);

    if (existing) {
      existing.description = description;
      existing.updatedAt = Date.now();
      existing.confidence = Math.min(existing.confidence + 0.1, 1);
    } else {
      const topic: LearningTopic = {
        id: `topic_${Date.now()}`,
        name,
        description,
        experiences: [],
        confidence: 0.5,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      this.topics.set(name, topic);
    }

    await this.persist();
  }

  /**
   * 从经验中提取主题
   */
  private extractTopic(experience: Experience): void {
    // 简单的关键词提取
    const keywords = this.extractKeywords(experience.description);

    for (const keyword of keywords) {
      const existing = this.topics.get(keyword);

      if (existing) {
        if (!existing.experiences.includes(experience.id)) {
          existing.experiences.push(experience.id);
        }
        existing.updatedAt = Date.now();
      } else {
        const topic: LearningTopic = {
          id: `topic_${keyword}_${Date.now()}`,
          name: keyword,
          description: `关于 ${keyword} 的经验`,
          experiences: [experience.id],
          confidence: 0.3,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        this.topics.set(keyword, topic);
      }
    }
  }

  /**
   * 提取关键词
   */
  private extractKeywords(text: string): string[] {
    // 简单的分词
    const words = text.toLowerCase().split(/[\s,，。,.!?]+/);
    const keywords = words.filter(w => w.length > 2 && w.length < 20);
    return [...new Set(keywords)].slice(0, 5);
  }

  /**
   * 提取模式
   */
  private extractPattern(description: string): string {
    // 提取通用模式（替换具体值为占位符）
    let pattern = description
      .replace(/\d+/g, 'N')
      .replace(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi, 'UUID')
      .replace(/["'`].*?["'`]/g, 'X')
      .slice(0, 100);

    return pattern;
  }

  /**
   * 查找经验
   */
  private findExperience(description: string, pattern: string, type: string): Experience | undefined {
    for (const exp of this.experiences.values()) {
      if (exp.type === type && exp.pattern === pattern) {
        return exp;
      }
    }
    return undefined;
  }

  /**
   * 更新模式
   */
  private async updatePattern(pattern: string, type: 'success' | 'failure'): Promise<void> {
    const existing = this.patterns.get(pattern);

    if (existing) {
      if (type === 'success') {
        existing.successCount++;
      } else {
        existing.failureCount++;
      }
      existing.lastMatched = Date.now();
    } else {
      const newPattern: ExperiencePattern = {
        id: `pattern_${Date.now()}`,
        pattern,
        description: `Pattern: ${pattern.slice(0, 50)}...`,
        successCount: type === 'success' ? 1 : 0,
        failureCount: type === 'failure' ? 1 : 0,
        lastMatched: Date.now(),
      };
      this.patterns.set(pattern, newPattern);
    }
  }

  /**
   * 获取成功模式
   */
  getSuccessPatterns(): ExperiencePattern[] {
    return Array.from(this.patterns.values())
      .filter(p => p.successCount >= this.config.minSuccessCount)
      .sort((a, b) => b.successCount - a.successCount);
  }

  /**
   * 获取失败模式（需要避免）
   */
  getFailurePatterns(): ExperiencePattern[] {
    return Array.from(this.patterns.values())
      .filter(p => p.failureCount >= this.config.minFailureCount)
      .sort((a, b) => b.failureCount - a.failureCount);
  }

  /**
   * 获取相关主题
   */
  getRelatedTopics(query: string): LearningTopic[] {
    const keywords = this.extractKeywords(query);
    const related = new Map<string, number>();

    for (const keyword of keywords) {
      const topic = this.topics.get(keyword);
      if (topic) {
        related.set(topic.id, (related.get(topic.id) || 0) + 1);
      }
    }

    return Array.from(related.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id]) => this.topics.get(id)!)
      .filter(Boolean);
  }

  /**
   * 建议下一步行动
   */
  suggestNextAction(context: Record<string, unknown> = {}): string[] {
    const suggestions: string[] = [];

    // 基于失败模式提供建议
    const failurePatterns = this.getFailurePatterns();
    for (const pattern of failurePatterns) {
      suggestions.push(`避免: ${pattern.pattern.slice(0, 50)}...`);
    }

    // 基于成功模式提供建议
    const successPatterns = this.getSuccessPatterns();
    for (const pattern of successPatterns.slice(0, 3)) {
      suggestions.push(`推荐: ${pattern.pattern.slice(0, 50)}...`);
    }

    return suggestions;
  }

  /**
   * 持久化
   */
  private async persist(): Promise<void> {
    // 简化的持久化实现
    // 实际可以使用文件系统或数据库
    try {
      const { writeFile } = await import('fs/promises');
      const data = {
        experiences: Array.from(this.experiences.values()),
        topics: Array.from(this.topics.values()),
        patterns: Array.from(this.patterns.values()),
      };
      // 保存到文件（需要配置路径）
    } catch (error) {
      console.error('[Learning] Persist error:', error);
    }
  }

  /**
   * 加载
   */
  async load(): Promise<void> {
    // 从持久存储加载
  }

  /**
   * 获取统计
   */
  getStats() {
    return {
      totalExperiences: this.experiences.size,
      successCount: Array.from(this.experiences.values()).filter(e => e.type === 'success').length,
      failureCount: Array.from(this.experiences.values()).filter(e => e.type === 'failure').length,
      topicsCount: this.topics.size,
      patternsCount: this.patterns.size,
    };
  }
}

/**
 * 创建学习系统
 */
export function createLearningSystem(config?: LearningConfig): LearningSystem {
  return new LearningSystem(config);
}

/**
 * 全局学习系统
 */
let globalLearningSystem: LearningSystem | null = null;

export function setGlobalLearningSystem(system: LearningSystem): void {
  globalLearningSystem = system;
}

export function getGlobalLearningSystem(): LearningSystem | null {
  return globalLearningSystem;
}
