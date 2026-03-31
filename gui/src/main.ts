import { createStatusPoller } from './lib/status';
import { checkEngine, streamChatCompletion, type ChatMessage, type StreamStatus, type StatusSnapshot } from './lib/engine';
import { defaultFilePath, type WorkspaceFile, workspaceFiles, workspaceTree, type WorkspaceNode } from './lib/workspace';
import { renderFileHtml } from './lib/highlight';
import './styles.css';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('App root not found');

const storedBaseUrl = localStorage.getItem('poke-engine-base-url') ?? 'http://127.0.0.1:3000';
const state = {
  baseUrl: storedBaseUrl,
  model: 'poke-engine',
  input: '',
  streamingStatus: 'idle' as StreamStatus,
  selectedPath: defaultFilePath,
  status: {
    online: false,
    message: 'Checking engine...',
    checkedAt: new Date().toISOString(),
    endpoints: [],
  } as StatusSnapshot,
  messages: [
    { role: 'system', content: 'You are a concise desktop assistant inside the Poke Engine GUI.' },
  ] as ChatMessage[],
};

app.innerHTML = `
  <main class="app-shell">
    <header class="topbar panel">
      <div class="brand">
        <div class="brand-mark">P</div>
        <div>
          <div class="eyebrow">Poke Engine / premium GUI</div>
          <div class="brand-title">Codex-class desktop cockpit</div>
        </div>
      </div>
      <div class="topbar-meta">
        <div class="meta-chip"><span class="dot"></span><span id="statusText">${escapeHtml(state.status.message)}</span></div>
        <div class="meta-chip subtle"><span>Base URL</span><strong id="baseUrlLabel">${escapeHtml(state.baseUrl)}</strong></div>
      </div>
    </header>

    <section class="panel explorer">
      <div class="panel-title-row">
        <div>
          <div class="eyebrow">Workspace</div>
          <h2>Repository tree</h2>
        </div>
        <button id="refreshBtn" class="secondary">Refresh</button>
      </div>
      <div id="tree" class="tree"></div>
      <div class="inspector">
        <div class="eyebrow">Endpoint health</div>
        <div id="endpointHealth" class="endpoint-list"></div>
      </div>
    </section>

    <section class="panel center">
      <div class="editor-toolbar">
        <div>
          <div class="eyebrow">Code view</div>
          <h2 id="fileTitle">${escapeHtml(getFile(state.selectedPath)?.title ?? state.selectedPath)}</h2>
          <div id="fileSummary" class="file-summary">${escapeHtml(getFile(state.selectedPath)?.summary ?? '')}</div>
        </div>
        <div class="toolbar-actions">
          <button id="copyFileBtn" class="secondary">Copy file</button>
          <button id="openPromptBtn">Focus prompt</button>
        </div>
      </div>
      <div id="codePane" class="code-pane"></div>
      <div class="prompt-strip">
        <div class="prompt-stat">
          <span class="eyebrow">Stream</span>
          <strong id="streamingBadge">${state.streamingStatus}</strong>
        </div>
        <div class="prompt-stat">
          <span class="eyebrow">Checked</span>
          <strong id="checkedAt">${escapeHtml(formatCheckedAt(state.status.checkedAt))}</strong>
        </div>
      </div>
    </section>

    <section class="panel assistant">
      <div class="panel-title-row">
        <div>
          <div class="eyebrow">Assistant</div>
          <h2>Streaming chat</h2>
        </div>
      </div>
      <div id="messages" class="messages"></div>
      <form id="composer" class="composer">
        <label class="field">
          <span>Prompt</span>
          <textarea id="prompt" rows="5" placeholder="Ask the engine to inspect code, explain a module, or generate a patch..."></textarea>
        </label>
        <div class="composer-row">
          <input id="baseUrl" value="${escapeHtml(state.baseUrl)}" spellcheck="false" />
          <input id="model" value="${escapeHtml(state.model)}" spellcheck="false" />
          <button id="sendBtn" type="submit">Send</button>
        </div>
      </form>
    </section>
  </main>
`;

const treeEl = document.querySelector<HTMLDivElement>('#tree')!;
const codePaneEl = document.querySelector<HTMLDivElement>('#codePane')!;
const messagesEl = document.querySelector<HTMLDivElement>('#messages')!;
const baseUrlInput = document.querySelector<HTMLInputElement>('#baseUrl')!;
const modelInput = document.querySelector<HTMLInputElement>('#model')!;
const promptInput = document.querySelector<HTMLTextAreaElement>('#prompt')!;
const composer = document.querySelector<HTMLFormElement>('#composer')!;
const sendBtn = document.querySelector<HTMLButtonElement>('#sendBtn')!;
const statusText = document.querySelector<HTMLSpanElement>('#statusText')!;
const baseUrlLabel = document.querySelector<HTMLElement>('#baseUrlLabel')!;
const endpointHealthEl = document.querySelector<HTMLDivElement>('#endpointHealth')!;
const streamingBadge = document.querySelector<HTMLElement>('#streamingBadge')!;
const checkedAtEl = document.querySelector<HTMLElement>('#checkedAt')!;
const fileTitleEl = document.querySelector<HTMLHeadingElement>('#fileTitle')!;
const fileSummaryEl = document.querySelector<HTMLDivElement>('#fileSummary')!;
const refreshBtn = document.querySelector<HTMLButtonElement>('#refreshBtn')!;
const copyFileBtn = document.querySelector<HTMLButtonElement>('#copyFileBtn')!;
const openPromptBtn = document.querySelector<HTMLButtonElement>('#openPromptBtn')!;

