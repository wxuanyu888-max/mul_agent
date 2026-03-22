/**
 * Human-in-the-Loop 管理器
 *
 * 管理人工干预请求的生命周期
 */

import type {
  HumanIntervention,
  InterruptConfig,
  InterventionContext,
  InterventionResponse,
  InterventionStats,
  InterventionState,
} from './types.js';

/**
 * 干预回调类型
 */
type InterventionCallback = (intervention: HumanIntervention) => void;

/**
 * Human-in-the-Loop 管理器
 */
export class HumanInLoopManager {
  private interventions: Map<string, HumanIntervention> = new Map();
  private pendingCallbacks: Map<string, (response: InterventionResponse) => void> = new Map();
  private interruptConfigs: Map<string, InterruptConfig> = new Map();
  private listeners: InterventionCallback[] = [];
  private stats = {
    approved: 0,
    rejected: 0,
    timeout: 0,
    responseTimes: [] as number[],
  };

  constructor() {
    // 初始化默认中断配置
    this.initDefaultConfigs();
  }

  /**
   * 初始化默认配置
   */
  private initDefaultConfigs(): void {
    // 默认：在执行危险工具时请求确认
    this.registerInterrupt({
      id: 'default_dangerous_tool',
      trigger: 'tool',
      match: '(rm|del|mkfs|shutdown|reboot|format)',
      type: 'confirm',
      message: '确认执行危险操作？',
      enabled: true,
      priority: 100,
    });
  }

  /**
   * 注册中断配置
   */
  registerInterrupt(config: InterruptConfig): void {
    this.interruptConfigs.set(config.id, config);
  }

  /**
   * 取消注册中断配置
   */
  unregisterInterrupt(id: string): void {
    this.interruptConfigs.delete(id);
  }

  /**
   * 获取所有中断配置
   */
  getInterruptConfigs(): InterruptConfig[] {
    return Array.from(this.interruptConfigs.values())
      .sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }

  /**
   * 启用/禁用中断配置
   */
  toggleInterrupt(id: string, enabled: boolean): void {
    const config = this.interruptConfigs.get(id);
    if (config) {
      config.enabled = enabled;
    }
  }

