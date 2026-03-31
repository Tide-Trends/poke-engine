import { mkdirSync, existsSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { SessionEntry, SessionMeta } from './types.js';

export class SessionManager {
  constructor(private sessionsDir: string) {
    mkdirSync(this.sessionsDir, { recursive: true });
  }

  create(label?: string): SessionMeta {
    const meta: SessionMeta = { id: randomUUID(), startedAt: new Date().toISOString(), lastActiveAt: new Date().toISOString(), messageCount: 0, label };
    writeFileSync(join(this.sessionsDir, `${meta.id}.jsonl`), '', 'utf8');
    const index = this.list();
    index.push(meta);
    this.saveIndex(index);
    return meta;
  }

  append(sessionId: string, entry: SessionEntry): void {
    appendFileSync(join(this.sessionsDir, `${sessionId}.jsonl`), JSON.stringify(entry) + '\n', 'utf8');
    const index = this.list().map(s => s.id === sessionId ? { ...s, lastActiveAt: new Date().toISOString(), messageCount: s.messageCount + 1 } : s);
    this.saveIndex(index);
  }

  list(): SessionMeta[] {
    const index = this.loadIndex();
    return index.sort((a, b) => b.lastActiveAt.localeCompare(a.lastActiveAt));
  }

  loadEntries(sessionId: string): SessionEntry[] {
    const p = join(this.sessionsDir, `${sessionId}.jsonl`);
    if (!existsSync(p)) return [];
    const raw = readFileSync(p, 'utf8').trim();
    if (!raw) return [];
    return raw.split('\n').map(line => JSON.parse(line));
  }

  private loadIndex(): SessionMeta[] {
    const p = join(this.sessionsDir, 'index.json');
    if (!existsSync(p)) return [];
    try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return []; }
  }

  private saveIndex(index: SessionMeta[]): void {
    writeFileSync(join(this.sessionsDir, 'index.json'), JSON.stringify(index, null, 2), 'utf8');
  }
}
