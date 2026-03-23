/**
 * Checkpoint 时间旅行增强模块
 *
 * 提供：
 * - 分支管理
 * - 时间旅行
 * - 差异比较
 * - 垃圾回收
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { Checkpoint } from './types.js';
import type {
  Branch,
  TimeTravelRequest,
  TimeTravelResult,
  CheckpointDiff,
  TimelineView,
  TimelineCheckpoint,
  CheckpointSearchOptions,
  CheckpointGCConfig,
} from './enhanced-types.js';
import { getCheckpoint, getSessionCheckpoints } from './manager.js';

const STORAGE_DIR = '/Users/agent/PycharmProjects/mul_agent/storage/runtime/checkpoints';

/**
 * 获取分支信息存储路径
 */
function getBranchesPath(sessionId: string): string {
  return path.join(STORAGE_DIR, sessionId, 'branches.json');
}

/**
 * 获取所有分支
 */
export async function getBranches(sessionId: string): Promise<Branch[]> {
  try {
    const data = await fs.readFile(getBranchesPath(sessionId), 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

/**
 * 保存分支列表
 */
async function saveBranches(sessionId: string, branches: Branch[]): Promise<void> {
  await fs.mkdir(path.join(STORAGE_DIR, sessionId), { recursive: true });
  await fs.writeFile(getBranchesPath(sessionId), JSON.stringify(branches, null, 2));
}

/**
 * 创建新分支
 */
export async function createBranch(
  sessionId: string,
  name: string,
  fromCheckpointId: string,
  description?: string
): Promise<Branch> {
  const branches = await getBranches(sessionId);

  // 检查分支名是否已存在
  if (branches.some(b => b.name === name)) {
    throw new Error(`Branch '${name}' already exists`);
  }

  const checkpoint = await getCheckpoint(fromCheckpointId);
  if (!checkpoint) {
    throw new Error(`Checkpoint not found: ${fromCheckpointId}`);
  }

  const branch: Branch = {
    name,
    headCheckpointId: fromCheckpointId,
    createdAt: Date.now(),
    createdFrom: fromCheckpointId,
    description,
  };

  branches.push(branch);
  await saveBranches(sessionId, branches);

  return branch;
}

/**
 * 更新分支头
 */
export async function updateBranchHead(
  sessionId: string,
  branchName: string,
  checkpointId: string
): Promise<void> {
  const branches = await getBranches(sessionId);
  const branch = branches.find(b => b.name === branchName);

  if (!branch) {
    throw new Error(`Branch not found: ${branchName}`);
  }

  branch.headCheckpointId = checkpointId;
  await saveBranches(sessionId, branches);
}

/**
 * 删除分支
 */
export async function deleteBranch(sessionId: string, name: string): Promise<void> {
  const branches = await getBranches(sessionId);
  const filtered = branches.filter(b => b.name !== name);

  if (filtered.length === branches.length) {
    throw new Error(`Branch not found: ${name}`);
  }

  await saveBranches(sessionId, filtered);
}

/**
 * 时间旅行：恢复到指定 Checkpoint
 */
export async function timeTravel(request: TimeTravelRequest): Promise<TimeTravelResult> {
  const { checkpointId, branchName, preserveCurrent, description } = request;

  const targetCheckpoint = await getCheckpoint(checkpointId);
  if (!targetCheckpoint) {
    throw new Error(`Checkpoint not found: ${checkpointId}`);
  }

  const sessionId = targetCheckpoint.metadata.sessionId;

  // 如果指定了新分支名称，创建新分支
  if (branchName) {
    // 检查分支是否已存在
    const existingBranches = await getBranches(sessionId);
    if (existingBranches.some(b => b.name === branchName)) {
      // 更新现有分支的头
      await updateBranchHead(sessionId, branchName, checkpointId);

      return {
        snapshot: targetCheckpoint,
        newCheckpointId: checkpointId,
        currentBranch: branchName,
      };
    }

    // 创建新分支
    const newBranch = await createBranch(
      sessionId,
      branchName,
      checkpointId,
      description || `Branch created from checkpoint ${checkpointId}`
    );

    return {
      snapshot: targetCheckpoint,
      newCheckpointId: checkpointId,
      currentBranch: newBranch.name,
    };
  }

  // 如果需要保留当前状态作为新分支
  if (preserveCurrent) {
    const mainBranch = await getBranches(sessionId).then(branches =>
      branches.find(b => b.name === 'main')
    );

    if (mainBranch) {
      // 为当前状态创建备份分支
      const backupName = `backup_${Date.now()}`;
      await createBranch(sessionId, backupName, mainBranch.headCheckpointId, 'Auto backup before time travel');
    }
  }

  return {
    snapshot: targetCheckpoint,
    newCheckpointId: checkpointId,
    currentBranch: 'main',
  };
}

/**
 * 比较两个 Checkpoint 的差异
 */
export async function diffCheckpoint(
  checkpointIdA: string,
  checkpointIdB: string
): Promise<CheckpointDiff> {
  const [checkpointA, checkpointB] = await Promise.all([
    getCheckpoint(checkpointIdA),
    getCheckpoint(checkpointIdB),
  ]);

  if (!checkpointA || !checkpointB) {
    throw new Error('Checkpoint not found');
  }

  const messagesA = checkpointA.messages;
  const messagesB = checkpointB.messages;

  // 简单比较消息数量
  const messagesAdded = Math.max(0, messagesB.length - messagesA.length);
  const messagesRemoved = Math.max(0, messagesA.length - messagesB.length);

  // 粗略估算 token 差异
  const tokensA =
    (checkpointA.lastLlmResponse?.usage?.inputTokens || 0) +
    (checkpointA.lastLlmResponse?.usage?.outputTokens || 0);
  const tokensB =
    (checkpointB.lastLlmResponse?.usage?.inputTokens || 0) +
    (checkpointB.lastLlmResponse?.usage?.outputTokens || 0);

  // 工具调用比较
  const toolsA = new Set(checkpointA.completedToolCalls.map(t => t.id));
  const toolsB = new Set(checkpointB.completedToolCalls.map(t => t.id));

  let toolsAdded = 0;
  let toolsRemoved = 0;

  for (const id of toolsB) {
    if (!toolsA.has(id)) toolsAdded++;
  }
  for (const id of toolsA) {
    if (!toolsB.has(id)) toolsRemoved++;
  }

  return {
    checkpointIdA,
    checkpointIdB,
    messagesAdded,
    messagesRemoved,
    messagesChanged: Math.min(messagesA.length, messagesB.length),
    tokensDelta: tokensB - tokensA,
    toolsAdded,
    toolsRemoved,
    toolResultsDelta: checkpointB.completedToolCalls.length - checkpointA.completedToolCalls.length,
    duration: checkpointB.metadata.timestamp - checkpointA.metadata.timestamp,
  };
}

/**
 * 获取时间线视图
 */
export async function getTimelineView(sessionId: string): Promise<TimelineView> {
  const branches = await getBranches(sessionId);
  const checkpoints = await getSessionCheckpoints(sessionId);

  // 如果没有分支，创建默认 main 分支
  if (branches.length === 0) {
    const latestCheckpoint = checkpoints[0];
    if (latestCheckpoint) {
      branches.push({
        name: 'main',
        headCheckpointId: latestCheckpoint.id,
        createdAt: latestCheckpoint.metadata.timestamp,
      });
    }
  }

  const timelineCheckpoints: TimelineCheckpoint[] = checkpoints.map(cp => ({
    id: cp.id,
    branchName: branches.find(b => b.headCheckpointId === cp.id)?.name || 'main',
    parentId: cp.parentId,
    timestamp: cp.metadata.timestamp,
    reason: cp.metadata.reason,
    iteration: cp.metadata.iteration,
    conversationRound: cp.metadata.conversationRound,
    messagesCount: cp.messages.length,
    toolCallsCount: cp.completedToolCalls.length,
    inputTokens: cp.lastLlmResponse?.usage?.inputTokens || 0,
    outputTokens: cp.lastLlmResponse?.usage?.outputTokens || 0,
  }));

  return {
    sessionId,
    branches,
    checkpoints: timelineCheckpoints,
  };
}

/**
 * 搜索 Checkpoint
 */
export async function searchCheckpoints(options: CheckpointSearchOptions): Promise<Checkpoint[]> {
  const {
    sessionId,
    branch,
    reason,
    minIteration,
    maxIteration,
    since,
    until,
    limit = 50,
    offset = 0,
  } = options;

  let checkpoints = await getSessionCheckpoints(sessionId);

  // 过滤
  if (branch) {
    const branches = await getBranches(sessionId);
    const branchHead = branches.find(b => b.name === branch)?.headCheckpointId;
    if (branchHead) {
      checkpoints = checkpoints.filter(cp => cp.id === branchHead);
    }
  }

  if (reason) {
    checkpoints = checkpoints.filter(cp => cp.metadata.reason === reason);
  }

  if (minIteration !== undefined) {
    checkpoints = checkpoints.filter(cp => cp.metadata.iteration >= minIteration);
  }

  if (maxIteration !== undefined) {
    checkpoints = checkpoints.filter(cp => cp.metadata.iteration <= maxIteration);
  }

  if (since) {
    checkpoints = checkpoints.filter(cp => cp.metadata.timestamp >= since);
  }

  if (until) {
    checkpoints = checkpoints.filter(cp => cp.metadata.timestamp <= until);
  }

  // 分页
  return checkpoints.slice(offset, offset + limit);
}

/**
 * 垃圾回收：删除过期的 Checkpoint
 */
export async function garbageCollect(
  sessionId: string,
  config: CheckpointGCConfig
): Promise<number> {
  const { maxCheckpoints, maxAgeMs, keepReasons = ['manual'] } = config;

  let checkpoints = await getSessionCheckpoints(sessionId);

  // 过滤需要保留的
  let toDelete: Checkpoint[] = [];

  // 保留指定原因 的 checkpoint
  const kept = checkpoints.filter(cp => keepReasons.includes(cp.metadata.reason));
  const toConsider = checkpoints.filter(cp => !keepReasons.includes(cp.metadata.reason));

  // 保留最新的 N 个
  const recentCount = Math.min(maxCheckpoints, toConsider.length);
  const recentToKeep = toConsider.slice(0, recentCount);

  // 需要删除的
  const older = toConsider.slice(recentCount);

  // 按时间过滤
  if (maxAgeMs) {
    const cutoff = Date.now() - maxAgeMs;
    for (const cp of older) {
      if (cp.metadata.timestamp < cutoff) {
        toDelete.push(cp);
      }
    }
  } else {
    toDelete = older;
  }

  // 执行删除
  let deleted = 0;
  for (const cp of toDelete) {
    try {
      const cpPath = path.join(STORAGE_DIR, sessionId, `${cp.id}.json`);
      await fs.unlink(cpPath);
      deleted++;
    } catch {
      // 文件可能已不存在
    }
  }

  return deleted;
}

/**
 * 获取 Checkpoint 链（祖先）
 */
export async function getCheckpointChain(checkpointId: string): Promise<Checkpoint[]> {
  const chain: Checkpoint[] = [];
  let currentId: string | null = checkpointId;

  while (currentId) {
    const checkpoint = await getCheckpoint(currentId);
    if (!checkpoint) break;

    chain.unshift(checkpoint);
    currentId = checkpoint.parentId;
  }

  return chain;
}

/**
 * 格式化 Checkpoint 为可读文本
 */
export function formatCheckpointBrief(checkpoint: Checkpoint): string {
  const { iteration, conversationRound, reason, timestamp } = checkpoint.metadata;
  const msgCount = checkpoint.messages.length;
  const toolCount = checkpoint.completedToolCalls.length;
  const tokens = checkpoint.lastLlmResponse?.usage;

  return `[${checkpoint.id.slice(0, 8)}] iter=${iteration} round=${conversationRound} reason=${reason} msgs=${msgCount} tools=${toolCount} tokens=${(tokens?.inputTokens || 0) + (tokens?.outputTokens || 0)} @${new Date(timestamp).toLocaleTimeString()}`;
}
