import { ChatDbPoller } from './db/poller.js';
import { parseAssistantOutput } from './parser.js';
import { PokeClient } from './poke/client.js';
import { SessionManager } from './session.js';
import { ToolExecutor, ToolRegistry } from './tools.js';
import type { ChatMessage, EngineConfig } from './types.js';

export class PokeEngine {
  private client: PokeClient;
  private poller: ChatDbPoller;
  private sessions: SessionManager;
  private registry = new ToolRegistry();
  private executor: ToolExecutor;

  constructor(private config: EngineConfig, sessionsDir = '.poke-engine/sessions') {
    this.client = new PokeClient(config.apiKey);
    this.poller = new ChatDbPoller();
    this.poller.setChat(config.chatId);
    this.sessions = new SessionManager(sessionsDir);
    this.executor = new ToolExecutor(this.registry, config.cwd);
  }

  private buildPrompt(messages: ChatMessage[]): string {
    const system = [
      'You are Poke Engine, an OpenAI-compatible assistant with local tool execution.',
      'Use <tool_call>{"tool":"name","params":{...}}</tool_call> when you need tools.',
      'Prefer concise answers. Do not invent tool results.'
    ].join('\n');
    return [system, '', ...messages.map(m => `${m.role.toUpperCase()}: ${m.content ?? ''}`)].join('\n');
  }

  async complete(messages: ChatMessage[], stream = false): Promise<Response> {
    const session = this.sessions.create();
    const prompt = this.buildPrompt(messages);
    await this.client.sendMessage(prompt);
    this.sessions.append(session.id, { role: 'user', content: prompt, timestamp: new Date().toISOString() });

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
    };

    const loop = async () => {
      let current = await waitForResponse();
      for (let i = 0; i < 5; i++) {
        const parsed = parseAssistantOutput(current);
        if (parsed.toolCalls.length === 0) return current;
        const results = await this.executor.execute(parsed.toolCalls);
        const resultText = this.executor.formatResults(results);
        this.sessions.append(session.id, { role: 'assistant', content: parsed.text, timestamp: new Date().toISOString() });
        this.sessions.append(session.id, { role: 'tool', toolCalls: parsed.toolCalls, results, timestamp: new Date().toISOString() });
        await this.client.sendMessage(resultText);
        current = await waitForResponse();
      }
      return current;
    };

    const finalText = await loop();
    this.sessions.append(session.id, { role: 'assistant', content: finalText, timestamp: new Date().toISOString() });

    const body = {
      id: `chatcmpl-${session.id}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: this.config.model,
      choices: [{ index: 0, message: { role: 'assistant', content: finalText }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
    };

    if (!stream) {
      return Response.json(body);
    }

    const encoder = new TextEncoder();
    const streamBody = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ id: body.id, object: 'chat.completion.chunk', created: body.created, model: body.model, choices: [{ index: 0, delta: { role: 'assistant', content: finalText }, finish_reason: null }] })}\n\n`));
        controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
        controller.close();
      }
    });
    return new Response(streamBody, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' } });
  }
}
