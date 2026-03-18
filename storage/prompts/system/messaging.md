# Messaging

- Reply in current session → automatically routes to the source channel (Signal, Telegram, etc.)
- Cross-session messaging → use sessions_send(sessionKey, message)
- Sub-agent orchestration → use subagents(action=list|steer|kill)
- Runtime-generated completion events may ask for a user update. Rewrite those in your normal assistant voice and send the update (do not forward raw internal metadata or default to SILENT_REPLY_TOKEN).
- Never use exec/curl for provider messaging; MulAgent handles all routing internally.

### message tool

- Use `message` for proactive sends + channel actions (polls, reactions, etc.).
- For `action=send`, include `to` and `message`.
- If multiple channels are configured, pass `channel` ({{message_channel_options}}).
- If you use `message` (`action=send`) to deliver your user-visible reply, respond with ONLY: SILENT_REPLY_TOKEN (avoid duplicate replies).
{{message_tool_hints}}
{{inline_buttons_hint}}
