import { useCallback, useEffect, useRef } from 'react';
import { useChatStore } from '../stores';
import type { Message } from '../types';

export function useChat(selectedAgent?: string) {
  const {
    messages,
    currentSessionId,
    isLoading,
    executionSteps,
    showExecutionSteps,
    setMessages,
    addMessage,
    clearMessages,
    setCurrentSessionId,
    setLoading,
    setExecutionSteps,
    addExecutionStep,
    updateExecutionStep,
    clearExecutionSteps,
    toggleExecutionSteps,
  } = useChatStore();

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Load sessions and messages
  const loadSessions = useCallback(async () => {
    const { chatApi } = await import('../services/api');
    const res = await chatApi.getSessions(selectedAgent);
    const sessions = res.data.sessions || [];
    if (sessions.length > 0 && !currentSessionId) {
      loadSessionMessages(sessions[0].session_id);
    }
  }, [selectedAgent, currentSessionId]);

  const loadSessionMessages = useCallback(async (sessionId: string) => {
    const { chatApi } = await import('../services/api');
    try {
      const res = await chatApi.getSessionMessages(sessionId, selectedAgent);
      const msgs = res.data.messages || [];
      setMessages(
        msgs.map((msg) => ({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content,
          timestamp: msg.timestamp ? new Date(msg.timestamp).getTime() : Date.now(),
        }))
      );
      setCurrentSessionId(sessionId);
    } catch (err) {
      console.error('Failed to load session messages:', err);
    }
  }, [selectedAgent, setMessages, setCurrentSessionId]);

  const handleNewChat = useCallback(() => {
    clearMessages();
    setCurrentSessionId('');
    clearExecutionSteps();
  }, [clearMessages, setCurrentSessionId, clearExecutionSteps]);

  // SSE streaming for sending messages
  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: content.trim(),
      timestamp: Date.now(),
    };

    addMessage(userMessage);
    setLoading(true);
    clearExecutionSteps();

    try {
      const response = await fetch('/api/v1/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          agent_id: selectedAgent || undefined,
          conversation_id: currentSessionId || undefined,
        }),
      });

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let finalResponse = '';
      let conversationId = currentSessionId;

      // Process SSE events directly in the loop to handle closure correctly
      const processEvent = (event: Record<string, unknown>) => {
        switch (event.type) {
          case 'status':
            addExecutionStep({
              id: `status-${Date.now()}`,
              type: 'status',
              status: 'running',
              title: event.message as string,
              timestamp: Date.now(),
            });
            break;

          case 'agent_state':
            const state = event.state as Record<string, unknown>;
            if (state?.status === 'planning' && state?.current_action) {
              addExecutionStep({
                id: `planning-${Date.now()}`,
                type: 'action',
                status: 'completed',
                title: '🧠 LLM 决策',
                description: state.current_action as string,
                timestamp: Date.now(),
                expanded: true,
              });
            }
            if (state?.route && state.route !== 'uncertain' && state?.status === 'executing') {
              addExecutionStep({
                id: `tool-${Date.now()}`,
                type: 'tool',
                status: 'running',
                title: `执行 ${state.route}`,
                details: state.details,
                timestamp: Date.now(),
              });
            }
            break;

          case 'response':
            finalResponse = event.response as string;
            conversationId = event.conversation_id as string;
            break;

          case 'error':
            addExecutionStep({
              id: `error-${Date.now()}`,
              type: 'error',
              status: 'error',
              title: '发生错误',
              description: event.error as string,
              timestamp: Date.now(),
            });
            break;

          case 'complete':
            break;
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.slice(6));
              processEvent(event);
            } catch (e) {
              console.error('Failed to parse SSE event:', e);
            }
          }
        }
      }

      if (finalResponse) {
        addMessage({
          role: 'assistant',
          content: finalResponse,
          timestamp: Date.now(),
        });
      }

      if (conversationId && conversationId !== currentSessionId) {
        setCurrentSessionId(conversationId);
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      addMessage({
        role: 'assistant',
        content: `Error: ${err instanceof Error ? err.message : 'Failed to get response from agent'}`,
        timestamp: Date.now(),
      });
    } finally {
      setLoading(false);
    }
  }, [selectedAgent, currentSessionId, isLoading, addMessage, setLoading, clearExecutionSteps, setCurrentSessionId, addExecutionStep]);

  return {
    messages,
    currentSessionId,
    isLoading,
    executionSteps,
    showExecutionSteps,
    messagesEndRef,
    loadSessions,
    loadSessionMessages,
    handleNewChat,
    sendMessage,
    clearMessages,
    toggleExecutionSteps,
  };
}
