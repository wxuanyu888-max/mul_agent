/**
 * Task Planner - 任务规划器
 *
 * 将复杂任务分解为可执行的子任务
 * 支持：
 * - 自动任务分解
 * - 依赖关系分析
 * - 执行顺序优化
 * - 回溯计划
 */

import type { Task, TaskCreateParams, TaskManager } from '../tools/tasks/manager.js';

/**
 * 规划配置
 */
export interface PlannerConfig {
  /** 最大子任务数量 */
  maxSubtasks?: number;
  /** 是否并行执行独立任务 */
  parallelExecution?: boolean;
  /** 任务优先级 */
  defaultPriority?: number;
}

/**
 * 规划结果
 */
export interface Plan {
  /** 任务列表 */
  tasks: PlannedTask[];
  /** 执行顺序 */
  executionOrder: number[][];
  /** 估计的总时间（分钟） */
  estimatedMinutes?: number;
}

/**
 * 已规划的任务
 */
export interface PlannedTask {
  /** 任务 ID（规划中） */
  id: string;
  /** 任务标题 */
  subject: string;
  /** 任务描述 */
  description: string;
  /** 优先级 */
  priority: number;
  /** 依赖任务 IDs */
  dependencies: string[];
  /** 是否可以并行 */
  canParallel: boolean;
  /** 任务类型 */
  type: 'implementation' | 'testing' | 'refactoring' | 'documentation' | 'research' | 'unknown';
}

/**
 * 任务分析结果
 */
export interface TaskAnalysis {
  /** 复杂度评分 (1-10) */
  complexity: number;
  /** 需要的技能 */
  requiredSkills: string[];
  /** 估计的难度 */
  difficulty: 'easy' | 'medium' | 'hard';
  /** 是否需要多步骤 */
  requiresMultipleSteps: boolean;
  /** 建议的分解方式 */
  suggestedApproach: string;
}

/**
 * 任务规划器
 */
export class TaskPlanner {
  private config: Required<PlannerConfig>;
  private taskManager?: TaskManager;

  constructor(config: PlannerConfig = {}, taskManager?: TaskManager) {
    this.config = {
      maxSubtasks: config.maxSubtasks ?? 10,
      parallelExecution: config.parallelExecution ?? true,
      defaultPriority: config.defaultPriority ?? 5,
    };
    this.taskManager = taskManager;
  }

  /**
   * 分析任务复杂度
   */
  analyzeTask(description: string): TaskAnalysis {
    const keywords = {
      implementation: ['实现', '开发', '创建', '构建', 'write', 'implement', 'create', 'build'],
      testing: ['测试', '验证', '测试', 'test', 'verify', 'validate'],
      refactoring: ['重构', '优化', '改进', 'refactor', 'optimize', 'improve'],
      documentation: ['文档', '说明', '写文档', 'document', 'write docs'],
      research: ['研究', '调查', '探索', 'research', 'investigate', 'explore'],
    };

    // 计算复杂度
    let complexity = 1;
    const words = description.toLowerCase().split(/\s+/);
    const wordCount = words.length;

    // 根据词数估计复杂度
    if (wordCount > 50) complexity = 8;
    else if (wordCount > 30) complexity = 6;
    else if (wordCount > 15) complexity = 4;
    else if (wordCount > 5) complexity = 2;

    // 检查关键词
    let requiredSkills: string[] = [];
    let requiresMultipleSteps = false;

    for (const [skill, kws] of Object.entries(keywords)) {
      for (const kw of kws) {
        if (description.toLowerCase().includes(kw)) {
          requiredSkills.push(skill);
          requiresMultipleSteps = true;
          complexity += 1;
        }
      }
    }

    // 检测是否有多个步骤（通过连接词）
    const stepIndicators = ['首先', '然后', '接着', '之后', '最后', '第一步', '第二步', 'first', 'then', 'next', 'finally'];
    for (const indicator of stepIndicators) {
      if (description.toLowerCase().includes(indicator)) {
        requiresMultipleSteps = true;
        complexity += 1;
      }
    }

    // 确定难度
    let difficulty: 'easy' | 'medium' | 'hard' = 'easy';
    if (complexity >= 7) difficulty = 'hard';
    else if (complexity >= 4) difficulty = 'medium';

    // 建议的分解方式
    let suggestedApproach = '直接执行';
    if (requiresMultipleSteps) {
      suggestedApproach = '分解为多个子任务';
    }
    if (complexity >= 6) {
      suggestedApproach = '需要详细规划，可能需要多人协作';
    }

    return {
      complexity: Math.min(complexity, 10),
      requiredSkills: [...new Set(requiredSkills)],
      difficulty,
      requiresMultipleSteps,
      suggestedApproach,
    };
  }

