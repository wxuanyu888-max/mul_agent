/**
 * TeammateManager - 队友生命周期管理
 *
 * 实现队友智能体管理：
 * 1. 创建持久化的队友智能体
 * 2. 队友拥有独立生命周期 (WORKING -> IDLE -> SHUTDOWN)
 * 3. 队友之间通过 JSONL 邮箱进行通信
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createAgentLoop, type AgentLoop } from './loop.js';
import { createDefaultTools } from '../tools/index.js';
import { isTaskTool, type TaskTool } from '../tools/task.js';
import { readInbox, send as messageSend } from '../message/teammate-bus.js';

export type TeammateStatus = 'WORKING' | 'IDLE' | 'SHUTDOWN';

export interface TeammateConfig {
  /** 队友名称 */
  name: string;
  /** 角色 */
  role: string;
  /** 系统提示词 */
  prompt?: string;
}

export interface TeammateInfo {
  name: string;
  role: string;
  status: TeammateStatus;
  createdAt: string;
  prompt?: string;
}

interface TeammateEntry {
  info: TeammateInfo;
  loop: AgentLoop;
  running: boolean;
}

const STORAGE_DIR = path.join(process.cwd(), 'storage', 'teammates');

/**
 * 确保存储目录存在
 */
function ensureStorageDir(): void {
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }
  if (!fs.existsSync(path.join(STORAGE_DIR, 'inbox'))) {
    fs.mkdirSync(path.join(STORAGE_DIR, 'inbox'), { recursive: true });
  }
}

/**
 * 加载团队配置
 */
function loadConfig(): { teammates: TeammateInfo[] } {
  ensureStorageDir();
  const configPath = path.join(STORAGE_DIR, 'config.json');

  if (!fs.existsSync(configPath)) {
    return { teammates: [] };
  }

  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch {
    return { teammates: [] };
  }
}

/**
 * 保存团队配置
 */
