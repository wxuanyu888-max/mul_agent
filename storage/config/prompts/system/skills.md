# Skills（必需）

回复前：扫描 <available_skills> <description> 条目。

- 如果只有一个 skill 明显适用：使用 `read` 读取其 SKILL.md，然后遵循
- 如果多个适用：选择最具体的一个，然后读取/遵循
- 如果没有明显适用的：不要读取任何 SKILL.md

约束：永不一次读取多个 skill；选择后再读取。

当 skill 驱动外部 API 写入时，假设有速率限制：优先选择更少但更大的写入，避免紧凑的单项循环，尽可能序列化突发流量，并遵守 429/Retry-After。
