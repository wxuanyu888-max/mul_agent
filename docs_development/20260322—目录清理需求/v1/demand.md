# 需求文档：确定 memory 和 transcript 目录是否应该保留

## 1. 需求背景

用户对项目根目录下的 `memory` 和 `transcript` 目录的保留存在疑惑，不确定它们是否应该存在于项目中。

## 2. 初步分析

### `.transcripts/` 目录
- **位置**: 根目录 `.transcripts/`
- **内容**: Claude Code 会话转录文件（.jsonl 格式）
- **当前状态**: 已被添加到 `.gitignore`（第88行）
- **问题**: git status 显示有 3 个已删除的 transcript 文件

### `memory` 目录
- **位置**: 根目录无 `memory` 目录，实际存在的是 `storage/memory/`
- **当前状态**: `storage/memory/` 已在 `.gitignore` 中被忽略（第71行）
- **问题**: 用户可能是指 `storage/memory/` 或根目录应该有 `memory` 目录

## 3. 需求确认

**用户明确：**
1. 根目录的 `:memory:` 是一个 macOS linked directory
2. 如果是有用的存储需求，就丢到 `storage` 里面
3. 如果是垃圾就删除

**分析结果：**
- `:memory:` 包含 SQLite 数据库（memory.db, memory.db-shm, memory.db-wal）
- 这是项目 memory 系统的持久化存储，**不应该在根目录**
- 应该移动到 `storage/memory/` 下

## 4. 约束条件

- 移动后 memory 系统仍能正常工作
- 不能丢失已有的 memory 数据
- macOS 特殊目录 `:memory:` 需要正确处理

## 5. 根本原因分析

经过代码分析，发现：

1. **测试代码** `tests/integration/memory-integration.test.ts:25` 使用了 `createMemoryDatabase(':memory:')`
   - 这是 **SQLite 的特殊语法**，表示内存数据库，不是文件系统路径
   - **这是正常用法，不需要处理**

2. **根目录的 `:memory:` 目录**
   - 是一个 **macOS 的 directory junction**（符号链接）
   - 包含 `memory.db`, `memory.db-shm`, `memory.db-wal`
   - 这些是 SQLite WAL 模式的正常文件
   - **问题**：memory 数据库被错误地创建在根目录，而不是 `storage/memory/` 下

3. **项目 memory 系统设计**
   - `storage/memory/` - 应该是 memory 数据库的正确位置
   - `UnifiedMemoryManager` 配置指向 `storage/memory/`

## 4. 约束条件

- 需要遵循项目开发规范
- 需要确认 memory 系统的设计意图

---

**Agent 初步理解**: 用户可能想确认项目结构是否整洁，以及 memory 相关目录的定位是否正确。但具体需求不明确，需要进一步讨论。