  /**
   * 分解任务
   */
  async decomposeTask(description: string, parentId?: number): Promise<Plan> {
    const analysis = this.analyzeTask(description);

    // 如果任务简单，不需要分解
    if (!analysis.requiresMultipleSteps || analysis.complexity < 3) {
      const simpleTask: PlannedTask[] = [
        {
          id: '1',
          subject: this.extractTitle(description),
          description,
          priority: this.config.defaultPriority,
          dependencies: [],
          canParallel: true,
          type: this.detectTaskType(description),
        },
      ];

      return {
        tasks: simpleTask,
        executionOrder: [[1]],
        estimatedMinutes: analysis.difficulty === 'hard' ? 60 : analysis.difficulty === 'medium' ? 30 : 10,
      };
    }

    // 智能分解任务
    const subtasks = await this.smartDecompose(description, analysis);

    // 生成执行顺序
    const executionOrder = this.generateExecutionOrder(subtasks);

    return {
      tasks: subtasks,
      executionOrder,
      estimatedMinutes: subtasks.length * 15,
    };
  }

  /**
   * 智能分解
   */
  private async smartDecompose(description: string, analysis: TaskAnalysis): Promise<PlannedTask[]> {
    const tasks: PlannedTask[] = [];

    // 基于分析结果进行分解
    const subTaskPatterns = [
      // 开发和实现类
      { pattern: /创建|实现|开发|build|implement|create/i, type: 'implementation' as const, action: '创建' },
      { pattern: /测试|验证|验证|test|verify|validate/i, type: 'testing' as const, action: '测试' },
      { pattern: /重构|优化|改进|refactor|optimize/i, type: 'refactoring' as const, action: '重构' },
      { pattern: /文档|说明|docs|document/i, type: 'documentation' as const, action: '编写文档' },
      { pattern: /研究|调查|探索|research|investigate/i, type: 'research' as const, action: '研究' },
    ];

    // 检查是否有明确的步骤
    const stepPatterns = [
      /第一[步件个]+[:：]?\s*([^，,。\n]+)/gi,
      /第二[步件个]+[:：]?\s*([^，,。\n]+)/gi,
      /第三[步件个]+[:：]?\s*([^，,。\n]+)/gi,
      /首先[:：]?\s*([^，,。\n]+)/gi,
      /然后[:：]?\s*([^，,。\n]+)/gi,
      /接着[:：]?\s*([^，,。\n]+)/gi,
      /最后[:：]?\s*([^，,。\n]+)/gi,
    ];

    let foundSteps: string[] = [];
    for (const pattern of stepPatterns) {
      const matches = description.match(pattern);
      if (matches) {
        foundSteps.push(...matches.map(m => m.replace(/^(第一|第二|第三|首先|然后|接着|最后)[:：]?\s*/, '').trim()));
      }
    }

    if (foundSteps.length > 0) {
      // 使用明确的步骤
      for (let i = 0; i < foundSteps.length; i++) {
        tasks.push({
          id: String(i + 1),
          subject: this.extractTitle(foundSteps[i]),
          description: foundSteps[i],
          priority: this.config.defaultPriority + i,
          dependencies: i > 0 ? [String(i)] : [],
          canParallel: false,
          type: this.detectTaskType(foundSteps[i]),
        });
      }
    } else {
      // 基于关键词分解
      let taskId = 1;

      // 添加研究/分析阶段（如需要）
      if (analysis.requiredSkills.includes('research') || analysis.difficulty === 'hard') {
        tasks.push({
          id: String(taskId++),
          subject: '研究和分析',
          description: '分析需求和研究实现方案',
          priority: 1,
          dependencies: [],
          canParallel: false,
          type: 'research',
        });
      }

      // 添加实现阶段
      if (analysis.requiredSkills.includes('implementation')) {
        tasks.push({
          id: String(taskId++),
          subject: '实现核心功能',
          description: description,
          priority: 2,
          dependencies: tasks.length > 0 ? [String(taskId - 1)] : [],
          canParallel: false,
          type: 'implementation',
        });
      }

      // 添加测试阶段
      if (analysis.requiredSkills.includes('testing') || analysis.complexity >= 5) {
        tasks.push({
          id: String(taskId++),
          subject: '编写测试',
          description: '为功能编写单元测试和集成测试',
          priority: 3,
          dependencies: tasks.length > 0 ? [String(taskId - 1)] : [],
          canParallel: false,
          type: 'testing',
        });
      }

      // 添加文档阶段
      if (analysis.requiredSkills.includes('documentation')) {
        tasks.push({
          id: String(taskId++),
          subject: '编写文档',
          description: '更新相关文档',
          priority: 4,
          dependencies: tasks.length > 0 ? [String(taskId - 1)] : [],
          canParallel: false,
          type: 'documentation',
        });
      }

      // 如果没有匹配到任何类型，添加一个通用任务
      if (tasks.length === 0) {
        tasks.push({
          id: String(taskId++),
          subject: this.extractTitle(description),
          description,
          priority: 1,
          dependencies: [],
          canParallel: true,
          type: 'implementation',
        });
      }
    }

    return tasks.slice(0, this.config.maxSubtasks);
  }

