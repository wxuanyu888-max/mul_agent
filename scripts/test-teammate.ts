/**
 * 测试 Teammate Agent 功能
 *
 * 用法: pnpm exec tsx scripts/test-teammate.ts
 */

import { getTeammateManager, spawnTeammate, listTeammates, sendToTeammate, broadcastToTeammates, checkTeammateInbox } from '../src/agents/teammate.js';
import { getTaskManager } from '../src/tools/tasks/manager.js';

async function main() {
  console.log('=== Teammate Agent 测试 ===\n');

  const taskManager = getTaskManager();
  const teammateManager = getTeammateManager();

  // 清理已有任务
  console.log('1. 清理已有任务...');
  const existingTasks = taskManager.list();
  for (const task of existingTasks) {
    taskManager.delete(task.id);
  }

  // 清理已有 teammates
  console.log('2. 清理已有 teammates...');
  const existingTeammates = listTeammates();
  for (const tm of existingTeammates) {
    // Shutdown would be here if implemented
  }

  // 创建测试任务
  console.log('3. 创建测试任务...');
  const task1 = taskManager.create({
    subject: 'Design API specification',
    description: 'Design REST API for the new feature',
    priority: 1,
  });
  const task2 = taskManager.create({
    subject: 'Implement API endpoint',
    description: 'Implement the designed API endpoint',
    priority: 2,
  });
  console.log(`   Task #${task1.id}: ${task1.subject}`);
  console.log(`   Task #${task2.id}: ${task2.subject}`);

  // 创建 Teammates
  console.log('\n4. 创建 Teammates...');

  const designerId = await spawnTeammate({
    name: 'designer',
    role: 'API Designer',
    prompt: 'You are an API designer. Design clean and RESTful APIs.',
  });
  console.log(`   创建 Teammate: designer (ID: ${designerId})`);

  const developerId = await spawnTeammate({
    name: 'developer',
    role: 'Backend Developer',
    prompt: 'You are a backend developer. Implement APIs efficiently.',
  });
  console.log(`   创建 Teammate: developer (ID: ${developerId})`);

  // 列出所有 teammates
  console.log('\n5. 列出所有 teammates:');
  const teammates = listTeammates();
  for (const tm of teammates) {
    console.log(`   - ${tm.name}: ${tm.role} (status: ${tm.status})`);
  }

  // 测试发送消息给 designer
  console.log('\n6. 发送消息给 designer...');
  const sendResult = sendToTeammate('user', 'designer', 'Please design an API for user management (create, get, update, delete).');
  console.log(`   发送结果: ${sendResult}`);

  // 检查 designer 收件箱
  console.log('\n7. 检查 designer 收件箱...');
  const designerInbox = checkTeammateInbox('designer');
  console.log(`   收件箱: ${designerInbox}`);

  // 测试 broadcast
  console.log('\n8. 测试 Broadcast...');
  const broadcastResult = broadcastToTeammates('user', 'Team meeting at 3pm today.');
  console.log(`   广播结果: ${broadcastResult}`);

  // 列出所有 teammates 状态
  console.log('\n9. Teammates 状态:');
  const finalTeammates = listTeammates();
  for (const tm of finalTeammates) {
    console.log(`   - ${tm.name}: ${tm.status}`);
  }

  console.log('\n=== 测试完成 ===');
}

main().catch(console.error);
