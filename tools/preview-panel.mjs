/**
 * Render the progress panel's real HTML/CSS into standalone pages.
 *
 * `client.js` is a browser module, so this loads the SAME source and adds one debug export to the
 * factory's `module.exports` in memory (the file on disk is untouched), then captures the stylesheet
 * `ensureStyles()` hands to its <style> element and the bodies the renderers build.
 *
 *   node tools/preview-panel.mjs          →  tools/preview-panel.html   (3-column before/after page)
 *   node tools/preview-panel.mjs --shot   →  tools/shot-panel.html      →  assets/preview.png
 *                                            tools/shot-composer.html   →  assets/composer-button.png
 *
 * The compare page shows the panel three ways — the old Markdown panel (0.10.x), the new structured
 * panel with the OLD dim section styling, and the new structured panel as it is now. The two shot
 * pages are chrome-less frames sized for a 2x headless screenshot (see README).
 *
 * DSH's own design tokens are not on these pages, so every `var(--dsw-alias-*, fallback)` shows its
 * dark-theme fallback.
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
  title: 'Chuyển dsh-session-progress sang lưu JSON + checklist cây có trọng số',
  overview: 'Thay Markdown bằng **file JSON** (schema v2) và cho mỗi item checklist khai báo `weight`, kể cả sub-item. % trên vòng tròn do hệ thống **tự tính** từ các ô checkbox — agent không bao giờ phải ghi số %.',
  currentActivity: 'Chỉnh CSS `.dsh-sp-section-title` và nút tiến độ trên thanh nhập liệu',
  nextSteps: '1. Cài bản mới vào profile DSH\n2. Refresh trang và kiểm tra panel\n3. Cập nhật ảnh trong README',
  notes: 'Trọng số được chuẩn hoá theo từng nhóm: `share = share(parent) × weight / Σ weight(siblings)`.\nÔ `done` tính 1, `running` tính ½, `pending` tính 0.\nBản Markdown của v0.10.x tự động migrate sang JSON ở lần đọc đầu tiên.',
  tasksTotal: 4,
  tasksDone: 2,
  tasksInProgress: 1,
  tasksPending: 1,
  groups: 1,
  checklist: [
    { path: '1', depth: 1, text: 'Thiết kế schema JSON v2 cho tiến độ', weightPercent: 20, state: 'done', percent: 100, isGroup: false, done: 1, running: 0, pending: 0, leaves: 1, children: [] },
    { path: '2', depth: 1, text: 'Viết model thuần: trọng số, trạng thái, matcher, migrate', weightPercent: 40, state: 'done', percent: 100, isGroup: false, done: 1, running: 0, pending: 0, leaves: 1, children: [] },
    {
      path: '3', depth: 1, text: 'Cập nhật host + client', weightPercent: 40, state: 'running', percent: 25,
      isGroup: true, done: 1, running: 1, pending: 0, leaves: 2,
      children: [
        { path: '3.1', depth: 2, text: 'Bốn tool mới, không có tham số %', weightPercent: 20, state: 'done', percent: 100, isGroup: false, done: 1, running: 0, pending: 0, leaves: 1, children: [] },
        { path: '3.2', depth: 2, text: 'Panel render cây có badge % từng item', weightPercent: 20, state: 'running', percent: 50, isGroup: false, done: 0, running: 1, pending: 0, leaves: 1, children: [] }
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
// Shared page pieces
// ---------------------------------------------------------------------------

const BASE_STYLE = `
  html, body { margin: 0; background: #0b0b0e; color: #f4f4f5;
    font-family: var(--dsw-font-family, system-ui, -apple-system, "Segoe UI", sans-serif); }
`;

/** The panel chrome the React tab draws around the body, so a shot is at real size. */
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

const page = (title, styles, body) => `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>${BASE_STYLE}${styles}</style>
<style>
/* --- the plugin's own stylesheet, captured from client.js --- */
${css}
</style>
</head>
<body>
${body}
</body>
</html>
`;

// ---------------------------------------------------------------------------
// 1. The compare page
// ---------------------------------------------------------------------------

