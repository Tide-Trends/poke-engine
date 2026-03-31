import { createStatusPoller } from './lib/status';
import { checkEngine, streamChatCompletion, type ChatMessage, type StreamStatus, type StatusSnapshot } from './lib/engine';
import { defaultFilePath, integrations, skills, workspaceFiles, workspaceTree, type IntegrationItem, type SkillItem, type WorkspaceFile, type WorkspaceNode } from './lib/workspace';
import { fileLanguageLabel, renderCodeBlock, renderDiffBlock, summarizeDiff } from './lib/renderer';
import './styles.css';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('App root not found');

const state = {
  baseUrl: localStorage.getItem('poke-engine-base-url') ?? 'http://127.0.0.1:3000',
  model: localStorage.getItem('poke-engine-model') ?? 'poke-engine',
  selectedPath: defaultFilePath,
  mode: 'code' as 'code' | 'diff',
  streamingStatus: 'idle' as StreamStatus,
  activeSkillId: skills.find((skill) => skill.enabled)?.id ?? skills[0]?.id ?? 'debugger',
  selectedIntegrationId: integrations[0]?.id ?? 'engine',
  status: {
    online: false,
    message: 'Checking engine...',
    checkedAt: new Date().toISOString(),
    endpoints: [],
  } as StatusSnapshot,
  messages: [{ role: 'system', content: 'You are the premium Poke Engine desktop assistant.' }] as ChatMessage[],
};

app.innerHTML = `
  <main class="app-shell">
    <header class="topbar panel">
      <div class="brand-group">
        <div class="brand-mark">P</div>
        <div class="brand-copy">
          <div class="eyebrow">Codex / Antigravity tier</div>
          <div class="brand-title">Poke Engine Desktop</div>
          <div class="brand-subtitle">Local assistant cockpit for Tide-Trends/poke-engine</div>
        </div>
      </div>
      <div class="topbar-metrics">
        <div class="metric-chip"><span class="pulse"></span><span id="statusText">${escapeHtml(state.status.message)}</span></div>
        <div class="metric-chip subtle"><span>Base</span><strong id="baseUrlLabel">${escapeHtml(state.baseUrl)}</strong></div>
        <div class="metric-chip subtle"><span>Model</span><strong id="modelLabel">${escapeHtml(state.model)}</strong></div>
      </div>
    </header>

    <aside class="panel left-rail">
      <section class="rail-section">
        <div class="panel-title-row">
          <div>
            <div class="eyebrow">Workspace</div>
            <h2>Repository tree</h2>
          </div>
          <button id="refreshBtn" class="ghost">Refresh</button>
        </div>
        <div id="tree" class="tree"></div>
      </section>

      <section class="rail-section">
        <div class="panel-title-row compact">
          <div>
            <div class="eyebrow">Integrations</div>
            <h2>Connections</h2>
          </div>
          <button id="addIntegrationBtn" class="ghost">Add</button>
        </div>
        <div id="integrations" class="stack"></div>
      </section>

      <section class="rail-section">
        <div class="panel-title-row compact">
          <div>
            <div class="eyebrow">Skills</div>
            <h2>Assistant presets</h2>
          </div>
          <button id="addSkillBtn" class="ghost">New skill</button>
        </div>
        <div id="skills" class="stack"></div>
      </section>
    </aside>

    <section class="panel editor-stage">
      <div class="editor-toolbar">
        <div class="tabs">
          <button id="codeTab" class="tab active">Code preview</button>
          <button id="diffTab" class="tab">Diff</button>
        </div>
        <div class="editor-actions">
          <button id="copyFileBtn" class="ghost">Copy file</button>
          <button id="focusPromptBtn">Focus prompt</button>
        </div>
      </div>

      <div class="file-hero">
        <div>
          <div class="eyebrow">Selected file</div>
          <h2 id="fileTitle">${escapeHtml(getFile(state.selectedPath)?.title ?? state.selectedPath)}</h2>
          <div id="fileSummary" class="file-summary">${escapeHtml(getFile(state.selectedPath)?.summary ?? '')}</div>
        </div>
        <div id="fileMeta" class="file-meta"></div>
      </div>

      <div id="codePane" class="code-pane"></div>

      <div class="insight-grid">
        <div class="insight-card">
          <div class="eyebrow">Diff summary</div>
          <div id="diffSummary" class="insight-value"></div>
        </div>
        <div class="insight-card">
          <div class="eyebrow">Runtime</div>
          <div id="runtimeSummary" class="insight-value"></div>
        </div>
        <div class="insight-card">
          <div class="eyebrow">Selected skill</div>
          <div id="skillSummary" class="insight-value"></div>
        </div>
      </div>
    </section>

    <aside class="panel right-rail">
      <section class="rail-section status-card">
        <div class="panel-title-row compact">
          <div>
            <div class="eyebrow">Engine status</div>
            <h2>Live telemetry</h2>
          </div>
        </div>
        <div id="endpointHealth" class="endpoint-list"></div>
        <div class="status-footer">
          <span id="checkedAt">${escapeHtml(formatCheckedAt(state.status.checkedAt))}</span>
          <span class="badge">${state.streamingStatus}</span>
        </div>
      </section>

      <section class="rail-section chat-card">
        <div class="panel-title-row compact">
          <div>
            <div class="eyebrow">Assistant</div>
            <h2>Streaming chat</h2>
          </div>
        </div>
        <div id="messages" class="messages"></div>
        <form id="composer" class="composer">
          <label class="field">
            <span>Prompt</span>
            <textarea id="prompt" rows="6" placeholder="Ask the engine to inspect a file, explain a diff, or generate a refinement..."></textarea>
          </label>
          <div class="composer-row">
            <input id="baseUrl" value="${escapeHtml(state.baseUrl)}" spellcheck="false" />
            <input id="model" value="${escapeHtml(state.model)}" spellcheck="false" />
            <button id="sendBtn" type="submit">Send</button>
          </div>
        </form>
      </section>
    </aside>
  </main>
`;

