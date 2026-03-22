/**
 * 调试相关 API 路由
 *
 * 提供调试面板所需的数据接口：
 * - 时间线
 * - Token 事件
 * - 实时事件流
 */

import { Router } from 'express';
import { getTimelineView, getCheckpoint } from '../../agents/checkpoint/index.js';

const router: Router = Router();

// 模拟的事件存储（实际应该从 AgentLoop 获取）
const sessionEvents: Map<string, Array<{
  id: string;
  type: string;
  timestamp: number;
  iteration?: number;
  duration?: number;
  data: Record<string, unknown>;
}>> = new Map();

const sessionTokens: Map<string, Array<{
  type: 'system' | 'llm_input' | 'llm_output' | 'tool_result';
  tokens: number;
  iteration?: number;
  timestamp: number;
}>> = new Map();

/**
 * 注册会话事件
 */
export function registerSessionEvent(
  sessionId: string,
  event: {
    type: string;
    iteration?: number;
    duration?: number;
    data: Record<string, unknown>;
  }
): void {
  const events = sessionEvents.get(sessionId) || [];
  events.push({
    id: `evt_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    timestamp: Date.now(),
    ...event,
  });

  // 限制事件数量
  if (events.length > 1000) {
    events.splice(0, events.length - 1000);
  }

  sessionEvents.set(sessionId, events);
}

/**
 * 注册 Token 事件
 */
export function registerTokenEvent(
  sessionId: string,
  event: {
    type: 'system' | 'llm_input' | 'llm_output' | 'tool_result';
    tokens: number;
    iteration?: number;
  }
): void {
  const tokens = sessionTokens.get(sessionId) || [];
  tokens.push({
    ...event,
    timestamp: Date.now(),
  });

  // 限制数量
  if (tokens.length > 1000) {
    tokens.splice(0, tokens.length - 1000);
  }

  sessionTokens.set(sessionId, tokens);
}

/**
 * 获取时间线
 */
router.get('/sessions/:sessionId/timeline', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const events = sessionEvents.get(sessionId) || [];

    res.json({
      timeline: events,
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

/**
 * 获取 Token 事件
 */
router.get('/sessions/:sessionId/tokens', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const tokens = sessionTokens.get(sessionId) || [];

    res.json({
      events: tokens,
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

/**
 * 获取单个 Checkpoint 详情
 */
router.get('/checkpoints/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const checkpoint = await getCheckpoint(id);

    if (!checkpoint) {
      return res.status(404).json({ error: 'Checkpoint not found' });
    }

    res.json({
      messages: checkpoint.messages,
      toolCalls: checkpoint.completedToolCalls,
      systemPrompt: checkpoint.systemPrompt,
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

/**
 * 手动创建 Checkpoint（调试用）
 */
router.post('/sessions/:sessionId/checkpoint', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { reason } = req.body;

    // 这里可以调用 CheckpointManager.create
    // 简化处理返回成功
    res.json({
      success: true,
      message: 'Checkpoint created',
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

/**
 * 导出 Trace 数据
 */
router.get('/sessions/:sessionId/export', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { format } = req.query;

    const events = sessionEvents.get(sessionId) || [];
    const tokens = sessionTokens.get(sessionId) || [];
    const timeline = await getTimelineView(sessionId);

    const data = {
      sessionId,
      exportedAt: Date.now(),
      events,
      tokens,
      timeline,
    };

    if (format === 'json') {
      res.json(data);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="trace-${sessionId}.json"`);
      res.json(data);
    }
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

export const createDebugRouter = (): typeof router => router;

// SSE 事件流（可选实现）
export function createDebugEventStream(sessionId: string): ReadableStream {
  const encoder = new TextEncoder();

  return new ReadableStream({
    start(controller) {
      const sendEvent = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      // 定时发送心跳
      const interval = setInterval(() => {
        sendEvent({ type: 'heartbeat', timestamp: Date.now() });
      }, 30000);

      // 监听新事件（这里简化处理，实际应该用事件总线）
      // 可以在 AgentLoop 中 emit 事件时同步到这里

      return () => {
        clearInterval(interval);
      };
    },
  });
}
