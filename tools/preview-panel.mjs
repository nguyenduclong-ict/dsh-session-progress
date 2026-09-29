/**
 * Render the progress panel's real HTML/CSS into a standalone page.
 *
 * `client.js` is a browser module, so this loads the SAME source and adds one debug export to the
 * factory's `module.exports` in memory (the file on disk is untouched), then captures the stylesheet
 * `ensureStyles()` hands to its <style> element and the body `renderProgressPanelHtml()` builds.
 *
 *   node tools/preview-panel.mjs      →  tools/preview-panel.html
 *
 * The page shows the panel three ways: the old Markdown panel (0.10.x), the new structured panel
 * with the OLD dim section styling, and the new structured panel with the current styling — so a
 * styling change can be judged without restarting DSH. DSH's own design tokens are not on this
 * page, so every `var(--dsw-alias-*, fallback)` shows its dark-theme fallback.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const source = fs.readFileSync(path.join(root, 'client.js'), 'utf-8');
const marker = '    return module.exports;';
if (!source.includes(marker)) throw new Error('client.js no longer ends its factory with `return module.exports;`');

const patched = source.replace(
  marker,
  '    Object.assign(module.exports, { __preview: { renderProgressPanelHtml, markdownBodyToHtml, ensureStyles } });\n' + marker
);

const React = {
  createElement: () => null,
  useState: (initial) => [initial, () => {}],
  useEffect: () => {},
  useLayoutEffect: () => {},
  useMemo: (factory) => factory(),
  useRef: (initial) => ({ current: initial })
};

let css = '';
const fakeDocument = {
  getElementById: () => null,
  createElement: () => ({
    style: {},
    set textContent(value) { css = value; },
    get textContent() { return css; }
  }),
  querySelectorAll: () => [],
  head: { appendChild() {} },
  body: { appendChild() {} }
};

let captured = null;
new Function('window', 'console', 'document', patched)(
  { __ModuleLoader__: { load: (definition) => { captured = definition; } } },
  console,
  fakeDocument
);
if (!captured) throw new Error('the client module did not register itself');
const client = captured.factory((id) => (id === 'react' ? React : {}));
const { renderProgressPanelHtml, markdownBodyToHtml, ensureStyles } = client.__preview;
ensureStyles();
if (!css.trim()) throw new Error('ensureStyles() produced no CSS');

// ---------------------------------------------------------------------------
// Sample material
// ---------------------------------------------------------------------------

/** The `/content` payload the host returns for the panel (schema v2 document). */
const payload = {
  success: true,
  found: true,
  hasFile: true,
  sessionId: 'session-0b1d8545',
  filePath: '/tmp/dsh-progress-session-0b1d8545.json',
  fileName: 'dsh-progress-session-0b1d8545.json',
  percent: 70,
  title: 'Làm nổi bật các section trong panel tiến độ',
  overview: 'Panel phải của `dsh-session-progress`: Overview / Checklist / Current Activity / Next Steps / Notes phải đọc ra như **tiêu đề**, không phải caption xám mờ.',
  currentActivity: 'Chỉnh CSS `.dsh-sp-section-title` trong `client.js`',
  nextSteps: '1. Copy `client.js` vào profile DSH\n2. Refresh trang\n3. So 3 cột trong preview này',
  notes: 'Bản 0.10.x render cả panel bằng Markdown: H2 xanh `#93c5fd` + thanh accent 3px `#3b82f6`.\nBản 0.11.0 dùng `.dsh-sp-section-title`, nên đã bê nguyên ngôn ngữ thị giác đó sang.',
  tasksTotal: 4,
  tasksDone: 2,
  tasksInProgress: 1,
  tasksPending: 1,
  groups: 1,
  checklist: [
    { path: '1', depth: 1, text: 'Đọc CSS section hiện tại + style markdown của bản cũ', weightPercent: 20, state: 'done', percent: 100, isGroup: false, done: 1, running: 0, pending: 0, leaves: 1, children: [] },
    { path: '2', depth: 1, text: 'Thiết kế lại style section cho nổi bật', weightPercent: 40, state: 'done', percent: 100, isGroup: false, done: 1, running: 0, pending: 0, leaves: 1, children: [] },
    {
      path: '3', depth: 1, text: 'Kiểm chứng', weightPercent: 40, state: 'running', percent: 25,
      isGroup: true, done: 1, running: 1, pending: 0, leaves: 2,
      children: [
        { path: '3.1', depth: 2, text: 'Chạy test suite', weightPercent: 20, state: 'done', percent: 100, isGroup: false, done: 1, running: 0, pending: 0, leaves: 1, children: [] },
        { path: '3.2', depth: 2, text: 'Xem lại panel trong app', weightPercent: 20, state: 'running', percent: 50, isGroup: false, done: 0, running: 1, pending: 0, leaves: 1, children: [] }
      ]
    }
  ],
  content: '{"version":2}',
  corrupted: false,
  migrated: false,
  warnings: []
};

