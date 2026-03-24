/**
 * 测试 Cron 定时任务功能
 */
import { getCronManager } from '../src/tools/system/cron-manager.js';
import { notificationSystem } from '../src/tools/system/notification.js';

async function testCron() {
  console.log('=== 测试 Cron 定时任务 ===\n');

  // 1. 创建测试任务（立即执行）
  const manager = getCronManager();

  // 使用一个今天已经过去的时间，测试 parseCronExpression 逻辑
  const now = new Date();
  const currentMin = now.getMinutes();
  const currentHour = now.getHours();

  // 创建任务：1分钟后执行
  const testJob = manager.createJob(
    '测试提醒',
    `${(currentMin + 1) % 60} ${currentHour} * * *`,
    '这是一条测试提醒消息！'
  );

  console.log('创建测试任务:', testJob.label);
  console.log('任务ID:', testJob.id);
  console.log('计划时间: 每分钟');
  console.log('下次执行:', new Date(testJob.nextRun).toLocaleString());

  // 2. 立即把任务设为到期（模拟）
  testJob.nextRun = Date.now() - 1000;

  console.log('\n手动修改为立即到期...');
  console.log('新下次执行时间:', new Date(testJob.nextRun).toLocaleString());

  // 3. 等待 2 秒，让 cron manager 检测到并执行
  console.log('\n等待 cron manager 检测...\n');
  await new Promise(resolve => setTimeout(resolve, 2000));

  // 4. 检查通知
  const notifications = notificationSystem.getAll(10);
  console.log('=== 通知列表 ===');
  console.log('未读数量:', notificationSystem.getUnreadCount());

  for (const n of notifications) {
    console.log('');
    console.log(`[${n.type}] ${n.title}`);
    console.log(`内容: ${n.content}`);
    console.log(`时间: ${new Date(n.createdAt).toLocaleString()}`);
    console.log(`已读: ${n.read}`);
  }

  // 5. 清理测试任务
  manager.deleteJob(testJob.id);
  console.log('\n测试任务已清理');
}

testCron().catch(console.error);
