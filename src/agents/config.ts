/**
 * Agent 配置加载模块
 *
 * 从 storage/config.json 加载配置
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 配置文件路径
const CONFIG_PATH = join(__dirname, '../../storage/config.json');

/**
 * Agent 配置
 */
export interface AgentConfig {
  provider: string;
  minimax: {
    api_key: string;
    base_url: string;
  };
  model: {
    default: string;
    fallback?: string[];
  };
  settings: {
    temperature: number;
    max_tokens: number;
  };
}

/**
 * 全局配置缓存
 */
let cachedConfig: AgentConfig | null = null;

/**
 * 加载配置
 */
export function loadConfig(): AgentConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  if (!existsSync(CONFIG_PATH)) {
    throw new Error(`Config file not found: ${CONFIG_PATH}`);
  }

  const content = readFileSync(CONFIG_PATH, 'utf-8');
  cachedConfig = JSON.parse(content) as AgentConfig;

  return cachedConfig;
}

/**
 * 获取 API Key
 */
export function getApiKey(): string {
  const config = loadConfig();
  return config.minimax.api_key;
}

/**
 * 获取基础 URL
 */
export function getBaseUrl(): string {
  const config = loadConfig();
  return config.minimax.base_url;
}

/**
 * 获取默认模型
 */
export function getDefaultModel(): string {
  const config = loadConfig();
  return config.model.default;
}

/**
 * 获取备用模型列表
 */
export function getFallbackModels(): string[] {
  const config = loadConfig();
  return config.model.fallback ?? [];
}

/**
 * 获取温度参数
 */
export function getTemperature(): number {
  const config = loadConfig();
  return config.settings.temperature;
}

/**
 * 获取最大 Token 数
 */
export function getMaxTokens(): number {
  const config = loadConfig();
  return config.settings.max_tokens;
}

/**
 * 获取提供商名称
 */
export function getProvider(): string {
  const config = loadConfig();
  return config.provider;
}

/**
 * 重新加载配置
 */
export function reloadConfig(): AgentConfig {
  cachedConfig = null;
  return loadConfig();
}

/**
 * 验证配置
 */
export function validateConfig(config: AgentConfig): string[] {
  const errors: string[] = [];

  if (!config.provider) {
    errors.push('Missing provider');
  }

  if (!config.minimax?.api_key) {
    errors.push('Missing minimax.api_key');
  }

  if (!config.minimax?.base_url) {
    errors.push('Missing minimax.base_url');
  }

  if (!config.model?.default) {
    errors.push('Missing model.default');
  }

  return errors;
}
