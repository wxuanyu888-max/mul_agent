import { useEffect, useRef, useCallback, useState } from 'react';
import {
  Bot,
  User,
  Brain,
  Play,
  Pause,
  RefreshCw,
  X,
  FileText,
  Activity,
  Clock,
  BookOpen,
  Loader2,
  Sparkles,
  Terminal,
  MessageSquare,
  Heart,
  Database,
} from 'lucide-react';
import { infoApi } from '../../services/api';
import { ProjectSwitcher } from '../project/ProjectSwitcher';
import type { Interaction } from '../../types';

// ============================================================
// Types
// ============================================================

interface Particle {
  id: string;
  name: string;
  type: 'user' | 'brain' | 'agent';
  agentType?: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  status: 'idle' | 'active' | 'executing';
  lastActiveTime: number;
  agentId?: string;
  projectId?: string;
  currentWork?: string;
  color: { bg: string; border: string; text: string };
  // Target position for active particles (fixed until released)
  targetX?: number;
  targetY?: number;
}

interface Connection {
  sourceId: string;
  targetId: string;
  type: string;
  task: string;
  status: string;
}

// ============================================================
// Constants
// ============================================================

const RELEASE_TIMEOUT = 5 * 60 * 1000;
const BOUNDARY_PADDING = 60;
const MAX_SPEED = 1.5;
const FRICTION = 0.99;
const DIRECTION_CHANGE = 0.15;
const CENTER_ATTRACTION = 0.02;
const MIN_SPEED = 0.5;

// Colors
const nodeColors = {
  brain: { bg: '#e8f4ff', border: '#0071e3', text: '#0071e3' },
  agent: { bg: '#f5f3ff', border: '#5e5ce6', text: '#5e5ce6' },
  user: { bg: '#fff0f7', border: '#ff2d55', text: '#c91f45' },
};

const statusColors: Record<string, string> = {
  idle: '#9ca3af',
  planning: '#f59e0b',
  thinking: '#f59e0b',
  executing: '#22c55e',
  running: '#22c55e',
  working: '#22c55e',
  waiting: '#3b82f6',
  pending: '#f59e0b',
  active: '#22c55e',
  completed: '#3b82f6',
  success: '#3b82f6',
  failed: '#ef4444',
  error: '#ef4444',
};

const connectionColors: Record<string, string> = {
  chat: '#5e5ce6',
  bash: '#ff9500',
  create_user: '#34c759',
  memory: '#ff2d55',
  heart: '#0071e3',
  collaboration: '#a855f7',
  delegation: '#0071e3',
};

// ============================================================
// Particle System (runs independently, no React state)
// ============================================================

class ParticleSystem {
  private particles: Map<string, Particle> = new Map();
  private connections: Connection[] = [];
  private width: number = 800;
  private height: number = 600;
  private animationId: number | null = null;
  private isRunning: boolean = false;

