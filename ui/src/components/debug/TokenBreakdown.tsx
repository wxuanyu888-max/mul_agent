/**
 * TokenBreakdown - Token 消耗分析面板
 *
 * 显示 Agent 执行过程中的 Token 消耗分布：
 * - System Prompt
 * - LLM 输入/输出
 * - 工具结果
 * - 实时更新
 */

import { useState, useEffect, useMemo } from 'react';
import { PieChart, BarChart3, TrendingUp, Zap } from 'lucide-react';
import { checkpointApi } from '../../services/api';

interface TokenEvent {
  type: 'system' | 'llm_input' | 'llm_output' | 'tool_result';
  tokens: number;
  iteration?: number;
  timestamp: number;
}

interface TokenBreakdownProps {
  sessionId: string;
}

// API - 注意：debug API 的 tokens 端点通过 checkpoint API 复用 timeline 数据
async function fetchTokenEvents(sessionId: string): Promise<TokenEvent[]> {
  try {
    const response = await checkpointApi.getTimeline(sessionId);
    // 从 timeline 事件中提取 token 相关信息
    const timeline = (response.data.timeline as Array<{ type: string; tokens?: number; iteration?: number; timestamp?: number }>) || [];
    return timeline
      .filter(e => e.type === 'llm_call' || e.type === 'llm_response' || e.type === 'tool_result')
      .map(e => ({
        type: e.type === 'llm_call' ? 'llm_input' : e.type === 'llm_response' ? 'llm_output' : 'tool_result',
        tokens: (e.tokens as number) || 0,
        iteration: e.iteration,
        timestamp: (e.timestamp as number) || Date.now(),
      }));
  } catch {
    return [];
  }
}

