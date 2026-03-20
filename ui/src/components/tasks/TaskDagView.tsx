/**
 * TaskDagView - 任务依赖 DAG 可视化
 */

import React, { useMemo } from 'react';
import { GitBranch } from 'lucide-react';
import type { Task as TaskType } from '../../types';

interface TaskDagViewProps {
  tasks: TaskType[];
  onSelectTask: (taskId: string) => void;
}

const statusColors: Record<string, { bg: string; border: string; text: string }> = {
  pending: { bg: 'bg-gray-50', border: 'border-gray-300', text: 'text-gray-600' },
  in_progress: { bg: 'bg-blue-50', border: 'border-blue-300', text: 'text-blue-600' },
  completed: { bg: 'bg-green-50', border: 'border-green-300', text: 'text-green-600' },
};

export function TaskDagView({ tasks, onSelectTask }: TaskDagViewProps) {
  // 构建 DAG 布局
  const { nodes, edges, levels } = useMemo(() => {
    const nodeMap = new Map<string, TaskType>();
    const inDegree = new Map<string, number>();
    const outEdges: { from: string; to: string }[] = [];

    // 建立节点映射
    tasks.forEach(t => {
      nodeMap.set(String(t.id), t);
      inDegree.set(String(t.id), 0);
    });

    // 建立边关系
    tasks.forEach(t => {
      const taskId = String(t.id);
      (t.blockedBy || []).forEach(blockedId => {
        const blockedIdStr = String(blockedId);
        if (nodeMap.has(blockedIdStr)) {
          outEdges.push({ from: blockedIdStr, to: taskId });
          inDegree.set(taskId, (inDegree.get(taskId) || 0) + 1);
        }
      });
    });

    // 计算层级 (拓扑排序)
    const levels = new Map<string, number>();
    const queue: string[] = [];

    // 从入度为0的开始
    inDegree.forEach((deg, id) => {
      if (deg === 0) queue.push(id);
    });

    let level = 0;
    while (queue.length > 0) {
      const size = queue.length;
      for (let i = 0; i < size; i++) {
        const nodeId = queue.shift()!;
        levels.set(nodeId, level);

        // 找子节点
        outEdges.forEach(e => {
          if (e.from === nodeId) {
            const newDeg = (inDegree.get(e.to) || 0) - 1;
            inDegree.set(e.to, newDeg);
            if (newDeg === 0) queue.push(e.to);
          }
        });
      }
      level++;
    }

    // 处理没有依赖的节点
    tasks.forEach(t => {
      const id = String(t.id);
      if (!levels.has(id)) {
        levels.set(id, 0);
      }
    });

    return { nodes: nodeMap, edges: outEdges, levels };
  }, [tasks]);

  // 按层级分组
  const tasksByLevel = useMemo(() => {
    const grouped = new Map<number, TaskType[]>();
    levels.forEach((level, id) => {
      const task = nodes.get(id);
      if (task) {
        if (!grouped.has(level)) grouped.set(level, []);
        grouped.get(level)!.push(task);
      }
    });
    return Array.from(grouped.entries()).sort((a, b) => a[0] - b[0]);
  }, [levels, nodes]);

  // 渲染连接线
  const renderEdges = () => {
    const lines: React.ReactElement[] = [];
    const levelMap = new Map<string, number>();

    // 计算每层的位置
    tasksByLevel.forEach(([level, tasksInLevel]) => {
      tasksInLevel.forEach((task, idx) => {
        levelMap.set(String(task.id), idx);
      });
    });

    let edgeId = 0;
    edges.forEach(edge => {
      const fromLevel = levels.get(edge.from) ?? 0;
      const toLevel = levels.get(edge.to) ?? 0;
      const fromIdx = levelMap.get(edge.from) ?? 0;
      const toIdx = levelMap.get(edge.to) ?? 0;

      if (fromLevel < toLevel) {
        const x1 = (fromLevel * 200) + 80;
        const x2 = (toLevel * 200) + 20;
        const y1 = (fromIdx * 60) + 40;
        const y2 = (toIdx * 60) + 40;

        lines.push(
          <g key={edgeId++}>
            <line
              x1={x1} y1={y1}
              x2={x2} y2={y2}
              stroke="#9ca3af"
              strokeWidth={2}
              markerEnd="url(#arrowhead)"
            />
          </g>
        );
      }
    });
    return lines;
  };

  if (tasks.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <div className="text-center">
          <GitBranch className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No tasks to display</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-4">
      <div className="flex items-center gap-2 mb-4">
        <GitBranch className="w-5 h-5 text-purple-600" />
        <span className="font-semibold">Task Dependency Graph</span>
        <span className="text-sm text-gray-400">({tasks.length} tasks)</span>
      </div>

      <div className="relative">
        <svg width={(tasksByLevel.length * 200) + 100} height={Math.max(tasksByLevel.length * 60, 300)}>
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill="#9ca3af" />
            </marker>
          </defs>

          {/* 渲染边 */}
          {renderEdges()}

          {/* 渲染节点 */}
          {tasksByLevel.map(([level, tasksInLevel]) => (
            <g key={level} transform={`translate(${level * 200}, 0)`}>
              {tasksInLevel.map((task, idx) => {
                const colors = statusColors[task.status] || statusColors.pending;
                return (
                  <g
                    key={task.id}
                    transform={`translate(0, ${idx * 60})`}
                    onClick={() => onSelectTask(String(task.id))}
                    className="cursor-pointer"
                  >
                    <rect
                      x={0}
                      y={0}
                      width={160}
                      height={50}
                      rx={8}
                      className={`${colors.bg} ${colors.border} border-2`}
                    />
                    <text
                      x={80}
                      y={20}
                      textAnchor="middle"
                      className={`text-sm font-medium ${colors.text}`}
                    >
                      {task.subject.length > 18 ? task.subject.slice(0, 18) + '...' : task.subject}
                    </text>
                    <text
                      x={80}
                      y={38}
                      textAnchor="middle"
                      className="text-xs fill-gray-400"
                    >
                      #{task.id} • {task.status}
                    </text>
                  </g>
                );
              })}
            </g>
          ))}
        </svg>
      </div>

      {/* 图例 */}
      <div className="mt-4 flex gap-4 text-sm">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-gray-50 border border-gray-300" />
          <span>Pending</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-blue-50 border border-blue-300" />
          <span>In Progress</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-green-50 border border-green-300" />
          <span>Completed</span>
        </div>
      </div>
    </div>
  );
}
