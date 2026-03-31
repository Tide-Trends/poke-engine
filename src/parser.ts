import type { ParsedAssistantOutput, ToolCall } from './types.js';

const TOOL_CALL_RE = /<tool_call>([\s\S]*?)<\/tool_call>/g;
const BRACKET_RE = /^\s*\[(?<tool>[a-z_]+)(?:\s+(?<args>[^\]]+))?\]\s*(?<rest>[\s\S]*)$/i;
const WRITE_OPEN_RE = /^\s*\[write(?:\s+(?<path>.+?))?\]\s*$/i;
const WRITE_CLOSE_RE = /^\s*\[\/write\]\s*$/i;

function parseInlineArgs(raw: string): Record<string, unknown> {
  const trimmed = raw.trim();
  if (!trimmed) return {};
  try {
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) return JSON.parse(trimmed);
  } catch {}

  const parts = trimmed.match(/(?:["'][^"']+["']|\S+)/g) ?? [];
  const [first, ...rest] = parts;
  if (!first) return {};
  const cleanedFirst = first.replace(/^['"]|['"]$/g, '');
  if (rest.length === 0) return { value: cleanedFirst };
  return { path: cleanedFirst, value: rest.join(' ').replace(/^['"]|['"]$/g, '') };
}

function extractToolCallFromJson(json: string): ToolCall | null {
  try {
    const parsed = JSON.parse(json);
    if (parsed && typeof parsed.tool === 'string' && parsed.params && typeof parsed.params === 'object') {
      return { tool: parsed.tool, params: parsed.params as Record<string, unknown> };
    }
  } catch {}
  return null;
}

function parseBracketLine(line: string): ToolCall | null {
  const match = line.match(BRACKET_RE);
  if (!match?.groups) return null;
  const tool = match.groups.tool.toLowerCase();
  const args = match.groups.args ?? '';
  const rest = match.groups.rest ?? '';

  switch (tool) {
    case 'read':
    case 'read_file':
      return { tool: 'read_file', params: { ...parseInlineArgs(args || rest), path: (args || rest).trim() } };
    case 'list':
    case 'list_dir':
      return { tool: 'list_dir', params: { path: (args || rest).trim() || '.' } };
    case 'glob':
      return { tool: 'glob', params: { pattern: (args || rest).trim() } };
    case 'grep':
      return { tool: 'grep', params: { pattern: (args || rest).trim() } };
    case 'search':
    case 'web_search':
      return { tool: 'web_search', params: { query: (args || rest).trim() } };
    case 'fetch':
    case 'web_fetch':
      return { tool: 'web_fetch', params: { url: (args || rest).trim() } };
    case 'bash':
    case 'run':
      return { tool: 'bash', params: { command: (args || rest).trim() } };
    case 'edit':
      return { tool: 'edit_file', params: parseInlineArgs(args || rest) };
    case 'write':
      return { tool: 'write_file', params: { path: (args || rest).trim() } };
    default:
      return null;
  }
}

export function parseAssistantOutput(raw: string): ParsedAssistantOutput {
  const toolCalls: ToolCall[] = [];
  const textChunks: string[] = [];
  if (!raw.trim()) return { text: '', toolCalls, incomplete: false };

  let last = 0;
  for (const match of raw.matchAll(TOOL_CALL_RE)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    const before = raw.slice(last, start).trim();
    if (before) textChunks.push(before);
    const call = extractToolCallFromJson(match[1].trim());
    if (call) toolCalls.push(call); else textChunks.push(match[0]);
    last = end;
  }
  const remainder = raw.slice(last).trim();
  if (remainder) textChunks.push(remainder);

  for (const line of raw.split(/\r?\n/)) {
    const call = parseBracketLine(line);
    if (call) toolCalls.push(call);
  }

  const incomplete = /<tool_call>[^]*$/.test(raw) && !/<\/tool_call>\s*$/.test(raw);
  return { text: textChunks.join('\n').trim(), toolCalls, incomplete };
}
