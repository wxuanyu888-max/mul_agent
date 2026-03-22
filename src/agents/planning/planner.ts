/**
 * LLM 驱动的任务规划器
 *
 * 使用 LLM 进行动态任务分解，而非静态规则匹配
 */

import { getLLMClient } from '../llm.js';
import type { Message } from '../types.js';
import type {
  Goal,
  Subtask,
  PlanningResult,
  PlanningConfig,
  IPlanner,
} from './types.js';

/**
 * 规划提示词模板
 */
const PLANNING_PROMPT = `You are a task planning expert. Your job is to break down complex user requests into executable subtasks.

## Your Task

Analyze the user's request and create a detailed execution plan.

## Guidelines

1. **Break down thoroughly**: Decompose the task into specific, actionable subtasks
2. **Identify dependencies**: Determine which subtasks depend on others
3. **Set clear order**: Specify the execution order based on dependencies
4. **Be specific**: Each subtask should be concrete and measurable

## Output Format

Respond with a JSON object in the following format:
\`\`\`json
{
  "goal_description": "A clear description of the overall goal",
  "reasoning": "Explain your planning approach in 2-3 sentences",
  "subtasks": [
    {
      "id": "1",
      "description": "Specific subtask description",
      "dependencies": ["id of subtask this depends on, or empty array"]
    }
  ]
}
\`\`\`

## User Request

{{USER_MESSAGE}}

## Context (if any)

{{CONTEXT}}

Now create your plan:`;

/**
 * 优化规划提示词
 */
const REFINE_PROMPT = `You are a task planning expert. The user requested a complex task, and you've created a plan. Now you need to refine it based on execution feedback.

## Original Goal

{{GOAL_DESCRIPTION}}

## Current Plan

{{CURRENT_PLAN}}

## Execution Feedback

{{FEEDBACK}}

## Guidelines

1. Analyze what went wrong or what needs adjustment
2. Keep successful subtasks as-is
3. Modify or remove failed subtasks
4. Add new subtasks if needed to address gaps

## Output Format

Respond with a JSON object:
\`\`\`json
{
  "goal_description": "Updated goal description",
  "reasoning": "Explain what changed and why",
  "subtasks": [
    {
      "id": "1",
      "description": "Subtask description",
      "dependencies": ["dependencies or empty"]
    }
  ]
}
\`\`\``;

/**
 * 生成唯一 ID
 */
