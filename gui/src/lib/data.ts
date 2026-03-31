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
  baseline?: string;
};

export type IntegrationItem = {
  id: string;
  name: string;
  status: 'active' | 'available' | 'paused';
  category: string;
  description: string;
  accent: string;
};

export type SkillItem = {
  id: string;
  name: string;
  summary: string;
  prompt: string;
  tags: string[];
  enabled: boolean;
};

export const workspaceTree: WorkspaceNode[] = [
  {
    name: 'src',
    path: 'src',
    kind: 'folder',
    description: 'OpenAI-compatible engine and local tool orchestration',
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
    description: 'Polished desktop shell, code previews, and assistant UX',
    children: [
      { name: 'main.ts', path: 'gui/src/main.ts', kind: 'file', language: 'ts' },
      { name: 'data.ts', path: 'gui/src/lib/data.ts', kind: 'file', language: 'ts' },
      { name: 'engine.ts', path: 'gui/src/lib/engine.ts', kind: 'file', language: 'ts' },
      { name: 'renderer.ts', path: 'gui/src/lib/renderer.ts', kind: 'file', language: 'ts' },
      { name: 'workspace.ts', path: 'gui/src/lib/workspace.ts', kind: 'file', language: 'ts' },
      { name: 'status.ts', path: 'gui/src/lib/status.ts', kind: 'file', language: 'ts' },
      { name: 'styles.css', path: 'gui/src/styles.css', kind: 'file', language: 'css' },
      { name: 'tauri.conf.json', path: 'gui/src-tauri/tauri.conf.json', kind: 'file', language: 'json' },
    ],
  },
  { name: 'package.json', path: 'package.json', kind: 'file', language: 'json' },
  { name: 'README.md', path: 'README.md', kind: 'file', language: 'md' },
];

export const integrations: IntegrationItem[] = [
  { id: 'engine', name: 'Local engine', status: 'active', category: 'core', description: 'Bun server on port 3000 with OpenAI-compatible endpoints.', accent: 'azure' },
  { id: 'filesystem', name: 'Repository filesystem', status: 'active', category: 'workspace', description: 'Real-time source browsing and code preview.', accent: 'violet' },
  { id: 'github', name: 'GitHub workspace sync', status: 'active', category: 'source control', description: 'Repository-backed code and push visibility.', accent: 'emerald' },
  { id: 'chatdb', name: 'Chat DB poller', status: 'active', category: 'runtime', description: 'Polling layer that turns the Poke backend into streaming responses.', accent: 'amber' },
  { id: 'notion', name: 'Notion knowledge', status: 'available', category: 'knowledge', description: 'Optional note and doc sync for specs, prompts, and plans.', accent: 'slate' },
  { id: 'gmail', name: 'Email triage', status: 'available', category: 'inbox', description: 'Potential assistant integration for inbox workflows.', accent: 'slate' },
];

export const skills: SkillItem[] = [
  {
    id: 'debugger',
    name: 'Debug endpoint',
    summary: 'Diagnose a failing server, test a route, and summarize the fix.',
    prompt: 'Inspect the selected module, identify the failure path, and give a concise debugging plan with the exact file to change.',
    tags: ['backend', 'routes', 'fast'],
    enabled: true,
  },
  {
    id: 'refactor',
    name: 'Refactor code',
    summary: 'Reorganize logic into clean modules without changing behavior.',
    prompt: 'Refactor the selected code to improve readability and structure while keeping the runtime behavior identical.',
    tags: ['architecture', 'cleanup'],
    enabled: true,
  },
  {
    id: 'review',
    name: 'Code review',
    summary: 'Highlight correctness, maintainability, and missing coverage.',
    prompt: 'Review the current file like a senior engineer and point out issues, risks, and concrete improvements.',
    tags: ['quality', 'bugs'],
    enabled: true,
  },
  {
    id: 'ui-polish',
    name: 'UI polish',
    summary: 'Upgrade interaction detail, motion, and layout density.',
    prompt: 'Polish the interface with premium UX details, strong spacing, and a visually refined dark theme.',
    tags: ['design', 'frontend'],
    enabled: true,
  },
  {
    id: 'diff',
    name: 'Diff explainer',
    summary: 'Explain code changes with a unified diff mindset.',
    prompt: 'Compare the selected file against the baseline and explain the diff in practical developer terms.',
    tags: ['git', 'compare'],
    enabled: false,
  },
];

export const defaultFilePath = 'gui/src/main.ts';

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

console.log(\`poke-engine listening on \${process.env.PORT ?? '8787'}\`);`,
    baseline: `import { PokeEngine } from './engine.js';
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
});`,
  },
  {
    path: 'gui/src/main.ts',
    language: 'ts',
    title: 'gui/src/main.ts',
    summary: 'The premium desktop shell with workspace, code view, integrations, skills, and assistant stream.',
    content: `const state = {
  baseUrl: 'http://127.0.0.1:3000',
  model: 'poke-engine',
  selectedPath: defaultFilePath,
  mode: 'code' as 'code' | 'diff',
  streamingStatus: 'idle' as StreamStatus,
  activeSkillId: 'debugger',
  status: { online: false, message: 'Checking engine...', checkedAt: new Date().toISOString(), endpoints: [] }
};

renderWorkspace();
renderIntegrations();
renderSkills();
attachEvents();`,
    baseline: `const state = {
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
  {
    path: 'gui/src/lib/renderer.ts',
    language: 'ts',
    title: 'gui/src/lib/renderer.ts',
    summary: 'Prism-powered code rendering and a unified diff generator for premium previews.',
    content: `export function renderUnifiedDiff(before: string, after: string, language: WorkspaceFile['language']): string {
  const rows = diffLines(before, after);
  return rows.map((row) => renderDiffRow(row, language)).join('');
}
`,
    baseline: `export function renderFileHtml(file: WorkspaceFile): string {
  const source = Prism.highlight(file.content, Prism.languages[file.language] ?? Prism.languages.markup, file.language);
  return source;
}`,
  },
  {
    path: 'gui/src/lib/data.ts',
    language: 'ts',
    title: 'gui/src/lib/data.ts',
    summary: 'Static workspace metadata, integrations, and skills used to build the premium cockpit.',
    content: `export const integrations = [...];
export const skills = [...];
export const workspaceTree = [...];`,
  },
  {
    path: 'gui/src/styles.css',
    language: 'css',
    title: 'gui/src/styles.css',
    summary: 'A glassy dark visual system with strong hierarchy, depth, and desktop-native feel.',
    content: `:root {
  color-scheme: dark;
  background:
    radial-gradient(circle at 15% 10%, rgba(56, 189, 248, 0.24), transparent 28%),
    radial-gradient(circle at 85% 20%, rgba(139, 92, 246, 0.18), transparent 26%),
    linear-gradient(180deg, #020617 0%, #0a1020 46%, #020617 100%);
}`,
    baseline: `:root {
  color-scheme: dark;
  background: #0b1020;
}`,
  },
];
