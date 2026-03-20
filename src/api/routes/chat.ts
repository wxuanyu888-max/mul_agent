/**
 * Chat API Routes
 */

import { Router, Request, Response } from 'express';
import { messageQueue } from '../../message/index.js';
import { chatWithContext } from '../../agents/llm.js';
import { AgentLoop } from '../../agents/loop.js';
import type { Message, SessionMessage } from '../../agents/types.js';
import { querySessions, getSession, deleteSession } from '../../session/manager.js';
import fs from 'node:fs/promises';
import path from 'node:path';

// Session 存储目录
const SESSIONS_DIR = path.join(process.cwd(), 'storage', 'sessions');

// 确保目录存在
async function ensureDir(dir: string) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch {
    // 目录已存在，忽略错误
  }
}
ensureDir(SESSIONS_DIR);

// In-memory storage for chat sessions (统一消息格式，包含完整 tool_use/tool_result)
const messagesStore: Record<string, SessionMessage[]> = {};

/**
 * 持久化 session 到文件
 */
async function saveSession(sessionId: string, messages: SessionMessage[]) {
  const sessionFile = path.join(SESSIONS_DIR, `${sessionId}.json`);
  await fs.writeFile(sessionFile, JSON.stringify({
    sessionId,
    updatedAt: Date.now(),
    messages
  }, null, 2));
}

/**
 * 从文件加载 session
 */
async function loadSession(sessionId: string): Promise<SessionMessage[]> {
  const sessionFile = path.join(SESSIONS_DIR, `${sessionId}.json`);
  try {
    const content = await fs.readFile(sessionFile, 'utf-8');
    const data = JSON.parse(content);
    return data.messages || [];
  } catch {
    return [];
  }
}

