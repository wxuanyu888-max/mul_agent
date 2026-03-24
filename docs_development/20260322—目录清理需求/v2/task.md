# 任务拆分

## 任务列表

### Task 1: 更新 vitest 配置
- **依赖**: 无
- **目标**: coverage 输出到 storage/coverage
- **文件**: `vitest.config.ts`

### Task 2: 更新 transcript 默认路径
- **依赖**: Task 1
- **目标**: 从 `.transcripts` 改为 `storage/runtime/transcripts`
- **文件**:
  - `src/agents/context-engine/strategies.ts`
  - `src/agents/compaction.ts`

### Task 3: 更新 workspace 路径
- **依赖**: Task 2
- **目标**: 从 `runtime/workspace` 改为 `storage/runtime/workspace`
- **文件**:
  - `src/memory/unified.ts`
  - `src/tools/web/fetch.ts`
  - `src/tools/media/video.ts`
  - `src/tools/file/grep.ts`

### Task 4: 移动数据到 storage 目录
- **依赖**: Task 3
- **目标**: 将现有数据移动到正确位置
- **操作**:
  - `.transcripts/*` → `storage/runtime/transcripts/`
  - `runtime/workspace/*` → `storage/runtime/workspace/`

### Task 5: 清理根目录
- **依赖**: Task 4
- **目标**: 删除根目录的异常目录
- **删除**:
  - `.transcripts/`
  - `runtime/`
  - `coverage/`
  - `:memory:`

### Task 6: 验证系统
- **依赖**: Task 5
- **目标**: 确保系统正常工作
- **操作**: 运行类型检查

---

## 文件位置

| 操作 | 文件路径 |
|------|----------|
| 修改 | `vitest.config.ts` |
| 修改 | `src/agents/context-engine/strategies.ts` |
| 修改 | `src/agents/compaction.ts` |
| 修改 | `src/memory/unified.ts` |
| 修改 | `src/tools/web/fetch.ts` |
| 修改 | `src/tools/media/video.ts` |
| 修改 | `src/tools/file/grep.ts` |
| 验证 | `storage/runtime/transcripts/` |
| 验证 | `storage/runtime/workspace/` |
| 删除 | `.transcripts/`, `runtime/`, `coverage/`, `:memory:` |
