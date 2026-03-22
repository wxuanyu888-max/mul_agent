/**
 * Checkpoint Replay 功能
 *
 * 支持从指定 checkpoint 重新执行到另一个 checkpoint，
 * 用于调试和理解 Agent 的决策过程。
 */

import type { Checkpoint, ToolCallRecord } from './types.js';
import { getCheckpointManager } from './manager.js';

/**
 * Replay 选项
 */
export interface ReplayOptions {
  /** 最大重放步数 */
  maxSteps?: number;
  /** 是否包含工具调用 */
  includeToolCalls?: boolean;
  /** 是否包含 LLM 响应 */
  includeLlmResponses?: boolean;
}

/**
 * Replay 结果
 */
export interface ReplayResult {
  startCheckpoint: Checkpoint;
  endCheckpoint: Checkpoint | null;
  replayedMessages: Array<{
    type: 'message' | 'tool_call' | 'llm_response';
    data: unknown;
    checkpointId: string;
    checkpointReason: string;
  }>;
  totalSteps: number;
  completed: boolean;
}

/**
 * 从指定 checkpoint 重新执行到另一个 checkpoint
 *
 * 这个函数主要用于分析和理解 Agent 的执行链路：
 * 1. 获取两个 checkpoint 之间的所有状态变化
 * 2. 重建完整的执行序列（消息、工具调用、LLM 响应）
 */
export async function replay(
  startCheckpointId: string,
  endCheckpointId: string,
  options: ReplayOptions = {}
): Promise<ReplayResult> {
  const manager = getCheckpointManager();
  const maxSteps = options.maxSteps ?? 100;

  // 获取起始 checkpoint
  const startCheckpoint = await manager.get(startCheckpointId);
  if (!startCheckpoint) {
    throw new Error(`Start checkpoint not found: ${startCheckpointId}`);
  }

  // 获取结束 checkpoint（可选）
  let endCheckpoint: Checkpoint | null = null;
  if (endCheckpointId) {
    endCheckpoint = await manager.get(endCheckpointId);
    if (!endCheckpoint) {
      throw new Error(`End checkpoint not found: ${endCheckpointId}`);
    }
  }

  // 构建从起始到结束的 checkpoint 链
  const checkpointChain: Checkpoint[] = [startCheckpoint];
  let currentId: string | null = startCheckpoint.parentId;

  while (currentId && (!endCheckpoint || currentId !== endCheckpoint.id)) {
    const cp = await manager.get(currentId);
    if (!cp) {
      break;
    }
    checkpointChain.push(cp);
    currentId = cp.parentId;
  }

  if (endCheckpoint) {
    checkpointChain.push(endCheckpoint);
  }

  // 重放结果
  const replayedMessages: ReplayResult['replayedMessages'] = [];
  let totalSteps = 0;

  for (let i = 0; i < checkpointChain.length && totalSteps < maxSteps; i++) {
    const checkpoint = checkpointChain[i];

    // 添加消息（只在状态变化时）
    if (i === 0 || checkpoint.messages.length !== checkpointChain[i - 1].messages.length) {
      const newMessages = i === 0
        ? checkpoint.messages
        : checkpoint.messages.slice(checkpointChain[i - 1].messages.length);

      for (const msg of newMessages) {
        replayedMessages.push({
          type: 'message',
          data: msg,
          checkpointId: checkpoint.id,
          checkpointReason: checkpoint.metadata.reason,
        });
        totalSteps++;

        if (totalSteps >= maxSteps) break;
      }
    }

    // 添加工具调用记录
    if (options.includeToolCalls !== false) {
      const prevToolCalls = i === 0
        ? []
        : checkpointChain[i - 1].completedToolCalls;

      const newToolCalls = checkpoint.completedToolCalls.slice(prevToolCalls.length);

      for (const tc of newToolCalls) {
        replayedMessages.push({
          type: 'tool_call',
          data: tc,
          checkpointId: checkpoint.id,
          checkpointReason: checkpoint.metadata.reason,
        });
        totalSteps++;

        if (totalSteps >= maxSteps) break;
      }
    }

    // 添加 LLM 响应
    if (options.includeLlmResponses !== false && checkpoint.lastLlmResponse) {
      const prevResponse = i === 0 ? null : checkpointChain[i - 1].lastLlmResponse;

      // 只在有新的 LLM 响应时添加
      if (!prevResponse || checkpoint.lastLlmResponse.content !== prevResponse.content) {
        replayedMessages.push({
          type: 'llm_response',
          data: checkpoint.lastLlmResponse,
          checkpointId: checkpoint.id,
          checkpointReason: checkpoint.metadata.reason,
        });
        totalSteps++;
      }
    }
  }

  return {
    startCheckpoint,
    endCheckpoint,
    replayedMessages,
    totalSteps,
    completed: !endCheckpoint || replayedMessages.some(
      (m) => m.checkpointId === endCheckpoint!.id
    ),
  };
}

