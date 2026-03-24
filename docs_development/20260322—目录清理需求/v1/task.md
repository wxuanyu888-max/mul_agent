# 任务拆分

## 任务列表

### Task 1: 迁移 memory 数据库到正确位置
- **依赖**: 无
- **目标**: 将根目录 `:memory:` 目录下的数据库文件迁移到 `storage/memory/`
- **步骤**:
  1. 检查 `storage/memory/` 是否存在
  2. 如果根目录 `:memory:` 存在且有数据，复制到 `storage/memory/`
  3. 删除根目录的 `:memory:` linked directory

### Task 2: 更新 .gitignore
- **依赖**: Task 1
- **目标**: 确保 `.gitignore` 正确忽略所有 memory 相关文件
- **步骤**:
  1. 检查 `.gitignore` 是否正确忽略根目录的 memory.db*
  2. 确保 `storage/memory/` 也在忽略列表中

### Task 3: 验证 memory 系统正常工作
- **依赖**: Task 1, Task 2
- **目标**: 确保 memory 系统能正常工作
- **步骤**:
  1. 运行 memory 相关测试
  2. 检查 memory API 是否正常

---

## 文件位置

| 操作 | 文件路径 |
|------|----------|
| 需要检查 | `storage/memory/` |
| 需要删除 | `/Users/agent/PycharmProjects/mul_agent/:memory:` |
| 需要检查 | `.gitignore` (第 71, 97-99 行) |

---

## 注意事项

1. **不要删除** `tests/integration/memory-integration.test.ts` 中的 `:memory:` 用法 - 这是 SQLite 内存数据库的特殊语法
2. **只处理**根目录的 `:memory:` linked directory（macOS directory junction）
3. 迁移后验证 `storage/memory/memory.db` 是否正确创建
