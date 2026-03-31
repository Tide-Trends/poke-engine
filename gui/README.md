# Poke Engine GUI

A premium Tauri-based desktop shell for `poke-engine`.

## What it includes
- Multi-pane developer layout with repository explorer, code viewer, and streaming assistant
- Live endpoint health for `/healthz` and `/v1/models`
- Streaming client for `/v1/chat/completions`
- Dark-mode visual system tuned for a high-end developer experience

## Development
1. Run the backend on port 3000.
2. In `gui/`, install dependencies with Bun or npm.
3. Start the frontend and Tauri shell.

## Notes
- The explorer uses a polished local workspace scaffold so the UI feels complete immediately.
- The base URL is configurable in the UI and stored in `localStorage`.
- The assistant panel understands both SSE-style `data:` chunks and raw JSON tokens.
