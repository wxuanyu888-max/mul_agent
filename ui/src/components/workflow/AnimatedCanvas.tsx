import { useEffect, useState, useCallback, useRef, memo } from 'react';
import {
  Brain,
  Bot,
  User,
  Play,
  Pause,
  RefreshCw,
  X,
  FileText,
  Activity,
  Clock,
  BookOpen,
  Loader2,
  ChevronRight,
  Sparkles,
  Terminal,
  MessageSquare,
  Heart,
  Database,
  Zap,
} from 'lucide-react';
import { infoApi } from '../../services/api';
import { ProjectSwitcher } from '../project/ProjectSwitcher';
import type { Interaction } from '../../types';

// ============================================================
// Types
// ============================================================

interface Entity {
  id: string;
  name: string;
  type: 'user' | 'brain' | 'agent';
  agentType?: string;
  description?: string;
  status: 'idle' | 'active' | 'executing';
  position: { x: number; y: number };
  velocity: { vx: number; vy: number };
  lastActiveTime: number;
  agentId?: string;
  projectId?: string;
  currentWork?: string;
}

interface Connection {
  id: string;
  source: string;
  target: string;
  type: string;
  task: string;
  status: string;
}

interface Bounds {
  width: number;
  height: number;
}

// ============================================================
// Constants
// ============================================================

const RELEASE_TIMEOUT = 5 * 60 * 1000; // 5 minutes
const BOUNDARY_PADDING = 60;
const MAX_SPEED = 1.5;
const SPEED_DAMPING = 0.98;
const DIRECTION_CHANGE = 0.1;
const CENTER_ATTRACTION = 0.03;
const CENTER_X_OFFSET = 0;
const CENTER_Y_OFFSET = 0;

// Node colors by type
const nodeColors = {
  brain: { bg: '#e8f4ff', border: '#0071e3', text: '#0071e3' },
  agent: { bg: '#f5f3ff', border: '#5e5ce6', text: '#5e5ce6' },
  user: { bg: '#fff0f7', border: '#ff2d55', text: '#c91f45' },
  subAgent: { bg: '#f0fdf4', border: '#34c759', text: '#2d7a38' },
};

const routeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  bash: Terminal,
  chat: MessageSquare,
  memory: Database,
  heart: Heart,
  create_user: Sparkles,
  response: Bot,
};

const statusColors: Record<string, string> = {
  idle: 'bg-gray-400',
  planning: 'bg-yellow-500',
  thinking: 'bg-yellow-500',
  executing: 'bg-green-500',
  running: 'bg-green-500',
  working: 'bg-green-500',
  waiting: 'bg-blue-400',
  pending: 'bg-amber-400',
  active: 'bg-green-500',
  completed: 'bg-blue-500',
  success: 'bg-blue-500',
  failed: 'bg-red-500',
  error: 'bg-red-500',
};

const statusLabels: Record<string, string> = {
  idle: '空闲',
  planning: '规划中',
  thinking: '思考中',
  executing: '执行工具',
  running: '运行中',
  working: '工作中',
  waiting: '等待响应',
  pending: '等待中',
  active: '活跃',
  completed: '已完成',
  success: '成功',
  failed: '失败',
  error: '错误',
};

// ============================================================
// Animation Engine
// ============================================================

class AnimationEngine {
  private entities: Entity[] = [];
  private bounds: Bounds = { width: 800, height: 600 };
  private animationId: number | null = null;
  private onUpdate: (entities: Entity[]) => void;
  private centerX: number = 400;
  private centerY: number = 300;

  constructor(onUpdate: (entities: Entity[]) => void) {
    this.onUpdate = onUpdate;
  }

  setBounds(bounds: Bounds) {
    this.bounds = bounds;
    this.centerX = bounds.width / 2 + CENTER_X_OFFSET;
    this.centerY = bounds.height / 2 + CENTER_Y_OFFSET;
  }

  setEntities(entities: Entity[]) {
    this.entities = entities.map(e => ({
      ...e,
      velocity: e.velocity.vx !== 0 || e.velocity.vy !== 0
        ? e.velocity
        : { vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2 }
    }));
  }

  start() {
    if (this.animationId !== null) return;
    this.tick();
  }

