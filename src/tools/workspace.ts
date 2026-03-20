/**
 * Workspace 文件管理工具
 */

import { jsonResult } from './types.js';

/**
 * 创建工作区文件刷新工具
 * 用于手动刷新文件列表到系统提示词中
 */
export function createWorkspaceRefreshTool() {
  return {
    label: "Workspace Refresh",
    name: "workspace_refresh",
    description: "Refresh the generated files list in system prompt. Use this when you want to ensure the file list is up-to-date.",
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["refresh", "list"],
          description: "Action: refresh (update file list in prompt), list (show current file list)"
        }
      },
      required: ["action"]
    },
    execute: async (_toolCallId: string, params: { action: 'refresh' | 'list' }) => {
      const { action } = params;

      if (action === 'list') {
        // 返回当前文件列表（这个工具主要是给 AgentLoop 调用的）
        return jsonResult({
          message: "Use this tool with action='refresh' to update the file list in system prompt."
        });
      }

      // refresh 动作由 AgentLoop 内部处理，这里只是占位
      return jsonResult({
        success: true,
        message: "File list refreshed. The system prompt now includes the latest generated files."
      });
    }
  };
}
