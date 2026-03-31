# Poke Engine GUI

A premium Tauri-based desktop shell for `poke-engine`.

## What it includes
- Dedicated desktop layout with no terminal-style UI
- Integrated repository explorer and file preview
- Prism-powered syntax highlighting and unified diffs
- Integrations and Skills management panels inspired by advanced coding tools
- Live engine probes for `/healthz` and `/v1/models`
- Streaming chat client for `/v1/chat/completions`

## Development
1. Run the backend on port 3000.
2. In `gui/`, install dependencies with Bun.
3. Start the Vite frontend and Tauri shell.

## Notes
- The base URL and model are persisted in localStorage.
- Streaming supports SSE-style `data:` chunks and raw JSON payloads.
- The explorer and management panels are local-first and ready to wire into real persistence later.
