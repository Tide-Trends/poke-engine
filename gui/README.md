# Poke Engine GUI

A Tauri-based desktop scaffold for `poke-engine`.

## What this scaffold includes
- Local connection to `http://127.0.0.1:3000`
- Streaming chat UI for `/v1/chat/completions`
- Connection/status polling against `/v1/models`
- A clean desktop shell ready for native polish

## Development
1. Run the backend on port 3000.
2. In `gui/`, install dependencies.
3. Start the Vite frontend and Tauri shell.

## Notes
- The frontend talks directly to the local engine API.
- Base URL is configurable in the UI and stored in `localStorage`.
- Streaming supports both SSE-style `data:` payloads and raw chunked text.
