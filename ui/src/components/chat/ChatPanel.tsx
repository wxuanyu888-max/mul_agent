import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, User, Bot, Loader2, RefreshCw, Trash2, Menu, MessageSquare, ChevronRight, ChevronDown, CheckCircle, AlertCircle, Play, Brain, Activity, Clock, Mic, MicOff, Volume2, Square, Upload, X, Image, FileText } from 'lucide-react';
import { chatApi, infoApi } from '../../services/api';
import { synthesizeSpeech, playAudio, stopAudio, playWithBrowserTTS, stopBrowserTTS } from '../../services/endpoints/voice';
import { uploadFile, isAllowedFileType, formatFileSize, getFileUrl } from '../../services/endpoints/files';
import { FileUploadButton, FilePreviewItem } from './FileUploadButton';

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
import { Message, Agent, Attachment } from '../../types';
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

  // 添加 loading 状态防止重复请求
  const [isLoadingData, setIsLoadingData] = useState(false);
  const isLoadingDataRef = useRef(false); // 用于在 useEffect 中检查

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

  // File upload state
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);

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

  // Load agents and sessions - 使用 ref 防止重复加载
  useEffect(() => {
    // 防止重复调用
    if (isLoadingDataRef.current) return;
    isLoadingDataRef.current = true;

    const loadData = async () => {
      setIsLoadingData(true);
      try {
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
      } finally {
        setIsLoadingData(false);
      }
    };

    loadData();

    // 清理函数
    return () => {
      isLoadingDataRef.current = false;
    };
  }, []); // 空依赖数组，只在组件挂载时执行一次

  // 当 selectedAgent 变化时，重新加载 sessions
  useEffect(() => {
    if (!selectedAgent || isLoadingDataRef.current) return;

    const loadAgentSessions = async () => {
      setIsLoadingData(true);
      try {
        await loadSessions();
      } finally {
        setIsLoadingData(false);
      }
    };

    loadAgentSessions();
  }, [selectedAgent]);

  const loadSessions = async () => {
    try {
      const res = await chatApi.getSessions(selectedAgent);
      const sessions = res.data.sessions || [];
      if (sessions.length > 0) {
        // Always load the most recent session when agent changes
        await loadSessionMessages(sessions[0].session_id);
      } else {
        // No sessions - clear current session and messages
        setMessages([]);
        setCurrentSessionId('');
        localStorage.removeItem('chat_currentSessionId');
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
    } catch (err: any) {
      console.error('Failed to load session messages:', err);
      // 如果是 404 (Session not found)，清除无效的 session
      if (err?.response?.status === 404) {
        console.log('Session not found, clearing invalid sessionId');
        setMessages([]);
        setCurrentSessionId('');
        localStorage.removeItem('chat_currentSessionId');
        // 尝试加载一个有效的 session
        loadSessions();
      }
    }
  };

  const handleNewChat = () => {
    setMessages([]);
    setCurrentSessionId('');
    localStorage.removeItem('chat_currentSessionId');
    setInput('');
    setAttachments([]);
  };

  const handleSessionSelect = (sessionId: string) => {
    loadSessionMessages(sessionId);
    setShowSessionList(false);
  };

  // Handle files selected from upload button
  const handleFilesSelected = (newAttachments: Attachment[]) => {
    setAttachments(prev => [...prev, ...newAttachments]);
  };

  // Remove attachment
  const handleRemoveAttachment = (attachmentId: string) => {
    setAttachments(prev => prev.filter(a => a.id !== attachmentId));
  };

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    const validFiles = files.filter(file => isAllowedFileType(file));

    if (validFiles.length === 0) {
      alert('不支持的文件类型。请上传图片（PNG、JPG、GIF、WebP）、PDF 或 Markdown (.md) 文件。');
      return;
    }

    // Upload files
    const uploadedAttachments: Attachment[] = [];
    for (const file of validFiles) {
      try {
        const metadata = await uploadFile(file);
        uploadedAttachments.push({
          id: metadata.id,
          filename: metadata.filename,
          originalName: metadata.originalName,
          mimeType: metadata.mimeType,
          size: metadata.size,
          url: getFileUrl(metadata.id)
        });
      } catch (error) {
        console.error('Upload failed:', error);
        alert(`文件 ${file.name} 上传失败`);
      }
    }

    if (uploadedAttachments.length > 0) {
      setAttachments(prev => [...prev, ...uploadedAttachments]);
    }
  }, []);

  // 跟踪进行中的请求
  const [pendingRequests, setPendingRequests] = useState<Set<string>>(new Set());

  const sendMessage = async () => {
    if (!input.trim() && attachments.length === 0) return;

    const messageContent = input.trim();
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const userMessage: Message = {
      role: 'user',
      content: messageContent,
      timestamp: Date.now(),
      attachments: attachments.length > 0 ? [...attachments] : undefined,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setAttachments([]);
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
          attachments: userMessage.attachments ? userMessage.attachments.map(a => ({
            id: a.id,
            type: a.mimeType.startsWith('image/') ? 'image' : 'document',
            url: a.url,
            originalName: a.originalName,
            mimeType: a.mimeType,
            // 传递提取的文本内容给后端
            extractedText: a.extractedText,
          })) : undefined,
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
                case 'tool':
                  // 后端发送的工具执行事件
                  // 格式: { type: 'tool', tool: string, status: 'start'|'complete'|'rejected', input?, output?, duration? }
                  setExecutionSteps((prev) => {
                    const existingToolStep = prev.find(
                      (s) => s.type === 'tool' && s.title === `执行 ${event.tool}` && s.status === 'running'
                    );

                    if (event.status === 'start') {
                      // 工具开始执行 - 添加新步骤
                      if (existingToolStep) {
                        return prev; // 已存在，跳过
                      }
                      return [
                        ...prev,
                        {
                          id: event.tool_call_id || `tool-${Date.now()}`,
                          type: 'tool',
                          status: 'running',
                          title: `执行 ${event.tool}`,
                          details: event.input,
                          timestamp: Date.now(),
                        },
                      ];
                    } else if (event.status === 'complete') {
                      // 工具执行完成 - 更新现有步骤
                      if (existingToolStep) {
                        return prev.map((step) =>
                          step.id === existingToolStep.id
                            ? {
                                ...step,
                                status: event.isError ? 'error' : 'completed',
                                details: event.output,
                                duration: event.duration,
                              }
                            : step
                        );
                      }
                      // 如果没有找到运行中的步骤，添加完成状态（处理后端直接发 complete 的情况）
                      return [
                        ...prev,
                        {
                          id: event.tool_call_id || `tool-${Date.now()}`,
                          type: 'tool',
                          status: event.isError ? 'error' : 'completed',
                          title: `执行 ${event.tool}`,
                          details: event.output,
                          duration: event.duration,
                          timestamp: Date.now(),
                        },
                      ];
                    } else if (event.status === 'rejected') {
                      // 工具被拒绝
                      if (existingToolStep) {
                        return prev.map((step) =>
                          step.id === existingToolStep.id
                            ? { ...step, status: 'error', description: 'Tool execution was rejected by user' }
                            : step
                        );
                      }
                    }
                    return prev;
                  });
                  break;

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

                case 'agent_response':
                  // 广播模式下的单个 agent 响应
                  // 作为单独的消息显示，带有 agent 名字
                  setMessages((prev) => [
                    ...prev,
                    {
                      role: 'assistant',
                      content: event.response,
                      agentId: event.agent_id,
                      agentName: event.agent_name,
                      timestamp: Date.now(),
                    },
                  ]);
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
        // 后端闭环后，直接显示最终响应，不再解析 tool_calls
        // tool_calls 的展示已由后端通过 'tool' 事件控制
        const displayContent = finalResponse;

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
    } catch (err: any) {
      console.error('Failed to send message:', err);

      // 检测 429 错误并返回友好消息
      let errorContent = 'Failed to get response from agent';
      if (err?.response?.status === 429) {
        errorContent = '当前请求过多，请稍后再试（Rate limit exceeded）';
      } else if (err?.response?.data?.error?.message) {
        errorContent = `错误: ${err.response.data.error.message}`;
      } else if (err instanceof Error) {
        errorContent = `错误: ${err.message}`;
      }

      const errorMessage: Message = {
        role: 'assistant',
        content: errorContent,
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

    // 语音识别功能 - 使用浏览器原生 Web Speech API
    const toggleVoiceRecording = async () => {
      console.log('[Voice] toggleVoiceRecording 被调用, isListening:', isListening);
      const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
      console.log('[Voice] SpeechRecognitionAPI:', SpeechRecognitionAPI);

      if (!SpeechRecognitionAPI) {
        alert('您的浏览器不支持语音识别功能，请使用 Chrome、Edge 或 Safari 浏览器');
        return;
      }

      // 如果正在聆听，点击停止
      if (isListening) {
        if (recognitionRef.current) {
          recognitionRef.current.stop();
        }
        return;
      }

      // 先获取麦克风权限 - 禁用所有降噪
      let audioStream: MediaStream | null = null;
      try {
        audioStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,  // 关闭回声消除
            noiseSuppression: false,  // 关闭降噪
            autoGainControl: false,   // 关闭自动增益
          }
        });
        console.log('[Voice] 麦克风权限已获取，轨道数:', audioStream.getTracks().length);
      } catch (err) {
        console.error('[Voice] 获取麦克风权限失败:', err);
        alert('无法获取麦克风权限，请检查浏览器设置');
        return;
      }

      const recognition = new SpeechRecognitionAPI();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'zh-CN';

      let finalTranscript = '';

      recognition.onstart = () => {
        console.log('[Voice] Recognition onstart - 开始聆听');
        setIsListening(true);
        setInterimTranscript('');
        finalTranscript = '';
      };

      recognition.onresult = (event: any) => {
        console.log('[Voice] Recognition onresult 触发, results length:', event.results.length);
        let transcript = '';
        for (let i = 0; i < event.results.length; i++) {
          const text = event.results[i][0].transcript;
          console.log(`[Voice] result[${i}]: isFinal=${event.results[i].isFinal}, text="${text}"`);
          transcript += text;
        }
        console.log('[Voice] 识别到文字:', transcript);
        setInterimTranscript(transcript);

        // 检查最终结果
        for (let i = 0; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            finalTranscript = event.results[i][0].transcript;
            break;
          }
        }
      };

      recognition.onerror = (event: any) => {
        console.error('[Voice] Recognition error:', event.error);
        // 停止麦克风流
        if (audioStream) {
          audioStream.getTracks().forEach(t => t.stop());
        }
        if (event.error === 'no-speech') {
          alert('未检测到语音。\n\n请确保：\n1. macOS 麦克风模式设为 Standard（不是 Voice Isolation）\n2. 对着麦克风说话声音大一点');
        }
        setIsListening(false);
        setInterimTranscript('');
        recognitionRef.current = null;
      };

      recognition.onend = () => {
        console.log('[Voice] Recognition ended, final:', finalTranscript, 'interim:', interimTranscript);
        // 停止麦克风流
        if (audioStream) {
          audioStream.getTracks().forEach(t => t.stop());
        }
        if (finalTranscript) {
          setInput(finalTranscript);
        } else if (interimTranscript) {
          setInput(interimTranscript);
        }
        setIsListening(false);
        setInterimTranscript('');
        recognitionRef.current = null;
      };

      recognitionRef.current = recognition;
      recognition.start();
      console.log('[Voice] Web Speech API 已启动');
    };

  // TTS 语音合成功能
  const handlePlayTTS = async (content: string, messageIndex: number) => {
    // 如果正在播放同一个消息，停止播放
    if (playingMessageIndex === messageIndex && isPlaying) {
      stopAudio(audioRef.current);
      stopBrowserTTS();
      setIsPlaying(false);
      setPlayingMessageIndex(null);
      return;
    }

    // 停止当前播放
    if (audioRef.current) {
      stopAudio(audioRef.current);
    }
    stopBrowserTTS();

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
      console.warn('[TTS] MiniMax failed, using browser TTS...', error);
      // 使用浏览器原生 TTS 作为后备
      playWithBrowserTTS(content, selectedVoice, () => {
        setIsPlaying(false);
        setPlayingMessageIndex(null);
      });
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
              <option value="__all__">All Agents (广播)</option>
              <option value="core_brain">Core Brain</option>
              {agents.filter(a => a.agent_id !== 'core_brain').map((agent) => (
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
              const isAgentResponse = !isUser && msg.agentName;  // 广播模式下的 agent 回复
              return (
                <div
                  key={index}
                  className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}
                >
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      isUser
                        ? 'bg-gradient-to-br from-blue-100 to-blue-200'
                        : isAgentResponse
                        ? 'bg-gradient-to-br from-green-100 to-green-200'
                        : 'bg-gradient-to-br from-purple-100 to-purple-200'
                    }`}
                  >
                    {isUser ? (
                      <User className="w-4 h-4 text-blue-600" />
                    ) : isAgentResponse ? (
                      // 显示 agent 名字的首字母
                      <span className="w-4 h-4 text-xs font-bold text-green-600">
                        {msg.agentName?.charAt(0).toUpperCase()}
                      </span>
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
                    {isAgentResponse && (
                      <div className="text-xs font-medium text-green-600 mb-1">
                        {msg.agentName}
                      </div>
                    )}
                    {isUser ? (
                      <>
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        {/* Display attachments */}
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {msg.attachments.map((attachment) => {
                              const isImage = attachment.mimeType?.startsWith('image/');
                              const isPdf = attachment.mimeType === 'application/pdf';

                              return (
                                <div
                                  key={attachment.id}
                                  className="flex items-center gap-2 bg-blue-600/20 rounded-lg px-2 py-1.5"
                                >
                                  {isImage && attachment.url ? (
                                    <img
                                      src={attachment.url}
                                      alt={attachment.originalName}
                                      className="w-16 h-16 object-cover rounded"
                                    />
                                  ) : (
                                    <div className="w-16 h-16 flex items-center justify-center bg-blue-600/30 rounded">
                                      {isPdf ? (
                                        <div className="text-center">
                                          <FileText className="w-6 h-6 text-blue-300 mx-auto" />
                                          <span className="text-xs text-blue-200">PDF</span>
                                        </div>
                                      ) : (
                                        <Image className="w-6 h-6 text-blue-300" />
                                      )}
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    <p className="text-xs text-blue-100 truncate max-w-[100px]">
                                      {attachment.originalName}
                                    </p>
                                    <p className="text-xs text-blue-300">
                                      {formatFileSize(attachment.size)}
                                    </p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </>
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
        {/* Drag and drop overlay */}
        {isDragging && (
          <div
            className="absolute inset-0 bg-purple-100/90 z-50 flex items-center justify-center border-2 border-dashed border-purple-400 m-4 rounded-xl"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="text-center">
              <Upload className="w-12 h-12 text-purple-500 mx-auto mb-2" />
              <p className="text-purple-700 font-medium">松开鼠标上传文件</p>
              <p className="text-purple-500 text-sm">支持 PNG、JPG、GIF、WebP、PDF</p>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3">
          {/* File Upload Button */}
          <FileUploadButton
            onFilesSelected={handleFilesSelected}
            disabled={pendingRequests.size > 0}
          />

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
          <div
            className={`flex-1 relative ${isDragging ? 'opacity-50' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
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

            {/* Attachments Preview */}
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {attachments.map((attachment) => (
                  <FilePreviewItem
                    key={attachment.id}
                    attachment={attachment}
                    onRemove={() => handleRemoveAttachment(attachment.id)}
                  />
                ))}
              </div>
            )}

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
            disabled={!input.trim() && attachments.length === 0 && !isListening}
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