const column = (title, note, bodyHtml, className = '') => `
  <section class="sp-col ${className}">
    <h1>${title}</h1>
    <p class="sp-note">${note}</p>
    ${frame(bodyHtml)}
  </section>`;

const comparePage = page('dsh-session-progress · preview panel', `
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
`, `<div class="sp-wrap">
${column('0.10.x · bản cũ (Markdown)', 'Panel cũ render Markdown: mỗi mục là &lt;h2&gt; xanh #93c5fd kèm thanh accent 3px #3b82f6.', markdownBodyToHtml(legacyMarkdown))}
${column('0.11.x · section cũ (trước khi sửa)', 'Cấu trúc mới nhưng tiêu đề section vẫn là caption xám 11px, chữ thường.', panelBody, 'sp-before')}
${column('0.11.x · section đã làm nổi bật', 'Tiêu đề 12px xanh #93c5fd + thanh accent 3px + gạch chân xanh, badge metadata bên phải.', panelBody, 'sp-after')}
</div>`);

// ---------------------------------------------------------------------------
// 2. Shot: the panel as a right Sidebar tab (assets/preview.png)
// ---------------------------------------------------------------------------

const panelShot = page('shot · panel', `
  /* 533x505 CSS px at deviceScaleFactor 2 => 1066x1010, the size the README shows at 800. */
  body { display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
  .sp-tabstrip {
    flex: none; display: flex; align-items: flex-end; gap: 2px;
    padding: 8px 10px 0; background: #0b0b0e;
  }
  .sp-tab {
    display: flex; align-items: center; gap: 7px;
    font-size: 12px; font-weight: 500; color: #e4e4e7;
    background: #1c1c21; border: 1px solid #2a2a30; border-bottom: none;
    border-radius: 8px 8px 0 0; padding: 7px 10px 8px;
  }
  .sp-tab-x { color: #71717a; font-size: 11px; }
  .sp-tab-plus { padding: 6px 8px 8px; color: #71717a; font-size: 14px; }
  .sp-pane { flex: 1; min-height: 0; display: flex; background: #131316; border-top: 1px solid #2a2a30; }
`, `  <div class="sp-tabstrip">
    <div class="sp-tab">Session Progress<span class="sp-tab-x">✕</span></div>
    <div class="sp-tab-plus">+</div>
  </div>
  <div class="sp-pane">${frame(panelBody)}</div>`);

// ---------------------------------------------------------------------------
// 3. Shot: the trigger in the composer dock row (assets/composer-button.png)
// ---------------------------------------------------------------------------

const RING_CIRCUMFERENCE = 34.56;
const shotPercent = 68;
const shotOffset = (RING_CIRCUMFERENCE * (1 - shotPercent / 100)).toFixed(2);
const shotActivity = 'Đã sửa xong dữ liệu nền hỏng; đang quét tham số allow_scenario_c + breakeven cho 5 cặp (job nền)';

/** The trigger exactly as `createProgressButton()` + `updateHeaderButtonUI()` draw it. */
const trigger = `<div class="sp-anchor">
  <button type="button" class="dsh-session-progress-button sp-open" aria-label="Session Progress: ${shotPercent}%">
    <svg class="dsh-progress-ring" viewBox="0 0 14 14" width="14" height="14" aria-hidden="true">
      <circle class="dsh-progress-ring-track" cx="7" cy="7" r="5.5"></circle>
      <circle class="dsh-progress-ring-fill" cx="7" cy="7" r="5.5" stroke-dasharray="${RING_CIRCUMFERENCE}" stroke-dashoffset="${shotOffset}"></circle>
    </svg>
    <span class="dsh-progress-pill">${shotPercent}%</span>
    <div class="dsh-progress-tooltip" id="dsh-progress-btn-tooltip">
      <div class="dsh-progress-tooltip-header">
        <span class="dsh-progress-tooltip-badge">${shotPercent}%</span>
        <span class="dsh-progress-tooltip-title">Current Activity</span>
      </div>
      <div class="dsh-progress-tooltip-body">${shotActivity}</div>
      <div class="dsh-progress-tooltip-hint">Click to open the progress panel</div>
      <div class="dsh-tooltip-toggle-row">
        <span class="dsh-tooltip-toggle-label">
          <span>⚡ Session Progress</span>
        </span>
        <div class="dsh-toggle-switch active" id="dsh-tooltip-toggle-switch" title="Disable progress tracking for this session"></div>
      </div>
    </div>
  </button>
</div>`;

