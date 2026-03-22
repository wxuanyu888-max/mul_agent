/**
 * 自主规划模块导出
 *
 * 提供任务规划、自我反思和目标追踪能力
 */

// Import types for re-export
import type {
  SubtaskStatus,
  GoalStatus,
  Subtask,
  Goal,
  PlanningResult,
  ReflectionResult,
  ExecutionContext,
  PlanningConfig,
  ReflectionTrigger,
  MetacognitionResult,
  IGoalTracker,
  IPlanner,
  IReflector,
} from './types.js';

// Re-export all types
export type {
  SubtaskStatus,
  GoalStatus,
  Subtask,
  Goal,
  PlanningResult,
  ReflectionResult,
  ExecutionContext,
  PlanningConfig,
  ReflectionTrigger,
  MetacognitionResult,
  IGoalTracker,
  IPlanner,
  IReflector,
};

// Import implementations
import { PlanningAgent, createPlanner } from './planner.js';
import { Reflector, createReflector } from './reflector.js';
import { GoalTracker, createGoalTracker } from './goal-tracker.js';

// Export implementations
export { PlanningAgent, createPlanner };
export { Reflector, createReflector };
export { GoalTracker, createGoalTracker };

// Convenience function to create all planning components
export interface PlanningComponents {
  planner: IPlanner;
  reflector: IReflector;
  goalTracker: IGoalTracker;
}

/**
 * 创建所有规划组件
 */
export function createPlanningComponents(config?: PlanningConfig): PlanningComponents {
  return {
    planner: createPlanner(config),
    reflector: createReflector(),
    goalTracker: createGoalTracker(),
  };
}
