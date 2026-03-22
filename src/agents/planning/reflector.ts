/**
 * 自我反思机制
 *
 * 定期评估进度、方向正确性，并提供策略调整建议
 */

import { getLLMClient } from '../llm.js';
import type { Message } from '../types.js';
import type {
  Goal,
  Subtask,
  ReflectionResult,
  MetacognitionResult,
  ExecutionContext,
  IReflector,
} from './types.js';

/**
 * 反思提示词
 */
const REFLECTION_PROMPT = `You are an expert at self-reflection and progress evaluation. Your job is to evaluate your own progress and determine if you're on the right track.

## Current Goal

{{GOAL_DESCRIPTION}}

## Subtasks Status

{{SUBTASKS_STATUS}}

## Recent Execution History

{{EXECUTION_HISTORY}}

## Your Task

Analyze the above information and provide your assessment.

## Guidelines

1. **Progress**: What percentage of the goal has been completed?
2. **Direction**: Is your current approach correct?
3. **Issues**: What problems have you encountered?
4. **Adjustment**: Do you need to change your strategy?

## Output Format

Respond with a JSON object:
\`\`\`json
{
  "progress_score": 0-100,
  "is_on_track": true/false,
  "issues": ["list of problems identified"],
  "suggestions": ["list of suggestions"],
  "needs_replanning": true/false,
  "reasoning": "Your detailed analysis in 2-4 sentences"
}
\`\`\`

Now evaluate:`;

/**
 * 元认知提示词
 */
const METACOGNITION_PROMPT = `You are a metacognitive agent. Your job is to evaluate your own reasoning quality and thought process.

## Current Goal

{{GOAL_DESCRIPTION}}

## Reasoning History (last few steps)

{{REASONING_HISTORY}}

## Tool Usage Patterns

{{TOOL_USAGE}}

## Your Task

Analyze your reasoning quality and provide suggestions for improvement.

## Guidelines

1. **Reasoning Quality**: Is your thinking clear and logical?
2. **Tool Strategy**: Are you using tools effectively?
3. **Patterns**: Do you notice any recurring patterns (good or bad)?
4. **Adjustment**: What should you do differently?

## Output Format

Respond with a JSON object:
\`\`\`json
{
  "reasoning_quality": 0-100,
  "needs_approach_change": true/false,
  "observed_patterns": ["patterns you've noticed"],
  "strategy_adjustment": "What to do differently",
  "suggested_tool_strategy": "How to use tools better"
}
\`\`\`

Now analyze:`;

/**
 * 解析反思响应
 */
function parseReflectionResponse(response: string): ReflectionResult {
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      progressScore: parsed.progress_score ?? 0,
      isOnTrack: parsed.is_on_track ?? true,
      issues: parsed.issues ?? [],
      suggestions: parsed.suggestions ?? [],
      needsReplanning: parsed.needs_replanning ?? false,
      reasoning: parsed.reasoning ?? '',
    };
  } catch (error) {
    console.error('[Reflection] Failed to parse response:', error);
    return {
      progressScore: 50,
      isOnTrack: true,
      issues: [],
      suggestions: [],
      needsReplanning: false,
      reasoning: 'Parse error - assuming on track',
    };
  }
}

/**
 * 解析元认知响应
 */
function parseMetacognitionResponse(response: string): MetacognitionResult {
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      reasoningQuality: parsed.reasoning_quality ?? 70,
      needsApproachChange: parsed.needs_approach_change ?? false,
      observedPatterns: parsed.observed_patterns ?? [],
      strategyAdjustment: parsed.strategy_adjustment,
      suggestedToolStrategy: parsed.suggested_tool_strategy,
    };
  } catch (error) {
    console.error('[Metacognition] Failed to parse response:', error);
    return {
      reasoningQuality: 70,
      needsApproachChange: false,
      observedPatterns: [],
    };
  }
}

/**
 * 格式化子任务状态
 */
function formatSubtasksStatus(goal: Goal): string {
  return goal.subtasks
    .map((st) => {
      const statusIcon = {
        pending: '[ ]',
        in_progress: '[>]',
        completed: '[✓]',
        failed: '[✗]',
      }[st.status];
      return `  ${statusIcon} ${st.id}: ${st.description}`;
    })
    .join('\n');
}

/**
 * 格式化执行历史
 */
function formatExecutionHistory(
  messages: Array<{ role: string; content: string }>
): string {
  const recentMessages = messages.slice(-6);
  return recentMessages
    .map((msg) => {
      const role = msg.role === 'user' ? 'User' : 'Assistant';
      const content = msg.content.substring(0, 200);
      return `${role}: ${content}`;
    })
    .join('\n\n');
}

/**
 * 自我反思器
 */
export class Reflector implements IReflector {
  private llm = getLLMClient();

  /**
   * 执行反思
   */
  async reflect(context: ExecutionContext): Promise<ReflectionResult> {
    const { goal, messages, iterations } = context;

    console.log(`[Reflection] Running reflection at iteration ${iterations}`);

    const prompt = REFLECTION_PROMPT
      .replace('{{GOAL_DESCRIPTION}}', goal.description)
      .replace('{{SUBTASKS_STATUS}}', formatSubtasksStatus(goal))
      .replace('{{EXECUTION_HISTORY}}', formatExecutionHistory(messages));

    try {
      const response = await this.llm.chat({
        model: (this.llm as any).model || 'claude-sonnet-4-20250514',
        messages: [
          {
            role: 'user' as const,
            content: prompt,
          },
        ] as any,
        system: 'You are a self-reflection expert. Respond with valid JSON only.',
      });

      const textContent = this.extractTextContent(response);
      return parseReflectionResponse(textContent);
    } catch (error) {
      console.error('[Reflection] Failed:', error);
      return {
        progressScore: 50,
        isOnTrack: true,
        issues: [],
        suggestions: [],
        needsReplanning: false,
        reasoning: 'Error during reflection - continuing',
      };
    }
  }

  /**
   * 执行元认知
   */
  async metacognize(context: ExecutionContext): Promise<MetacognitionResult> {
    const { goal, messages } = context;

    console.log('[Metacognition] Running metacognition');

    // 提取推理历史
    const reasoningHistory = messages
      .filter((m) => m.role === 'assistant')
      .slice(-3)
      .map((m) => m.content.substring(0, 300))
      .join('\n---\n');

    const prompt = METACOGNITION_PROMPT
      .replace('{{GOAL_DESCRIPTION}}', goal.description)
      .replace('{{REASONING_HISTORY}}', reasoningHistory || 'No reasoning history yet')
      .replace('{{TOOL_USAGE}}', 'Analyze from recent messages');

    try {
      const response = await this.llm.chat({
        model: (this.llm as any).model || 'claude-sonnet-4-20250514',
        messages: [
          {
            role: 'user' as const,
            content: prompt,
          },
        ] as any,
        system: 'You are a metacognitive expert. Respond with valid JSON only.',
      });

      const textContent = this.extractTextContent(response);
      return parseMetacognitionResponse(textContent);
    } catch (error) {
      console.error('[Metacognition] Failed:', error);
      return {
        reasoningQuality: 70,
        needsApproachChange: false,
        observedPatterns: [],
      };
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
 * 创建反思器
 */
export function createReflector(): IReflector {
  return new Reflector();
}
