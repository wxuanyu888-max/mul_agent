/**
 * Auth System - Agent Integration
 *
 * 将认证系统集成到 Agent 中
 */

import {
  AuthManager,
  AuthProfileStore,
  createAuthProfileStore,
  type AuthProfile,
  type AuthCredential,
} from './index.js';
import type { AgentLoop } from '../agents/loop.js';

/**
 * 工具权限级别
 */
export type ToolPermission = 'none' | 'read' | 'write' | 'admin';

/**
 * Agent Auth 配置
 */
export interface AgentAuthConfig {
  /** Auth Profile 列表 */
  profiles?: Array<{
    provider: string;
    apiKey?: string;
    refreshToken?: string;
    expiresAt?: number;
    priority?: number;
  }>;
  /** 冷却时间 (ms) */
  cooldownMs?: number;
  /** 最大失败次数 */
  maxFailures?: number;
  /** Profile 变更回调 */
  onProfileChange?: (profile: AuthProfile) => void;
  /** Profile 失败回调 */
  onProfileFailure?: (profile: AuthProfile, error: Error) => void;
}

/**
 * 创建 Agent Auth 管理器
 */
export function createAgentAuthManager(config: AgentAuthConfig): AuthManager {
  const { profiles = [], cooldownMs = 60000, maxFailures = 3 } = config;

  // 创建 profile store
  const store = createAuthProfileStore(profiles);

  // 创建 auth manager
  return new AuthManager(store, {
    defaultCooldownMs: cooldownMs,
    maxFailures,
    onProfileChange: config.onProfileChange || (() => {}),
    onProfileFailure: config.onProfileFailure || (() => {}),
  });
}

/**
 * 工具权限配置
 */
export interface ToolPermissionConfig {
  /** 工具名称 */
  toolName: string;
  /** 需要的权限级别 */
  requiredPermission: ToolPermission;
  /** 需要的认证提供商 */
  requiredProvider?: string;
}

/**
 * 将 Auth 系统集成到 Agent
 *
 * 这个函数会：
 * 1. 创建 Auth Manager
 * 2. 配置工具权限检查
 * 3. 设置 Provider 轮换
 */
export function integrateAuthWithAgent(
  agent: AgentLoop,
  config: AgentAuthConfig
): {
  authManager: AuthManager;
  getCredential: (provider: string) => Promise<AuthCredential | null>;
} {
  // 创建 Auth Manager
  const authManager = createAgentAuthManager(config);

  // 获取凭证的函数
  const getCredential = async (provider: string): Promise<AuthCredential | null> => {
    const result = await authManager.getAuth(provider);
    return result?.credential || null;
  };

  return {
    authManager,
    getCredential,
  };
}

/**
 * 认证中间件
 *
 * 包装 Agent 的工具执行，添加认证检查
 */
export function createAuthMiddleware(
  authManager: AuthManager,
  toolPermissions: Map<string, { requiredProvider?: string }>
) {
  return {
    /**
     * 工具执行前检查
     */
    beforeToolExecute: async (toolName: string): Promise<boolean> => {
      const permission = toolPermissions.get(toolName);

      if (permission?.requiredProvider) {
        const result = await authManager.getAuth(permission.requiredProvider);

        if (!result) {
          console.warn(`[Auth] No available credentials for provider: ${permission.requiredProvider}`);
          return false;
        }
      }

      return true;
    },

    /**
     * 工具执行后标记成功
     */
    afterToolSuccess: async (toolName: string, provider?: string): Promise<void> => {
      if (provider) {
        authManager.markSuccess(provider);
      }
    },

    /**
     * 工具执行后标记失败
     */
    afterToolFailure: async (toolName: string, error: Error, provider?: string): Promise<void> => {
      if (provider) {
        authManager.markFailure(provider, error);
      }
    },

    /**
     * 轮换到下一个 Provider
     */
    rotateProvider: async (provider: string): Promise<boolean> => {
      const result = await authManager.rotate(provider);
      return result !== null;
    },
  };
}

/**
 * 预配置的 Auth Profile
 */
export const DEFAULT_AUTH_PROFILES = [
  {
    provider: 'anthropic',
    priority: 10,
  },
  {
    provider: 'openai',
    priority: 5,
  },
  {
    provider: 'ollama',
    priority: 1,
  },
];

/**
 * 从环境变量加载 Auth Profiles
 */
export function loadAuthProfilesFromEnv(): Array<{
  provider: string;
  apiKey?: string;
  priority: number;
}> {
  const profiles: Array<{ provider: string; apiKey?: string; priority: number }> = [];

  // Anthropic
  if (process.env.ANTHROPIC_API_KEY) {
    profiles.push({
      provider: 'anthropic',
      apiKey: process.env.ANTHROPIC_API_KEY,
      priority: 10,
    });
  }

  // OpenAI
  if (process.env.OPENAI_API_KEY) {
    profiles.push({
      provider: 'openai',
      apiKey: process.env.OPENAI_API_KEY,
      priority: 5,
    });
  }

  // Ollama (不需要 API key)
  profiles.push({
    provider: 'ollama',
    priority: 1,
  });

  return profiles;
}
