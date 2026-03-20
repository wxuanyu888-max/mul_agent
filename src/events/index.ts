/**
 * Events - 事件通知系统
 *
 * 提供 Agent 间的事件通信能力
 */

export {
  getEventEmitter,
  emitEvent,
  subscribeToEvents,
  unsubscribeFromEvents,
  getEventHistory,
  emitTaskCompleted,
  emitTaskFailed,
  emitMemberJoined,
  emitMemberLeft,
  emitDelegationCompleted,
  type Event,
  type EventType,
} from './emitter.js';