/** The Markdown document the 0.10.x panel rendered (frontmatter already stripped). */
const legacyMarkdown = `## 📌 Mục tiêu
Chuyển panel sang JSON + checklist có trọng số.

## Checklist
- [x] Đọc CSS section hiện tại (20%)
- [x] Thiết kế lại style section (40%)
- [ ] Kiểm chứng (40%)
  - [x] Chạy test suite
  - [ ] Xem lại panel trong app

## Current Activity
Chỉnh CSS \`.dsh-sp-section-title\` trong \`client.js\`

## Key Findings / Notes
Bản cũ render cả panel bằng Markdown: H2 xanh + thanh accent 3px.`;

const panelBody = renderProgressPanelHtml(payload);

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

/** The panel chrome the React tab draws around the body, so the preview is at real size. */
function frame(bodyHtml, { head = true } = {}) {
  return `<div class="sp-frame"><div class="dsh-sp-panel">
${head ? `  <div class="dsh-sp-head">
    <div class="dsh-sp-detail">2/4 items done · 70% weighted</div>
    <div class="dsh-progress-track"><div class="dsh-progress-fill" style="width:70%"></div></div>
  </div>` : ''}
  <div class="dsh-sp-body"><div class="dsh-sp-md">${bodyHtml}</div></div>
  <div class="dsh-sp-foot"><div class="dsh-sp-path"><span class="dsh-sp-path-text">dsh-progress-session-0b1d8545.json</span></div></div>
</div></div>`;
}

const column = (title, note, bodyHtml, className = '') => `
  <section class="sp-col ${className}">
    <h1>${title}</h1>
    <p class="sp-note">${note}</p>
    ${frame(bodyHtml)}
  </section>`;

const page = `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<title>dsh-session-progress · preview panel</title>
<style>
  html, body { margin: 0; background: #0b0b0e; color: #f4f4f5;
    font-family: var(--dsw-font-family, system-ui, -apple-system, "Segoe UI", sans-serif); }
  .sp-wrap { display: flex; gap: 28px; align-items: flex-start; justify-content: center;
    padding: 28px 24px 40px; flex-wrap: wrap; }
  .sp-col { margin: 0; }
  .sp-col > h1 { font-size: 13px; font-weight: 700; margin: 0 0 4px; letter-spacing: .2px; }
  .sp-note { font-size: 11px; line-height: 1.5; color: #a1a1aa; margin: 0 0 12px; max-width: 380px; }
  .sp-frame { width: 380px; height: 660px; display: flex;
    border: 1px solid #2a2a30; border-radius: 10px; overflow: hidden; background: #131316; }
  .sp-col.sp-before > h1 { color: #fca5a5; }
  .sp-col.sp-after > h1 { color: #86efac; }

  /* The panel styling exactly as it was before this change (dim caption headings). */
  .sp-before .dsh-sp-section-title {
    display: block; font-size: 11px; font-weight: 700; letter-spacing: .06em;
    text-transform: uppercase; color: var(--dsw-alias-label-tertiary, #71717a);
    margin: 0 0 6px; padding-bottom: 4px;
    border-bottom: 1px solid rgba(255, 255, 255, .07);
  }
  .sp-before .dsh-sp-section-title::before { content: none; }
  .sp-before .dsh-sp-hint {
    float: right; margin-left: 0; font-size: inherit; font-weight: 400; letter-spacing: 0;
    text-transform: none; color: rgba(255, 255, 255, .28);
    background: none; border: none; padding: 0;
  }
  .sp-before .dsh-sp-section { margin: 0 0 14px; }
  .sp-before .dsh-sp-sub { margin: 0 0 12px; }
</style>
<style>
/* --- the plugin's own stylesheet, captured from client.js --- */
${css}
</style>
</head>
<body>
<div class="sp-wrap">
${column('0.10.x · bản cũ (Markdown)', 'Panel cũ render Markdown: mỗi mục là &lt;h2&gt; xanh #93c5fd kèm thanh accent 3px #3b82f6.', markdownBodyToHtml(legacyMarkdown))}
${column('0.11.0 · section cũ (trước khi sửa)', 'Cấu trúc mới nhưng tiêu đề section vẫn là caption xám 11px, chữ thường.', panelBody, 'sp-before')}
${column('0.11.0 · section đã làm nổi bật', 'Tiêu đề 12px xanh #93c5fd + thanh accent 3px + gạch chân xanh, badge metadata bên phải.', panelBody, 'sp-after')}
</div>
</body>
</html>
`;

const out = path.join(here, 'preview-panel.html');
fs.writeFileSync(out, page, 'utf-8');
console.log(`wrote ${path.relative(process.cwd(), out)} (${(page.length / 1024).toFixed(1)} kB, css ${(css.length / 1024).toFixed(1)} kB)`);
