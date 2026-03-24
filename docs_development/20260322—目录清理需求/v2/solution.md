# 实施逻辑

## 执行步骤

### 1. 更新 vitest 配置

```typescript
// vitest.config.ts
coverage: {
  provider: "v8",
  reporter: ["text", "lcov", "html"],
  directory: "storage/coverage",  // 新增
  all: false,
  // ...
}
```

### 2. 更新 transcript 默认路径

```typescript
// src/agents/context-engine/strategies.ts:210
const transcriptDir = cfg.transcriptDir ?? 'storage/runtime/transcripts';

// src/agents/compaction.ts:216
const transcriptDir = cfg.transcriptDir ?? 'storage/runtime/transcripts';
```

### 3. 更新 workspace 路径

```typescript
// src/memory/unified.ts:119
directory: 'storage/runtime/workspace',

// src/tools/web/fetch.ts:8
const WORKSPACE_DIR = 'storage/runtime/workspace';

// src/tools/media/video.ts:12
const WORKSPACE_DIR = 'storage/runtime/workspace';

// src/tools/file/grep.ts:54
extraPaths: ['storage/runtime/workspace'],
```

### 4. 移动数据到 storage 目录

```bash
# 移动 transcript 文件
mv .transcripts/* storage/runtime/transcripts/

# 移动 workspace 文件
mv runtime/workspace/* storage/runtime/workspace/
```

### 5. 清理根目录

```bash
rm -rf .transcripts/ runtime/ coverage/ :memory:
```

## 修改文件汇总

| 文件 | 修改内容 |
|------|----------|
| `vitest.config.ts` | 添加 `directory: "storage/coverage"` |
| `src/agents/context-engine/strategies.ts` | 默认 transcript 路径改为 `storage/runtime/transcripts` |
| `src/agents/compaction.ts` | 默认 transcript 路径改为 `storage/runtime/transcripts` |
| `src/memory/unified.ts` | workspace 路径改为 `storage/runtime/workspace` |
| `src/tools/web/fetch.ts` | WORKSPACE_DIR 改为 `storage/runtime/workspace` |
| `src/tools/media/video.ts` | WORKSPACE_DIR 改为 `storage/runtime/workspace` |
| `src/tools/file/grep.ts` | extraPaths 改为 `storage/runtime/workspace` |

## 验证结果

- ✅ 类型检查通过 (`pnpm typecheck`)
- ✅ 数据已移动到 `storage/runtime/workspace/`
- ✅ 数据已移动到 `storage/runtime/transcripts/`
- ✅ 根目录异常目录已删除

## .gitignore 配置确认

已确认以下规则存在：
- `coverage/` (第 61 行)
- `.transcripts/` (第 86 行)
- `storage/runtime/` (第 74 行)
- `memory.db*` (第 95-97 行)
