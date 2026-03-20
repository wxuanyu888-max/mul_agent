// Load 工具 - 显式加载 skill 或 MCP 到当前对话上下文
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

import { jsonResult, errorResult, type JsonToolResult } from './types.js';
import type { LoadedItem } from '../agents/types.js';

export interface LoadToolParams {
  /** 要加载的类型 */
  type: 'skill' | 'mcp';
  /** skill 名称或 MCP 服务器名称 */
  name: string;
  /** 操作: load 加载, list 列出已加载的 */
  action: 'load' | 'list';
}

/**
 * Load 工具回调接口
 */
export interface LoadToolCallbacks {
  /** 获取当前已加载的项 */
  getLoadedItems: () => Map<string, LoadedItem>;
  /** 更新已加载的项 */
  setLoadedItem: (name: string, item: LoadedItem) => void;
}

/**
 * 创建 Load 工具
 *
 * 允许 Agent 显式加载 skill 或 MCP 到当前对话上下文中
 */
export function createLoadTool(callbacks: LoadToolCallbacks) {
  return {
    label: "Load",
    name: "load",
    description: `加载 skill 或 MCP 到当前对话上下文中。
- 加载后可以在后续对话中直接使用
- 新的 load 会覆盖之前相同名称的加载
- 支持加载: skill (技能), mcp (MCP 服务器)`,
    parameters: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: ['skill', 'mcp'],
          description: "要加载的类型"
        },
        name: {
          type: "string",
          description: "skill 名称或 MCP 服务器名称"
        },
        action: {
          type: "string",
          enum: ['load', 'list'],
          description: "操作: load 加载, list 列出已加载的"
        }
      },
      required: ['type', 'action']
    },
    execute: async (
      _toolCallId: string,
      params?: LoadToolParams,
    ) => {
      try {
        const { type, name, action } = params || {};

        if (!type || !action) {
          return errorResult('type and action are required parameters');
        }

        // list 模式：返回已加载的列表
        if (action === 'list') {
          const items = Array.from(callbacks.getLoadedItems().values()).map(item => ({
            name: item.name,
            type: item.type,
            loadedAt: new Date(item.loadedAt).toISOString(),
            lastUsedAt: new Date(item.lastUsedAt).toISOString()
          }));
          return jsonResult({ loaded: items });
        }

        // load 模式
        if (!name) {
          return errorResult('name is required for load action');
        }

        if (type === 'skill') {
          return loadSkill(name, callbacks);
        } else if (type === 'mcp') {
          return loadMcp(name, callbacks);
        } else {
          return errorResult(`Invalid type: ${type}`);
        }
      } catch (error) {
        return errorResult(`Load failed: ${error}`);
      }
    },
  };
}

/**
 * 加载 skill
 */
function loadSkill(name: string, callbacks: LoadToolCallbacks): JsonToolResult {
  const skillsDir = join(process.cwd(), 'skills');
  const skillPath = join(skillsDir, name, 'SKILL.md');

  if (!existsSync(skillPath)) {
    return errorResult(`Skill not found: ${name} at ${skillPath}`);
  }

  try {
    const content = readFileSync(skillPath, 'utf-8');

    const loadedItem: LoadedItem = {
      type: 'skill',
      name,
      content,
      loadedAt: Date.now(),
      lastUsedAt: Date.now()
    };

    callbacks.setLoadedItem(name, loadedItem);

    return jsonResult({
      success: true,
      name,
      type: 'skill',
      message: `已加载 skill: ${name}`
    });
  } catch (error) {
    return errorResult(`Failed to read skill: ${error}`);
  }
}

/**
 * 加载 MCP
 */
function loadMcp(name: string, callbacks: LoadToolCallbacks): JsonToolResult {
  // MCP 加载逻辑 - 读取 MCP 配置文件
  const mcpConfigPath = join(process.cwd(), '.mcp.json');

  if (!existsSync(mcpConfigPath)) {
    return errorResult('MCP config file not found: .mcp.json');
  }

  try {
    const mcpConfig = JSON.parse(readFileSync(mcpConfigPath, 'utf-8'));
    const mcpServers = mcpConfig.mcpServers || {};

    if (!mcpServers[name]) {
      return errorResult(`MCP server not found: ${name}`);
    }

    const mcpConfigStr = JSON.stringify(mcpServers[name], null, 2);

    const loadedItem: LoadedItem = {
      type: 'mcp',
      name,
      content: mcpConfigStr,
      loadedAt: Date.now(),
      lastUsedAt: Date.now()
    };

    callbacks.setLoadedItem(name, loadedItem);

    return jsonResult({
      success: true,
      name,
      type: 'mcp',
      message: `已加载 MCP: ${name}`
    });
  } catch (error) {
    return errorResult(`Failed to load MCP: ${error}`);
  }
}
