export type WorkspaceNode = {
  name: string;
  path: string;
  kind: 'folder' | 'file';
  language?: 'ts' | 'json' | 'md' | 'html' | 'css' | 'toml' | 'rs';
  description?: string;
  children?: WorkspaceNode[];
};

export type WorkspaceFile = {
  path: string;
  language: 'ts' | 'json' | 'md' | 'html' | 'css' | 'toml' | 'rs';
  title: string;
  summary: string;
  content: string;
};

export const workspaceTree: WorkspaceNode[] = [
  {
    name: 'src',
    path: 'src',
    kind: 'folder',
    description: 'Backend engine and OpenAI-compatible transport',
    children: [
      { name: 'server.ts', path: 'src/server.ts', kind: 'file', language: 'ts' },
      { name: 'engine.ts', path: 'src/engine.ts', kind: 'file', language: 'ts' },
      { name: 'parser.ts', path: 'src/parser.ts', kind: 'file', language: 'ts' },
      { name: 'session.ts', path: 'src/session.ts', kind: 'file', language: 'ts' },
      { name: 'tools.ts', path: 'src/tools.ts', kind: 'file', language: 'ts' },
      { name: 'types.ts', path: 'src/types.ts', kind: 'file', language: 'ts' },
      {
        name: 'db',
        path: 'src/db',
        kind: 'folder',
        children: [{ name: 'poller.ts', path: 'src/db/poller.ts', kind: 'file', language: 'ts' }],
      },
      {
        name: 'poke',
        path: 'src/poke',
        kind: 'folder',
        children: [{ name: 'client.ts', path: 'src/poke/client.ts', kind: 'file', language: 'ts' }],
      },
    ],
  },
  {
    name: 'gui',
    path: 'gui',
    kind: 'folder',
    description: 'Premium desktop shell for live engine interaction',
    children: [
      { name: 'main.ts', path: 'gui/src/main.ts', kind: 'file', language: 'ts' },
      { name: 'engine.ts', path: 'gui/src/lib/engine.ts', kind: 'file', language: 'ts' },
      { name: 'workspace.ts', path: 'gui/src/lib/workspace.ts', kind: 'file', language: 'ts' },
      { name: 'highlight.ts', path: 'gui/src/lib/highlight.ts', kind: 'file', language: 'ts' },
      { name: 'styles.css', path: 'gui/src/styles.css', kind: 'file', language: 'css' },
      { name: 'tauri.conf.json', path: 'gui/src-tauri/tauri.conf.json', kind: 'file', language: 'json' },
    ],
  },
  { name: 'package.json', path: 'package.json', kind: 'file', language: 'json' },
  { name: 'README.md', path: 'README.md', kind: 'file', language: 'md' },
];

export const workspaceFiles: WorkspaceFile[] = [
  {
    path: 'src/server.ts',
    language: 'ts',
    title: 'src/server.ts',
    summary: 'OpenAI-compatible HTTP router with /healthz, /v1/models, and /v1/chat/completions.',
    content: `import { PokeEngine } from './engine.js';
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

const engine = config.apiKey && config.chatId && config.handleId ? new PokeEngine(config) : null;`,
  },
  {
    path: 'src/engine.ts',
    language: 'ts',
    title: 'src/engine.ts',
    summary: 'The orchestration loop that sends prompts, polls the chat DB, and executes tools.',
    content: `export class PokeEngine {
  async complete(messages: ChatMessage[], stream = false): Promise<Response> {
    const session = this.sessions.create();
    const prompt = this.buildPrompt(messages);
    await this.client.sendMessage(prompt);

    const waitForResponse = async (): Promise<string> => {
      const collected: string[] = [];
      this.poller.clearCallbacks();
      this.poller.onMessages((chunks) => collected.push(...chunks));
      const start = Date.now();
      while (Date.now() - start < this.config.timeoutMs) {
        this.poller.pollOnce();
        if (collected.length > 0) return collected.join('\n');
        await Bun.sleep(this.config.pollIntervalMs);
      }
      throw new Error('Timed out waiting for response');
    };`,
  },
  {
    path: 'gui/src/main.ts',
    language: 'ts',
    title: 'gui/src/main.ts',
    summary: 'The polished desktop shell: explorer, code view, status telemetry, and streaming chat.',
    content: `const state = {
  baseUrl: 'http://127.0.0.1:3000',
  model: 'poke-engine',
  streamingStatus: 'idle',
  status: { online: false, message: 'Checking engine...', checkedAt: new Date().toISOString() }
};

const stopPolling = createStatusPoller(() => state.baseUrl, (snapshot) => {
  state.status = snapshot;
  render();
});`,
  },
];

export const defaultFilePath = 'src/server.ts';
