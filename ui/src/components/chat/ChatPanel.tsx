import { useState, useEffect, useRef } from 'react';
import { Send, User, Bot, Loader2, RefreshCw, Trash2, Menu, MessageSquare, ChevronRight, ChevronDown, CheckCircle, AlertCircle, Play, Brain, Activity, Clock, Mic, MicOff, Volume2, Square } from 'lucide-react';
import { chatApi, infoApi } from '../../services/api';
import { synthesizeSpeech, playAudio, stopAudio } from '../../services/endpoints/voice';

// Web Speech API 类型声明
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}
import { AgentStatePanel } from './AgentStatePanel';
import { CommandAutocomplete, CommandSuggestion } from './CommandAutocomplete';
import { SessionList } from './SessionList';
import { Message, Agent } from '../../types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Execution step types for displaying agent actions
interface ExecutionStep {
  id: string;
  type: 'status' | 'action' | 'tool' | 'result' | 'error';
  status: 'pending' | 'running' | 'completed' | 'error';
  title: string;
  description?: string;
  details?: any;
  timestamp: number;
  expanded?: boolean;
  duration?: number; // 用时（毫秒）
}

// Available commands (should match backend commands)
const AVAILABLE_COMMANDS: CommandSuggestion[] = [
  {
    command_id: 'help',
    command_name: 'help',
    command_description: 'Show help information',
    command_aliases: ['h', '?', '援助'],
  },
  {
    command_id: 'status',
    command_name: 'status',
    command_description: 'Show agent status',
    command_aliases: ['st', '状态'],
  },
  {
    command_id: 'list',
    command_name: 'list',
    command_description: 'List items (skills, hooks, commands, etc.)',
    command_aliases: ['ls', '列表'],
  },
  {
    command_id: 'skill',
    command_name: 'skill',
    command_description: 'Manage skills',
    command_aliases: ['sk', '技能'],
  },
  {
    command_id: 'hook',
    command_name: 'hook',
    command_description: 'Manage hooks',
    command_aliases: ['hk', '钩子'],
  },
  {
    command_id: 'memory',
    command_name: 'memory',
    command_description: 'Manage memory',
    command_aliases: ['mem', '记忆'],
  },
  {
    command_id: 'bash',
    command_name: 'bash',
    command_description: 'Execute shell commands',
    command_aliases: ['$', 'sh', '执行'],
  },
];

// Markdown rendering styles
const markdownComponents = {
  p: ({ node, ...props }: any) => <p className="mb-2 last:mb-0" {...props} />,
  code: ({ node, inline, className, children, ...props }: any) => {
    if (inline) {
      return (
        <code className="px-1.5 py-0.5 bg-gray-100 rounded text-sm font-mono text-red-600" {...props}>
          {children}
        </code>
      );
    }
    return (
      <code className={className} {...props}>
        {children}
      </code>
    );
  },
  pre: ({ node, ...props }: any) => (
    <pre className="my-2 p-3 bg-gray-100 rounded-lg overflow-x-auto text-sm font-mono" {...props} />
  ),
  ul: ({ node, ...props }: any) => <ul className="list-disc list-inside mb-2 space-y-1" {...props} />,
  ol: ({ node, ...props }: any) => <ol className="list-decimal list-inside mb-2 space-y-1" {...props} />,
  li: ({ node, ...props }: any) => <li className="ml-2" {...props} />,
  h1: ({ node, ...props }: any) => <h1 className="text-lg font-bold mt-3 mb-2" {...props} />,
  h2: ({ node, ...props }: any) => <h2 className="text-base font-bold mt-3 mb-2" {...props} />,
  h3: ({ node, ...props }: any) => <h3 className="text-sm font-bold mt-2 mb-1" {...props} />,
  blockquote: ({ node, ...props }: any) => (
    <blockquote className="border-l-4 border-gray-300 pl-4 italic my-2" {...props} />
  ),
  table: ({ node, ...props }: any) => (
    <div className="overflow-x-auto my-2">
      <table className="min-w-full border border-gray-200" {...props} />
    </div>
  ),
  th: ({ node, ...props }: any) => (
    <th className="border border-gray-200 px-3 py-2 bg-gray-50 font-semibold" {...props} />
  ),
  td: ({ node, ...props }: any) => (
    <td className="border border-gray-200 px-3 py-2" {...props} />
  ),
};

