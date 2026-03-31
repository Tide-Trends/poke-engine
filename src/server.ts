import { PokeEngine } from './engine.js';
import type { ChatMessage, EngineConfig } from './types.js';

const config: EngineConfig = {
  apiKey: process.env.POKE_API_KEY ?? '',
  chatId: Number(process.env.POKE_CHAT_ID ?? '0'),
  handleId: Number(process.env.POKE_HANDLE_ID ?? '0'),
  cwd: process.cwd(),
  model: process.env.POKE_MODEL ?? 'poke-engine',
  pollIntervalMs: Number(process.env.POKE_POLL_INTERVAL_MS ?? '1500'),
  timeoutMs: Number(process.env.POKE_TIMEOUT_MS ?? '180000')
};

const engine = config.apiKey && config.chatId && config.handleId ? new PokeEngine(config) : null;

Bun.serve({
  port: Number(process.env.PORT ?? '8787'),
  async fetch(req) {
    const url = new URL(req.url);
    if (req.method === 'GET' && url.pathname === '/healthz') return new Response('ok');
    if (req.method === 'GET' && url.pathname === '/v1/models') {
      return Response.json({ object: 'list', data: [{ id: config.model, object: 'model', owned_by: 'tide-trends' }] });
    }
    if (req.method === 'POST' && url.pathname === '/v1/chat/completions') {
      if (!engine) {
        return Response.json({ error: { message: 'POKE_API_KEY, POKE_CHAT_ID, and POKE_HANDLE_ID are required' } }, { status: 503 });
      }
      const payload = await req.json() as { messages?: ChatMessage[]; stream?: boolean };
      return await engine.complete(payload.messages ?? [], Boolean(payload.stream));
    }
    return new Response('not found', { status: 404 });
  }
});

console.log(`poke-engine listening on ${process.env.PORT ?? '8787'}`);
