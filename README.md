# poke-engine

A clean, Bun-based OpenAI-compatible backend for Poke.

## What it does
- Exposes `/v1/chat/completions`
- Reuses the Poke-style parser/tool/session patterns
- Uses macOS `chat.db` polling as the stable return path
- Keeps the codebase small and fast, with no runtime dependencies

## Notes
- The reference repo did not expose a separate port 9765 listener in practice, so this engine defaults to `chat.db` polling.
- Set `POKE_API_KEY`, `POKE_CHAT_ID`, and `POKE_HANDLE_ID` before starting.

## Run
```bash
bun run src/server.ts
```