  setSize(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  setParticles(particles: Particle[]) {
    this.particles.clear();
    particles.forEach(p => this.particles.set(p.id, p));
  }

  updateParticle(id: string, updates: Partial<Particle>) {
    const particle = this.particles.get(id);
    if (particle) {
      Object.assign(particle, updates);
    }
  }

  setConnections(connections: Connection[]) {
    this.connections = connections;
  }

  getParticles(): Particle[] {
    return Array.from(this.particles.values());
  }

  getConnections(): Connection[] {
    return this.connections;
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.tick();
  }

  stop() {
    this.isRunning = false;
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  private tick = () => {
    if (!this.isRunning) return;
    this.update();
    this.animationId = requestAnimationFrame(this.tick);
  };

  private update() {
    const padding = BOUNDARY_PADDING;
    const centerX = this.width / 2;
    const centerY = this.height / 2;

    this.particles.forEach(particle => {
      if (particle.status === 'idle') {
        // Natural floating: add small random forces, let momentum handle the rest
        // This creates smooth, organic movement like objects floating on water

        // Small random acceleration (like gentle currents)
        const ax = (Math.random() - 0.5) * 0.15;
        const ay = (Math.random() - 0.5) * 0.15;

        particle.vx += ax;
        particle.vy += ay;

        // Apply strong friction to make movement smooth and damped
        particle.vx *= 0.96;
        particle.vy *= 0.96;

        // Calculate current speed
        const speed = Math.sqrt(particle.vx ** 2 + particle.vy ** 2);

        // Clamp to max speed
        if (speed > MAX_SPEED) {
          particle.vx = (particle.vx / speed) * MAX_SPEED;
          particle.vy = (particle.vy / speed) * MAX_SPEED;
        }

        // If too slow, give a gentle push in a somewhat random direction
        if (speed < MIN_SPEED) {
          const angle = Math.random() * Math.PI * 2;
          particle.vx += Math.cos(angle) * MIN_SPEED * 0.5;
          particle.vy += Math.sin(angle) * MIN_SPEED * 0.5;
        }

        // Update position
        particle.x += particle.vx;
        particle.y += particle.vy;

        // Boundary bounce
        if (particle.x < padding) {
          particle.x = padding;
          particle.vx = Math.abs(particle.vx) * 0.4 + 0.3;
        }
        if (particle.x > this.width - padding) {
          particle.x = this.width - padding;
          particle.vx = -Math.abs(particle.vx) * 0.4 - 0.3;
        }
        if (particle.y < padding) {
          particle.y = padding;
          particle.vy = Math.abs(particle.vy) * 0.4 + 0.3;
        }
        if (particle.y > this.height - padding) {
          particle.y = this.height - padding;
          particle.vy = -Math.abs(particle.vy) * 0.4 - 0.3;
        }

      } else {
        // Active - move towards fixed target (set when status changed to active)
        if (particle.targetX === undefined || particle.targetY === undefined) {
          particle.targetX = centerX + (Math.random() - 0.5) * 200;
          particle.targetY = centerY + (Math.random() - 0.5) * 150;
        }

        particle.x += (particle.targetX - particle.x) * CENTER_ATTRACTION;
        particle.y += (particle.targetY - particle.y) * CENTER_ATTRACTION;
      }
    });
  }
}

// ============================================================
// Drawing utilities
// ============================================================

function drawCircle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.closePath();
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ============================================================
// Agent Details Modal
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
    { id: 'work', label: 'Current Work', icon: Play },
    { id: 'soul', label: 'Soul', icon: FileText },
    { id: 'role', label: 'Role', icon: User },
    { id: 'skill', label: 'Skill', icon: Activity },
    { id: 'memory', label: 'Memory', icon: Clock },
    { id: 'logs', label: 'Logs', icon: BookOpen },
  ];

