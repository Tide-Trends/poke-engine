import Prism from 'prismjs';
import 'prismjs/components/prism-markup';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-markdown';
import 'prismjs/themes/prism-tomorrow.css';
import type { WorkspaceFile } from './data';

export type DiffRow = {
  kind: 'context' | 'add' | 'remove';
  oldLine?: number;
  newLine?: number;
  text: string;
};

export function renderCodeBlock(file: WorkspaceFile): string {
  const html = Prism.highlight(file.content, getLanguageGrammar(file.language), file.language);
  const lines: string[] = html.split('\n').map((line: string) => line || '&nbsp;');
  return `<pre class="code-block"><code>${lines.map((line: string, index: number) => `<div class="code-line"><span class="line-number">${index + 1}</span><span class="code-text">${line}</span></div>`).join('')}</code></pre>`;
}

export function renderDiffBlock(file: WorkspaceFile): string {
  if (!file.baseline) {
    return `<div class="empty-state"><div class="empty-title">No baseline available</div><p>This file is being shown as a live code preview.</p></div>`;
  }
  const rows = diffLines(file.baseline, file.content);
  return `<div class="diff-grid">${rows.map((row) => renderDiffRow(row, file.language)).join('')}</div>`;
}

export function summarizeDiff(file: WorkspaceFile): { additions: number; deletions: number; changed: boolean } {
  if (!file.baseline) return { additions: 0, deletions: 0, changed: false };
  const rows = diffLines(file.baseline, file.content);
  return {
    additions: rows.filter((row) => row.kind === 'add').length,
    deletions: rows.filter((row) => row.kind === 'remove').length,
    changed: rows.some((row) => row.kind !== 'context'),
  };
}

export function fileLanguageLabel(language: WorkspaceFile['language']): string {
  return ({ ts: 'TypeScript', json: 'JSON', md: 'Markdown', html: 'HTML', css: 'CSS', toml: 'TOML', rs: 'Rust' } as const)[language];
}

function renderDiffRow(row: DiffRow, language: WorkspaceFile['language']): string {
  const grammar = getLanguageGrammar(language);
  const code = Prism.highlight(row.text || ' ', grammar, language);
  const prefix = row.kind === 'add' ? '+' : row.kind === 'remove' ? '−' : ' ';
  return `
    <div class="diff-row ${row.kind}">
      <div class="diff-gutter">
        <span>${row.oldLine ?? ''}</span>
        <span>${row.newLine ?? ''}</span>
      </div>
      <div class="diff-prefix">${prefix}</div>
      <div class="diff-code"><span class="code-text">${code || '&nbsp;'}</span></div>
    </div>
  `;
}

function diffLines(before: string, after: string): DiffRow[] {
  const a = before.split(/\r?\n/);
  const b = after.split(/\r?\n/);
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array<number>(n + 1).fill(0));

  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const rows: DiffRow[] = [];
  let i = 0;
  let j = 0;
  let oldLine = 1;
  let newLine = 1;

  while (i < m && j < n) {
    if (a[i] === b[j]) {
      rows.push({ kind: 'context', oldLine, newLine, text: a[i] });
      i++;
      j++;
      oldLine++;
      newLine++;
      continue;
    }
    if (dp[i + 1][j] >= dp[i][j + 1]) {
      rows.push({ kind: 'remove', oldLine, text: a[i] });
      i++;
      oldLine++;
    } else {
      rows.push({ kind: 'add', newLine, text: b[j] });
      j++;
      newLine++;
    }
  }

  while (i < m) {
    rows.push({ kind: 'remove', oldLine, text: a[i] });
    i++;
    oldLine++;
  }
  while (j < n) {
    rows.push({ kind: 'add', newLine, text: b[j] });
    j++;
    newLine++;
  }

  return rows;
}

function getLanguageGrammar(language: WorkspaceFile['language']) {
  return (
    {
      ts: Prism.languages.typescript,
      json: Prism.languages.json,
      md: Prism.languages.markdown,
      html: Prism.languages.markup,
      css: Prism.languages.css,
      toml: Prism.languages.toml ?? Prism.languages.markup,
      rs: Prism.languages.rust ?? Prism.languages.typescript,
    } as const
  )[language];
}