export function createChatRouter(): Router {
  const router = Router();

  // POST /chat - 加入消息队列
  router.post('/chat', (req: Request, res: Response) => {
    const { message, agent_id, conversation_id } = req.body;

    if (!message) {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    const session_id = conversation_id || `session_${Date.now()}`;

    // 加入消息队列（不阻塞等待处理）
    const result = messageQueue.enqueue(session_id, message);

    res.json({
      status: 'queued',
      message_id: result.message_id,
      conversation_id: session_id,
      queue_status: result.queue_status
    });
  });

  // POST /chat/process - 触发处理下一条消息
  router.post('/chat/process', (req: Request, res: Response) => {
    const { conversation_id } = req.body;

    // 获取下一条待处理消息
    const msg = messageQueue.dequeue(conversation_id || '');

    if (!msg) {
      res.json({
        status: 'idle',
        message: 'No pending messages'
      });
      return;
    }

    // 模拟处理（实际的 agent 处理在 /chat/stream 端点）
    const responseText = `处理中: ${msg.content}`;

    // 记录消息
    if (!messagesStore[msg.sessionKey]) {
      messagesStore[msg.sessionKey] = [];
    }
    messagesStore[msg.sessionKey].push({ role: 'user', content: msg.content });
    messagesStore[msg.sessionKey].push({ role: 'assistant', content: responseText });

    // 标记完成
    messageQueue.complete(msg.id);

    res.json({
      status: 'processing',
      message_id: msg.id,
      response: responseText,
      queue_status: messageQueue.getStatus(msg.sessionKey)
    });
  });

  // GET /chat/queue/:session_id - 获取队列状态
  router.get('/chat/queue/:session_id', (req: Request, res: Response) => {
    const session_id = req.params.session_id as string;
    res.json(messageQueue.getStatus(session_id));
  });

  // GET /chat/queue - 获取所有队列状态
  router.get('/chat/queue', (req: Request, res: Response) => {
    res.json(messageQueue.getAllStatus());
  });

  // DELETE /chat/queue/:session_id - 清空队列
  router.delete('/chat/queue/:session_id', (req: Request, res: Response) => {
    const session_id = req.params.session_id as string;
    messageQueue.clear(session_id);
    res.json({ status: 'success', message: 'Queue cleared' });
  });

  // GET /chat/history
  router.get('/chat/history', (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 20;
    const session_id = req.query.session_id as string;

    let messages: Array<{ role: string; content: string }> = [];

    if (session_id && messagesStore[session_id]) {
      messages = messagesStore[session_id].slice(-limit);
    } else {
      // Return all messages from all sessions
      for (const msgs of Object.values(messagesStore)) {
        messages.push(...msgs);
      }
      messages = messages.slice(-limit);
    }

    // 同时返回队列状态
    const queueStatus = session_id
      ? messageQueue.getStatus(session_id)
      : undefined;

    res.json({
      history: messages,
      total: messages.length,
      queue_status: queueStatus,
      sessions: []
    });
  });

  // GET /chat/sessions
  router.get('/chat/sessions', async (req: Request, res: Response) => {
    const agent_id = req.query.agent_id as string;
    const limit = parseInt(req.query.limit as string) || 20;

    try {
      // 使用真正的 session 管理器查询
      const sessions = await querySessions({
        parentId: agent_id,
        limit,
      });

      // 转换为前端需要的格式
      const sessionList = sessions.map((s) => ({
        session_id: s.id,
        agent_id: s.parentId || s.config?.runtime || 'default',
        created_at: new Date(s.createdAt).toISOString(),
        last_message_at: new Date(s.updatedAt).toISOString(),
        message_count: 0, // 需要另外查询
        preview: s.label || '',
        first_message: s.label || '',
      }));

      res.json({ sessions: sessionList });
    } catch (error) {
      console.error('Failed to query sessions:', error);
      res.json({ sessions: [] });
    }
  });

  // GET /chat/session/:session_id
  router.get('/chat/session/:session_id', async (req: Request, res: Response) => {
    const session_id = req.params.session_id as string;
    const limit = parseInt(req.query.limit as string) || 100;

    try {
      // 使用真正的 session 管理器获取消息
      const session = await getSession(session_id);

      if (!session) {
        res.json({
          session_id,
          messages: [],
          total: 0,
        });
        return;
      }

      // 从 session 中获取消息
      const messages = (session.messages || []).slice(-limit);

      res.json({
        session_id,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
          timestamp: new Date(m.timestamp || Date.now()).toISOString(),
        })),
        total: session.messages?.length || 0,
      });
    } catch (error) {
      console.error('Failed to get session:', error);
      res.json({
        session_id,
        messages: [],
        total: 0,
      });
    }
  });

  // DELETE /chat/session/:session_id
  router.delete('/chat/session/:session_id', async (req: Request, res: Response) => {
    const session_id = req.params.session_id as string;

    try {
      // 使用真正的 session 管理器删除
      await deleteSession(session_id);
      // 同时清空队列
      messageQueue.clear(session_id);
      res.json({ status: 'success', message: 'Session deleted' });
    } catch (error) {
      console.error('Failed to delete session:', error);
      res.json({ status: 'error', message: 'Failed to delete session' });
    }
  });

  // SSE Stream endpoint for real-time chat
  router.post('/chat/stream', async (req: Request, res: Response) => {
    const { message, agent_id, conversation_id } = req.body;

    if (!message) {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    const session_id = conversation_id || `session_${Date.now()}`;

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Initialize message store for session - 优先从文件加载
    if (!messagesStore[session_id]) {
      messagesStore[session_id] = await loadSession(session_id);
    }

    // Send status: start
    res.write(`data: ${JSON.stringify({ type: 'status', message: '开始处理...' })}\n\n`);

    try {
      // Get conversation history (统一格式，包含完整 tool_use/tool_result)
      const history = messagesStore[session_id] || [];

      // 转换历史消息为 Message 格式（保持完整结构）
      const historyMessages: Message[] = history.map((msg, idx) => ({
        id: `msg_${idx}_${Date.now()}`,
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content,
        toolCalls: msg.tool_calls as any,
        timestamp: msg.timestamp ?? Date.now(),
      }));

      // 创建 AgentLoop 实例
      const agent = new AgentLoop({
        maxIterations: 50,
        workspaceDir: process.cwd(),
        sessionId: session_id,
        promptMode: 'full',

        // 回调：工具确认（自动确认执行）
        onToolConfirm: async (tool) => {
          return true;
        },

        // 回调：工具执行（工具结果已包含在消息历史中，无需单独发给前端）

        // 回调：LLM 调用
        onLlmCall: (messages, systemPrompt) => {
          // 可用于调试
        },

        // 回调：LLM 响应
        onLlmResponse: (response) => {
          res.write(`data: ${JSON.stringify({ type: 'status', message: 'LLM 响应中...' })}\n\n`);
        },
      });

      // 注册所有默认工具
      agent.registerDefaultTools();

      // Send status: thinking
      res.write(`data: ${JSON.stringify({ type: 'status', message: 'Agent 思考中...' })}\n\n`);

      // 使用 AgentLoop 处理消息
      const startTime = Date.now();
      const result = await agent.run({
        message,
        history: historyMessages,
      });

      const elapsed = Date.now() - startTime;

      // Send status: completed
      res.write(`data: ${JSON.stringify({ type: 'status', message: `处理完成 (${elapsed}ms), 迭代: ${result.iterations}, 工具调用: ${result.toolCalls}` })}\n\n`);

      // Send the response
      res.write(`data: ${JSON.stringify({ type: 'response', response: result.content, conversation_id: session_id })}\n\n`);

      // Send complete
      res.write(`data: ${JSON.stringify({ type: 'complete' })}\n\n`);

      // Store full messages in memory (包含完整的 tool_use/tool_result)
      // result.messages 已经包含完整的历史，直接替换
      if (result.messages && result.messages.length > 0) {
        messagesStore[session_id] = result.messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
          tool_calls: msg.tool_calls,
          tool_call_id: msg.tool_call_id,
          name: msg.name,
          timestamp: Date.now(),
        }));
      } else {
        // 兼容：如果没有 result.messages，回退到旧逻辑
        messagesStore[session_id].push({ role: 'user', content: message, timestamp: Date.now() });
        messagesStore[session_id].push({ role: 'assistant', content: result.content, timestamp: Date.now() });
      }

      // 持久化 session 到文件
      await saveSession(session_id, messagesStore[session_id]);

    } catch (error) {
      console.error('Chat stream error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.write(`data: ${JSON.stringify({ type: 'error', error: errorMessage })}\n\n`);
    } finally {
      res.end();
    }
  });

  return router;
}
