import type { WorkspaceFile } from './workspace';

const tsKeywords = new Set([
  'async', 'await', 'break', 'class', 'const', 'continue', 'export', 'false', 'function', 'if', 'import', 'let', 'new', 'null', 'return', 'super', 'switch', 'this', 'throw', 'true', 'try', 'type', 'typeof', 'undefined', 'var', 'void', 'while', 'yield', 'extends', 'implements', 'interface', 'private', 'public', 'protected', 'from', 'as', 'static', 'readonly'
]);

export function renderFileHtml(file: WorkspaceFile): string {
  const lines = file.content.split('\n');
  const rendered = lines
    .map((line, index) => `<div class="code-line"><span class="line-number">${index + 1}</span><span class="code-text">${highlightLine(escapeHtml(line), file.language)}</span></div>`)
    .join('');

  return `<pre class="code-block language-${file.language}"><code>${rendered}</code></pre>`;
}

function highlightLine(line: string, language: WorkspaceFile['language']): string {
  if (language === 'md') return line;
  if (language === 'json') return highlightJson(line);
  if (language === 'html') return highlightHtml(line);
  if (language === 'css') return highlightCss(line);
  return highlightTs(line);
}

function highlightTs(line: string): string {
  return line
    .replace(/(&quot;[^&]*?&quot;|'[^&]*?')/g, '<span class="token string">$1</span>')
    .replace(/\b(\d+)\b/g, '<span class="token number">$1</span>')
    .replace(/\b([A-Za-z_$][\w$]*)\b/g, (match) => (tsKeywords.has(match) ? `<span class="token keyword">${match}</span>` : match))
    .replace(/(\/\/.*$)/g, '<span class="token comment">$1</span>');
}

function highlightJson(line: string): string {
  return line
    .replace(/(&quot;[^&]*?&quot;)(\s*:)/g, '<span class="token property">$1</span>$2')
    .replace(/:\s*(&quot;[^&]*?&quot;)/g, ': <span class="token string">$1</span>')
    .replace(/\b(true|false|null)\b/g, '<span class="token keyword">$1</span>');
}

function highlightHtml(line: string): string {
  return line.replace(/(&lt;\/?)([A-Za-z0-9-]+)/g, '$1<span class="token keyword">$2</span>');
}

function highlightCss(line: string): string {
  return line
    .replace(/([.#]?[A-Za-z0-9_-]+)(\s*\{)/g, '<span class="token keyword">$1</span>$2')
    .replace(/:\s*([^;]+)/g, ': <span class="token string">$1</span>');
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
