/**
 * 测试 Autonomous Agent 自动认领任务功能
 *
 * 用法: pnpm exec tsx scripts/test-autonomous.ts
 */

import { getTaskManager } from '../src/tools/tasks/manager.js';
import { createAutonomousAgent } from '../src/agents/autonomous.js';

async function main() {
  console.log('=== Autonomous Agent 测试 ===\n');

  const taskManager = getTaskManager();

  // 清理已有任务
  console.log('1. 清理已有任务...');
  const existingTasks = taskManager.list();
  for (const task of existingTasks) {
    taskManager.delete(task.id);
  }

  // 创建测试任务（有依赖关系）
  console.log('2. 创建测试任务（带依赖）...');

  // Task 1: 最底层任务，无依赖
  const task1 = taskManager.create({
    subject: 'Research competitor products',
    description: 'Research 3 competitor products and summarize features',
    priority: 1,
  });
  console.log(`   创建 Task #${task1.id}: ${task1.subject}`);

  // Task 2: 依赖 Task 1
  const task2 = taskManager.create({
    subject: 'Write feature comparison document',
    description: 'Write a detailed comparison based on research',
    priority: 2,
    blockedBy: [task1.id],
  });
  console.log(`   创建 Task #${task2.id}: ${task2.subject} (blocked by #${task1.id})`);

  // Task 3: 依赖 Task 2
  const task3 = taskManager.create({
    subject: 'Create product roadmap',
    description: 'Create product roadmap based on comparison',
    priority: 3,
    blockedBy: [task2.id],
  });
  console.log(`   创建 Task #${task3.id}: ${task3.subject} (blocked by #${task2.id})`);

  // Task 4: 独立任务
  const task4 = taskManager.create({
    subject: 'Setup CI/CD pipeline',
    description: 'Setup continuous integration and deployment',
    priority: 2,
  });
  console.log(`   创建 Task #${task4.id}: ${task4.subject} (no dependencies)`);

  // Task 5: 低优先级任务
  const task5 = taskManager.create({
    subject: 'Update documentation',
    description: 'Update API documentation',
    priority: 10,
  });
  console.log(`   创建 Task #${task5.id}: ${task5.subject} (priority: 10)`);

  console.log('\n3. 当前任务状态:');
  const tasks = taskManager.list();
  for (const t of tasks) {
    const deps = t.blockedBy.length > 0 ? ` (blocked by: ${t.blockedBy.join(', ')})` : '';
    console.log(`   #${t.id}: ${t.subject} [${t.status}] priority=${t.priority}${deps}`);
  }

  // 启动 Autonomous Agent
  console.log('\n4. 启动 Autonomous Agent（分配初始任务 #41）...');
  const agent = createAutonomousAgent({
    name: 'WorkerBot',
    role: 'task_executor',
    teamName: 'test-team',
    initialTaskId: task1.id, // 分配初始任务
    maxIterations: 5,
    idleTimeoutMs: 15000, // 15秒后超时
    pollIntervalMs: 2000, // 每2秒轮询一次
  });

  console.log('   Agent 已启动，等待任务...\n');

  // 运行 Agent
  const result = await agent.run();

  console.log('\n=== 测试结果 ===');
  console.log(`   状态: ${result.finalStatus}`);
  console.log(`   迭代次数: ${result.iterations}`);
  console.log(`   成功: ${result.success}`);

  if (result.error) {
    console.log(`   错误: ${result.error}`);
  }

  // 检查最终任务状态
  console.log('\n5. 最终任务状态:');
  const finalTasks = taskManager.list();
  for (const t of finalTasks) {
    const deps = t.blockedBy.length > 0 ? ` (blocked by: ${t.blockedBy.join(', ')})` : '';
    console.log(`   #${t.id}: ${t.subject} [${t.status}] owner=${t.owner || 'none'}${deps}`);
  }
}

main().catch(console.error);
