import { createStatusPoller } from './lib/status';
import { streamChatCompletion, type ChatMessage, type StreamStatus, type StatusSnapshot } from './lib/engine';
import './styles.css';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('App root not found');

const storedBaseUrl = localStorage.getItem('poke-engine-base-url') ?? 'http://127.0.0.1:3000';
const state = {
  baseUrl: storedBaseUrl,
  model: 'gpt-4.1-mini',
  input: '',
  streamingStatus: 'idle' as StreamStatus,
  status: {
    online: false,
    message: 'Checking engine...',
    checkedAt: new Date().toISOString(),
  } as StatusSnapshot,
  messages: [
    { role: 'system', content: 'You are a concise desktop assistant inside Poke Engine GUI.' },
  ] as ChatMessage[],
};

app.innerHTML = `
  <main class="shell">
    <section class="panel sidebar">
      <div>
        <div class="eyebrow">Poke Engine</div>
        <h1>Desktop GUI scaffold</h1>
        <p>Local Tauri shell for the Bun server on port 3000.</p>
      </div>
      <label class="field">
        <span>Base URL</span>
        <input id="baseUrl" value="${escapeHtml(state.baseUrl)}" spellcheck="false" />
      </label>
      <label class="field">
        <span>Model</span>
        <input id="model" value="${escapeHtml(state.model)}" spellcheck="false" />
      </label>
      <div class="status-card">
        <div class="status-label">Engine status</div>
        <div id="engineStatus" class="status-value">${escapeHtml(state.status.message)}</div>
        <div id="engineMeta" class="status-meta">${escapeHtml(formatCheckedAt(state.status.checkedAt))}</div>
      </div>
      <div class="actions">
        <button id="pingBtn">Ping engine</button>
        <button id="clearBtn" class="secondary">Clear chat</button>
      </div>
    </section>

    <section class="panel chat">
      <div class="chat-header">
        <div>
          <div class="eyebrow">Streaming chat</div>
          <h2>Live completion viewer</h2>
        </div>
        <div id="streamingBadge" class="badge">${state.streamingStatus}</div>
      </div>
      <div id="messages" class="messages"></div>
      <form id="composer" class="composer">
        <textarea id="prompt" rows="4" placeholder="Ask the local engine something..."></textarea>
        <div class="composer-row">
          <div id="hint" class="hint">Uses /v1/chat/completions with stream:true.</div>
          <button id="sendBtn" type="submit">Send</button>
        </div>
      </form>
    </section>
  </main>
`;

const baseUrlInput = document.querySelector<HTMLInputElement>('#baseUrl')!;
const modelInput = document.querySelector<HTMLInputElement>('#model')!;
const engineStatusEl = document.querySelector<HTMLDivElement>('#engineStatus')!;
const engineMetaEl = document.querySelector<HTMLDivElement>('#engineMeta')!;
const pingBtn = document.querySelector<HTMLButtonElement>('#pingBtn')!;
const clearBtn = document.querySelector<HTMLButtonElement>('#clearBtn')!;
const promptInput = document.querySelector<HTMLTextAreaElement>('#prompt')!;
const composer = document.querySelector<HTMLFormElement>('#composer')!;
const messagesEl = document.querySelector<HTMLDivElement>('#messages')!;
const streamingBadge = document.querySelector<HTMLDivElement>('#streamingBadge')!;
const sendBtn = document.querySelector<HTMLButtonElement>('#sendBtn')!;
const hint = document.querySelector<HTMLDivElement>('#hint')!;

const render = () => {
  messagesEl.innerHTML = state.messages
    .map((message) => `<article class="message ${message.role}"><div class="role">${message.role}</div><div class="content">${escapeHtml(message.content)}</div></article>`)
    .join('');
  messagesEl.scrollTop = messagesEl.scrollHeight;
  streamingBadge.textContent = state.streamingStatus;
  engineStatusEl.textContent = state.status.message;
  engineMetaEl.textContent = `${state.status.online ? 'Online' : 'Offline'} · ${formatCheckedAt(state.status.checkedAt)}`;
  sendBtn.disabled = state.streamingStatus === 'streaming';
  hint.textContent = state.streamingStatus === 'streaming' ? 'Receiving streaming chunks from the engine.' : 'Uses /v1/chat/completions with stream:true.';
};

const stopPolling = createStatusPoller(() => state.baseUrl, (snapshot) => {
  state.status = snapshot;
  render();
});

baseUrlInput.addEventListener('change', () => {
  state.baseUrl = baseUrlInput.value.trim();
  localStorage.setItem('poke-engine-base-url', state.baseUrl);
});
modelInput.addEventListener('change', () => {
  state.model = modelInput.value.trim() || 'gpt-4.1-mini';
});

pingBtn.addEventListener('click', async () => {
  pingBtn.disabled = true;
  try {
    const { checkEngine } = await import('./lib/engine');
    state.status = await checkEngine(state.baseUrl);
  } catch (error) {
    state.status = {
      online: false,
      message: error instanceof Error ? error.message : 'Ping failed',
      checkedAt: new Date().toISOString(),
    };
  } finally {
    pingBtn.disabled = false;
    render();
  }
});

clearBtn.addEventListener('click', () => {
  state.messages = state.messages.filter((message) => message.role === 'system');
  render();
});

composer.addEventListener('submit', async (event) => {
  event.preventDefault();
  const text = promptInput.value.trim();
  if (!text || state.streamingStatus === 'streaming') return;

  state.messages.push({ role: 'user', content: text });
  promptInput.value = '';
  state.messages.push({ role: 'assistant', content: '' });
  state.streamingStatus = 'streaming';
  render();

  const assistantIndex = state.messages.length - 1;
  try {
    await streamChatCompletion({
      baseUrl: state.baseUrl,
      model: state.model,
      messages: state.messages.slice(0, assistantIndex),
      onToken: (token) => {
        state.messages[assistantIndex].content += token;
        render();
      },
      onStatus: (status) => {
        state.streamingStatus = status;
        render();
      },
    });
  } catch (error) {
    state.messages[assistantIndex].content = error instanceof Error ? error.message : 'Streaming failed';
    state.streamingStatus = 'error';
    render();
  }
});

window.addEventListener('beforeunload', () => stopPolling());
render();

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