function saveConfig(config: { teammates: TeammateInfo[] }): void {
  ensureStorageDir();
  const configPath = path.join(STORAGE_DIR, 'config.json');
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

/**
 * 队友管理器类
 */
class TeammateManagerClass {
  private teammates: Map<string, TeammateEntry> = new Map();

  /**
   * 创建并启动队友
   */
  async spawn(config: TeammateConfig): Promise<string> {
    const { name, role, prompt } = config;

    // 检查是否已存在
    if (this.teammates.has(name)) {
      return `Teammate "${name}" already exists`;
    }

    ensureStorageDir();

    // 创建 AgentLoop
    const loop = createAgentLoop({
      maxIterations: 50,
      timeoutMs: 600000,
      workspaceDir: process.cwd(),
      promptMode: 'full',
    });

    // 注册工具（过滤掉 task 和 teammate_* 工具）
    const allTools = createDefaultTools() as TaskTool[];
    const filteredTools = allTools.filter(tool => {
      const name = (tool as any).name;
      // 过滤掉 task 工具（避免递归）
      if (isTaskTool(tool)) return false;
      // 过滤掉 teammate_* 工具（队友不能使用）
      if (name && name.startsWith('teammate_')) return false;
      return true;
    });

    for (const tool of filteredTools) {
      const toolAny = tool as any;
      loop.registerTool({
        name: toolAny.name,
        description: toolAny.description,
        parameters: {
          type: 'object',
          properties: (toolAny.parameters?.properties) || {},
          required: (toolAny.parameters?.required) || [],
        },
        execute: async (toolCallId: string, params: Record<string, unknown>) => {
          return await toolAny.execute(toolCallId, params);
        },
      });
    }

    // 保存到配置
    const teammateInfo: TeammateInfo = {
      name,
      role,
      status: 'IDLE',
      createdAt: new Date().toISOString(),
      prompt,
    };

    const configData = loadConfig();
    configData.teammates.push(teammateInfo);
    saveConfig(configData);

    // 添加到内存
    this.teammates.set(name, {
      info: teammateInfo,
      loop,
      running: false,
    });

    // 启动队友（异步运行）
    this.startTeammate(name, prompt);

    return `Teammate "${name}" (${role}) spawned`;
  }

  /**
   * 启动队友循环
   */
  private async startTeammate(name: string, prompt?: string): Promise<void> {
    const entry = this.teammates.get(name);
    if (!entry) return;

    entry.running = true;
    entry.info.status = 'WORKING';

    // 构建初始消息
    const initialMessage = prompt
      ? `You are a ${entry.info.role}. ${prompt}\n\nYou have messages in your inbox. Check your inbox for tasks from teammates.`
      : `You are a ${entry.info.role}. You have messages in your inbox. Check your inbox for tasks from teammates.`;

    // 启动循环（异步）
    (async () => {
      try {
        await entry.loop.run({
          message: initialMessage,
        });
      } catch (error) {
        console.error(`[TeammateManager] Teammate "${name}" error:`, error);
      } finally {
        entry.running = false;
        entry.info.status = 'SHUTDOWN';
      }
    })();
  }

  /**
   * 关闭队友
   */
  shutdown(name: string): string {
    const entry = this.teammates.get(name);

    if (!entry) {
      // 如果内存中没有，尝试从配置加载
      const config = loadConfig();
      const teammate = config.teammates.find(t => t.name === name);

      if (!teammate) {
        return `Teammate "${name}" not found`;
      }

      teammate.status = 'SHUTDOWN';
      saveConfig(config);
      return `Teammate "${name}" shut down`;
    }

    entry.running = false;
    entry.info.status = 'SHUTDOWN';

    // 更新配置
    const config = loadConfig();
    const teammate = config.teammates.find(t => t.name === name);
    if (teammate) {
      teammate.status = 'SHUTDOWN';
      saveConfig(config);
    }

    // 从内存中移除
    this.teammates.delete(name);

    return `Teammate "${name}" shut down`;
  }

  /**
   * 获取队友状态
   */
  getStatus(name: string): TeammateInfo | undefined {
    // 优先从内存获取
    const entry = this.teammates.get(name);
    if (entry) {
      return entry.info;
    }

    // 从配置获取
    const config = loadConfig();
    return config.teammates.find(t => t.name === name);
  }

  /**
   * 列出所有队友
   */
  list(): TeammateInfo[] {
    // 合并内存和配置
    const config = loadConfig();
    const result: TeammateInfo[] = [...config.teammates];

    // 更新内存中的状态
    for (const entry of this.teammates.values()) {
      const idx = result.findIndex(t => t.name === entry.info.name);
      if (idx >= 0) {
        result[idx] = entry.info;
      }
    }

    return result;
  }

  /**
   * 发送消息给队友
   */
  sendMessage(sender: string, to: string, content: string, msgType?: string): string {
    // 检查接收者是否存在
    const config = loadConfig();
    const exists = config.teammates.some(t => t.name === to);

    if (!exists) {
      return `Teammate "${to}" not found`;
    }

    messageSend(sender, to, content, msgType);

    // 如果队友正在运行，注入唤醒消息
    const entry = this.teammates.get(to);
    if (entry && !entry.running) {
      entry.running = true;
      entry.info.status = 'WORKING';
    }

    return `Message sent to ${to}`;
  }

  /**
   * 广播消息给所有队友
   */
  broadcast(sender: string, content: string): string {
    const config = loadConfig();
    let count = 0;

    for (const teammate of config.teammates) {
      if (teammate.name !== sender && teammate.status !== 'SHUTDOWN') {
        messageSend(sender, teammate.name, content);
        count++;
      }
    }

    return `Broadcast to ${count} teammate(s)`;
  }

  /**
   * 检查收件箱
   */
  checkInbox(name: string): string {
    return readInbox(name);
  }
}

// 单例
let teammateManagerInstance: TeammateManagerClass | null = null;

/**
 * 获取 TeammateManager 单例
 */
export function getTeammateManager(): TeammateManagerClass {
  if (!teammateManagerInstance) {
    teammateManagerInstance = new TeammateManagerClass();
  }
  return teammateManagerInstance;
}

// 导出便捷函数
export async function spawnTeammate(config: TeammateConfig): Promise<string> {
  const manager = getTeammateManager();
  return await manager.spawn(config);
}

export function shutdownTeammate(name: string): string {
  const manager = getTeammateManager();
  return manager.shutdown(name);
}

export function listTeammates(): TeammateInfo[] {
  const manager = getTeammateManager();
  return manager.list();
}

export function getTeammateStatus(name: string): TeammateInfo | undefined {
  const manager = getTeammateManager();
  return manager.getStatus(name);
}

export function sendToTeammate(sender: string, to: string, content: string, msgType?: string): string {
  const manager = getTeammateManager();
  return manager.sendMessage(sender, to, content, msgType);
}

export function broadcastToTeammates(sender: string, content: string): string {
  const manager = getTeammateManager();
  return manager.broadcast(sender, content);
}

export function checkTeammateInbox(name: string): string {
  const manager = getTeammateManager();
  return manager.checkInbox(name);
}