export function TokenBreakdown({ sessionId }: TokenBreakdownProps) {
  const [events, setEvents] = useState<TokenEvent[]>([]);

  useEffect(() => {
    fetchTokenEvents(sessionId).then(setEvents);

    // 定时刷新
    const interval = setInterval(() => {
      fetchTokenEvents(sessionId).then(setEvents);
    }, 5000);

    return () => clearInterval(interval);
  }, [sessionId]);

  // 计算统计
  const stats = useMemo(() => {
    let system = 0;
    let llmInput = 0;
    let llmOutput = 0;
    let toolResult = 0;

    for (const event of events) {
      switch (event.type) {
        case 'system':
          system += event.tokens;
          break;
        case 'llm_input':
          llmInput += event.tokens;
          break;
        case 'llm_output':
          llmOutput += event.tokens;
          break;
        case 'tool_result':
          toolResult += event.tokens;
          break;
      }
    }

    const total = system + llmInput + llmOutput + toolResult;

    return {
      system,
      llmInput,
      llmOutput,
      toolResult,
      total,
      byIteration: events.reduce((acc, e) => {
        if (e.iteration !== undefined) {
          acc[e.iteration] = (acc[e.iteration] || 0) + e.tokens;
        }
        return acc;
      }, {} as Record<number, number>),
    };
  }, [events]);

  // 颜色
  const colors = {
    system: '#9C27B0',    // Purple
    llmInput: '#4CAF50',  // Green
    llmOutput: '#2196F3',  // Blue
    toolResult: '#FF9800', // Orange
  };

  // 计算百分比
  const getPercent = (value: number) => {
    if (stats.total === 0) return 0;
    return (value / stats.total) * 100;
  };

  // 迭代次数组
  const iterations = Object.keys(stats.byIteration).map(Number).sort((a, b) => a - b);

  return (
    <div className="flex flex-col h-full bg-gray-900 text-gray-100">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <BarChart3 size={16} />
          <h3 className="font-semibold">Token 消耗分析</h3>
        </div>
        <span className="text-sm text-gray-400">
          总计: {stats.total.toLocaleString()}
        </span>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-2 p-4">
        <div className="p-3 bg-gray-800 rounded-lg">
          <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
            <Zap size={12} />
            LLM 输入
          </div>
          <div className="text-xl font-bold" style={{ color: colors.llmInput }}>
            {stats.llmInput.toLocaleString()}
          </div>
          <div className="text-xs text-gray-500">
            {getPercent(stats.llmInput).toFixed(1)}%
          </div>
        </div>

        <div className="p-3 bg-gray-800 rounded-lg">
          <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
            <TrendingUp size={12} />
            LLM 输出
          </div>
          <div className="text-xl font-bold" style={{ color: colors.llmOutput }}>
            {stats.llmOutput.toLocaleString()}
          </div>
          <div className="text-xs text-gray-500">
            {getPercent(stats.llmOutput).toFixed(1)}%
          </div>
        </div>

        <div className="p-3 bg-gray-800 rounded-lg">
          <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
            <PieChart size={12} />
            System Prompt
          </div>
          <div className="text-xl font-bold" style={{ color: colors.system }}>
            {stats.system.toLocaleString()}
          </div>
          <div className="text-xs text-gray-500">
            {getPercent(stats.system).toFixed(1)}%
          </div>
        </div>

        <div className="p-3 bg-gray-800 rounded-lg">
          <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
            工具结果
          </div>
          <div className="text-xl font-bold" style={{ color: colors.toolResult }}>
            {stats.toolResult.toLocaleString()}
          </div>
          <div className="text-xs text-gray-500">
            {getPercent(stats.toolResult).toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Breakdown Bar */}
      <div className="px-4 pb-2">
        <div className="h-4 rounded-full overflow-hidden flex">
          {stats.system > 0 && (
            <div
              className="h-full transition-all"
              style={{
                width: `${getPercent(stats.system)}%`,
                backgroundColor: colors.system,
              }}
              title={`System: ${stats.system}`}
            />
          )}
          {stats.llmInput > 0 && (
            <div
              className="h-full transition-all"
              style={{
                width: `${getPercent(stats.llmInput)}%`,
                backgroundColor: colors.llmInput,
              }}
              title={`LLM Input: ${stats.llmInput}`}
            />
          )}
          {stats.llmOutput > 0 && (
            <div
              className="h-full transition-all"
              style={{
                width: `${getPercent(stats.llmOutput)}%`,
                backgroundColor: colors.llmOutput,
              }}
              title={`LLM Output: ${stats.llmOutput}`}
            />
          )}
          {stats.toolResult > 0 && (
            <div
              className="h-full transition-all"
              style={{
                width: `${getPercent(stats.toolResult)}%`,
                backgroundColor: colors.toolResult,
              }}
              title={`Tool Result: ${stats.toolResult}`}
            />
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="px-4 pb-4 flex flex-wrap gap-3 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: colors.system }} />
          <span className="text-gray-400">System</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: colors.llmInput }} />
          <span className="text-gray-400">LLM Input</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: colors.llmOutput }} />
          <span className="text-gray-400">LLM Output</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: colors.toolResult }} />
          <span className="text-gray-400">Tool Results</span>
        </div>
      </div>

      {/* Per Iteration Chart */}
      {iterations.length > 0 && (
        <div className="flex-1 px-4 pb-4 overflow-auto">
          <h4 className="text-sm font-medium text-gray-400 mb-2">每轮 Token 消耗</h4>
          <div className="flex items-end gap-1 h-24">
            {iterations.map(iter => {
              const height = (stats.byIteration[iter] / Math.max(...Object.values(stats.byIteration))) * 100;
              return (
                <div
                  key={iter}
                  className="flex-1 bg-blue-600 rounded-t transition-all hover:bg-blue-500"
                  style={{ height: `${height}%` }}
                  title={`迭代 ${iter}: ${stats.byIteration[iter].toLocaleString()} tokens`}
                />
              );
            })}
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>1</span>
            <span>迭代</span>
            <span>{iterations.length}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default TokenBreakdown;
