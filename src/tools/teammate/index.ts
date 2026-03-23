/**
 * Teammate tools - 队友工具集
 *
 * 提供以下工具（已简化为 2 个核心工具）：
 * - teammate_spawn: 创建队友
 * - teammate_send: 发送消息给队友
 *
 * 以下工具已禁用（代码保留）：
 * - teammate_inbox: 已禁用
 * - teammate_broadcast: 已禁用
 * - teammate_list: 已禁用（列表默认加载到提示词）
 * - teammate_delegate: 已禁用
 * - teammate_delegation_status: 已禁用
 * - teammate_ask: 已禁用
 */

export { createTeammateSpawnTool } from './spawn.js';
export { createTeammateSendTool } from './send.js';
// 以下工具已禁用，代码保留但不再导出
// export { createTeammateInboxTool } from './inbox.js';
// export { createTeammateBroadcastTool } from './broadcast.js';
// export { createTeammateListTool } from './list.js';
// export { createTeammateDelegateTool, createTeammateDelegationStatusTool } from './delegate.js';
// export { createTeammateAskTool } from './ask.js';
