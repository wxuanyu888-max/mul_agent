/**
 * AgentTimeline - Agent 执行时间线可视化
 *
 * 显示 Agent 执行过程中的事件时间线：
 * - LLM 调用
 * - 工具调用和结果
 * - Checkpoint 创建
 * - 压缩操作
 */

import { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, ChevronDown, ChevronRight, Clock } from 'lucide-react';

import { checkpointApi } from '../../services/api';

// Types
export interface TimelineEvent {
  id: string;
  type: 'llm_call' | 'llm_response' | 'tool_call' | 'tool_result' | 'checkpoint' | 'compact' | 'error';
  timestamp: number;
  duration?: number;
  iteration?: number;
  data: Record<string, unknown>;
}

interface AgentTimelineProps {
  sessionId: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

// 事件颜色映射
const eventColors: Record<string, string> = {
  llm_call: '#4CAF50',
  llm_response: '#66BB6A',
  tool_call: '#2196F3',
  tool_result: '#42A5F5',
  checkpoint: '#9C27B0',
  compact: '#F44336',
  error: '#E53935',
};

// API
async function fetchTimeline(sessionId: string): Promise<TimelineEvent[]> {
  try {
    // 先尝试从 checkpoint API 获取
    const response = await checkpointApi.getTimeline(sessionId);
    return (response.data.timeline as TimelineEvent[]) || [];
  } catch {
    return [];
  }
}

async function subscribeEvents(
  sessionId: string,
  onEvent: (event: TimelineEvent) => void
): Promise<() => void> {
  const eventSource = new EventSource(`/api/debug/sessions/${sessionId}/events`);

  eventSource.onmessage = (e) => {
    try {
      const event = JSON.parse(e.data) as TimelineEvent;
      onEvent(event);
    } catch {
      // ignore
    }
  };

  return () => eventSource.close();
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${((ms % 60000) / 1000).toFixed(0)}s`;
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString();
}

export function AgentTimeline({ sessionId, autoRefresh = true, refreshInterval = 2000 }: AgentTimelineProps) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);

  // 加载初始数据
  useEffect(() => {
    fetchTimeline(sessionId).then(setEvents);
  }, [sessionId]);

  // 实时订阅
  useEffect(() => {
    if (!autoRefresh || !isPlaying) return;

    const unsubscribe = subscribeEvents(sessionId, (event) => {
      setEvents(prev => [...prev, event]);
    });

    return () => {
      unsubscribe.then(fn => fn());
    };
  }, [sessionId, autoRefresh, isPlaying]);

  // 自动滚动到底部
  useEffect(() => {
    if (containerRef.current && isPlaying) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [events, isPlaying]);

  const toggleExpand = (eventId: string) => {
    setExpandedEvents(prev => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  };

  const totalDuration = events.length > 0
    ? events[events.length - 1].timestamp - events[0].timestamp
    : 0;

  return (
    <div className="flex flex-col h-full bg-gray-900 text-gray-100">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700">
        <div className="flex items-center gap-4">
          <h3 className="font-semibold">执行时间线</h3>
          <span className="text-sm text-gray-400">
            {events.length} 事件 · {formatDuration(totalDuration)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-1.5 rounded hover:bg-gray-700"
            title={isPlaying ? '暂停' : '播放'}
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <button
            onClick={() => fetchTimeline(sessionId).then(setEvents)}
            className="p-1.5 rounded hover:bg-gray-700"
            title="刷新"
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </div>

      {/* Timeline */}
      <div ref={containerRef} className="flex-1 overflow-auto p-2">
        {events.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <Clock size={24} className="mr-2" />
            等待事件...
          </div>
        ) : (
          <div className="relative">
            {/* 时间线竖线 */}
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-700" />

            {events.map((event, index) => (
              <div
                key={event.id}
                className="relative flex items-start gap-3 py-2 pl-8 cursor-pointer hover:bg-gray-800 rounded"
                onClick={() => setSelectedEvent(event)}
              >
                {/* 节点 */}
                <div
                  className="absolute left-2 w-4 h-4 rounded-full border-2 border-gray-900"
                  style={{ backgroundColor: eventColors[event.type] || '#666' }}
                />

                {/* 内容 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">
                      {formatTime(event.timestamp)}
                    </span>
                    {event.iteration !== undefined && (
                      <span className="text-xs px-1.5 py-0.5 bg-gray-700 rounded">
                        iter {event.iteration}
                      </span>
                    )}
                    {event.duration !== undefined && (
                      <span className="text-xs text-gray-400">
                        {formatDuration(event.duration)}
                      </span>
                    )}
                  </div>

                  <div className="mt-1 font-medium">
                    {event.type.replace('_', ' ')}
                  </div>

                  {/* 展开详情 */}
                  {expandedEvents.has(event.id) && (
                    <div className="mt-2 p-2 bg-gray-800 rounded text-xs font-mono overflow-auto max-h-40">
                      <pre>{JSON.stringify(event.data, null, 2)}</pre>
                    </div>
                  )}

                  {/* 快速预览 */}
                  {!expandedEvents.has(event.id) && event.data && (
                    <div className="mt-1 text-xs text-gray-400 truncate">
                      {JSON.stringify(event.data).slice(0, 100)}
                    </div>
                  )}
                </div>

                {/* 展开按钮 */}
                {event.data && Object.keys(event.data).length > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleExpand(event.id);
                    }}
                    className="p-1 hover:bg-gray-700 rounded"
                  >
                    {expandedEvents.has(event.id) ? (
                      <ChevronDown size={14} />
                    ) : (
                      <ChevronRight size={14} />
                    )}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Selected Event Detail */}
      {selectedEvent && (
        <div className="border-t border-gray-700 p-4 bg-gray-800 max-h-60 overflow-auto">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold">事件详情</h4>
            <button
              onClick={() => setSelectedEvent(null)}
              className="text-gray-400 hover:text-white"
            >
              ✕
            </button>
          </div>
          <pre className="text-xs font-mono whitespace-pre-wrap">
            {JSON.stringify(selectedEvent, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export default AgentTimeline;