  /**
   * 请求人工干预
   */
  async requestIntervention(
    context: InterventionContext,
    configOverride?: Partial<InterruptConfig>
  ): Promise<HumanIntervention> {
    // 查找匹配的中断配置
    const matchedConfig = this.findMatchingConfig(context);

    // 如果没有匹配的默认配置，且没有覆盖配置，则不中断
    if (!matchedConfig && !configOverride) {
      // 返回一个自动批准的干预
      return {
        id: `auto_${Date.now()}`,
        sessionId: context.sessionId,
        agentId: context.agentId,
        type: 'confirm',
        message: '',
        state: 'approved',
        createdAt: Date.now(),
      };
    }

    const config = { ...matchedConfig, ...configOverride } as InterruptConfig;

    // 创建干预请求
    const intervention: HumanIntervention = {
      id: `interrupt_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      sessionId: context.sessionId,
      agentId: context.agentId,
      type: config.type,
      message: this.formatMessage(config.message, context),
      options: config.options,
      defaultValue: config.defaultValue,
      state: 'pending',
      createdAt: Date.now(),
      timeoutAt: config.timeoutMs ? Date.now() + config.timeoutMs : undefined,
      metadata: {
        trigger: config.trigger,
        match: config.match,
        iteration: context.iteration,
        ...context.additionalInfo,
      },
    };

    this.interventions.set(intervention.id, intervention);
    this.notifyListeners(intervention);

    // 如果有回调，立即返回（同步模式）
    const callback = this.pendingCallbacks.get(intervention.id);
    if (callback) {
      const response: InterventionResponse = {
        interventionId: intervention.id,
        action: 'approve',
      };
      callback(response);
      this.pendingCallbacks.delete(intervention.id);
      return intervention;
    }

    // 否则返回待处理的干预
    return intervention;
  }

  /**
   * 响应干预请求
   */
  respond(response: InterventionResponse): void {
    const intervention = this.interventions.get(response.interventionId);
    if (!intervention) {
      console.warn(`[HumanInLoop] Intervention not found: ${response.interventionId}`);
      return;
    }

    // 更新干预状态
    intervention.state = this.actionToState(response.action);
    intervention.response = response.response;
    intervention.respondedAt = Date.now();

    // 记录统计
    const responseTime = intervention.respondedAt - intervention.createdAt;
    this.stats.responseTimes.push(responseTime);

    switch (response.action) {
      case 'approve':
        this.stats.approved++;
        break;
      case 'reject':
      case 'timeout':
        this.stats.rejected++;
        if (response.action === 'timeout') {
          this.stats.timeout++;
        }
        break;
    }

    // 触发回调
    const callback = this.pendingCallbacks.get(response.interventionId);
    if (callback) {
      callback(response);
      this.pendingCallbacks.delete(response.interventionId);
    }

    this.notifyListeners(intervention);
  }

  /**
   * 设置干预回调（用于同步模式）
   */
  setCallback(interventionId: string, callback: (response: InterventionResponse) => void): void {
    this.pendingCallbacks.set(interventionId, callback);
  }

  /**
   * 获取待处理的干预列表
   */
  getPending(sessionId?: string): HumanIntervention[] {
    return Array.from(this.interventions.values())
      .filter(i => i.state === 'pending')
      .filter(i => !sessionId || i.sessionId === sessionId);
  }

  /**
   * 获取干预历史
   */
  getHistory(sessionId?: string, limit = 50): HumanIntervention[] {
    return Array.from(this.interventions.values())
      .filter(i => !sessionId || i.sessionId === sessionId)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);
  }

  /**
   * 获取单个干预详情
   */
  getIntervention(id: string): HumanIntervention | undefined {
    return this.interventions.get(id);
  }

  /**
   * 获取统计信息
   */
  getStats(): InterventionStats {
    const responseTimes = this.stats.responseTimes;
    const avgResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : 0;

    return {
      total: this.interventions.size,
      pending: this.getPending().length,
      approved: this.stats.approved,
      rejected: this.stats.rejected,
      timeout: this.stats.timeout,
      avgResponseTimeMs: avgResponseTime,
    };
  }

  /**
   * 订阅干预事件
   */
  subscribe(listener: InterventionCallback): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /**
   * 清理超时的干预
   */
  cleanupTimeouts(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [id, intervention] of this.interventions) {
      if (intervention.state === 'pending' && intervention.timeoutAt && intervention.timeoutAt < now) {
        intervention.state = 'timeout';
        intervention.respondedAt = now;
        this.stats.timeout++;
        this.stats.rejected++;

        // 触发回调
        const callback = this.pendingCallbacks.get(id);
        if (callback) {
          callback({
            interventionId: id,
            action: 'timeout',
          });
          this.pendingCallbacks.delete(id);
        }

        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * 清空历史记录
   */
  clearHistory(): void {
    // 只保留待处理的干预
    for (const [id, intervention] of this.interventions) {
      if (intervention.state !== 'pending') {
        this.interventions.delete(id);
      }
    }
  }

  /**
   * 查找匹配的中断配置
   */
  private findMatchingConfig(context: InterventionContext): InterruptConfig | null {
    for (const config of this.getInterruptConfigs()) {
      if (!config.enabled) continue;
      if (config.trigger !== context.phase && config.trigger !== 'custom') continue;

      // 检查匹配条件
      if (config.match) {
        let target = '';
        if (context.phase === 'tool') {
          target = context.toolName || '';
        } else if (context.phase === 'llm') {
          target = context.model || '';
        }

        if (typeof config.match === 'string') {
          if (!target.includes(config.match)) continue;
        } else if (config.match instanceof RegExp) {
          if (!config.match.test(target)) continue;
        }
      }

      return config;
    }

    return null;
  }

  /**
   * 格式化消息
   */
  private formatMessage(template: string, context: InterventionContext): string {
    return template
      .replace(/\{iteration\}/g, String(context.iteration))
      .replace(/\{toolName\}/g, context.toolName || '')
      .replace(/\{model\}/g, context.model || '')
      .replace(/\{sessionId\}/g, context.sessionId);
  }

  /**
   * 通知监听器
   */
  private notifyListeners(intervention: HumanIntervention): void {
    for (const listener of this.listeners) {
      try {
        listener(intervention);
      } catch (error) {
        console.error('[HumanInLoop] Listener error:', error);
      }
    }
  }

  /**
   * 动作转状态
   */
  private actionToState(action: InterventionResponse['action']): InterventionState {
    switch (action) {
      case 'approve':
        return 'approved';
      case 'reject':
        return 'rejected';
      case 'modify':
        return 'modified';
      case 'timeout':
        return 'timeout';
      default:
        return 'pending';
    }
  }
}

// 全局单例
let globalManager: HumanInLoopManager | null = null;

/**
 * 获取全局 Human-in-the-Loop 管理器
 */
export function getHumanInLoopManager(): HumanInLoopManager {
  if (!globalManager) {
    globalManager = new HumanInLoopManager();
  }
  return globalManager;
}

/**
 * 设置全局管理器（用于测试）
 */
export function setHumanInLoopManager(manager: HumanInLoopManager): void {
  globalManager = manager;
}
