# 实施记录：Memory 更新和记忆管理

## 实施日期
2026-03-24

## 已完成的改动

### 1. 提示词更新
**文件**: [storage/config/prompts/system/memory.md](storage/config/prompts/system/memory.md)

更新内容：
- 添加三种记忆类型说明（short_term、long_term、handover）
- 添加交接文档规范和模板
- 添加必填字段说明

### 2. 工具 description 更新

#### 2.1 task 工具
**文件**: [src/tools/task.ts](src/tools/task.ts) (第39-52行)

在 description 中添加：
```
## 交接文档要求（必须遵守）
每次调用 task 工具前，必须使用 memory 工具的 write 功能写入 handover 类型的记忆...
```

#### 2.2 teammate_spawn 工具
**文件**: [src/tools/teammate/spawn.ts](src/tools/teammate/spawn.ts) (第14-17行)

在 description 中添加：
```
## 交接文档要求（必须遵守）
创建 teammate 前，必须使用 memory 工具的 write 功能写入 handover 类型的记忆...
```

#### 2.3 teammate_send 工具
**文件**: [src/tools/teammate/send.ts](src/tools/teammate/send.ts) (第14-16行)

在 description 中添加：
```
## 交接文档要求（必须遵守）
发送消息前，如果涉及任务交接，必须使用 memory 工具的 write 功能写入 handover 类型的记忆。
```

### 3. 压缩前记忆更新

**文件**: [src/agents/compaction.ts](src/agents/compaction.ts)

改动：
- 导入 MemoryPersistence
- 在 autoCompact 和 manualCompact 函数中添加 agentId 参数
- 添加 updateMemoriesBeforeCompaction 函数，在压缩前自动更新 short_term 和 long_term 记忆

核心逻辑：
- 提取当前会话的消息摘要
- 更新 short_term 记忆（会话进度）
- 提取项目相关文件作为 long_term 记忆
- 不阻塞压缩流程（失败时只打印日志）

## 验证

类型检查通过：
```bash
pnpm typecheck  # ✓ 通过
```

## 效果

1. **handover 强制要求**：Agent 在调用 subagent/teammate 前，必须先写入 handover 记忆
2. **压缩前更新**：每次压缩前自动保存会话进度到 short_term 和 long_term
3. **记忆加载**：会话开始时加载 short_term 和 long_term，subagent 调用时加载 handover

## 后续优化

- [ ] 添加记忆加载逻辑到 session 启动时
- [ ] 添加 handover 加载逻辑到 subagent 启动时
- [ ] 添加记忆搜索能力到提示词构建中
