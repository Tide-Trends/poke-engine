import { Database } from 'bun:sqlite';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { ToolCall } from '../types.js';

const APPLE_EPOCH_OFFSET = 978307200;
const OBJECT_REPLACEMENT = '\uFFFC';
const POLL_QUERY = `
  SELECT m.ROWID, m.text, m.attributedBody, m.date, m.is_from_me, m.cache_has_attachments, m.associated_message_type
  FROM message m
  JOIN chat_message_join cmj ON m.ROWID = cmj.message_id
  WHERE cmj.chat_id = ? AND m.ROWID > ?
  ORDER BY m.ROWID ASC
`;
const INITIAL_QUERY = `
  SELECT m.ROWID, m.text, m.attributedBody, m.date, m.is_from_me, m.cache_has_attachments, m.associated_message_type
  FROM message m
  JOIN chat_message_join cmj ON m.ROWID = cmj.message_id
  WHERE cmj.chat_id = ?
  ORDER BY m.ROWID DESC
  LIMIT 50
`;

interface RawMessage { ROWID: number; text: string | null; attributedBody: Uint8Array | null; date: number; is_from_me: number; cache_has_attachments: number; associated_message_type: number; }

function appleToDate(nanos: number): Date { return new Date(((nanos / 1_000_000_000) + APPLE_EPOCH_OFFSET) * 1000); }
function extractTextFromAttributedBody(body: Uint8Array): string { return new TextDecoder().decode(body).replace(/\u0000/g, '').trim(); }
function parseRow(row: RawMessage): { rowId: number; text: string; isFromMe: boolean; date: Date; hasAttachments: boolean } | null {
  if (row.associated_message_type >= 2000 && row.associated_message_type <= 5005) return null;
  let text = (row.text ?? '').replaceAll(OBJECT_REPLACEMENT, '').trim();
  if (!text && row.attributedBody) text = extractTextFromAttributedBody(row.attributedBody);
  if (!text) return null;
  return { rowId: row.ROWID, text, isFromMe: row.is_from_me === 1, date: appleToDate(row.date), hasAttachments: row.cache_has_attachments === 1 };
}

export class ChatDbPoller {
  private db: Database;
  private lastSeenRowId = 0;
  private chatId: number | null = null;
  private callbacks: Array<(texts: string[]) => void> = [];

  constructor(dbPath = join(homedir(), 'Library', 'Messages', 'chat.db')) {
    this.db = new Database(dbPath, { readonly: true });
    this.db.exec('PRAGMA journal_mode = WAL;');
  }

  setChat(chatId: number): void { this.chatId = chatId; }
  onMessages(cb: (texts: string[]) => void): void { this.callbacks.push(cb); }
  clearCallbacks(): void { this.callbacks = []; }

  loadInitialMessages(): string[] {
    if (this.chatId === null) throw new Error('No chat selected');
    const rows = this.db.query<RawMessage, [number]>(INITIAL_QUERY).all(this.chatId).reverse();
    const msgs: string[] = [];
    for (const row of rows) { const parsed = parseRow(row); if (parsed) msgs.push(parsed.text); }
    if (rows.length > 0) this.lastSeenRowId = Math.max(...rows.map(r => r.ROWID));
    return msgs;
  }

  pollOnce(): void {
    if (this.chatId === null) return;
    const rows = this.db.query<RawMessage, [number, number]>(POLL_QUERY).all(this.chatId, this.lastSeenRowId);
    const msgs: string[] = [];
    for (const row of rows) {
      const parsed = parseRow(row);
      if (parsed) msgs.push(parsed.text);
      if (row.ROWID > this.lastSeenRowId) this.lastSeenRowId = row.ROWID;
    }
    if (msgs.length > 0) for (const cb of this.callbacks) cb(msgs);
  }
}
