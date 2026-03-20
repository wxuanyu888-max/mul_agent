// Team Memory 单元测试 - T-006
import { describe, it, expect, beforeEach } from "vitest";
import path from 'path';
import fs from 'fs';

describe("Team Memory (T-006)", () => {
  // 使用临时目录进行测试
  const testDir = path.join(process.cwd(), 'storage', 'team-memory-test');

  // 动态导入模块前设置环境变量
  beforeEach(() => {
    // 清理测试目录
    if (fs.existsSync(testDir)) {
      const files = fs.readdirSync(testDir);
      for (const file of files) {
        fs.unlinkSync(path.join(testDir, file));
      }
      fs.rmdirSync(testDir);
    }

    // 设置临时存储目录
    process.env.TEAM_MEMORY_DIR = testDir;
  });

  it("should export team memory functions", async () => {
    const {
      getTeamMemoryManager,
      teamMemoryWrite,
      teamMemoryRead,
      teamMemoryList,
      teamMemoryListByAgent,
      teamMemoryDelete,
      teamMemoryCleanup,
      teamMemoryStats,
    } = await import("../../src/memory/team.js");

    expect(typeof getTeamMemoryManager).toBe('function');
    expect(typeof teamMemoryWrite).toBe('function');
    expect(typeof teamMemoryRead).toBe('function');
    expect(typeof teamMemoryList).toBe('function');
    expect(typeof teamMemoryListByAgent).toBe('function');
    expect(typeof teamMemoryDelete).toBe('function');
    expect(typeof teamMemoryCleanup).toBe('function');
    expect(typeof teamMemoryStats).toBe('function');
  });

  it("should write and read memory", async () => {
    // 需要重新导入以使用新的目录
    const { getTeamMemoryManager } = await import("../../src/memory/team.js");
    const manager = getTeamMemoryManager();

    const id = manager.write('agent1', 'test content', ['tag1']);
    expect(id).toBeTruthy();

    const result = manager.read('test');
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].content).toBe('test content');
  });

  it("should filter by agent", async () => {
    const { getTeamMemoryManager } = await import("../../src/memory/team.js");
    const manager = getTeamMemoryManager();

    manager.write('agent1', 'content 1');
    manager.write('agent2', 'content 2');

    const agent1 = manager.listByAgent('agent1');
    expect(agent1.length).toBe(1);
    expect(agent1[0].agent).toBe('agent1');
  });

  it("should support tags", async () => {
    const { getTeamMemoryManager } = await import("../../src/memory/team.js");
    const manager = getTeamMemoryManager();

    manager.write('agent1', 'use try-catch', ['best-practice', 'error-handling']);
    manager.write('agent1', 'use async await', ['best-practice']);

    // 按标签搜索
    const result = manager.read('error-handling');
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].content).toBe('use try-catch');
  });

  it("should delete memory", async () => {
    const { getTeamMemoryManager } = await import("../../src/memory/team.js");
    const manager = getTeamMemoryManager();

    const id = manager.write('agent1', 'temp content');
    const deleted = manager.delete(id);
    expect(deleted).toBe(true);

    const list = manager.list();
    expect(list.find(m => m.id === id)).toBeUndefined();
  });

  it("should cleanup expired memories", async () => {
    const { getTeamMemoryManager } = await import("../../src/memory/team.js");
    const manager = getTeamMemoryManager();

    // 写入一个立即过期的记忆
    manager.write('agent1', 'expired content', [], 1); // 1ms TTL
    manager.write('agent1', 'valid content', [], 86400000); // 1天 TTL

    // 等待过期
    await new Promise(resolve => setTimeout(resolve, 10));

    const count = manager.cleanup();
    expect(count).toBe(1);

    const list = manager.list();
    expect(list.length).toBe(1);
    expect(list[0].content).toBe('valid content');
  });

  it("should get stats", async () => {
    const { getTeamMemoryManager } = await import("../../src/memory/team.js");
    const manager = getTeamMemoryManager();

    manager.write('agent1', 'content 1');
    manager.write('agent2', 'content 2');

    const stats = manager.getStats();
    expect(stats.total).toBe(2);
    expect(stats.byAgent.agent1).toBe(1);
    expect(stats.byAgent.agent2).toBe(1);
  });

  it("should sort by createdAt descending", async () => {
    const { getTeamMemoryManager } = await import("../../src/memory/team.js");
    const manager = getTeamMemoryManager();

    manager.write('agent1', 'first');
    manager.write('agent1', 'second');
    manager.write('agent1', 'third');

    const list = manager.list();
    // newest first
    expect(list[0].content).toBe('third');
  });
});