  /**
   * 生成执行顺序
   */
  private generateExecutionOrder(tasks: PlannedTask[][] | PlannedTask[]): number[][] {
    const flatTasks = Array.isArray(tasks[0]) ? (tasks as PlannedTask[][]).flat() : tasks as PlannedTask[];
    const order: number[][] = [];
    const executed = new Set<string>();

    // 简化版本：按依赖顺序执行
    let remaining = [...flatTasks];
    let round = 0;

    while (remaining.length > 0 && round < 10) {
      const canExecute: PlannedTask[] = [];

      for (const task of remaining) {
        const depsMet = task.dependencies.every(dep => executed.has(dep));
        if (depsMet) {
          canExecute.push(task);
        }
      }

      if (canExecute.length === 0) {
        // 死锁：剩余任务无法执行
        break;
      }

      order.push(canExecute.map(t => parseInt(t.id)));
      canExecute.forEach(t => executed.add(t.id));

      remaining = remaining.filter(t => !executed.has(t.id));
      round++;
    }

    return order;
  }

  /**
   * 提取标题
   */
  private extractTitle(description: string): string {
    const firstLine = description.split(/[。.\n]/)[0];
    return firstLine.slice(0, 50) + (firstLine.length > 50 ? '...' : '');
  }

  /**
   * 检测任务类型
   */
  private detectTaskType(description: string): PlannedTask['type'] {
    const lower = description.toLowerCase();

    if (/实现|开发|创建|build|implement|create|develop/i.test(lower)) {
      return 'implementation';
    }
    if (/测试|验证|test|verify|validate/i.test(lower)) {
      return 'testing';
    }
    if (/重构|优化|改进|refactor|optimize|improve/i.test(lower)) {
      return 'refactoring';
    }
    if (/文档|说明|docs|document/i.test(lower)) {
      return 'documentation';
    }
    if (/研究|调查|探索|research|investigate|explore/i.test(lower)) {
      return 'research';
    }

    return 'unknown';
  }

  /**
   * 将规划转换为实际任务
   */
  async createTasksFromPlan(plan: Plan, owner: string = 'agent'): Promise<Task[]> {
    if (!this.taskManager) {
      throw new Error('TaskManager not configured');
    }

    const tasks: Task[] = [];

    for (const planned of plan.tasks) {
      // 转换依赖 ID
      const blockedBy: number[] = [];
      for (const depId of planned.dependencies) {
        const depTask = tasks.find(t => t.id.toString() === depId);
        if (depTask) {
          blockedBy.push(depTask.id);
        }
      }

      const params: TaskCreateParams = {
        subject: planned.subject,
        description: planned.description,
        owner,
        priority: planned.priority,
        blockedBy,
      };

      const task = await this.taskManager.create(params);
      tasks.push(task);
    }

    return tasks;
  }

  /**
   * 验证计划
   */
  validatePlan(plan: Plan): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 检查循环依赖
    for (const task of plan.tasks) {
      const visited = new Set<string>();
      const stack = [task.id];

      while (stack.length > 0) {
        const current = stack.pop()!;
        if (visited.has(current)) {
          errors.push(`循环依赖 detected at task ${current}`);
          break;
        }
        visited.add(current);

        const currentTask = plan.tasks.find(t => t.id === current);
        if (currentTask) {
          stack.push(...currentTask.dependencies);
        }
      }
    }

    // 检查任务数量
    if (plan.tasks.length > this.config.maxSubtasks) {
      errors.push(`任务数量超过限制: ${plan.tasks.length} > ${this.config.maxSubtasks}`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

/**
 * 创建任务规划器
 */
export function createTaskPlanner(config?: PlannerConfig, taskManager?: TaskManager): TaskPlanner {
  return new TaskPlanner(config, taskManager);
}
