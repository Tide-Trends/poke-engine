export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type StreamStatus = 'idle' | 'connecting' | 'streaming' | 'complete' | 'error';

export type StatusSnapshot = {
  online: boolean;
  message: string;
  checkedAt: string;
  endpoints: Array<{ path: string; ok: boolean; detail: string }>;
};

export type ChatResponse = {
  message: string;
  status: number;
};

export async function checkEngine(baseUrl: string): Promise<StatusSnapshot> {
  const root = normalizeBaseUrl(baseUrl);
  const health = await probe(`${root}/healthz`);
  const models = await probe(`${root}/v1/models`);

  const online = health.ok && models.ok;
  return {
    online,
    message: online ? 'Engine ready for premium UI testing' : 'Engine needs attention',
    checkedAt: new Date().toISOString(),
    endpoints: [
      { path: '/healthz', ok: health.ok, detail: health.detail },
      { path: '/v1/models', ok: models.ok, detail: models.detail },
    ],
  };
}

export async function streamChatCompletion(params: {
  baseUrl: string;
  messages: ChatMessage[];
  model?: string;
  onToken: (token: string) => void;
  onStatus?: (status: StreamStatus) => void;
}): Promise<void> {
  const { baseUrl, messages, model = 'poke-engine', onToken, onStatus } = params;
  onStatus?.('connecting');

  const response = await fetch(`${normalizeBaseUrl(baseUrl)}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream, application/json',
    },
    body: JSON.stringify({ model, stream: true, messages }),
  });

  if (!response.ok || !response.body) {
    const message = await safeText(response);
    throw new Error(message || `Chat completion failed with ${response.status}`);
  }

  onStatus?.('streaming');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const parts = buffer.split(/\n\n|\r\n\r\n/);
    buffer = parts.pop() ?? '';

    for (const part of parts) {
      const lines = part.split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const payload = trimmed.startsWith('data:') ? trimmed.slice(5).trim() : trimmed;
        if (!payload || payload === '[DONE]') continue;

        try {
          const parsed = JSON.parse(payload) as {
            choices?: Array<{ delta?: { content?: string }; message?: { content?: string } }>;
            content?: string;
            delta?: { content?: string };
          };
          const token = parsed.choices?.[0]?.delta?.content ?? parsed.choices?.[0]?.message?.content ?? parsed.delta?.content ?? parsed.content ?? '';
          if (token) onToken(token);
        } catch {
          onToken(payload);
        }
      }
    }
  }

  const tail = decoder.decode();
  if (tail.trim()) onToken(tail);
  onStatus?.('complete');
}

async function probe(url: string): Promise<{ ok: boolean; detail: string }> {
  try {
    const response = await fetch(url, { method: 'GET' });
    if (!response.ok) {
      return { ok: false, detail: `HTTP ${response.status}` };
    }
    return { ok: true, detail: await safeText(response) };
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : 'network error' };
  }
}

async function safeText(response: Response): Promise<string> {
  try {
    return (await response.text()).slice(0, 240);
  } catch {
    return '';
  }
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/$/, '');
}
