import { promises as fs } from 'node:fs';
import { existsSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { ToolCall, ToolDefinition, ToolResult } from './types.js';

const execFileAsync = promisify(execFile);
const READ_TOOLS = new Set(['read_file', 'list_dir', 'glob', 'grep', 'web_search', 'web_fetch']);

const defs: ToolDefinition[] = [
  { name: 'read_file', description: 'Read a file', params: { path: { type: 'string', required: true, description: 'File path' } }, permission: 'auto' },
  { name: 'list_dir', description: 'List a directory', params: { path: { type: 'string', required: true, description: 'Directory path' } }, permission: 'auto' },
  { name: 'glob', description: 'Find files matching a glob-like pattern', params: { pattern: { type: 'string', required: true, description: 'Pattern' }, path: { type: 'string', required: false, description: 'Search root' } }, permission: 'auto' },
  { name: 'grep', description: 'Search file contents', params: { pattern: { type: 'string', required: true, description: 'Regex pattern' }, path: { type: 'string', required: false, description: 'Search root' } }, permission: 'auto' },
  { name: 'write_file', description: 'Write a file', params: { path: { type: 'string', required: true, description: 'File path' }, content: { type: 'string', required: true, description: 'Full file content' } }, permission: 'ask' },
  { name: 'edit_file', description: 'Edit a file by replacement', params: { path: { type: 'string', required: true, description: 'File path' }, old_string: { type: 'string', required: true, description: 'Exact text to replace' }, new_string: { type: 'string', required: true, description: 'Replacement' }, replace_all: { type: 'boolean', required: false, description: 'Replace all' } }, permission: 'ask' },
  { name: 'bash', description: 'Run a shell command', params: { command: { type: 'string', required: true, description: 'Shell command' } }, permission: 'ask' },
  { name: 'web_search', description: 'Search the web', params: { query: { type: 'string', required: true, description: 'Query' } }, permission: 'auto' },
  { name: 'web_fetch', description: 'Fetch a web page', params: { url: { type: 'string', required: true, description: 'URL' } }, permission: 'auto' },
];

function escapeRegExp(text: string): string { return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

async function readFileTool(path: string): Promise<string> {
  const text = await fs.readFile(path, 'utf8');
  return text.length > 12000 ? `${text.slice(0, 12000)}\n... (truncated)` : text;
}

async function listDirTool(path: string): Promise<string> {
  const entries = await fs.readdir(path, { withFileTypes: true });
  return entries.map(e => e.isDirectory() ? `${e.name}/` : e.name).sort().join('\n');
}

async function globTool(pattern: string, root = '.'): Promise<string> {
  const results: string[] = [];
  const segments = pattern.split('/').filter(Boolean);
  async function walk(dir: string, depth = 0): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dir, entry.name);
      const rel = relative(root, full).replace(/\\/g, '/');
      if (entry.isDirectory()) {
        if (depth < 6) await walk(full, depth + 1);
        continue;
      }
      if (matchesGlob(rel, segments)) results.push(rel);
    }
  }
  await walk(resolve(root));
  return results.slice(0, 200).join('\n');
}

function matchesGlob(path: string, segments: string[]): boolean {
  if (segments.length === 0) return false;
  const target = path.split('/');
  const last = segments[segments.length - 1] ?? '';
  if (last === '**') return true;
  const regex = new RegExp('^' + segments.map(seg => seg === '**' ? '.*' : escapeRegExp(seg).replace(/\\\*/g, '.*').replace(/\\\?/g, '.') ).join('/').replace(/\\\//g, '\\/') + '$');
  return regex.test(path);
}

async function grepTool(pattern: string, root = '.'): Promise<string> {
  const rx = new RegExp(pattern, 'i');
  const out: string[] = [];
  async function walk(dir: string): Promise<void> {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) { await walk(full); continue; }
      if (out.length > 200) return;
      try {
        const text = await fs.readFile(full, 'utf8');
        const lines = text.split(/\r?\n/);
        lines.forEach((line, idx) => { if (rx.test(line) && out.length < 200) out.push(`${relative(root, full)}:${idx + 1}:${line}`); rx.lastIndex = 0; });
      } catch {}
    }
  }
  await walk(resolve(root));
  return out.join('\n');
}

