---
title: 技能系统
description: 可扩展的技能系统
---

# 技能系统

技能系统允许 Agent 通过读取外部 SKILL.md 文件来扩展能力。

## 技能目录

```
skills/                    # 项目级技能
├── skill_name/
│   ├── SKILL.md          # 技能定义
│   └── skill.yaml        # 元数据
└── ...

storage/skills/            # 运行时技能
└── ...
```

## 技能元数据

```yaml
name: skill_name
description: 技能描述
version: 1.0.0
author: author_name
tags:
  - utility
  - file
```

## SKILL.md 格式

```markdown
# Skill Name

## Description
简短描述这个技能做什么

## When to Use
什么时候应该使用这个技能

## Instructions
1. 步骤 1
2. 步骤 2
3. 步骤 3

## Examples

### Example 1
\`\`\`
输入: xxx
输出: yyy
\`\`\`
```

## Agent 如何使用技能

Agent 通过渐进式发现技能：

1. 系统提示词中包含 `<available_skills>` 标签
2. Agent 扫描技能描述，选择最相关的
3. Agent 读取对应 SKILL.md 文件
4. Agent 按照技能指令执行任务

## 约束

- Agent 每次最多读取一个技能
- 只能在选择后读取，不能预先读取多个
- 技能应专注于单一职责

## 相关文件

- `src/skills/` - 技能加载器
- `skills/` - 项目技能目录
- `storage/prompts/system/skills.md` - 技能提示词