  stop() {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  private tick = () => {
    this.update();
    this.onUpdate([...this.entities]);
    this.animationId = requestAnimationFrame(this.tick);
  };

  private update() {
    const padding = BOUNDARY_PADDING;

    this.entities.forEach(entity => {
      if (entity.status === 'idle') {
        // Random direction change
        entity.velocity.vx += (Math.random() - 0.5) * DIRECTION_CHANGE;
        entity.velocity.vy += (Math.random() - 0.5) * DIRECTION_CHANGE;

        // Apply damping
        entity.velocity.vx *= SPEED_DAMPING;
        entity.velocity.vy *= SPEED_DAMPING;

        // Limit speed
        const speed = Math.sqrt(entity.velocity.vx ** 2 + entity.velocity.vy ** 2);
        if (speed > MAX_SPEED) {
          entity.velocity.vx = (entity.velocity.vx / speed) * MAX_SPEED;
          entity.velocity.vy = (entity.velocity.vy / speed) * MAX_SPEED;
        }

        // Ensure minimum movement
        if (speed < 0.3) {
          entity.velocity.vx = (Math.random() - 0.5) * 0.8;
          entity.velocity.vy = (Math.random() - 0.5) * 0.8;
        }

        // Update position
        entity.position.x += entity.velocity.vx;
        entity.position.y += entity.velocity.vy;

        // Boundary collision with bounce
        this.checkBoundary(entity, padding);

      } else if (entity.status === 'active' || entity.status === 'executing') {
        // Move towards center with slight offset variation
        const targetX = this.centerX + (Math.random() - 0.5) * 100;
        const targetY = this.centerY + (Math.random() - 0.5) * 80;

        entity.position.x += (targetX - entity.position.x) * CENTER_ATTRACTION;
        entity.position.y += (targetY - entity.position.y) * CENTER_ATTRACTION;
      }
    });
  }

  private checkBoundary(entity: Entity, padding: number) {
    const { width, height } = this.bounds;

    // Left boundary
    if (entity.position.x < padding) {
      entity.position.x = padding;
      entity.velocity.vx = Math.abs(entity.velocity.vx) * 0.5 + 0.3;
    }
    // Right boundary
    if (entity.position.x > width - padding) {
      entity.position.x = width - padding;
      entity.velocity.vx = -Math.abs(entity.velocity.vx) * 0.5 - 0.3;
    }
    // Top boundary
    if (entity.position.y < padding) {
      entity.position.y = padding;
      entity.velocity.vy = Math.abs(entity.velocity.vy) * 0.5 + 0.3;
    }
    // Bottom boundary
    if (entity.position.y > height - padding) {
      entity.position.y = height - padding;
      entity.velocity.vy = -Math.abs(entity.velocity.vy) * 0.5 - 0.3;
    }
  }
}

// ============================================================
// Agent Node Component
// ============================================================

interface AgentNodeProps {
  entity: Entity;
  isSelected: boolean;
  onClick: (entity: Entity) => void;
}

const AgentNodeComponent = memo(function AgentNodeComponent({
  entity,
  isSelected,
  onClick,
}: AgentNodeProps) {
  const colors = nodeColors[entity.type as keyof typeof nodeColors] || nodeColors.agent;
  const Icon = entity.type === 'user' ? User
    : entity.type === 'brain' ? Brain
    : routeIcons[entity.agentType || ''] || Bot;

  const isIdle = entity.status === 'idle';
  const isExecuting = entity.status === 'executing';

  return (
    <div
      className={`absolute transition-all duration-300 cursor-pointer ${
        isExecuting ? 'animate-pulse' : ''
      }`}
      style={{
        left: entity.position.x,
        top: entity.position.y,
        transform: 'translate(-50%, -50%)',
        opacity: isIdle ? 0.6 : 1,
        filter: isIdle ? 'grayscale(30%)' : 'none',
        zIndex: isIdle ? 1 : 10,
      }}
      onClick={() => onClick(entity)}
    >
      <div
        className={`px-4 py-3 rounded-xl shadow-lg border-2 bg-white ${
          isSelected ? 'ring-2 ring-blue-500 scale-105' : ''
        } ${isExecuting ? 'ring-2 ring-green-500' : ''}`}
        style={{
          borderColor: colors.border,
          minWidth: '160px',
          boxShadow: isIdle
            ? '0 2px 8px rgba(0,0,0,0.1)'
            : `0 4px 20px ${colors.border}40`,
        }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: colors.bg }}
          >
            <span style={{ color: colors.text }}>
              <Icon className="w-4 h-4" />
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-gray-900 font-semibold text-sm block truncate">
              {entity.name}
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  statusColors[entity.status] || statusColors.idle
                } ${isExecuting ? 'animate-pulse' : ''}`}
              />
              <span className="text-gray-500 text-xs truncate">
                {statusLabels[entity.status] || entity.status}
              </span>
            </div>
          </div>
        </div>
        {entity.agentType && entity.type === 'agent' && (
          <div className="flex items-center gap-1 mt-1.5 ml-11">
            <Zap className="w-3 h-3 text-gray-400" />
            <span className="text-gray-500 text-xs font-mono truncate max-w-[100px]">
              {entity.agentType}
            </span>
          </div>
        )}
        {entity.currentWork && !isIdle && (
          <div className="mt-2 ml-11 p-2 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 shadow-sm">
            <div className="flex items-center gap-1.5 mb-1">
              <Loader2 className="w-3 h-3 text-blue-500 animate-spin" />
              <p className="text-blue-700 text-xs font-semibold">Current Task</p>
            </div>
            <p className="text-blue-800 text-xs font-mono truncate leading-relaxed">
              {entity.currentWork}
            </p>
          </div>
        )}
      </div>
    </div>
  );
});

// ============================================================
// Connection Line Component
// ============================================================

interface ConnectionLineProps {
  connection: Connection;
  entities: Entity[];
}

const ConnectionLine = memo(function ConnectionLine({
  connection,
  entities,
}: ConnectionLineProps) {
  const sourceEntity = entities.find(e => e.id === connection.source);
  const targetEntity = entities.find(e => e.id === connection.target);

  if (!sourceEntity || !targetEntity) return null;

  const x1 = sourceEntity.position.x;
  const y1 = sourceEntity.position.y;
  const x2 = targetEntity.position.x;
  const y2 = targetEntity.position.y;

  // Calculate control point for bezier curve
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const controlX = midX - dy * 0.2;
  const controlY = midY + dx * 0.2;

  const isActive = connection.status === 'executing' || connection.status === 'active';

  const strokeColors: Record<string, string> = {
    chat: '#5e5ce6',
    bash: '#ff9500',
    create_user: '#34c759',
    memory: '#ff2d55',
    heart: '#0071e3',
    collaboration: '#a855f7',
    delegation: '#0071e3',
  };

  const strokeColor = strokeColors[connection.type] || '#6b7280';

  return (
    <g>
      {/* Connection line */}
      <path
        d={`M ${x1} ${y1} Q ${controlX} ${controlY} ${x2} ${y2}`}
        fill="none"
        stroke={strokeColor}
        strokeWidth={isActive ? 3 : 2}
        strokeDasharray={connection.type === 'collaboration' ? 'none' : '5,5'}
        className={isActive ? 'animate-pulse' : ''}
        style={{
          opacity: 0.8,
          transition: 'opacity 0.3s',
        }}
      />
      {/* Arrow head at target */}
      <circle
        cx={x2}
        cy={y2}
        r={4}
        fill={strokeColor}
      />
      {/* Label */}
      <foreignObject
        x={midX - 40}
        y={midY - 35}
        width={80}
        height={24}
      >
        <div
          className="bg-white rounded-full px-2 py-0.5 text-center text-xs font-medium shadow-sm"
          style={{
            color: strokeColor,
            border: `1px solid ${strokeColor}`,
          }}
        >
          {connection.type}
        </div>
      </foreignObject>
    </g>
  );
});

// ============================================================
// Agent Details Modal (kept from original)
// ============================================================

interface AgentDetailsModalProps {
  agentId: string;
  agentType?: string;
  projectId?: string;
  onClose: () => void;
}

function AgentDetailsModal({ agentId, agentType, projectId, onClose }: AgentDetailsModalProps) {
  const [details, setDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'soul' | 'role' | 'skill' | 'memory' | 'work' | 'logs'>('soul');

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const res = await infoApi.getAgentDetails(agentId, projectId);
        setDetails(res.data);
      } catch (error) {
        console.error('Failed to fetch agent details:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [agentId, projectId]);

  const tabs = [
    { id: 'soul', label: 'Soul', icon: FileText },
    { id: 'role', label: 'Role', icon: User },
    { id: 'skill', label: 'Skill', icon: Activity },
    { id: 'memory', label: 'Memory', icon: Clock },
    { id: 'work', label: 'Current Work', icon: Play },
    { id: 'logs', label: 'Logs', icon: BookOpen },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-100 to-purple-200 flex items-center justify-center">
              <Bot className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{details?.name || agentId}</h2>
              <p className="text-sm text-gray-500">{details?.description || agentType || 'Agent'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex border-b border-gray-200 px-6 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
            </div>
          ) : (
            <pre className="whitespace-pre-wrap text-gray-700 font-mono text-xs bg-gray-50 p-4 rounded-lg overflow-x-auto">
              {details?.[activeTab] || 'No content available'}
            </pre>
          )}
        </div>

        <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Agent ID: {agentId}</span>
            <span>Type: {agentType || 'standard'}</span>
            <span>Status: {details?.status || 'idle'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Main AnimatedCanvas Component
// ============================================================

export function AnimatedCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<AnimationEngine | null>(null);
  const releaseTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [entities, setEntities] = useState<Entity[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [bounds, setBounds] = useState<Bounds>({ width: 800, height: 600 });
  const [selectedAgent, setSelectedAgent] = useState<{ agentId: string; agentType?: string; projectId?: string } | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);

  // Initialize animation engine
  useEffect(() => {
    engineRef.current = new AnimationEngine((updatedEntities) => {
      setEntities(updatedEntities);
    });
    engineRef.current.start();

    return () => {
      engineRef.current?.stop();
    };
  }, []);

  // Handle resize
  useEffect(() => {
    const updateBounds = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const newBounds = { width: rect.width, height: rect.height };
        setBounds(newBounds);
        engineRef.current?.setBounds(newBounds);
      }
    };

    updateBounds();
    window.addEventListener('resize', updateBounds);

    return () => {
      window.removeEventListener('resize', updateBounds);
    };
  }, []);

  // Fetch agents and initialize entities
  const fetchAgents = useCallback(async () => {
    try {
      const res = await infoApi.getAgentTeam(selectedProjectId || undefined);
      const agents = res.data.agents || [];

      // Initialize entities with random positions
      const initialEntities: Entity[] = [
        {
          id: 'user',
          name: 'User',
          type: 'user',
          status: 'idle',
          position: {
            x: Math.random() * (bounds.width - 200) + 100,
            y: Math.random() * (bounds.height - 200) + 100,
          },
          velocity: { vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2 },
          lastActiveTime: Date.now(),
        },
        {
          id: 'core-brain',
          name: 'Core Brain',
          type: 'brain',
          description: 'Central Coordinator',
          status: 'idle',
          position: {
            x: bounds.width / 2,
            y: bounds.height / 2,
          },
          velocity: { vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2 },
          lastActiveTime: Date.now(),
          agentId: 'core_brain',
          agentType: 'coordinator',
        },
        ...agents.map((agent: any, index: number) => ({
          id: `agent-${agent.agent_id}`,
          name: agent.name || agent.agent_id,
          type: 'agent' as const,
          agentType: agent.agent_type,
          description: agent.description || 'Team Member',
          status: 'idle' as const,
          position: {
            x: Math.random() * (bounds.width - 200) + 100,
            y: Math.random() * (bounds.height - 200) + 100,
          },
          velocity: { vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2 },
          lastActiveTime: Date.now(),
          agentId: agent.agent_id,
          projectId: agent.project_id,
        })),
      ];

      setEntities(initialEntities);
      engineRef.current?.setEntities(initialEntities);
    } catch (err) {
      console.error('Failed to fetch agents:', err);
    }
  }, [selectedProjectId, bounds]);

  // Fetch interactions and update entity states
  const fetchInteractions = useCallback(async () => {
    try {
      const res = await infoApi.getInteractions(50);
      const interactionList: Interaction[] = res.data.interactions || [];

      if (interactionList.length === 0) {
        // No interactions - release all agents after timeout
        return;
      }

      const now = Date.now();

      // Find the most recent interaction
      const latestInteraction = interactionList[0];

      // Build connections from interactions
      const newConnections: Connection[] = interactionList.map((interaction, index) => ({
        id: `conn-${interaction.run_id}`,
        source: interaction.source === 'wang' || interaction.source === 'core-brain'
          ? 'core-brain'
          : `agent-${interaction.source}`,
        target: interaction.target === 'wang' || interaction.target === 'core-brain'
          ? 'core-brain'
          : `agent-${interaction.target}`,
        type: interaction.type,
        task: interaction.task,
        status: interaction.status,
      }));

      setConnections(newConnections);

      // Update entity states
      setEntities(prevEntities => {
        const updatedEntities = prevEntities.map(entity => {
          const isSource = newConnections.some(c => c.source === entity.id);
          const isTarget = newConnections.some(c => c.target === entity.id);

          if (isSource || isTarget) {
            return {
              ...entity,
              status: (interactionList.find(i =>
                (i.source === entity.id.replace('agent-', '') || i.source === entity.id || i.source === 'core-brain' && entity.id === 'core-brain') ||
                (i.target === entity.id.replace('agent-', '') || i.target === entity.id || i.target === 'core-brain' && entity.id === 'core-brain')
              )?.status || 'active') as Entity['status'],
              lastActiveTime: now,
            };
          }

          return entity;
        });

        engineRef.current?.setEntities(updatedEntities);
        return updatedEntities;
      });

      // Reset release timer
      if (releaseTimerRef.current) {
        clearTimeout(releaseTimerRef.current);
      }
      releaseTimerRef.current = setTimeout(() => {
        releaseAllAgents();
      }, RELEASE_TIMEOUT);

    } catch (err) {
      console.error('Failed to fetch interactions:', err);
    }
  }, []);

  // Release all agents to idle
  const releaseAllAgents = useCallback(() => {
    setEntities(prevEntities => {
      const releasedEntities = prevEntities.map(entity => ({
        ...entity,
        status: 'idle' as const,
        velocity: { vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2 },
      }));
      engineRef.current?.setEntities(releasedEntities);
      return releasedEntities;
    });
    setConnections([]);
    setIsActive(false);
  }, []);

  // Check for idle timeout every second
  useEffect(() => {
    const checkIdleTimeout = setInterval(() => {
      const now = Date.now();
      setEntities(prevEntities => {
        let shouldUpdate = false;
        const updatedEntities = prevEntities.map(entity => {
          if (entity.status !== 'idle' && now - entity.lastActiveTime > RELEASE_TIMEOUT) {
            shouldUpdate = true;
            return {
              ...entity,
              status: 'idle' as const,
              velocity: { vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2 },
            };
          }
          return entity;
        });

        if (shouldUpdate) {
          engineRef.current?.setEntities(updatedEntities);
          setConnections([]);
        }

        return shouldUpdate ? updatedEntities : prevEntities;
      });
    }, 1000);

    return () => clearInterval(checkIdleTimeout);
  }, []);

  // Initial fetch and polling
  useEffect(() => {
    fetchAgents();

    const pollInterval = setInterval(() => {
      fetchInteractions();
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [fetchAgents, fetchInteractions]);

  // Handle project change
  const handleProjectChange = useCallback((projectId: string | null) => {
    setSelectedProjectId(projectId);
  }, []);

  // Handle agent click
  const handleAgentClick = useCallback((entity: Entity) => {
    if (entity.agentId) {
      setSelectedAgent({
        agentId: entity.agentId,
        agentType: entity.agentType,
        projectId: entity.projectId,
      });
    }
  }, []);

  return (
    <div className="w-full h-full bg-white relative overflow-hidden">
      {/* Header */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
        <ProjectSwitcher
          selectedProjectId={selectedProjectId || undefined}
          onProjectChange={handleProjectChange}
        />

        {/* Status Card */}
        <div className="bg-white/90 backdrop-blur-sm rounded-xl border border-gray-200 p-4 shadow-lg min-w-[200px]">
          <div className="flex items-center gap-2 mb-2">
            {isActive ? (
              <Pause className="w-4 h-4 text-green-500 animate-pulse" />
            ) : (
              <Play className="w-4 h-4 text-gray-400" />
            )}
            <h2 className="text-base font-semibold text-gray-900">Workflow Status</h2>
          </div>
          <div className="space-y-1.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Status:</span>
              <span className={`font-medium ${isActive ? 'text-green-600' : 'text-gray-400'}`}>
                {isActive ? 'Running' : 'Idle'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Agents:</span>
              <span className="font-medium text-gray-700">{entities.filter(e => e.type === 'agent').length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Connections:</span>
              <span className="font-medium text-gray-700">{connections.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Canvas Container */}
      <div
        ref={containerRef}
        className="w-full h-full"
        style={{
          background: '#ffffff',
        }}
      >
        {/* SVG for connections */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill="#6b7280" />
            </marker>
          </defs>
          {connections.map(conn => (
            <ConnectionLine
              key={conn.id}
              connection={conn}
              entities={entities}
            />
          ))}
        </svg>

        {/* Agent Nodes */}
        {entities.map(entity => (
          <AgentNodeComponent
            key={entity.id}
            entity={entity}
            isSelected={selectedAgent?.agentId === entity.agentId}
            onClick={handleAgentClick}
          />
        ))}
      </div>

      {/* Refresh Button */}
      <button
        onClick={() => { fetchAgents(); fetchInteractions(); }}
        className="absolute bottom-4 right-4 z-10 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg p-2 shadow-lg transition-colors"
        title="Refresh"
      >
        <RefreshCw className="w-5 h-5 text-gray-600" />
      </button>

      {/* Agent Details Modal */}
      {selectedAgent && (
        <AgentDetailsModal
          agentId={selectedAgent.agentId}
          agentType={selectedAgent.agentType}
          projectId={selectedAgent.projectId}
          onClose={() => setSelectedAgent(null)}
        />
      )}

      {/* CSS for animations */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        .animate-pulse {
          animation: pulse 1.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