const treeEl = document.querySelector<HTMLDivElement>('#tree')!;
const integrationsEl = document.querySelector<HTMLDivElement>('#integrations')!;
const skillsEl = document.querySelector<HTMLDivElement>('#skills')!;
const codePaneEl = document.querySelector<HTMLDivElement>('#codePane')!;
const messagesEl = document.querySelector<HTMLDivElement>('#messages')!;
const baseUrlInput = document.querySelector<HTMLInputElement>('#baseUrl')!;
const modelInput = document.querySelector<HTMLInputElement>('#model')!;
const promptInput = document.querySelector<HTMLTextAreaElement>('#prompt')!;
const composer = document.querySelector<HTMLFormElement>('#composer')!;
const sendBtn = document.querySelector<HTMLButtonElement>('#sendBtn')!;
const statusText = document.querySelector<HTMLSpanElement>('#statusText')!;
const baseUrlLabel = document.querySelector<HTMLElement>('#baseUrlLabel')!;
const modelLabel = document.querySelector<HTMLElement>('#modelLabel')!;
const endpointHealthEl = document.querySelector<HTMLDivElement>('#endpointHealth')!;
const checkedAtEl = document.querySelector<HTMLElement>('#checkedAt')!;
const fileTitleEl = document.querySelector<HTMLHeadingElement>('#fileTitle')!;
const fileSummaryEl = document.querySelector<HTMLDivElement>('#fileSummary')!;
const fileMetaEl = document.querySelector<HTMLDivElement>('#fileMeta')!;
const diffSummaryEl = document.querySelector<HTMLDivElement>('#diffSummary')!;
const runtimeSummaryEl = document.querySelector<HTMLDivElement>('#runtimeSummary')!;
const skillSummaryEl = document.querySelector<HTMLDivElement>('#skillSummary')!;
const refreshBtn = document.querySelector<HTMLButtonElement>('#refreshBtn')!;
const copyFileBtn = document.querySelector<HTMLButtonElement>('#copyFileBtn')!;
const focusPromptBtn = document.querySelector<HTMLButtonElement>('#focusPromptBtn')!;
const codeTab = document.querySelector<HTMLButtonElement>('#codeTab')!;
const diffTab = document.querySelector<HTMLButtonElement>('#diffTab')!;

function renderAll() {
  renderTree();
  renderIntegrations();
  renderSkills();
  updateSkillPromptHint();
  renderWorkspace();
  renderMessages();
  renderTelemetry();
}

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

function renderIntegrations() {
  integrationsEl.innerHTML = integrations.map((item) => renderIntegrationCard(item)).join('');
  integrationsEl.querySelectorAll<HTMLButtonElement>('button[data-integration]').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedIntegrationId = button.dataset.integration!;
      renderIntegrations();
      updateSkillPromptHint();
    });
  });
}

function renderIntegrationCard(item: IntegrationItem): string {
  const active = item.id === state.selectedIntegrationId;
  return `
    <button class="integration-card ${active ? 'active' : ''}" data-integration="${escapeHtml(item.id)}">
      <div class="integration-top">
        <div>
          <div class="integration-name">${escapeHtml(item.name)}</div>
          <div class="integration-category">${escapeHtml(item.category)}</div>
        </div>
        <span class="status-pill ${item.status}">${item.status}</span>
      </div>
      <div class="integration-desc">${escapeHtml(item.description)}</div>
      <div class="integration-accent ${item.accent}"></div>
    </button>
  `;
}