/**
 * 获取两个 checkpoint 之间的执行摘要
 */
export async function getExecutionSummary(
  startCheckpointId: string,
  endCheckpointId: string
): Promise<{
  duration: number;
  iterations: number;
  toolCalls: ToolCallRecord[];
  checkpoints: Array<{
    id: string;
    reason: string;
    iteration: number;
  }>;
}> {
  const manager = getCheckpointManager();

  const startCheckpoint = await manager.get(startCheckpointId);
  const endCheckpoint = await manager.get(endCheckpointId);

  if (!startCheckpoint || !endCheckpoint) {
    throw new Error('Checkpoint not found');
  }

  // 获取 checkpoint 链
  const chain: Checkpoint[] = [startCheckpoint];
  let currentId: string | null = startCheckpoint.parentId;

  while (currentId && currentId !== endCheckpoint.id) {
    const cp = await manager.get(currentId);
    if (!cp) break;
    chain.push(cp);
    currentId = cp.parentId;
  }

  if (currentId === endCheckpoint.id) {
    chain.push(endCheckpoint);
  }

  // 收集所有工具调用
  const allToolCalls: ToolCallRecord[] = [];
  const checkpointInfos: Array<{ id: string; reason: string; iteration: number }> = [];

  for (const cp of chain) {
    checkpointInfos.push({
      id: cp.id,
      reason: cp.metadata.reason,
      iteration: cp.metadata.iteration,
    });

    for (const tc of cp.completedToolCalls) {
      if (!allToolCalls.find((t) => t.id === tc.id)) {
        allToolCalls.push(tc);
      }
    }
  }

  return {
    duration: endCheckpoint.metadata.timestamp - startCheckpoint.metadata.timestamp,
    iterations: endCheckpoint.metadata.iteration - startCheckpoint.metadata.iteration,
    toolCalls: allToolCalls,
    checkpoints: checkpointInfos,
  };
}

/**
 * 格式化工具调用为可读字符串
 */
export function formatToolCall(tc: ToolCallRecord): string {
  const duration = tc.duration ? `(${tc.duration}ms)` : '';
  const error = tc.error ? ` [ERROR: ${tc.error}]` : '';
  return `[${tc.name}] ${duration}${error} Input: ${JSON.stringify(tc.input).slice(0, 100)}...`;
}

/**
 * 打印 Replay 结果（用于调试）
 */
export function printReplayResult(result: ReplayResult): void {
  console.log('='.repeat(80));
  console.log('Replay Result');
  console.log('='.repeat(80));
  console.log(`Start: ${result.startCheckpoint.id}`);
  console.log(`End: ${result.endCheckpoint?.id ?? 'N/A'}`);
  console.log(`Total steps: ${result.totalSteps}`);
  console.log(`Completed: ${result.completed}`);
  console.log('-'.repeat(80));

  for (const item of result.replayedMessages) {
    console.log(`[${item.checkpointReason}] ${item.type}:`);

    switch (item.type) {
      case 'message': {
        const msg = item.data as { role: string; content: string };
        console.log(`  Role: ${msg.role}`);
        console.log(`  Content: ${String(msg.content).slice(0, 200)}...`);
        break;
      }
      case 'tool_call': {
        console.log(`  ${formatToolCall(item.data as ToolCallRecord)}`);
        break;
      }
      case 'llm_response': {
        const resp = item.data as { content: string; stopReason: string };
        console.log(`  Stop reason: ${resp.stopReason}`);
        console.log(`  Content: ${resp.content.slice(0, 200)}...`);
        break;
      }
    }
    console.log();
  }
}
