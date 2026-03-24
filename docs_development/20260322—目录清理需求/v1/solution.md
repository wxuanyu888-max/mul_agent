# 实施逻辑

## 执行步骤

### 1. 分析问题

**问题**：
- 根目录存在 `:memory:` 目录（macOS linked directory）
- 包含 SQLite WAL 数据库文件：`memory.db`, `memory.db-shm`, `memory.db-wal`
- 这些是 memory 系统的持久化数据，不应该在根目录

**根本原因**：
- 某些测试或运行在根目录创建了 memory 数据库
- `.gitignore` 虽然配置了忽略规则，但文件已经存在

### 2. 迁移数据库

```bash
# 复制数据库到正确位置
cp /Users/agent/PycharmProjects/mul_agent/:memory:/memory.db* /Users/agent/PycharmProjects/mul_agent/storage/memory/

# 验证 storage/memory/ 目录
ls -la /Users/agent/PycharmProjects/mul_agent/storage/memory/
# 结果：memory.db, memory.db-shm, memory.db-wal 已存在
```

### 3. 清理根目录残留文件

```bash
# 删除根目录的 :memory: 目录和数据库文件
rm -rf /Users/agent/PycharmProjects/mul_agent/memory.db* /Users/agent/PycharmProjects/mul_agent/:memory:
```

### 4. 验证 .gitignore 配置

检查 `.gitignore` 第 71-84 行和第 97-99 行：
- ✅ `storage/memory/` 被忽略（第71行）
- ✅ `storage/*.db*` 被忽略（第82-84行）
- ✅ `memory.db*` 根目录文件被忽略（第97-99行）

### 5. 验证 memory 系统

```bash
# 验证数据库可以正常访问
sqlite3 storage/memory/memory.db "SELECT COUNT(*) FROM chunks_vec;"
# 结果：0（空数据库，或有数据）
```

## 关键文件

| 文件 | 作用 |
|------|------|
| `src/memory/database.ts` | SQLite 数据库层 |
| `src/memory/manager.ts` | Memory 索引管理器 |
| `src/memory/unified.ts` | 统一记忆管理器 |
| `storage/memory/` | Memory 数据库正确位置 |
| `.gitignore` | 忽略规则配置 |

## 注意事项

1. **不要删除** `tests/integration/memory-integration.test.ts` 中的 `:memory:`
   - 这是 SQLite 的特殊语法，表示内存数据库
   - 不是文件系统路径

2. **根目录的 `:memory:` 目录**是 macOS directory junction
   - 由 SQLite WAL 模式创建
   - 已被清理

3. **项目设计**要求所有运行时数据放在 `storage/` 目录下