function renderSkills() {
  skillsEl.innerHTML = skills.map((skill) => renderSkillCard(skill)).join('');
  skillsEl.querySelectorAll<HTMLButtonElement>('button[data-skill]').forEach((button) => {
    button.addEventListener('click', () => {
      state.activeSkillId = button.dataset.skill!;
      renderSkills();
      updateSkillPromptHint();
    });
  });
}

function renderSkillCard(skill: SkillItem): string {
  const active = skill.id === state.activeSkillId;
  return `
    <button class="skill-card ${active ? 'active' : ''}" data-skill="${escapeHtml(skill.id)}">
      <div class="skill-head">
        <div class="skill-name">${escapeHtml(skill.name)}</div>
        <span class="skill-state">${skill.enabled ? 'enabled' : 'off'}</span>
      </div>
      <div class="skill-summary">${escapeHtml(skill.summary)}</div>
      <div class="tag-row">${skill.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div>
    </button>
  `;
}

function renderWorkspace() {
  const file = getFile(state.selectedPath) ?? getFile(defaultFilePath)!;
  fileTitleEl.textContent = file.title;
  fileSummaryEl.textContent = file.summary;
  fileMetaEl.innerHTML = `<span class="meta-line">${fileLanguageLabel(file.language)}</span><span class="meta-line">${file.baseline ? 'Baseline available' : 'Preview only'}</span>`;
  codeTab.classList.toggle('active', state.mode === 'code');
  diffTab.classList.toggle('active', state.mode === 'diff');
  codePaneEl.innerHTML = state.mode === 'diff' ? renderDiffBlock(file) : renderCodeBlock(file);
  const summary = summarizeDiff(file);
  diffSummaryEl.textContent = summary.changed ? `${summary.additions} additions, ${summary.deletions} removals` : 'No baseline changes';
  runtimeSummaryEl.textContent = `${state.status.online ? 'Connected' : 'Offline'} · ${state.status.endpoints.length} probes`;
  skillSummaryEl.textContent = getSkill(state.activeSkillId)?.summary ?? 'No skill selected';
  sendBtn.disabled = state.streamingStatus === 'streaming';
}

function renderMessages() {
  messagesEl.innerHTML = state.messages
    .map((message) => `<article class="message ${message.role}"><div class="message-meta"><span>${message.role}</span></div><div class="message-content">${escapeHtml(message.content)}</div></article>`)
    .join('');
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function renderTelemetry() {
  statusText.textContent = state.status.message;
  baseUrlLabel.textContent = state.baseUrl;
  modelLabel.textContent = state.model;
  checkedAtEl.textContent = formatCheckedAt(state.status.checkedAt);
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
  renderTelemetry();
  renderWorkspace();
});

baseUrlInput.addEventListener('change', () => {
  state.baseUrl = baseUrlInput.value.trim();
  localStorage.setItem('poke-engine-base-url', state.baseUrl);
  renderTelemetry();
});

modelInput.addEventListener('change', () => {
  state.model = modelInput.value.trim() || 'poke-engine';
  localStorage.setItem('poke-engine-model', state.model);
  renderTelemetry();
});

refreshBtn.addEventListener('click', async () => {
  state.status = await checkEngine(state.baseUrl);
  renderAll();
});

copyFileBtn.addEventListener('click', async () => {
  const file = getFile(state.selectedPath);
  if (!file) return;
  await navigator.clipboard.writeText(file.content);
});

focusPromptBtn.addEventListener('click', () => promptInput.focus());

codeTab.addEventListener('click', () => {
  state.mode = 'code';
  renderWorkspace();
});

diffTab.addEventListener('click', () => {
  state.mode = 'diff';
  renderWorkspace();
});

composer.addEventListener('submit', async (event) => {
  event.preventDefault();
  const text = promptInput.value.trim();
  if (!text || state.streamingStatus === 'streaming') return;

  const skill = getSkill(state.activeSkillId);
  state.messages.push({ role: 'user', content: skill ? `${skill.prompt}\n\nUser request: ${text}` : text });
  promptInput.value = '';
  state.messages.push({ role: 'assistant', content: '' });
  state.streamingStatus = 'streaming';
  renderMessages();
  renderTelemetry();

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
        renderTelemetry();
        renderWorkspace();
      },
    });
  } catch (error) {
    state.messages[assistantIndex].content = error instanceof Error ? error.message : 'Streaming failed';
    state.streamingStatus = 'error';
    renderMessages();
    renderTelemetry();
  }
});

window.addEventListener('beforeunload', () => stopPolling());
renderAll();

function updateSkillPromptHint() {
  const skill = getSkill(state.activeSkillId);
  if (!skill) return;
  promptInput.placeholder = skill.summary;
}

function getFile(path: string): WorkspaceFile | undefined {
  return workspaceFiles.find((file) => file.path === path);
}

function getSkill(id: string): SkillItem | undefined {
  return skills.find((skill) => skill.id === id);
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
