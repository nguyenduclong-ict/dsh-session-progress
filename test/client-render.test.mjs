import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// `client.js` is a browser module: it hands its factory to `window.__ModuleLoader__`. To reach the
// panel renderers from a test we load the SAME source and add one debug export to the factory's
// `module.exports` in memory — the file on disk is untouched.
const here = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(here, '..', 'client.js'), 'utf-8');
const marker = '    return module.exports;';
assert.ok(source.includes(marker), 'the client factory still ends with `return module.exports;`');
const patched = source.replace(
  marker,
  '    Object.assign(module.exports, { __render: { renderProgressPanelHtml, renderChecklistHtml, markdownBodyToHtml, formatShare, flattenChecklist, COMPOSER_DOCK_SLOT, findComposerDockHost, mountProgressButton, shouldShowProgressTrigger, currentSessionKey, isNewConversationScreen, ensureStyles, STYLE_ID } });\n' + marker
);

const React = {
  createElement: () => null,
  useState: (initial) => [initial, () => {}],
  useEffect: () => {},
  useLayoutEffect: () => {},
  useMemo: (factory) => factory(),
  useRef: (initial) => ({ current: initial })
};
const fakeRequire = (id) => (id === 'react' ? React : {});
// The panel stylesheet is a string handed to a <style> element: capture it so the CSS is testable
// too, not just the HTML it dresses.
let pluginCss = '';
const fakeDocument = {
  getElementById: () => null,
  createElement: () => ({
    style: {},
    set textContent(value) { pluginCss = value; },
    get textContent() { return pluginCss; }
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
assert.ok(captured, 'the client module registered itself');
const client = captured.factory(fakeRequire);
const { renderProgressPanelHtml, renderChecklistHtml, markdownBodyToHtml, formatShare, flattenChecklist, COMPOSER_DOCK_SLOT, findComposerDockHost, mountProgressButton, shouldShowProgressTrigger, currentSessionKey, isNewConversationScreen, ensureStyles } = client.__render;

/** The payload the /content endpoint returns for a two-level, weighted checklist. */
function payload(overrides = {}) {
  return {
    success: true,
    found: true,
    hasFile: true,
    sessionId: 'session-1',
    filePath: '/tmp/dsh-progress-session-1-abc.json',
    fileName: 'dsh-progress-session-1-abc.json',
    percent: 35,
    title: 'Ship the JSON progress format',
    overview: 'Rewriting storage to JSON.',
    currentActivity: 'Rewrite the host',
    nextSteps: '1. Rewrite client.js',
    notes: 'schema = v2',
    tasksTotal: 4,
    tasksDone: 1,
    tasksInProgress: 1,
    tasksPending: 2,
    groups: 1,
    checklist: [
      { path: '1', depth: 1, text: 'Design the schema', weightPercent: 20, state: 'done', percent: 100, isGroup: false, done: 1, running: 0, pending: 0, leaves: 1, children: [] },
      { path: '2', depth: 1, text: 'Rewrite the host', weightPercent: 30, state: 'running', percent: 50, isGroup: false, done: 0, running: 1, pending: 0, leaves: 1, children: [] },
      {
        path: '3', depth: 1, text: 'Ship the panel', weightPercent: 50, state: 'running', percent: 0, isGroup: true, done: 0, running: 0, pending: 2, leaves: 2,
        children: [
          { path: '3.1', depth: 2, text: 'Render the <tree>', weightPercent: 25, state: 'pending', percent: 0, isGroup: false, done: 0, running: 0, pending: 1, leaves: 1, children: [] },
          { path: '3.2', depth: 2, text: 'Show the weights', weightPercent: 25, state: 'pending', percent: 0, isGroup: false, done: 0, running: 0, pending: 1, leaves: 1, children: [] }
        ]
      }
    ],
    content: '{"version":2}',
    corrupted: false,
    migrated: false,
    warnings: [],
    ...overrides
  };
}

test('formatShare renders whole and fractional shares', () => {
  assert.equal(formatShare(20), '20%');
  assert.equal(formatShare(12.5), '12.5%');
  assert.equal(formatShare(0), '0%');
  assert.equal(formatShare(undefined), '', 'a missing share renders nothing rather than NaN%');
});

test('the tree flattens in display order, so row N is row N for a #N matcher', () => {
  assert.deepEqual(
    flattenChecklist(payload().checklist, []).map((node) => node.path),
    ['1', '2', '3', '3.1', '3.2']
  );
});

test('the panel renders the goal, the sections and one weighted row per item', () => {
  const html = renderProgressPanelHtml(payload());

  assert.match(html, /class="dsh-sp-goal">Ship the JSON progress format</);
  assert.match(html, /1\/4 items done · 35% weighted · 1 group/);
  assert.match(html, /Overview/);
  assert.match(html, /KEY FINDINGS \/ NOTES|Key Findings \/ Notes/);
  assert.match(html, /% = share of the job/);

  // One row per item, each with its computed share.
  assert.equal((html.match(/class="dsh-task-item /g) || []).length, 5);
  for (const share of ['20%', '30%', '50%', '25%']) assert.ok(html.includes(`>${share}</span>`), `missing the ${share} badge`);

  // State classes drive the existing checkbox styling.
  assert.match(html, /dsh-sp-node done/);
  assert.match(html, /dsh-sp-node in-progress/);
  assert.match(html, /dsh-sp-node pending/);
  assert.match(html, /class="dsh-task-checkbox">✓</);
  assert.match(html, /class="dsh-task-checkbox">▶</);

  // Nesting is an indent, and a group carries its own completion bar and count.
  assert.match(html, /margin-left:14px/);
  assert.match(html, /class="dsh-sp-groupcount">0\/2</);
  assert.match(html, /dsh-sp-groupbar-fill" style="width:0%"/);
});

test('section headings are styled as headings, not dim captions', () => {
  ensureStyles();

  // One declaration block out of the captured stylesheet.
  const block = (selector) => {
    const start = pluginCss.indexOf(`${selector} {`);
    assert.ok(start > -1, `the stylesheet still declares ${selector}`);
    return pluginCss.slice(start, pluginCss.indexOf('}', start));
  };

  const title = block('.dsh-sp-section-title');
  assert.match(title, /color: #93c5fd/, 'the heading keeps the old Markdown panel blue');
  assert.match(title, /text-transform: uppercase/);
  assert.match(title, /display: flex/, 'the accent bar sits in the heading row');
  assert.match(title, /border-bottom: 1px solid rgba\(59, 130, 246, 0\.25\)/);
  assert.match(block('.dsh-sp-section-title::before'), /background: #3b82f6/, 'the accent bar is back');

  const hint = block('.dsh-sp-hint');
  assert.match(hint, /margin-left: auto/, 'the badge trails the label in the flex row');
  assert.ok(!/float: right/.test(hint), 'the float-based layout is gone');
});

test('item text is escaped, not injected', () => {
  const html = renderProgressPanelHtml(payload());
  assert.ok(html.includes('Render the &lt;tree&gt;'), 'angle brackets in item text are escaped');
  assert.ok(!html.includes('Render the <tree>'));
});

test('empty and missing documents fall back to the empty state', () => {
  assert.match(renderProgressPanelHtml(null), /No progress reported yet/);
  assert.match(renderProgressPanelHtml({ found: false, hasFile: false }), /No progress reported yet/);
  assert.match(renderChecklistHtml([]), /No checklist yet/);
});

test('an invalid document surfaces its warnings', () => {
  const html = renderProgressPanelHtml(payload({ corrupted: true, warnings: ['item #1 has no text.'] }));
  assert.match(html, /dsh-sp-warn/);
  assert.match(html, /item #1 has no text\./);
  assert.match(html, /invalid document/);
});

test('free-text fields still render through the Markdown path', () => {
  assert.match(markdownBodyToHtml('**bold** and `code`'), /<strong>bold<\/strong>/);
  assert.match(markdownBodyToHtml('**bold** and `code`'), /<code class="dsh-md-code">code<\/code>/);
  assert.equal(markdownBodyToHtml(''), '');
});

// --- where the trigger is mounted (a fake DOM, not jsdom: only the shapes the code touches) ---

/** A minimal element with the child/append/insert/query surface `mountProgressButton` uses. */
function el(className = '') {
  const node = {
    className,
    nodeType: 1,
    parentNode: null,
    children: [],
    appendChild(child) {
      if (child.parentNode) child.parentNode.removeChild(child);
      this.children.push(child);
      child.parentNode = this;
      return child;
    },
    insertBefore(child, before) {
      const at = this.children.indexOf(before);
      this.children.splice(at < 0 ? this.children.length : at, 0, child);
      child.parentNode = this;
      return child;
    },
    removeChild(child) {
      const at = this.children.indexOf(child);
      if (at >= 0) this.children.splice(at, 1);
      child.parentNode = null;
      return child;
    },
    querySelector: () => null,
    querySelectorAll: () => []
  };
  return node;
}

/** The composer DOM as the harness renders it: the dock slot anchor is a display:contents child. */
function composerDom() {
  const body = el('body');
  const dockRow = el('uV2eYG_dock');
  const anchor = el('');
  anchor.setAttribute = () => {};
  anchor.parentElement = dockRow;
  const contextMeter = el('ContextMeter_row');
  dockRow.appendChild(anchor);
  dockRow.appendChild(contextMeter);
  const selector = `[data-slot="${COMPOSER_DOCK_SLOT}"]`;
  const doc = {
    body,
    querySelector: (queried) => (queried === selector ? anchor : null),
    querySelectorAll: (queried) => (queried === selector ? [anchor] : [])
  };
  return { doc, body, dockRow, anchor, contextMeter };
}

test('the trigger mounts into the row hosting the conversation.composer.dock slot', () => {
  const { doc, dockRow, anchor, contextMeter } = composerDom();
  const btn = el('dsh-session-progress-button');

  assert.equal(COMPOSER_DOCK_SLOT, 'conversation.composer.dock');
  assert.equal(findComposerDockHost(doc), dockRow, 'the anchor\u2019s parent is the dock row');
  assert.equal(mountProgressButton(btn, doc), dockRow);
  assert.equal(btn.parentNode, dockRow);

  // A flex item of that row, beside the slot's own entries and ContextMeter — and never nested
  // inside the slot anchor itself, which belongs to other plugins.
  assert.deepEqual(dockRow.children, [anchor, contextMeter, btn]);

  // Re-mounting is idempotent: the observer calls this on every composer re-render.
  mountProgressButton(btn, doc);
  assert.equal(dockRow.children.filter((child) => child === btn).length, 1);
});

test('a split view mounts into the pane that is actually laid out', () => {
  const hiddenRow = el('uV2eYG_dock');
  hiddenRow.getClientRects = () => [];
  const hiddenAnchor = el('');
  hiddenAnchor.parentElement = hiddenRow;

  const shownRow = el('uV2eYG_dock');
  shownRow.getClientRects = () => [{}];
  const shownAnchor = el('');
  shownAnchor.parentElement = shownRow;

  const selector = `[data-slot="${COMPOSER_DOCK_SLOT}"]`;
  const doc = {
    body: el('body'),
    querySelector: () => hiddenAnchor,
    querySelectorAll: (queried) => (queried === selector ? [hiddenAnchor, shownAnchor] : [])
  };

  const btn = el('dsh-session-progress-button');
  assert.equal(mountProgressButton(btn, doc), shownRow);
  assert.equal(btn.parentNode, shownRow);
});

test('with no dock slot the trigger falls back to the composer trailing toolbar', () => {
  const body = el('body');
  const trailing = el('uV2eYG_trailing');
  const modelSelector = el('select');
  modelSelector.parentNode = trailing;
  trailing.children = [modelSelector];
  trailing.querySelector = (selector) =>
    selector.includes('button[aria-haspopup') ? modelSelector : null;

  const doc = {
    body,
    querySelector: () => null,
    querySelectorAll: (selector) => (selector === '[class*="trailing"]' ? [trailing] : [])
  };

  const btn = el('dsh-session-progress-button');
  assert.equal(mountProgressButton(btn, doc), trailing);
  assert.deepEqual(trailing.children, [btn, modelSelector], 'inserted before the model selector');

  // Nothing to mount into at all: the button still lands somewhere, never orphaned.
  const bare = { body, querySelector: () => null, querySelectorAll: () => [] };
  const orphan = el('dsh-session-progress-button');
  assert.equal(mountProgressButton(orphan, bare), body);
  assert.equal(orphan.parentNode, body);
});

// --- visibility of the trigger (it must stay off the new-conversation screen) ---

/** Bind a session the way the shipped right sidebar advertises the session it draws. */
function bindSessionToDocument(sessionId) {
  const owner = {
    getAttribute: (name) => (name === 'data-sidebar-right-session' ? sessionId : null),
    dataset: { sidebarRightSession: sessionId }
  };
  fakeDocument.querySelector = (selector) =>
    (selector === '[data-sidebar-right-session]' ? owner : null);
  return () => { delete fakeDocument.querySelector; };
}

test('the trigger is hidden while there is no session to report on', () => {
  delete fakeDocument.querySelector; // the new-conversation screen: nothing selected yet

  assert.equal(currentSessionKey(), null);
  assert.equal(shouldShowProgressTrigger(), false, 'no session ⇒ no trigger');

  const unbind = bindSessionToDocument('session-0b1d8545-6b67-40fe-aa4f-46ecdbc750c0');
  try {
    assert.equal(currentSessionKey(), 'session-0b1d8545-6b67-40fe-aa4f-46ecdbc750c0');
    assert.equal(shouldShowProgressTrigger(), true, 'a bound session brings the trigger back');
  } finally {
    unbind();
  }

  assert.equal(shouldShowProgressTrigger(), false, 'and it goes away again');

  // `default` is the new-conversation scope, not a session: it must not resurrect the trigger.
  const unbindDefault = bindSessionToDocument('default');
  try {
    assert.equal(currentSessionKey(), null);
    assert.equal(shouldShowProgressTrigger(), false);
  } finally {
    unbindDefault();
  }
});

test('the hero screen hides the trigger even while a stale session is still resolvable', () => {
  const sessionId = 'session-0b1d8545-6b67-40fe-aa4f-46ecdbc750c0';
  // The right sidebar keeps advertising the session that was open before "+ New"…
  const owner = {
    getAttribute: (name) => (name === 'data-sidebar-right-session' ? sessionId : null),
    dataset: { sidebarRightSession: sessionId }
  };
  // …the view binds a session that holds nothing yet (`shellPhase === "blank"`)…
  const blankSessionBody = {
    hasAttribute: (name) => name === 'data-conversation-session',
    querySelector: (selector) => (selector.includes('composerHero') ? { className: 'wSkVaW_composerHero' } : null)
  };
  // …or binds no session at all (`sessionId === undefined`).
  const sessionlessBody = { hasAttribute: () => false, querySelector: () => null };
  // A real conversation on screen.
  const conversationBody = {
    hasAttribute: (name) => name === 'data-conversation-session',
    querySelector: () => null
  };

  let heroDock = null;
  let viewBody = blankSessionBody;
  fakeDocument.querySelector = (selector) => {
    if (selector === '[data-slot="conversation.hero.dock"]') return heroDock;
    if (selector === '[data-conversation-content]') return viewBody;
    if (selector === '[data-sidebar-right-session]') return owner;
    return null;
  };

  try {
    assert.equal(isNewConversationScreen(), true, 'a blank session still paints the hero composer');
    assert.equal(currentSessionKey(), null, 'the stale session id must not win');
    assert.equal(shouldShowProgressTrigger(), false, 'nothing to report yet ⇒ no trigger');

    viewBody = sessionlessBody;
    assert.equal(isNewConversationScreen(), true, 'no session bound to the view');
    assert.equal(shouldShowProgressTrigger(), false);

    heroDock = {};
    assert.equal(isNewConversationScreen(), true, 'the hero dock outlet alone is enough');
    assert.equal(shouldShowProgressTrigger(), false);

    // First message sent: the hero is gone, so the trigger comes back.
    heroDock = null;
    viewBody = conversationBody;
    assert.equal(isNewConversationScreen(), false);
    assert.equal(currentSessionKey(), sessionId);
    assert.equal(shouldShowProgressTrigger(), true);
  } finally {
    delete fakeDocument.querySelector;
  }
});