  const renderWorkPanel = () => {
    if (!details?.current_task) {
      return (
        <div className="text-center py-8 text-gray-500">
          <Bot className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No active task</p>
        </div>
      );
    }
    return (
      <div className="space-y-4">
        <div className="p-4 rounded-xl border-2 bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
          <div className="flex items-center gap-2 mb-2">
            <Loader2 className="w-5 h-5 text-green-600 animate-spin" />
            <span className="font-semibold text-gray-900">Current Task</span>
          </div>
          <p className="text-gray-700 font-mono text-sm bg-white p-3 rounded border border-gray-200">
            {details.current_task.task}
          </p>
        </div>
      </div>
    );
  };

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
          ) : activeTab === 'work' ? (
            renderWorkPanel()
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
// Main CanvasFlow Component
// ============================================================

export function CanvasFlow() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const particleSystemRef = useRef<ParticleSystem>(new ParticleSystem());
  const renderLoopRef = useRef<number | null>(null);

  const [selectedAgent, setSelectedAgent] = useState<{ agentId: string; agentType?: string; projectId?: string } | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [connectionCount, setConnectionCount] = useState(0);
  const [agentCount, setAgentCount] = useState(0);

  // Start particle system
  useEffect(() => {
    particleSystemRef.current.start();
    return () => {
      particleSystemRef.current.stop();
    };
  }, []);

  // Handle resize with ResizeObserver
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const newDims = { width: rect.width, height: rect.height };
        setDimensions(newDims);
        particleSystemRef.current.setSize(newDims.width, newDims.height);
      }
    };

    // Initial update
    updateDimensions();

    // Use ResizeObserver for more reliable size detection
    const resizeObserver = new ResizeObserver(() => {
      updateDimensions();
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Render loop - separate from particle update
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = dimensions.width * dpr;
      canvas.height = dimensions.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Clear
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, dimensions.width, dimensions.height);

      const particles = particleSystemRef.current.getParticles();
      const connections = particleSystemRef.current.getConnections();

      // Draw connections
      connections.forEach(conn => {
        const source = particles.find(p => p.id === conn.sourceId);
        const target = particles.find(p => p.id === conn.targetId);
        if (!source || !target) return;

        const color = connectionColors[conn.type] || '#6b7280';
        const isConnActive = conn.status === 'executing' || conn.status === 'active';

        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = isConnActive ? 3 : 2;
        ctx.globalAlpha = 0.6;

        // Bezier curve
        const midX = (source.x + target.x) / 2;
        const midY = (source.y + target.y) / 2;
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const controlX = midX - dy * 0.2;
        const controlY = midY + dx * 0.2;

        ctx.moveTo(source.x, source.y);
        ctx.quadraticCurveTo(controlX, controlY, target.x, target.y);
        ctx.stroke();

        // Arrow
        const angle = Math.atan2(target.y - controlY, target.x - controlX);
        ctx.beginPath();
        ctx.fillStyle = color;
        ctx.moveTo(target.x, target.y);
        ctx.lineTo(target.x - 12 * Math.cos(angle - 0.4), target.y - 12 * Math.sin(angle - 0.4));
        ctx.lineTo(target.x - 12 * Math.cos(angle + 0.4), target.y - 12 * Math.sin(angle + 0.4));
        ctx.closePath();
        ctx.fill();

        // Label
        ctx.globalAlpha = 1;
        ctx.font = 'bold 10px system-ui';
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.fillText(conn.type, midX, midY - 12);
      });

      // Draw particles
      particles.forEach(particle => {
        const isIdle = particle.status === 'idle';
        const isExecuting = particle.status === 'executing';

        ctx.globalAlpha = isIdle ? 0.7 : 1;

        // Glow
        if (!isIdle) {
          ctx.shadowColor = particle.color.border;
          ctx.shadowBlur = isExecuting ? 25 : 15;
        }

        // Main circle
        drawCircle(ctx, particle.x, particle.y, particle.radius);
        ctx.fillStyle = particle.color.bg;
        ctx.fill();
        ctx.strokeStyle = particle.color.border;
        ctx.lineWidth = isExecuting ? 3 : 2;
        ctx.stroke();

        ctx.shadowBlur = 0;

        // Inner circle for icon area
        drawCircle(ctx, particle.x, particle.y, particle.radius * 0.55);
        ctx.fillStyle = particle.color.border + '20';
        ctx.fill();

        // Icon (simple shapes based on type)
        ctx.fillStyle = particle.color.text;
        ctx.font = `bold ${particle.radius * 0.7}px system-ui`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        let icon = '?';
        if (particle.type === 'user') icon = 'U';
        else if (particle.type === 'brain') icon = 'B';
        else if (particle.agentType === 'bash') icon = '$_';
        else if (particle.agentType === 'chat') icon = '#';
        else if (particle.agentType === 'memory') icon = 'M';
        else icon = 'A';

        ctx.fillText(icon, particle.x, particle.y);

        // Name below
        ctx.fillStyle = '#111827';
        ctx.font = 'bold 10px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(particle.name, particle.x, particle.y + particle.radius + 14);

        // Status dot
        const statusColor = statusColors[particle.status] || statusColors.idle;
        drawCircle(ctx, particle.x + particle.radius - 8, particle.y - particle.radius + 8, 5);
        ctx.fillStyle = statusColor;
        if (isExecuting) {
          ctx.globalAlpha = 0.5 + Math.sin(Date.now() / 150) * 0.5;
        }
        ctx.fill();
        ctx.globalAlpha = isIdle ? 0.7 : 1;

        // Status label
        ctx.fillStyle = '#6b7280';
        ctx.font = '9px system-ui';
        ctx.textAlign = 'center';
        const statusLabels: Record<string, string> = {
          idle: 'Idle', active: 'Active', executing: 'Running',
          planning: 'Planning', thinking: 'Thinking', completed: 'Done', failed: 'Error'
        };
        ctx.fillText(statusLabels[particle.status] || particle.status, particle.x, particle.y + particle.radius + 26);

        // Type badge above
        if (particle.agentType && particle.type === 'agent') {
          ctx.fillStyle = particle.color.border;
          ctx.font = 'bold 8px system-ui';
          ctx.textAlign = 'center';
          ctx.fillText(particle.agentType, particle.x, particle.y - particle.radius - 6);
        }

        ctx.globalAlpha = 1;
      });

      renderLoopRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (renderLoopRef.current !== null) {
        cancelAnimationFrame(renderLoopRef.current);
      }
    };
  }, [dimensions]);

  // Create particle helper
  const createParticle = (
    type: Particle['type'],
    name: string,
    width: number,
    height: number,
    extras: Partial<Particle> = {}
  ): Particle => {
    const padding = BOUNDARY_PADDING + 50;
    const colors = type === 'user'
      ? nodeColors.user
      : type === 'brain'
      ? nodeColors.brain
      : nodeColors.agent;

    return {
      id: type === 'user' ? 'user' : type === 'brain' ? 'core-brain' : `agent-${extras.agentId || name}`,
      name,
      type,
      x: padding + Math.random() * (width - padding * 2),
      y: padding + Math.random() * (height - padding * 2),
      vx: (Math.random() - 0.5) * 2,
      vy: (Math.random() - 0.5) * 2,
      radius: 35,
      status: 'idle',
      lastActiveTime: Date.now(),
      color: colors,
      ...extras,
    };
  };

  const mapToParticleId = (id: string): string => {
    if (id === 'wang' || id === 'core-brain') return 'core-brain';
    return `agent-${id}`;
  };

  // Fetch agents
  const fetchAgents = useCallback(async () => {
    try {
      const res = await infoApi.getAgentTeam(selectedProjectId || undefined);
      const agents = res.data.agents || [];

      const initialParticles: Particle[] = [
        createParticle('user', 'User', dimensions.width, dimensions.height),
        createParticle('brain', 'Core Brain', dimensions.width, dimensions.height),
        ...agents.map((agent: any) =>
          createParticle('agent', agent.name || agent.agent_id, dimensions.width, dimensions.height, {
            agentId: agent.agent_id,
            projectId: agent.project_id,
            agentType: agent.agent_type,
          })
        ),
      ];

      particleSystemRef.current.setParticles(initialParticles);
      setAgentCount(agents.length);

      // Initialize connections to empty
      particleSystemRef.current.setConnections([]);
    } catch (err) {
      console.error('Failed to fetch agents:', err);
    }
  }, [selectedProjectId, dimensions]);

  // Fetch interactions
  const fetchInteractions = useCallback(async () => {
    try {
      const res = await infoApi.getInteractions(50);
      const interactionList: Interaction[] = res.data.interactions || [];

      if (interactionList.length === 0) {
        // Release all after timeout check
        const particles = particleSystemRef.current.getParticles();
        const now = Date.now();
        let hasReleased = false;

        particles.forEach(p => {
          if (p.status !== 'idle' && now - p.lastActiveTime > RELEASE_TIMEOUT) {
            particleSystemRef.current.updateParticle(p.id, {
              status: 'idle',
              vx: (Math.random() - 0.5) * 2,
              vy: (Math.random() - 0.5) * 2,
              targetX: undefined,
              targetY: undefined,
            });
            hasReleased = true;
          }
        });

        if (hasReleased) {
          particleSystemRef.current.setConnections([]);
          setIsActive(false);
        }
        return;
      }

      const now = Date.now();

      // Build connections
      const newConnections: Connection[] = interactionList.map(interaction => ({
        sourceId: mapToParticleId(interaction.source),
        targetId: mapToParticleId(interaction.target),
        type: interaction.type,
        task: interaction.task,
        status: interaction.status,
      }));

      particleSystemRef.current.setConnections(newConnections);
      setConnectionCount(newConnections.length);

      // Update particle states - only change target if particle is not already active
      interactionList.forEach(interaction => {
        const sourceId = mapToParticleId(interaction.source);
        const targetId = mapToParticleId(interaction.target);

        const sourceParticle = particleSystemRef.current.getParticles().find(p => p.id === sourceId);
        const targetParticle = particleSystemRef.current.getParticles().find(p => p.id === targetId);

        // Only clear target if particle is not already active (to prevent jitter)
        if (sourceParticle?.status !== 'active') {
          particleSystemRef.current.updateParticle(sourceId, {
            status: 'active',
            lastActiveTime: now,
            targetX: undefined,
            targetY: undefined,
          });
        } else {
          particleSystemRef.current.updateParticle(sourceId, {
            lastActiveTime: now, // Just update time
          });
        }

        const newTargetStatus = interaction.status === 'executing' ? 'executing' : 'active';
        if (targetParticle?.status !== 'active' && targetParticle?.status !== 'executing') {
          particleSystemRef.current.updateParticle(targetId, {
            status: newTargetStatus,
            lastActiveTime: now,
            targetX: undefined,
            targetY: undefined,
          });
        } else {
          particleSystemRef.current.updateParticle(targetId, {
            status: newTargetStatus,
            lastActiveTime: now,
          });
        }
      });

      setIsActive(true);
    } catch (err) {
      console.error('Failed to fetch interactions:', err);
    }
  }, []);

  // Initialize and poll
  useEffect(() => {
    fetchAgents();

    const pollInterval = setInterval(fetchInteractions, 2000);
    return () => clearInterval(pollInterval);
  }, [fetchAgents, fetchInteractions]);

  // Handle click
  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const particles = particleSystemRef.current.getParticles();
    const clicked = particles.find(p => {
      const dx = p.x - x;
      const dy = p.y - y;
      return Math.sqrt(dx * dx + dy * dy) < p.radius;
    });

    if (clicked?.agentId) {
      setSelectedAgent({
        agentId: clicked.agentId,
        agentType: clicked.agentType,
        projectId: clicked.projectId,
      });
    }
  }, []);

  const handleProjectChange = useCallback((projectId: string | null) => {
    setSelectedProjectId(projectId);
  }, []);

  return (
    <div className="w-full h-full bg-white relative overflow-hidden">
      {/* Header */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
        <ProjectSwitcher
          selectedProjectId={selectedProjectId || undefined}
          onProjectChange={handleProjectChange}
        />

        <div className="bg-white/90 backdrop-blur-sm rounded-xl border border-gray-200 p-4 shadow-lg min-w-[200px]">
          <div className="flex items-center gap-2 mb-2">
            {isActive ? (
              <Pause className="w-4 h-4 text-green-500 animate-pulse" />
            ) : (
              <Play className="w-4 h-4 text-gray-400" />
            )}
            <h2 className="text-base font-semibold text-gray-900">Workflow</h2>
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
              <span className="font-medium text-gray-700">{agentCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Connections:</span>
              <span className="font-medium text-gray-700">{connectionCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="w-full h-full">
        <canvas
          ref={canvasRef}
          style={{
            width: dimensions.width,
            height: dimensions.height,
            cursor: 'pointer',
          }}
          onClick={handleClick}
        />
      </div>

      {/* Refresh Button */}
      <button
        onClick={() => { fetchAgents(); fetchInteractions(); }}
        className="absolute bottom-4 right-4 z-10 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg p-2 shadow-lg transition-colors"
        title="Refresh"
      >
        <RefreshCw className="w-5 h-5 text-gray-600" />
      </button>

      {/* Agent Modal */}
      {selectedAgent && (
        <AgentDetailsModal
          agentId={selectedAgent.agentId}
          agentType={selectedAgent.agentType}
          projectId={selectedAgent.projectId}
          onClose={() => setSelectedAgent(null)}
        />
      )}
    </div>
  );
}
