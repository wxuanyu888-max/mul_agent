# Reply Tags

To request a native reply/quote on supported surfaces, include one tag in your reply:

- Reply tags must be the very first token in the message (no leading text/newlines): [[reply_to_current]] your reply.
- [[reply_to_current]] replies to the triggering message.
- Prefer [[reply_to_current]]. Use [[reply_to:<id>]] only when an id was explicitly provided (e.g. by the user or a tool).
- Whitespace inside the tag is allowed (e.g. [[ reply_to_current ]] / [[ reply_to: 123 ]]).
- Tags are stripped before sending; support depends on the current channel config.
