export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type StreamStatus = 'idle' | 'connecting' | 'streaming' | 'complete' | 'error';

export type StatusSnapshot = {
  online: boolean;
  message: string;
  checkedAt: string;
};

export async function checkEngine(baseUrl: string): Promise<StatusSnapshot> {
  const response = await fetch(`${normalizeBaseUrl(baseUrl)}/v1/models`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    return {
      online: false,
      message: `Engine responded with ${response.status}`,
      checkedAt: new Date().toISOString(),
    };
  }

  return {
    online: true,
    message: 'Engine is online',
    checkedAt: new Date().toISOString(),
  };
}

export async function streamChatCompletion(params: {
  baseUrl: string;
  messages: ChatMessage[];
  model?: string;
  onToken: (token: string) => void;
  onStatus?: (status: StreamStatus) => void;
}): Promise<void> {
  const { baseUrl, messages, model = 'gpt-4.1-mini', onToken, onStatus } = params;
  onStatus?.('connecting');

  const response = await fetch(`${normalizeBaseUrl(baseUrl)}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream, application/json',
    },
    body: JSON.stringify({
      model,
      stream: true,
      messages,
    }),
  });

  if (!response.ok || !response.body) {
    throw new Error(`Chat completion failed with ${response.status}`);
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

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/$/, '');
}