// Execution step status configuration
const stepStatusConfig: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: '等待中', color: 'text-gray-400', icon: Clock },
  running: { label: '执行中', color: 'text-blue-500', icon: Play },
  completed: { label: '已完成', color: 'text-green-500', icon: CheckCircle },
  error: { label: '错误', color: 'text-red-500', icon: AlertCircle },
};

// Execution step type configuration
const stepTypeConfig: Record<string, { color: string; bgColor: string }> = {
  status: { color: 'text-gray-600', bgColor: 'bg-gray-50' },
  action: { color: 'text-purple-600', bgColor: 'bg-purple-50' },
  tool: { color: 'text-blue-600', bgColor: 'bg-blue-50' },
  result: { color: 'text-green-600', bgColor: 'bg-green-50' },
  error: { color: 'text-red-600', bgColor: 'bg-red-50' },
};

// ExecutionStepItem component
function ExecutionStepItem({ step }: { step: ExecutionStep }) {
  const [expanded, setExpanded] = useState(false);
  const statusConfig = stepStatusConfig[step.status] || stepStatusConfig.pending;
  const typeConfig = stepTypeConfig[step.type] || stepTypeConfig.status;
  const StatusIcon = statusConfig.icon;

  // Auto-expand planning steps
  useEffect(() => {
    if (step.type === 'action' || step.title.includes('LLM') || step.title.includes('决策')) {
      setExpanded(true);
    }
  }, [step.type, step.title]);

  const hasContent = step.details || step.description;

  return (
    <div className={`rounded-lg border ${expanded ? 'border-purple-200 bg-purple-50/50' : 'border-gray-100 bg-white'}`}>
      <button
        onClick={() => hasContent && setExpanded(!expanded)}
        className={`w-full flex items-start gap-3 px-3 py-2.5 text-left ${!hasContent ? 'cursor-default' : 'cursor-pointer hover:bg-gray-50'}`}
      >
        {/* Status Icon */}
        <div className={`flex-shrink-0 ${statusConfig.color} mt-0.5`}>
          {step.status === 'running' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <StatusIcon className="w-4 h-4" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title */}
          <span className={`text-sm font-medium ${typeConfig.color}`}>
            {step.title}
          </span>

          {/* Description */}
          {step.description && (
            <p className="text-xs text-gray-600 mt-1 whitespace-pre-wrap">
              {step.description}
            </p>
          )}

          {/* Timestamp and Duration */}
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-gray-400">
              {new Date(step.timestamp).toLocaleTimeString()}
            </span>
            {step.duration !== undefined && step.status === 'completed' && (
              <span className="text-xs text-green-600 font-medium">
                {step.duration < 1000
                  ? `${step.duration}ms`
                  : `${(step.duration / 1000).toFixed(1)}s`}
              </span>
            )}
            {step.status === 'running' && (
              <span className="text-xs text-blue-500">
                运行中...
              </span>
            )}
          </div>
        </div>

        {/* Expand indicator */}
        {hasContent && (
          <div className={`transform transition-transform mt-0.5 ${expanded ? 'rotate-90' : ''}`}>
            <ChevronRight className="w-3 h-3 text-gray-400" />
          </div>
        )}
      </button>

      {/* Details */}
      {expanded && (
        <div className="px-3 pb-3 pt-0">
          {/* Description */}
          {step.description && (
            <div className="text-xs text-gray-700 bg-purple-50 rounded border border-purple-100 p-2 mb-2">
              <span className="font-medium text-purple-700">思考：</span>
              {step.description}
            </div>
          )}

          {/* Details */}
          {step.details && (
            <div className="text-xs text-gray-600 bg-white rounded border border-gray-200 p-2 font-mono overflow-x-auto">
              {typeof step.details === 'string'
                ? step.details
                : JSON.stringify(step.details, null, 2)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ChatPanel() {
  // 从 localStorage 恢复之前的状态
  const savedSessionId = localStorage.getItem('chat_currentSessionId');
  const savedAgent = localStorage.getItem('chat_selectedAgent');

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>(savedAgent || '');
  const [currentSessionId, setCurrentSessionId] = useState<string>(savedSessionId || '');
  const [showSessionList, setShowSessionList] = useState(false);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [hasSuggestions, setHasSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 语音识别状态
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const recognitionRef = useRef<any>(null);

  // 语音合成状态 (TTS)
  const [isPlaying, setIsPlaying] = useState(false);
  const [playingMessageIndex, setPlayingMessageIndex] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [selectedVoice, setSelectedVoice] = useState('male-qn-qingse');

  // 跟踪每个步骤的开始时间
  const stepStartTimes = useRef<Map<string, number>>(new Map());

  // Execution steps for displaying agent actions (like Claude's thought process)
  const [executionSteps, setExecutionSteps] = useState<ExecutionStep[]>([]);
  const [showExecutionSteps, setShowExecutionSteps] = useState(true);

  // 保存状态到 localStorage
  useEffect(() => {
    if (currentSessionId) {
      localStorage.setItem('chat_currentSessionId', currentSessionId);
    }
  }, [currentSessionId]);

  useEffect(() => {
    if (selectedAgent) {
      localStorage.setItem('chat_selectedAgent', selectedAgent);
    }
  }, [selectedAgent]);

  const scrollToBottom = () => {
    if (messagesEndRef.current && typeof messagesEndRef.current.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load agents and sessions
  useEffect(() => {
    const loadData = async () => {
      // Load agents
      try {
        const res = await infoApi.getAgentTeam();
        const agentsList = res.data.agents || [];
        setAgents(agentsList);
        if (agentsList.length > 0 && !selectedAgent) {
          setSelectedAgent(agentsList[0].agent_id);
        }
      } catch (err) {
        console.error('Failed to load agents:', err);
      }

      // Load recent sessions ONLY if we don't have a current session
      if (!currentSessionId) {
        await loadSessions();
      } else {
        // Restore messages from current session
        await loadSessionMessages(currentSessionId);
      }
    };

    loadData();
  }, []);

  const loadSessions = async () => {
    try {
      const res = await chatApi.getSessions(selectedAgent);
      const sessions = res.data.sessions || [];
      if (sessions.length > 0 && !currentSessionId) {
        // Load most recent session
        loadSessionMessages(sessions[0].session_id);
      }
    } catch (err) {
      console.error('Failed to load sessions:', err);
    }
  };

  const loadSessionMessages = async (sessionId: string) => {
    try {
      const res = await chatApi.getSessionMessages(sessionId, selectedAgent);
      const messages = res.data.messages || [];
      // Filter out tool messages - only show user and assistant messages
      const filteredMessages = messages.filter((msg) => msg.role === 'user' || msg.role === 'assistant');
      setMessages(
        filteredMessages.map((msg) => ({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content,
          // Use timestamp from backend if available, otherwise use current time
          timestamp: msg.timestamp ? new Date(msg.timestamp).getTime() : Date.now(),
        }))
      );
      setCurrentSessionId(sessionId);
    } catch (err) {
      console.error('Failed to load session messages:', err);
    }
  };

  const handleNewChat = () => {
    setMessages([]);
    setCurrentSessionId('');
    localStorage.removeItem('chat_currentSessionId');
    setInput('');
  };

  const handleSessionSelect = (sessionId: string) => {
    loadSessionMessages(sessionId);
    setShowSessionList(false);
  };

  // 跟踪进行中的请求
  const [pendingRequests, setPendingRequests] = useState<Set<string>>(new Set());

  const sendMessage = async () => {
    if (!input.trim()) return;

    const messageContent = input.trim();
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const userMessage: Message = {
      role: 'user',
      content: messageContent,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setPendingRequests((prev) => new Set(prev).add(requestId));
    setExecutionSteps([]); // Clear previous execution steps
    stepStartTimes.current.clear(); // Clear step timing

    try {
      // Use streaming API to get real-time agent execution updates
      const response = await fetch('/api/v1/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage.content,
          agent_id: selectedAgent || undefined,
          conversation_id: currentSessionId || undefined,
        }),
      });

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let finalResponse = '';
      let conversationId = currentSessionId;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.slice(6));

              // Handle different event types
              switch (event.type) {
                case 'status':
                  // Add status update as an execution step
                  setExecutionSteps((prev) => {
                    const lastStep = prev[prev.length - 1];
                    if (lastStep && lastStep.type === 'status' && lastStep.status === 'running') {
                      // 计算用时
                      const startTime = stepStartTimes.current.get(lastStep.id) || lastStep.timestamp;
                      const duration = Date.now() - startTime;
                      // Update existing status step
                      return prev.map((step, i) =>
                        i === prev.length - 1
                          ? { ...step, title: event.message, status: 'completed', duration }
                          : step
                      );
                    }
                    // Add new status step
                    const stepId = `status-${Date.now()}`;
                    stepStartTimes.current.set(stepId, Date.now());
                    return [
                      ...prev,
                      {
                        id: stepId,
                        type: 'status',
                        status: 'running',
                        title: event.message,
                        timestamp: Date.now(),
                      },
                    ];
                  });
                  break;

                case 'agent_state':
                  // Update agent state panel with detailed execution info
                  const state = event.state;

                  // Handle planning/reasoning display
                  if (state?.status === 'planning' && state?.current_action) {
                    setExecutionSteps((prev) => {
                      // Check if we already have a planning step
                      const existingPlanning = prev.find(s => s.type === 'action' && s.title === 'LLM 决策');
                      if (existingPlanning) {
                        return prev.map(step =>
                          step.id === existingPlanning.id
                            ? { ...step, description: state.current_action, expanded: true }
                            : step
                        );
                      }
                      return [
                        ...prev,
                        {
                          id: `planning-${Date.now()}`,
                          type: 'action',
                          status: 'completed',
                          title: '🧠 LLM 决策',
                          description: state.current_action,
                          timestamp: Date.now(),
                          expanded: true,
                        },
                      ];
                    });
                  }

                  // Handle tool execution display
                  if (state?.route && state.route !== 'uncertain' && state?.status === 'executing') {
                    setExecutionSteps((prev) => {
                      const existingToolStep = prev.find(
                        (s) => s.type === 'tool' && s.status === 'running'
                      );
                      if (existingToolStep) {
                        // 计算用时
                        const startTime = stepStartTimes.current.get(existingToolStep.id) || existingToolStep.timestamp;
                        const duration = Date.now() - startTime;
                        return prev.map((step) =>
                          step.id === existingToolStep.id
                            ? { ...step, title: `执行 ${state.route}`, details: state.details, status: 'completed', duration }
                            : step
                        );
                      }
                      // Add new tool execution step
                      const stepId = `tool-${Date.now()}`;
                      stepStartTimes.current.set(stepId, Date.now());
                      return [
                        ...prev,
                        {
                          id: stepId,
                          type: 'tool',
                          status: 'running',
                          title: `执行 ${state.route}`,
                          details: state.details,
                          timestamp: Date.now(),
                        },
                      ];
                    });
                  }

                  // Handle iteration display
                  if (state?.status === 'iteration') {
                    setExecutionSteps((prev) => {
                      const lastStep = prev[prev.length - 1];
                      if (lastStep && lastStep.type === 'status') {
                        // 计算用时
                        const startTime = stepStartTimes.current.get(lastStep.id) || lastStep.timestamp;
                        const duration = Date.now() - startTime;
                        return prev.map((step, i) =>
                          i === prev.length - 1
                            ? { ...step, title: state.current_action, status: 'completed', duration }
                            : step
                        );
                      }
                      return prev;
                    });
                  }
                  break;

                case 'response':
                  finalResponse = event.response;
                  if (event.conversation_id) {
                    conversationId = event.conversation_id;
                  }
                  break;

                case 'error':
                  setExecutionSteps((prev) => [
                    ...prev,
                    {
                      id: `error-${Date.now()}`,
                      type: 'error',
                      status: 'error',
                      title: '发生错误',
                      description: event.error,
                      timestamp: Date.now(),
                    },
                  ]);
                  break;

                case 'complete':
                  // Execution completed - 计算最后一个运行中步骤的用时
                  setExecutionSteps((prev) => {
                    const runningIndex = prev.findIndex(s => s.status === 'running');
                    if (runningIndex !== -1) {
                      const step = prev[runningIndex];
                      const startTime = stepStartTimes.current.get(step.id) || step.timestamp;
                      const duration = Date.now() - startTime;
                      return prev.map((s, i) =>
                        i === runningIndex
                          ? { ...s, status: 'completed', duration }
                          : s
                      );
                    }
                    return prev;
                  });
                  break;
              }
            } catch (e) {
              console.error('Failed to parse SSE event:', e);
            }
          }
        }
      }

      // Add assistant response to messages
      if (finalResponse) {
        // Check if response contains tool_calls JSON
        let displayContent = finalResponse;
        try {
          const parsed = JSON.parse(finalResponse);
          if (parsed.tool_calls && Array.isArray(parsed.tool_calls)) {
            // Response contains tool_calls - don't display the raw JSON
            // Instead, add tool execution steps
            for (const tc of parsed.tool_calls) {
              const toolName = tc.name || tc.function?.name || 'unknown';
              const toolInput = tc.input || tc.function?.arguments || {};
              const toolId = tc.id || `tool-${Date.now()}`;
              setExecutionSteps((prev) => [
                ...prev,
                {
                  id: toolId,
                  type: 'tool',
                  status: 'completed',
                  title: `Tool: ${toolName}`,
                  description: typeof toolInput === 'string' ? toolInput : JSON.stringify(toolInput).slice(0, 200),
                  timestamp: Date.now(),
                },
              ]);
            }
            // Don't show the raw JSON in the chat
            displayContent = '[Tool calls executed]';
          }
        } catch {
          // Not JSON, display as-is
        }

        const assistantMessage: Message = {
          role: 'assistant',
          content: displayContent,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      }

      // Update session ID if this is a new conversation
      if (conversationId && currentSessionId !== conversationId) {
        setCurrentSessionId(conversationId);
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      const errorMessage: Message = {
        role: 'assistant',
        content: `Error: ${err instanceof Error ? err.message : 'Failed to get response from agent'}`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      // 移除请求追踪
      setPendingRequests((prev) => {
        const next = new Set(prev);
        next.delete(requestId);
        return next;
      });
    }
  };

  const handleCommandSelect = (commandName: string) => {
    // Replace the command prefix with the selected command
    const prefixMatch = input.match(/^[/！？.]\S*/);
    if (prefixMatch) {
      const newValue = '/' + commandName + ' ';
      setInput(newValue);
    } else {
      setInput('/' + commandName + ' ');
    }
    setShowAutocomplete(false);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    // Don't handle when composing with IME (Chinese, Japanese, Korean, etc.)
    if (e.nativeEvent.isComposing) {
      return;
    }

    // Handle keyboard navigation for autocomplete
    if (showAutocomplete && hasSuggestions) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex((prev) => Math.min(prev + 1, AVAILABLE_COMMANDS.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        e.stopPropagation();
        // Get the filtered suggestions
        const cmdInput = input.replace(/^[/！？.]/, '').toLowerCase();
        const filtered = AVAILABLE_COMMANDS.filter((cmd) =>
          cmd.command_name.toLowerCase().startsWith(cmdInput)
        );
        const selected = filtered[selectedIndex] || filtered[0];
        if (selected) {
          handleCommandSelect(selected.command_name);
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setShowAutocomplete(false);
        return;
      }
      // Enter selects the current suggestion
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        // Get the filtered suggestions
        const cmdInput = input.replace(/^[/！？.]/, '').toLowerCase();
        const filtered = AVAILABLE_COMMANDS.filter((cmd) =>
          cmd.command_name.toLowerCase().startsWith(cmdInput)
        );
        const selected = filtered[selectedIndex] || filtered[0];
        if (selected) {
          handleCommandSelect(selected.command_name);
        }
        return;
      }
    }

    // Normal submit
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Check if we should show autocomplete
  useEffect(() => {
    // Show autocomplete when input starts with /, !, ?, or .
    const shouldShow = /^[/！？.]\S*$/.test(input) || /^[/！？.]$/.test(input);
    setShowAutocomplete(shouldShow);
    // Reset selected index when input changes
    if (shouldShow) {
      setSelectedIndex(0);
    }
  }, [input]);

  const clearChat = () => {
    setMessages([]);
  };

  // 语音识别功能
  const toggleVoiceRecording = () => {
    console.log('[Voice] toggleVoiceRecording 被调用, isListening:', isListening);
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    console.log('[Voice] SpeechRecognitionAPI:', SpeechRecognitionAPI);

    if (!SpeechRecognitionAPI) {
      // 检查是否在 Safari 浏览器
      const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
      if (isSafari) {
        alert('Safari 浏览器需要手动开启语音识别功能：\n1. 打开 Safari > 偏好设置 > 隐私\n2. 确保麦克风权限已开启\n3. 或者在地址栏输入：speechRecognition');
      } else {
        alert('您的浏览器不支持语音识别功能，请使用 Chrome、Edge 或 Safari 浏览器');
      }
      return;
    }

    // 如果正在聆听，点击停止
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      return;
    }

    // 开始新的识别
    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'zh-CN';

    let finalTranscript = ''; // 用于在停止时保存最终结果

    recognition.onstart = () => {
      setIsListening(true);
      setInterimTranscript('');
      finalTranscript = '';
    };

    recognition.onresult = (event: any) => {
      const results = Array.from(event.results);
      const transcript = results
        .map((result: any) => result[0].transcript)
        .join('');
      console.log('[Voice] 识别到文字:', transcript, '| 字符数:', transcript.length);
      setInterimTranscript(transcript);

      // 检查是否是最终结果
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const finalResult = (results as any[]).find((r: any) => r.isFinal);
      if (finalResult) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        finalTranscript = finalResult[0].transcript as string;
      }
    };

    recognition.onerror = (event: any) => {
      console.error('[Voice] Recognition error:', event.error);
      setIsListening(false);
      setInterimTranscript('');
      recognitionRef.current = null;
    };

    recognition.onend = () => {
      console.log('[Voice] Recognition ended');
      // 点击停止后，将识别结果转入输入框，不自动发送
      if (finalTranscript) {
        setInput(finalTranscript);
      } else if (interimTranscript) {
        // 如果没有最终结果但有临时结果，也保留
        setInput(interimTranscript);
      }
      setIsListening(false);
      setInterimTranscript('');
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  // TTS 语音合成功能
  const handlePlayTTS = async (content: string, messageIndex: number) => {
    // 如果正在播放同一个消息，停止播放
    if (playingMessageIndex === messageIndex && isPlaying) {
      stopAudio(audioRef.current);
      setIsPlaying(false);
      setPlayingMessageIndex(null);
      return;
    }

    // 停止当前播放
    if (audioRef.current) {
      stopAudio(audioRef.current);
    }

    try {
      setIsPlaying(true);
      setPlayingMessageIndex(messageIndex);

      const blob = await synthesizeSpeech(content, {
        voice_id: selectedVoice,
        speed: 1.0,
        emotion: 'calm',
      });

      const audio = playAudio(blob);
      audioRef.current = audio;

      audio.onended = () => {
        setIsPlaying(false);
        setPlayingMessageIndex(null);
        audioRef.current = null;
      };

      audio.onerror = () => {
        setIsPlaying(false);
        setPlayingMessageIndex(null);
        audioRef.current = null;
      };
    } catch (error) {
      console.error('TTS playback error:', error);
      setIsPlaying(false);
      setPlayingMessageIndex(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white relative">
      {/* Session List Sidebar */}
      <SessionList
        isOpen={showSessionList}
        onClose={() => setShowSessionList(false)}
        onSessionSelect={handleSessionSelect}
        onNewChat={handleNewChat}
        selectedAgent={selectedAgent}
      />

      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Session List Toggle */}
            <button
              onClick={() => setShowSessionList(!showSessionList)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500"
              title="会话列表"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-100 to-purple-200 flex items-center justify-center">
              <Bot className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Chat</h2>
              <p className="text-sm text-gray-500">
                {currentSessionId ? '会话中' : `${agents.length} 个 Agent`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* New Chat Button */}
            <button
              onClick={handleNewChat}
              className="p-2 hover:bg-purple-50 rounded-lg transition-colors text-purple-600"
              title="新对话"
            >
              <MessageSquare className="w-5 h-5" />
            </button>

            {/* Agent Selector */}
            <select
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
              className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="">All Agents</option>
              {agents.map((agent) => (
                <option key={agent.agent_id} value={agent.agent_id}>
                  {agent.name}
                </option>
              ))}
            </select>

            {/* Clear Button */}
            <button
              onClick={clearChat}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500"
              title="Clear chat"
            >
              <Trash2 className="w-5 h-5" />
            </button>

            {/* Refresh Button */}
            <button
              onClick={() => window.location.reload()}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500"
              title="Refresh"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 bg-gray-50">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <Bot className="w-16 h-16 mb-4 opacity-20" />
            <p className="text-lg font-medium">No messages yet</p>
            <p className="text-sm mt-1">Start a conversation with your agent team</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg, index) => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={index}
                  className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}
                >
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      isUser
                        ? 'bg-gradient-to-br from-blue-100 to-blue-200'
                        : 'bg-gradient-to-br from-purple-100 to-purple-200'
                    }`}
                  >
                    {isUser ? (
                      <User className="w-4 h-4 text-blue-600" />
                    ) : (
                      <Bot className="w-4 h-4 text-purple-600" />
                    )}
                  </div>
                  <div
                    className={`max-w-[70%] rounded-2xl px-4 py-3 ${
                      isUser
                        ? 'bg-blue-500 text-white rounded-br-none'
                        : 'bg-white border border-gray-200 text-gray-900 rounded-bl-none shadow-sm'
                    }`}
                  >
                    {isUser ? (
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    ) : (
                      <div className="text-sm">
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    )}
                    {/* TTS 播放按钮 - 仅 AI 消息显示 */}
                    {!isUser && (
                      <button
                        onClick={() => handlePlayTTS(msg.content, index)}
                        className={`mt-2 flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg transition-colors ${
                          playingMessageIndex === index && isPlaying
                            ? 'bg-red-100 text-red-600'
                            : 'bg-gray-100 text-gray-600 hover:bg-purple-100 hover:text-purple-600'
                        }`}
                        title={playingMessageIndex === index && isPlaying ? '停止播放' : '播放语音'}
                      >
                        {playingMessageIndex === index && isPlaying ? (
                          <>
                            <Square className="w-3 h-3" />
                            <span>停止</span>
                          </>
                        ) : (
                          <>
                            <Volume2 className="w-3 h-3" />
                            <span>朗读</span>
                          </>
                        )}
                      </button>
                    )}
                    <p
                      className={`text-xs mt-1 ${
                        isUser ? 'text-blue-100' : 'text-gray-400'
                      }`}
                    >
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              );
            })}

            {/* Execution Steps Display (like Claude's thought process) */}
            {pendingRequests.size > 0 && executionSteps.length > 0 && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-100 to-purple-200 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-purple-600" />
                </div>
                <div className="flex-1 max-w-[70%]">
                  <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                    {/* Header */}
                    <button
                      onClick={() => setShowExecutionSteps(!showExecutionSteps)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 text-purple-600 animate-spin" />
                        <span className="text-sm font-medium text-gray-700">Agent 正在执行</span>
                      </div>
                      {showExecutionSteps ? (
                        <ChevronDown className="w-4 h-4 text-gray-500" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-500" />
                      )}
                    </button>

                    {/* Steps List */}
                    {showExecutionSteps && (
                      <div className="p-4 space-y-2 max-h-64 overflow-y-auto">
                        {executionSteps.map((step, index) => (
                          <ExecutionStepItem key={step.id} step={step} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {pendingRequests.size > 0 && executionSteps.length === 0 && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-100 to-purple-200 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-purple-600" />
                </div>
                <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-none px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 text-purple-600 animate-spin" />
                    <span className="text-sm text-gray-500">Agent is thinking...</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Agent State Panel */}
      {selectedAgent && <AgentStatePanel agentId={selectedAgent} />}

      {/* Input */}
      <div className="px-6 py-4 border-t border-gray-200 bg-white">
        <div className="flex items-center gap-3">
          {/* Voice Input Button - 高度固定44px与输入框对齐 */}
          <button
            onClick={toggleVoiceRecording}
            className={`w-11 h-11 rounded-xl transition-all flex-shrink-0 flex items-center justify-center ${
              isListening
                ? 'bg-red-100 text-red-600 animate-pulse'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-800'
            }`}
            title={isListening ? '停止聆听' : '开始语音输入'}
          >
            {isListening ? (
              <MicOff className="w-5 h-5" />
            ) : (
              <Mic className="w-5 h-5" />
            )}
          </button>

          {/* Input Area */}
          <div className="flex-1 relative">
            {/* 语音聆听模式：顶部提示条 */}
            {isListening && (
              <div className="absolute left-0 top-0 z-10 flex items-center gap-2 w-full bg-red-50 border-2 border-red-200 rounded-t-xl px-4 py-2 pointer-events-none"
                style={{ opacity: 0.95 }}>
                <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                <span className="text-red-600 font-bold text-xs flex-shrink-0">正在聆听</span>
                <span className="text-red-500 text-xs">
                  {interimTranscript ? `已识别 ${interimTranscript.length} 字` : '等待声音...'}
                </span>
              </div>
            )}
            <textarea
              value={isListening ? interimTranscript : input}
              onChange={(e) => isListening ? setInterimTranscript(e.target.value) : setInput(e.target.value)}
              onKeyDown={isListening ? undefined : handleInputKeyDown}
              placeholder={isListening ? "正在识别..." : "Type your message... (try /help, /status, /list)"}
              rows={1}
              className={`w-full resize-none bg-gray-50 border rounded-xl px-4 py-3 text-gray-700 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent max-h-32 ${isListening ? 'border-red-200 bg-red-50/50 rounded-t-none' : 'border-gray-200'}`}
              style={{ minHeight: '44px' }}
            />
            {!isListening && showAutocomplete && (
              <CommandAutocomplete
                input={input}
                onSelect={handleCommandSelect}
                onClose={() => setShowAutocomplete(false)}
                hasSuggestions={hasSuggestions}
                setHasSuggestions={setHasSuggestions}
                selectedIndex={selectedIndex}
              />
            )}
          </div>

          {/* Send Button - 高度固定44px与输入框对齐 */}
          <button
            onClick={sendMessage}
            disabled={!input.trim() && !isListening}
            className="px-5 h-11 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 disabled:from-gray-300 disabled:to-gray-400 text-white rounded-xl font-medium text-sm transition-all disabled:cursor-not-allowed flex items-center gap-2 flex-shrink-0"
          >
            {pendingRequests.size > 0 ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">Send</span>
          </button>
        </div>
      </div>
    </div>
  );
}