async function writeFileTool(path: string, content: string): Promise<string> {
  await fs.mkdir(dirname(path), { recursive: true });
  await fs.writeFile(path, content, 'utf8');
  return `wrote ${path} (${content.length} bytes)`;
}

async function editFileTool(path: string, old_string: string, new_string: string, replace_all = false): Promise<string> {
  const original = await fs.readFile(path, 'utf8');
  const count = original.split(old_string).length - 1;
  if (count === 0) throw new Error(`String not found in ${path}`);
  if (count > 1 && !replace_all) throw new Error(`String occurs multiple times in ${path}; set replace_all=true`);
  const updated = replace_all ? original.split(old_string).join(new_string) : original.replace(old_string, new_string);
  await fs.writeFile(path, updated, 'utf8');
  return `edited ${path}`;
}

async function bashTool(command: string): Promise<string> {
  const { stdout, stderr } = await execFileAsync(command, { shell: true, timeout: 120000, maxBuffer: 10 * 1024 * 1024 });
  return `${stdout}${stderr}`.trim();
}

async function webSearchTool(query: string): Promise<string> {
  const url = new URL('https://duckduckgo.com/html/');
  url.searchParams.set('q', query);
  const html = await (await fetch(url)).text();
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 8000);
}

async function webFetchTool(url: string): Promise<string> {
  const html = await (await fetch(url)).text();
  return html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 10000);
}

export class ToolRegistry {
  listTools(): ToolDefinition[] { return defs; }
  getTool(name: string): ToolDefinition | undefined { return defs.find(t => t.name === name); }
  getPermission(name: string): 'auto' | 'ask' | 'deny' { return this.getTool(name)?.permission ?? 'deny'; }
  generateToolSchema(): string {
    return defs.map(tool => `${tool.name}: ${tool.description}`).join('\n');
  }
}

export class ToolExecutor {
  constructor(private registry: ToolRegistry, private cwd: string) {}

  async execute(toolCalls: ToolCall[]): Promise<ToolResult[]> {
    const results: ToolResult[] = [];
    const parallel = toolCalls.filter(tc => READ_TOOLS.has(tc.tool));
    const sequential = toolCalls.filter(tc => !READ_TOOLS.has(tc.tool));
    await Promise.all(parallel.map(async (call) => results.push(await this.run(call))));
    for (const call of sequential) results.push(await this.run(call));
    return results;
  }

  private async run(call: ToolCall): Promise<ToolResult> {
    const tool = this.registry.getTool(call.tool);
    if (!tool) return { tool: call.tool, params: call.params, output: '', error: `Unknown tool: ${call.tool}` };
    try {
      let output = '';
      switch (call.tool) {
        case 'read_file': output = await readFileTool(String(call.params.path)); break;
        case 'list_dir': output = await listDirTool(String(call.params.path ?? this.cwd)); break;
        case 'glob': output = await globTool(String(call.params.pattern), String(call.params.path ?? this.cwd)); break;
        case 'grep': output = await grepTool(String(call.params.pattern), String(call.params.path ?? this.cwd)); break;
        case 'write_file': output = await writeFileTool(String(call.params.path), String(call.params.content ?? '')); break;
        case 'edit_file': output = await editFileTool(String(call.params.path), String(call.params.old_string), String(call.params.new_string), Boolean(call.params.replace_all)); break;
        case 'bash': output = await bashTool(String(call.params.command)); break;
        case 'web_search': output = await webSearchTool(String(call.params.query)); break;
        case 'web_fetch': output = await webFetchTool(String(call.params.url)); break;
        default: return { tool: call.tool, params: call.params, output: '', error: `Unsupported tool: ${call.tool}` };
      }
      return { tool: call.tool, params: call.params, output };
    } catch (err) {
      return { tool: call.tool, params: call.params, output: '', error: err instanceof Error ? err.message : String(err) };
    }
  }

  formatResults(results: ToolResult[]): string {
    return results.map(r => `[${r.tool}]\n${r.error ? `Error: ${r.error}` : r.output}`).join('\n\n');
  }
}