/** The context meter the dock row carries next to the trigger (ring only, as shipped). */
const contextMeter = (percent) => {
  const r = 5.5;
  const c = 2 * Math.PI * r;
  return `<svg class="sp-donut" viewBox="0 0 14 14" width="14" height="14" aria-hidden="true">
  <circle cx="7" cy="7" r="${r}" fill="none" stroke="rgba(255,255,255,.15)" stroke-width="2"></circle>
  <circle cx="7" cy="7" r="${r}" fill="none" stroke="#71717a" stroke-width="2" stroke-linecap="round"
    stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${(c * (1 - percent / 100)).toFixed(2)}"
    transform="rotate(-90 7 7)"></circle>
</svg>`;
};

const composerShot = page('shot · composer', `
  /* 483x200 CSS px at deviceScaleFactor 2 => 966x400, the size the README shows at 800. */
  body { height: 100vh; overflow: hidden; }
  .sp-stage { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: flex-end; }

  /* The composer card, cropped at the top: context for where the dock row sits, not the subject. */
  .sp-composer { position: relative; margin: 0 10px; }
  .sp-card {
    background: #1c1c21; border: 1px solid #2f2f36; border-radius: 16px 16px 12px 12px;
    padding: 14px 14px 10px; min-height: 108px;
    display: flex; flex-direction: column; justify-content: space-between; gap: 12px;
  }
  .sp-input { font-size: 13px; line-height: 1.45; color: #b4b4bb; }
  .sp-card-foot { display: flex; align-items: center; justify-content: flex-end; gap: 10px; }
  .sp-model {
    display: flex; align-items: center; gap: 6px; font-size: 12px; color: #a1a1aa;
    background: rgba(255, 255, 255, .04); border-radius: 999px; padding: 4px 10px;
  }
  .sp-caret { font-size: 9px; color: #71717a; }
  .sp-send {
    width: 26px; height: 26px; border-radius: 50%; background: #3b82f6;
    display: flex; align-items: center; justify-content: center;
  }
  .sp-send::after { content: ''; width: 8px; height: 8px; border-radius: 2px; background: #fff; }

  /* The dock row below the card: the slot entry plus the context meter, with our trigger last. */
  .sp-dock { display: flex; gap: 12px; justify-content: center; align-items: center; padding: 6px 0 12px; }
  .sp-donut { display: block; flex: none; }
  .sp-anchor { position: relative; display: flex; }

  /* Headless has no hover: pin the popover open the way a hover would. */
  .sp-open .dsh-progress-tooltip { opacity: 1; visibility: visible; transform: translateY(0); }
`, `  <div class="sp-stage">
    <div class="sp-composer">
      <div class="sp-card">
        <div class="sp-input">Đã sửa xong dữ liệu nền hỏng, giờ quét tham số cho từng cặp
          <b style="color:#e4e4e7">allow_scenario_c</b> + breakeven.</div>
        <div class="sp-card-foot">
          <div class="sp-model">DeepSeek-V4.1-Flash<span class="sp-caret">▼</span></div>
          <div class="sp-send"></div>
        </div>
      </div>
    </div>
    <div class="sp-dock">
      ${contextMeter(42)}
      ${trigger}
    </div>
  </div>`);

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

const rel = (target) => path.relative(process.cwd(), target);
const outDir = here;

if (process.argv.includes('--shot')) {
  for (const [name, html] of [['shot-panel.html', panelShot], ['shot-composer.html', composerShot]]) {
    const out = path.join(outDir, name);
    fs.writeFileSync(out, html, 'utf-8');
    console.log(`wrote ${rel(out)} (${(html.length / 1024).toFixed(1)} kB)`);
  }
} else {
  const out = path.join(outDir, 'preview-panel.html');
  fs.writeFileSync(out, comparePage, 'utf-8');
  console.log(`wrote ${rel(out)} (${(comparePage.length / 1024).toFixed(1)} kB, css ${(css.length / 1024).toFixed(1)} kB)`);
}
