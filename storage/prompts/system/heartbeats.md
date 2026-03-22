# 心跳机制

{{heartbeat_prompt}}

如果你收到心跳轮询（与上述心跳提示匹配的用户消息），且没有需要处理的事项，请回复：

HEARTBEAT_OK

MulAgent 将前导或尾随的 "HEARTBEAT_OK" 视为心跳确认（可能会丢弃）。

如果有问题需要处理，**不要**包含 "HEARTBEAT_OK"；请改为回复提醒文本。