function renderTree() {
  treeEl.innerHTML = workspaceTree.map(renderNode).join('');
  treeEl.querySelectorAll<HTMLButtonElement>('button[data-path]').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedPath = button.dataset.path!;
      renderWorkspace();
    });
  });
}

function renderNode(node: WorkspaceNode): string {
  const isSelected = node.path === state.selectedPath;
  if (node.kind === 'folder') {
    const children = (node.children ?? []).map(renderNode).join('');
    return `
      <div class="tree-folder">
        <div class="tree-folder-head">
          <span class="folder-pill">${escapeHtml(node.name)}</span>
          <span class="folder-desc">${escapeHtml(node.description ?? '')}</span>
        </div>
        <div class="tree-children">${children}</div>
      </div>
    `;
  }
  return `<button data-path="${escapeHtml(node.path)}" class="tree-file ${isSelected ? 'selected' : ''}"><span>${escapeHtml(node.name)}</span><small>${escapeHtml(node.path)}</small></button>`;
}

function renderWorkspace() {
  const file = getFile(state.selectedPath) ?? getFile(defaultFilePath)!;
  fileTitleEl.textContent = file.title;
  fileSummaryEl.textContent = file.summary;
  codePaneEl.innerHTML = renderFileHtml(file);
  renderTree();
  renderMessages();
  renderEndpoints();
  statusText.textContent = state.status.message;
  baseUrlLabel.textContent = state.baseUrl;
  streamingBadge.textContent = state.streamingStatus;
  checkedAtEl.textContent = formatCheckedAt(state.status.checkedAt);
  sendBtn.disabled = state.streamingStatus === 'streaming';
}

function renderMessages() {
  messagesEl.innerHTML = state.messages
    .map((message) => `<article class="message ${message.role}"><div class="message-meta"><span>${message.role}</span></div><div class="message-content">${escapeHtml(message.content)}</div></article>`)
    .join('');
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function renderEndpoints() {
  endpointHealthEl.innerHTML = state.status.endpoints.length
    ? state.status.endpoints
        .map(
          (endpoint) => `
          <div class="endpoint-row ${endpoint.ok ? 'ok' : 'bad'}">
            <span>${escapeHtml(endpoint.path)}</span>
            <strong>${endpoint.ok ? 'ok' : 'check'}</strong>
            <small>${escapeHtml(endpoint.detail)}</small>
          </div>`,
        )
        .join('')
    : '<div class="endpoint-row"><small>Waiting for probe data...</small></div>';
}

const stopPolling = createStatusPoller(() => state.baseUrl, (snapshot) => {
  state.status = snapshot;
  renderWorkspace();
});

baseUrlInput.addEventListener('change', () => {
  state.baseUrl = baseUrlInput.value.trim();
  localStorage.setItem('poke-engine-base-url', state.baseUrl);
  renderWorkspace();
});

modelInput.addEventListener('change', () => {
  state.model = modelInput.value.trim() || 'poke-engine';
});

refreshBtn.addEventListener('click', async () => {
  state.status = await checkEngine(state.baseUrl);
  renderWorkspace();
});

copyFileBtn.addEventListener('click', async () => {
  const file = getFile(state.selectedPath);
  if (!file) return;
  await navigator.clipboard.writeText(file.content);
});

openPromptBtn.addEventListener('click', () => promptInput.focus());

composer.addEventListener('submit', async (event) => {
  event.preventDefault();
  const text = promptInput.value.trim();
  if (!text || state.streamingStatus === 'streaming') return;

  state.messages.push({ role: 'user', content: text });
  promptInput.value = '';
  state.messages.push({ role: 'assistant', content: '' });
  state.streamingStatus = 'streaming';
  renderWorkspace();

  const assistantIndex = state.messages.length - 1;
  try {
    await streamChatCompletion({
      baseUrl: state.baseUrl,
      model: state.model,
      messages: state.messages.slice(0, assistantIndex),
      onToken: (token) => {
        state.messages[assistantIndex].content += token;
        renderMessages();
      },
      onStatus: (status) => {
        state.streamingStatus = status;
        renderWorkspace();
      },
    });
  } catch (error) {
    state.messages[assistantIndex].content = error instanceof Error ? error.message : 'Streaming failed';
    state.streamingStatus = 'error';
    renderWorkspace();
  }
});

window.addEventListener('beforeunload', () => stopPolling());
renderWorkspace();

function getFile(path: string): WorkspaceFile | undefined {
  return workspaceFiles.find((file) => file.path === path);
}

function formatCheckedAt(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'medium' }).format(new Date(value));
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
