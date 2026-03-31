export type Role = 'system' | 'user' | 'assistant' | 'tool';

export interface ChatMessage {
  role: Role;
  content?: string;
  name?: string;
  tool_call_id?: string;
  tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>;
}

export interface ToolCall {
  tool: string;
  params: Record<string, unknown>;
}

export interface ToolResult {
  tool: string;
  params: Record<string, unknown>;
  output: string;
  error?: string;
}

export interface ParsedAssistantOutput {
  text: string;
  toolCalls: ToolCall[];
  incomplete: boolean;
}

export interface ToolDefinition {
  name: string;
  description: string;
  params: Record<string, { type: string; required: boolean; description: string }>;
  permission: 'auto' | 'ask' | 'deny';
}

export interface SessionMeta {
  id: string;
  startedAt: string;
  lastActiveAt: string;
  messageCount: number;
  label?: string;
}

export interface SessionEntry {
  role: 'user' | 'assistant' | 'tool';
  content?: string;
  toolCalls?: ToolCall[];
  results?: ToolResult[];
  timestamp: string;
}

export interface EngineConfig {
  apiKey: string;
  chatId: number;
  handleId: number;
  cwd: string;
  model: string;
  pollIntervalMs: number;
  timeoutMs: number;
}
