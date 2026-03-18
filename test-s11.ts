/**
 * s11 自治智能体测试
 *
 * 测试自治功能：
 * 1. 创建任务到看板
 * 2. 启动自治智能体
 * 3. 智能体自动认领任务
 */

import { createTaskCreateTool, createTaskListTool } from './src/tools/tasks/index.js';
import { getTaskManager } from './src/tools/tasks/manager.js';
import { createAutonomousAgent } from './src/agents/autonomous.js';

async function main() {
  console.log('🧪 s11 Autonomous Agents Test\n');
  console.log('='.repeat(60));

  const taskManager = getTaskManager();

  // 1. 创建一些测试任务
  console.log('\n📝 Creating test tasks...');

  taskManager.create({ subject: 'Write unit tests', description: 'Write tests for auth module' });
  taskManager.create({ subject: 'Fix login bug', description: 'Fix the login redirect issue' });
  taskManager.create({ subject: 'Update documentation', description: 'Update API docs' });

  const tasks = taskManager.list();
  console.log(`Created ${tasks.length} tasks:`);
  tasks.forEach(t => console.log(`  - Task #${t.id}: ${t.subject} (${t.status})`));

  // 2. 测试 team_list 工具
  console.log('\n📋 Testing team_list tool...');
  const { createTeamListTool } = await import('./src/agents/autonomous.js');
  const teamListTool = createTeamListTool();
  const teamResult = await teamListTool.execute('test-1', {});
  console.log('Team list:', teamResult);

  // 3. 测试 claim_task 工具
  console.log('\n🎯 Testing claim_task tool...');
  const { createClaimTaskTool } = await import('./src/agents/autonomous.js');
  const claimTool = createClaimTaskTool();

  const claimResult = await claimTool.execute('test-2', { task_id: 1 });
  console.log('Claim result:', claimResult);

  // 4. 列出任务验证认领
  const updatedTasks = taskManager.list();
  console.log('\n📋 Tasks after claim:');
  updatedTasks.forEach(t => console.log(`  - Task #${t.id}: ${t.subject} (${t.status}, owner: ${t.owner || 'none'})`));

  console.log('\n' + '='.repeat(60));
  console.log('✅ s11 Tools test completed!\n');
}

main().catch(console.error);