function generateId(): string {
  return `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * 解析 LLM 响应为规划结果
 */
function parsePlanningResponse(
  response: string,
  originalRequest: string
): PlanningResult {
  try {
    // 尝试提取 JSON
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    const now = Date.now();
    const subtasks: Subtask[] = (parsed.subtasks || []).map((st: any, index: number) => ({
      id: st.id || String(index + 1),
      description: st.description || '',
      status: 'pending' as const,
      dependencies: st.dependencies || [],
      createdAt: now,
      updatedAt: now,
      attempts: 0,
    }));

    const goal: Goal = {
      id: generateId(),
      originalRequest,
      description: parsed.goal_description || originalRequest,
      status: 'planning',
      subtasks,
      createdAt: now,
      updatedAt: now,
    };

    return {
      goal,
      reasoning: parsed.reasoning || '',
      needsReprompt: false,
      rawResponse: response,
    };
  } catch (error) {
    // 解析失败，返回简单规划
    console.error('[Planning] Failed to parse LLM response:', error);
    const now = Date.now();
    return {
      goal: {
        id: generateId(),
        originalRequest,
        description: originalRequest,
        status: 'planning',
        subtasks: [
          {
            id: '1',
            description: originalRequest,
            status: 'pending',
            dependencies: [],
            createdAt: now,
            updatedAt: now,
            attempts: 0,
          },
        ],
        createdAt: now,
        updatedAt: now,
      },
      reasoning: 'Simple fallback plan due to parse error',
      needsReprompt: false,
      rawResponse: response,
    };
  }
}

/**
 * 格式化子任务为可读文本
 */
function formatSubtasks(subtasks: Subtask[]): string {
  return subtasks
    .map((st) => `  - ${st.id}: ${st.description} (deps: [${st.dependencies.join(', ')}])`)
    .join('\n');
}

/**
 * LLM 驱动的任务规划器
 */
export class PlanningAgent implements IPlanner {
  private config: Required<PlanningConfig>;
  private llm = getLLMClient();

  constructor(config: PlanningConfig = {}) {
    this.config = {
      maxSubtasks: config.maxSubtasks ?? 10,
      reflectionInterval: config.reflectionInterval ?? 5,
      enableReflection: config.enableReflection ?? true,
      enableMetaCognition: config.enableMetaCognition ?? 3,
      maxRetries: config.maxRetries ?? 2,
      complexityThreshold: config.complexityThreshold ?? 5, // 降低阈值，让更多任务经过 LLM 规划
    };
  }

  /**
   * 分析任务复杂度
   * 简单任务不需要规划，直接执行
   * 为了更好的自主规划效果，我们让大部分任务都经过 LLM 规划
   */
  analyzeComplexity(description: string): number {
    const wordCount = description.split(/\s+/).length;

    // 简单启发式判断 - 调整阈值让更多任务走 LLM 规划
    const complexityIndicators = [
      /并且|同时|和/i,
      /first|then|next|finally/i,
      /multiple|various|series|多个/i,
      /with|including|包括|包含|功能/i,
      /注册|登录|个人资料|CRUD/i, // 这些关键词暗示复杂任务
    ];

    let score = Math.min(10, Math.floor(wordCount / 3)); // 更敏感的词数计算

    for (const indicator of complexityIndicators) {
      if (indicator.test(description)) {
        score += 3;
      }
    }

    return Math.min(15, score);
  }

  /**
   * 创建规划
   */
  async createPlan(userMessage: string, context?: string): Promise<PlanningResult> {
    const complexity = this.analyzeComplexity(userMessage);

    // 简单任务不需要完整规划
    if (complexity < this.config.complexityThreshold) {
      const now = Date.now();
      return {
        goal: {
          id: generateId(),
          originalRequest: userMessage,
          description: userMessage,
          status: 'planning',
          subtasks: [
            {
              id: '1',
              description: userMessage,
              status: 'pending',
              dependencies: [],
              createdAt: now,
              updatedAt: now,
              attempts: 0,
            },
          ],
          createdAt: now,
          updatedAt: now,
        },
        reasoning: 'Simple task - direct execution',
        needsReprompt: false,
      };
    }

    // 构建规划提示词
    const prompt = PLANNING_PROMPT
      .replace('{{USER_MESSAGE}}', userMessage)
      .replace('{{CONTEXT}}', context || 'No additional context');

    console.log('[Planning] Creating plan for:', userMessage.substring(0, 50));

    try {
      // 调用 LLM
      const response = await this.llm.chat({
        model: (this.llm as any).model || 'claude-sonnet-4-20250514',
        messages: [
          {
            role: 'user' as const,
            content: prompt,
          },
        ] as any,
        system: 'You are a task planning expert. Respond with valid JSON only.',
      });

      // 提取文本内容
      const textContent = this.extractTextContent(response);

      return parsePlanningResponse(textContent, userMessage);
    } catch (error) {
      console.error('[Planning] Failed to create plan:', error);
      // 返回简单规划作为后备
      const now = Date.now();
      return {
        goal: {
          id: generateId(),
          originalRequest: userMessage,
          description: userMessage,
          status: 'planning',
          subtasks: [
            {
              id: '1',
              description: userMessage,
              status: 'pending',
              dependencies: [],
              createdAt: now,
              updatedAt: now,
              attempts: 0,
            },
          ],
          createdAt: now,
          updatedAt: now,
        },
        reasoning: 'Fallback plan due to LLM error',
        needsReprompt: false,
      };
    }
  }

  /**
   * 优化规划
   */
  async refinePlan(goal: Goal, executionFeedback: string): Promise<Goal> {
    console.log('[Planning] Refining plan based on feedback');

    const prompt = REFINE_PROMPT
      .replace('{{GOAL_DESCRIPTION}}', goal.description)
      .replace('{{CURRENT_PLAN}}', formatSubtasks(goal.subtasks))
      .replace('{{FEEDBACK}}', executionFeedback);

    try {
      const response = await this.llm.chat({
        model: (this.llm as any).model || 'claude-sonnet-4-20250514',
        messages: [
          {
            role: 'user' as const,
            content: prompt,
          },
        ] as any,
        system: 'You are a task planning expert. Respond with valid JSON only.',
      });

      const textContent = this.extractTextContent(response);
      const result = parsePlanningResponse(textContent, goal.originalRequest);

      // 更新目标但保留已完成的任务状态
      const refinedGoal = result.goal;
      for (const refinedSubtask of refinedGoal.subtasks) {
        const existingSubtask = goal.subtasks.find((st) => st.id === refinedSubtask.id);
        if (existingSubtask && existingSubtask.status === 'completed') {
          refinedSubtask.status = 'completed';
          refinedSubtask.result = existingSubtask.result;
        }
      }

      return {
        ...refinedGoal,
        status: 'planning',
        updatedAt: Date.now(),
      };
    } catch (error) {
      console.error('[Planning] Failed to refine plan:', error);
      return goal;
    }
  }

  /**
   * 提取文本内容
   */
  private extractTextContent(response: any): string {
    if (!response.content) return '';
    const textBlocks = response.content.filter((block: any) => block.type === 'text');
    return textBlocks.map((block: any) => block.text || '').join('\n');
  }
}

/**
 * 创建规划器
 */
export function createPlanner(config?: PlanningConfig): IPlanner {
  return new PlanningAgent(config);
}
