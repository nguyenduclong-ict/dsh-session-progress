/**
 * dsh-session-progress — pure data model (schema v2).
 *
 * Storage moved from a Markdown document to a plain JSON object so that:
 *   - a checklist item may carry its own sub-checklist (arbitrary nesting), and
 *   - every item declares a WEIGHT, so the overall percentage is COMPUTED from the
 *     boxes instead of being asserted by the model.
 *
 * Canonical document shape:
 *
 *   {
 *     "version": 2,
 *     "sessionId": "session-…",
 *     "title": "Goal title",
 *     "status": "starting" | "in_progress" | "blocked" | "completed",
 *     "currentActivity": "one line",
 *     "overview": "free text",
 *     "checklist": [ { "text": "…", "weight": 20, "state": "pending",
 *                      "children": [ … ] } ],
 *     "nextSteps": "free text",
 *     "notes": "free text",
 *     "createdAt": 0,
 *     "updatedAt": 0
 *   }
 *
 * Weight semantics — the effective share of an item is its share among its siblings,
 * multiplied by the effective share of its parent:
 *
 *   share(item) = share(parent) * weight(item) / Σ weight(siblings)
 *
 * so both authoring styles are accepted and produce the same result:
 *   - top-level weights 20 / 30 / 50 (percent of the whole job), and
 *   - children of item 3 written as 25 / 15 / 10 (summing to the parent's 50).
 *
 * Progress of a node:
 *   - leaf: 1 for `done`, 0.5 for `running`, 0 for `pending`
 *   - group: weighted average of its children (its own `state` is derived, not counted)
 *
 * This module is pure (no fs, no ctx) so it can be unit-tested directly.
 */

export const SCHEMA_VERSION = 2;

/** Maximum nesting depth of the checklist. */
export const MAX_DEPTH = 6;

/** Maximum number of checklist nodes in one document. */
export const MAX_ITEMS = 400;

/** How much of a leaf's weight is earned by each state. */
export const STATE_FRACTION = { pending: 0, running: 0.5, done: 1 };

/** Every legal item state, in progress order. */
export const ITEM_STATES = ['pending', 'running', 'done'];

// ─────────────────────────────── small helpers ───────────────────────────────

/** Normalize text for tolerant comparison: diacritics/punctuation dropped, lowercase. */
export function normalizeHeading(text) {
  return String(text ?? '')
    .replace(/[Đđ]/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Round to `digits` decimals without float noise. */
function round(value, digits = 0) {
  const factor = 10 ** digits;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}

/** A finite, positive weight; `null` when the value carries no usable number. */
export function parseWeightValue(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'boolean') return null;
  const num = typeof value === 'number' ? value : Number(String(value).replace(',', '.').match(/-?\d+(?:\.\d+)?/)?.[0]);
  if (!Number.isFinite(num) || num <= 0) return null;
  return num;
}

const DONE_WORDS = ['x', 'done', 'complete', 'completed', 'finished', 'true', 'yes', '1', 'checked', 'ok', '✓', '✔'];
const RUNNING_WORDS = ['/', '~', '-', 'running', 'in_progress', 'in-progress', 'inprogress', 'progress', 'doing', 'active', 'started', 'wip', '▶', '>'];
const PENDING_WORDS = ['', ' ', 'pending', 'todo', 'to_do', 'open', 'waiting', 'not_started', 'not-started', 'new', 'backlog', '0', 'false', 'no', '□'];

/** The canonical state a raw mark/word maps to; `fallback` when it maps to nothing. */
export function normalizeState(value, fallback = 'pending') {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'boolean') return value ? 'done' : 'pending';
  const raw = String(value).trim().toLowerCase().replace(/^\[|\]$/g, '');
  const bare = raw.replace(/[\[\]]/g, '');
  if (DONE_WORDS.includes(bare)) return 'done';
  if (RUNNING_WORDS.includes(bare)) return 'running';
  if (PENDING_WORDS.includes(bare)) return 'pending';
  return fallback;
}

const TEXT_KEYS = ['text', 'title', 'name', 'label', 'task', 'step', 'goal', 'summary', 'content', 'desc', 'description'];
const WEIGHT_KEYS = ['weight', 'percent', 'percentage', 'share', 'w', 'ratio', 'value'];
const STATE_KEYS = ['state', 'status', 'mark', 'box', 'done', 'checked', 'completed'];
const CHILD_KEYS = ['children', 'items', 'sub', 'subtasks', 'subtasks_list', 'subchecklist', 'checklist', 'steps', 'tasks'];

/** First present key of `keys` in `source`, or undefined. */
function pick(source, keys) {
  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null) return source[key];
  }
  return undefined;
}

/**
 * Pull a trailing/leading percentage out of an item's text, e.g. `"Viết parser (20%)"`
 * or `"[20%] Viết parser"`, so a model that inlines the weight still declares it.
 * @param {string} text - raw item text.
 * @returns {{text: string, weight: number|null}} cleaned text and the weight it carried.
 */
export function extractInlineWeight(text) {
  let body = String(text ?? '').trim();
  let weight = null;

  const trailing = body.match(/^(.*?)\s*[\(\[]\s*(\d{1,3}(?:[.,]\d+)?)\s*%\s*[\)\]]\s*$/);
  if (trailing && trailing[1].trim() !== '') {
    const num = parseWeightValue(trailing[2]);
    if (num !== null) {
      weight = num;
      body = trailing[1].trim();
    }
  }
  if (weight === null) {
    const leading = body.match(/^\s*[([]\s*(\d{1,3}(?:[.,]\d+)?)\s*%\s*[)\]]\s*(.+)$/);
    if (leading && leading[2].trim() !== '') {
      const num = parseWeightValue(leading[1]);
      if (num !== null) {
        weight = num;
        body = leading[2].trim();
      }
    }
  }
  body = body.replace(/[\s·—–-]+$/, '').trim();
  return { text: body, weight };
}

/**
 * Strip a Markdown bullet and checkbox from a pasted line and read its state.
 * `"- [x] Viết parser"` → `{ text: "Viết parser", state: "done" }`.
 * @param {string} text - raw item text.
 * @returns {{text: string, state: string|null}} cleaned text and the state it carried.
 */
export function stripCheckboxPrefix(text) {
  let body = String(text ?? '').trim();
  let state = null;
  const bullet = body.match(/^(?:[-*+]|\d+[.)])\s+/);
  if (bullet) body = body.slice(bullet[0].length).trim();
  const box = body.match(/^\[([ xX\-\/~>]?)\]\s*/);
  if (box) {
    state = normalizeState(box[1], 'pending');
    body = body.slice(box[0].length).trim();
  }
  return { text: body, state };
}

// ─────────────────────────────── normalization ───────────────────────────────

/** A brand-new, empty progress document. */
export function createEmptyProgress(sessionId = '') {
  const now = Date.now();
  return {
    version: SCHEMA_VERSION,
    sessionId: sessionId ? String(sessionId) : '',
    title: '',
    status: 'starting',
    currentActivity: '',
    overview: '',
    checklist: [],
    nextSteps: '',
    notes: '',
    createdAt: now,
    updatedAt: now
  };
}

/**
 * Turn one raw checklist entry into a canonical item.
 * Accepts a bare string (`"Viết parser (20%)"`), a Markdown line (`"- [x] Viết parser"`)
 * or an object (`{ text, weight, state, children }`, with a tolerant key vocabulary).
 *
 * @param {*} raw - one entry of a `checklist` array.
 * @param {string} path - the item's path (`"2.1"`), used only in error messages.
 * @returns {{item: object, warnings: string[]}}
 */
export function normalizeItem(raw, path = '1') {
  const warnings = [];
  let source = raw;

  if (typeof source === 'string' || typeof source === 'number') source = { text: String(source) };
  if (Array.isArray(source)) {
    throw new Error(
      `checklist item ${path} is a bare array; wrap sub-items in an object: { "text": "…", "children": [ … ] }.`
    );
  }
  if (!source || typeof source !== 'object') {
    throw new Error(`checklist item ${path} must be a string or an object like { "text": "…", "weight": 20, "children": [] }.`);
  }

  let text = String(pick(source, TEXT_KEYS) ?? '').trim();
  const rawChildren = pick(source, CHILD_KEYS);
  let weight = parseWeightValue(pick(source, WEIGHT_KEYS));
  let state = pick(source, STATE_KEYS) === undefined ? null : normalizeState(pick(source, STATE_KEYS), 'pending');

  const stripped = stripCheckboxPrefix(text);
  text = stripped.text;
  if (state === null && stripped.state !== null) state = stripped.state;

  const inline = extractInlineWeight(text);
  if (inline.weight !== null) {
    if (weight === null) weight = inline.weight;
    text = inline.text;
  }

  if (!text) {
    throw new Error(`checklist item ${path} has no text; every item needs a non-empty "text" (and optional "weight"/"children").`);
  }

  const children = [];
  if (rawChildren !== undefined && rawChildren !== null) {
    if (!Array.isArray(rawChildren)) {
      throw new Error(`checklist item ${path} ("${text}") has a non-array child list; "children" must be an array.`);
    }
    rawChildren.forEach((child, index) => {
      const normalized = normalizeItem(child, `${path}.${index + 1}`);
      children.push(normalized.item);
      warnings.push(...normalized.warnings);
    });
  }

  return {
    item: {
      text,
      weight: weight === null ? 1 : weight,
      weightSource: weight === null ? 'default' : 'declared',
      state: state ?? 'pending',
      children
    },
    warnings
  };
}

/** Walk a canonical item tree, calling `visit(item, path, depth)`. */
function walkItems(items, path, depth, visit) {
  (Array.isArray(items) ? items : []).forEach((item, index) => {
    const itemPath = path ? `${path}.${index + 1}` : String(index + 1);
    visit(item, itemPath, depth);
    walkItems(item.children, itemPath, depth + 1, visit);
  });
}

/** Recompute every group node's state from its subtree (leaves keep their own state). */
function finalizeStates(items) {
  for (const item of Array.isArray(items) ? items : []) {
    if (!Array.isArray(item.children) || item.children.length === 0) {
      item.children = [];
      if (!ITEM_STATES.includes(item.state)) item.state = 'pending';
      continue;
    }
    finalizeStates(item.children);
    const allDone = item.children.every((child) => child.state === 'done');
    const anyStarted = item.children.some((child) => child.state !== 'pending');
    item.state = allDone ? 'done' : anyStarted ? 'running' : 'pending';
  }
}

/** Mark a whole subtree done (the cascade behind checking a GROUP off). */
function markSubtreeDone(item) {
  item.state = 'done';
  for (const child of Array.isArray(item.children) ? item.children : []) markSubtreeDone(child);
}

/**
 * Validate and canonicalize a whole checklist array.
 * @param {*} list - raw `checklist` value.
 * @returns {{items: object[], warnings: string[], errors: string[]}}
 */
export function normalizeChecklist(list) {
  const warnings = [];
  const errors = [];
  if (list === undefined || list === null) return { items: [], warnings, errors };
  if (!Array.isArray(list)) {
    throw new Error('`checklist` must be an array of items: [{ "text": "…", "weight": 20, "children": [] }].');
  }

  const items = [];
  list.forEach((raw, index) => {
    const normalized = normalizeItem(raw, String(index + 1));
    items.push(normalized.item);
    warnings.push(...normalized.warnings);
  });

  finalizeStates(items);

  let depth = 0;
  const groups = [];
  const seen = new Map();
  walkItems(items, '', 1, (item, path, itemDepth) => {
    depth = Math.max(depth, itemDepth);
    if (item.children.length > 0) groups.push({ path, item });
    seen.set(normalizeHeading(item.text), (seen.get(normalizeHeading(item.text)) || 0) + 1);
    if (item.weightSource === 'declared' && item.weight <= 0) errors.push(`item ${path} ("${item.text}") has a weight that is not a positive number.`);
  });

  const total = [...seen.values()].reduce((sum, count) => sum + count, 0);
  if (total > MAX_ITEMS) errors.push(`the checklist holds ${total} items; the limit is ${MAX_ITEMS}.`);
  if (depth > MAX_DEPTH) errors.push(`the checklist nests ${depth} levels deep; the limit is ${MAX_DEPTH}.`);

  // A group that mixes declared and defaulted weights normalizes in a way nobody
  // intended, so say it out loud instead of silently inventing percentages.
  const mixed = [];
  const checkGroup = (list_, path) => {
    (list_ ?? []).forEach((item, index) => {
      const itemPath = path ? `${path}.${index + 1}` : String(index + 1);
      if (item.children.length > 0) {
        const declared = item.children.filter((child) => child.weightSource === 'declared').length;
        if (declared > 0 && declared < item.children.length) {
          mixed.push(`"${item.text}" (${declared}/${item.children.length} children carry a weight)`);
        }
        checkGroup(item.children, itemPath);
      }
    });
  };
  checkGroup(items, '');
  if (mixed.length > 0) {
    warnings.push(
      `these groups mix declared and defaulted weights (missing weights count as 1): ${mixed.join(', ')}. Give every child of a group an explicit weight, or none.`
    );
  }

  const duplicated = [...seen.entries()].filter(([, count]) => count > 1).map(([name]) => name).filter(Boolean);
  if (duplicated.length > 0) {
    warnings.push(
      `two checklist items share the same text (${duplicated.slice(0, 3).map((name) => `"${name}"`).join(', ')}); a text matcher will refuse them as ambiguous — use the item path (\`#2.1\`) instead.`
    );
  }

  return { items, warnings, errors };
}

/** Free-text fields copied from an incoming patch, trimmed; `undefined` keys are dropped. */
function pickTextFields(patch, target, warnings) {
  const aliases = {
    title: ['title', 'goal', 'name', 'tieu_de'],
    overview: ['overview', 'summary', 'objective', 'tong_quan'],
    currentActivity: ['current_activity', 'currentActivity', 'activity', 'hoat_dong'],
    nextSteps: ['next_steps', 'nextSteps', 'plan', 'buoc_tiep_theo'],
    notes: ['notes', 'note', 'findings', 'key_findings', 'ghi_chu']
  };
  for (const [canonical, keys] of Object.entries(aliases)) {
    const value = pick(patch, keys);
    if (value === undefined) continue;
    if (typeof value !== 'string' && typeof value !== 'number') {
      warnings.push(`${canonical} must be a string; the value sent was ignored.`);
      continue;
    }
    target[canonical] = String(value).replace(/\r\n/g, '\n').trim();
  }
}

/**
 * Merge an incoming patch onto a base document and return a canonical document.
 *
 * @param {object} patch - fields the caller sent (only present keys are applied).
 * @param {object} [base] - the document to patch; omitted for a brand-new one.
 * @param {object} [options] - `sessionId`, `checklistMode` (`replace`|`append`|`merge`).
 * @returns {{progress: object, warnings: string[]}}
 */
export function normalizeProgress(patch = {}, base = null, options = {}) {
  const warnings = [];
  const source = patch && typeof patch === 'object' && !Array.isArray(patch) ? patch : {};
  const progress = base
    ? JSON.parse(JSON.stringify(base))
    : createEmptyProgress(options.sessionId);

  progress.version = SCHEMA_VERSION;
  if (options.sessionId) progress.sessionId = String(options.sessionId);
  if (!progress.createdAt) progress.createdAt = Date.now();

  pickTextFields(source, progress, warnings);

  if (source.status !== undefined && source.status !== null && source.status !== '') {
    const raw = String(source.status).trim().toLowerCase();
    if (!['starting', 'in_progress', 'blocked', 'completed'].includes(raw)) {
      throw new Error(`\`status\` must be one of starting | in_progress | blocked | completed (received ${JSON.stringify(source.status)}).`);
    }
    progress.status = raw;
  }

  if (source.checklist !== undefined) {
    const { items, warnings: itemWarnings, errors } = normalizeChecklist(source.checklist);
    if (errors.length > 0) throw new Error(errors.join(' '));
    warnings.push(...itemWarnings);
    const mode = String(options.checklistMode ?? 'replace').toLowerCase();
    if (mode === 'append') progress.checklist = [...(progress.checklist ?? []), ...items];
    else if (mode === 'merge') progress.checklist = mergeChecklists(progress.checklist ?? [], items, warnings);
    else if (mode === 'replace') progress.checklist = items;
    else throw new Error(`\`checklist_mode\` must be replace | append | merge (received ${JSON.stringify(options.checklistMode)}).`);
  }

  finalizeStates(progress.checklist ?? []);
  progress.updatedAt = Date.now();
  return { progress, warnings };
}

/**
 * Merge an incoming tree into an existing one by item path: a path that exists is
 * patched in place (text/weight/state and recursively its children), a new path is
 * appended.
 */
function mergeChecklists(base, incoming, warnings) {
  const out = JSON.parse(JSON.stringify(base));
  const mergeInto = (target, incomingList, path) => {
    incomingList.forEach((item, index) => {
      const existing = target[index];
      if (!existing) {
        target.push(item);
        return;
      }
      if (existing.text !== item.text) warnings.push(`item ${path ? `${path}.` : ''}${index + 1} text replaced ("${existing.text}" → "${item.text}").`);
      existing.text = item.text;
      if (item.weightSource === 'declared') existing.weight = item.weight;
      existing.weightSource = item.weightSource === 'declared' ? 'declared' : existing.weightSource;
      existing.state = item.children.length > 0 ? existing.state : item.state;
      existing.children = existing.children ?? [];
      mergeInto(existing.children, item.children, `${path ? `${path}.` : ''}${index + 1}`);
    });
  };
  mergeInto(out, incoming, '');
  return out;
}

// ──────────────────────────────── computation ────────────────────────────────

/** Weight of a list of items (never 0 when any item exists). */
function sumWeights(items) {
  return (items ?? []).reduce((sum, item) => sum + (Number.isFinite(item.weight) && item.weight > 0 ? item.weight : 1), 0);
}

/** Measure one node in place: its earned ratio, leaf counts and state. */
function measureNode(node) {
  if (node.item.children.length > 0) {
    const total = sumWeights(node.item.children);
    let earned = 0;
    let leaves = 0;
    let done = 0;
    let running = 0;
    let pending = 0;
    for (const child of node.children) {
      measureNode(child);
      earned += child.item.weight * child.ratio;
      leaves += child.leaves;
      done += child.done;
      running += child.running;
      pending += child.pending;
    }
    node.ratio = total > 0 ? earned / total : 0;
    node.leaves = leaves;
    node.done = done;
    node.running = running;
    node.pending = pending;
    node.state = node.item.state;
    return node;
  }
  const fraction = STATE_FRACTION[node.item.state] ?? 0;
  node.ratio = fraction;
  node.leaves = 1;
  node.done = node.item.state === 'done' ? 1 : 0;
  node.running = node.item.state === 'running' ? 1 : 0;
  node.pending = node.item.state === 'pending' ? 1 : 0;
  node.state = node.item.state;
  return node;
}

/** Build the internal node tree for a checklist array. */
function buildNodes(items, pathPrefix, depth) {
  return (Array.isArray(items) ? items : []).map((item, index) => {
    const path = pathPrefix ? `${pathPrefix}.${index + 1}` : String(index + 1);
    return { item, path, index: index + 1, depth, children: buildNodes(item.children, path, depth + 1) };
  });
}

/** Assign every node its effective share of the whole job (0-1). */
function assignShares(nodes, parentShare, siblingSum) {
  for (const node of nodes) {
    node.share = siblingSum > 0 ? (parentShare * node.item.weight) / siblingSum : 0;
    assignShares(node.children, node.share, sumWeights(node.item.children));
  }
}

/** Project one internal node onto the wire shape the tools and the panel consume. */
function toWireNode(node) {
  return {
    path: node.path,
    index: node.index,
    depth: node.depth,
    text: node.item.text,
    weight: node.item.weight,
    weightSource: node.item.weightSource ?? 'default',
    weightPercent: round(node.share * 100, 1),
    state: node.state,
    percent: Math.round(node.ratio * 100),
    isGroup: node.item.children.length > 0,
    leaves: node.leaves,
    done: node.done,
    running: node.running,
    pending: node.pending,
    children: node.children.map(toWireNode)
  };
}

/** Depth-first flatten of the wire tree (parents before their children). */
function flattenWire(nodes, out = []) {
  for (const node of nodes) {
    out.push(node);
    flattenWire(node.children, out);
  }
  return out;
}

/**
 * Compute everything derived from a document: the overall percentage, the
 * leaf counts, the decorated checklist tree and its depth-first flattening.
 *
 * @param {object} progress - a canonical document.
 * @returns {object} summary:
 *   `percent` (integer 0-100), `exactPercent`, `status`, `tasksTotal/Done/InProgress/Pending`
 *   (leaf counts), `items` (wire tree), `flat` (depth-first wire list),
 *   `groups` (number of group rows), `weightsDeclaredSum` (Σ top-level declared weights).
 */
export function computeProgress(progress) {
  const checklist = Array.isArray(progress?.checklist) ? progress.checklist : [];
  const nodes = buildNodes(checklist, '', 1);
  const topSum = sumWeights(checklist);
  assignShares(nodes, 1, topSum);
  nodes.forEach(measureNode);

  let earned = 0;
  let leaves = 0;
  let done = 0;
  let running = 0;
  let pending = 0;
  for (const node of nodes) {
    earned += node.item.weight * node.ratio;
    leaves += node.leaves;
    done += node.done;
    running += node.running;
    pending += node.pending;
  }

  const exactPercent = topSum > 0 ? (earned / topSum) * 100 : 0;
  const items = nodes.map(toWireNode);
  const flat = flattenWire(items);

  return {
    percent: Math.max(0, Math.min(100, Math.round(exactPercent))),
    exactPercent: round(exactPercent, 2),
    status: progress?.status ?? 'starting',
    title: progress?.title ?? '',
    currentActivity: progress?.currentActivity ?? '',
    tasksTotal: leaves,
    tasksDone: done,
    tasksInProgress: running,
    tasksPending: pending,
    groups: flat.length - leaves,
    items,
    flat,
    topWeightSum: round(topSum, 3)
  };
}

/**
 * Status derived from the boxes, with `blocked` always winning and an explicit
 * `completed` that the checklist denies being corrected back to `in_progress`.
 * @param {object} progress - the canonical document.
 * @param {object} summary - {@link computeProgress} of the same document.
 * @returns {{status: string, warning: string}}
 */
export function deriveStatus(progress, summary) {
  const explicit = String(progress?.status ?? '').trim().toLowerCase();
  if (explicit === 'blocked') return { status: 'blocked', warning: '' };
  if (summary.tasksTotal === 0) return { status: explicit || 'starting', warning: '' };
  if (summary.tasksDone >= summary.tasksTotal) return { status: 'completed', warning: '' };
  if (explicit === 'completed') {
    return {
      status: 'in_progress',
      warning: '`status: completed` was ignored: the checklist still has unfinished items, and progress is computed from the boxes.'
    };
  }
  return { status: summary.percent > 0 || summary.tasksInProgress > 0 ? 'in_progress' : 'starting', warning: '' };
}

// ─────────────────────────────── item addressing ─────────────────────────────

/** The box a wire state renders as, in Markdown/checkbox form. */
export function boxOf(state) {
  if (state === 'done') return '[x]';
  if (state === 'running') return '[/]';
  return '[ ]';
}

/**
 * Split a matcher into the state it asks for and the text/path it matches.
 * Accepts a bare snippet (`Viết parser`), a marked one (`~ Chạy lint`), a pasted
 * checklist line (`- [x] Viết parser`) or a path/row (`#2.1`, `3`).
 * @param {string} raw - one matcher.
 * @returns {{mark: string|null, text: string, state: string|null}}
 */
export function parseMatcher(raw) {
  let text = String(raw ?? '').trim().replace(/^[-*+]\s+/, '');
  let state = null;
  const box = text.match(/^([~\/]|\[\s?\]|\[[xX\-\/~]\])\s+/) ?? text.match(/^([~\/]|\[\s?\]|\[[xX\-\/~]\])(?=\s|$)/);
  if (box) {
    state = normalizeState(box[1], 'pending');
    text = text.slice(box[0].length).trim();
  }
  const rest = text.match(/^\[([ xX\-\/~]?)\]\s*(.*)$/);
  if (rest) {
    if (state === null) state = normalizeState(rest[1], 'pending');
    text = rest[2].trim();
  }
  return { mark: state, text, state };
}

/**
 * Resolve one matcher against the flattened checklist.
 * Ambiguity is refused on purpose: silently picking one of two identical items is
 * exactly how a checklist starts lying about the work.
 *
 * @param {object} summary - {@link computeProgress}.
 * @param {string} rawMatcher - the matcher (or a `#`-prefixed row/path).
 * @returns {{node: object, state: string|null, how: string}}
 */
export function matchChecklistItem(summary, rawMatcher) {
  const flat = summary?.flat ?? [];
  if (flat.length === 0) throw new Error('the Checklist is empty, so there is nothing to match.');
  const parsed = parseMatcher(rawMatcher);
  const query = parsed.text;
  if (!query) {
    throw new Error(
      `the matcher "${String(rawMatcher ?? '')}" names no item; send a text snippet or a path (\`#2.1\`). Checklist: ${listFlat(flat)}`
    );
  }

  const numbered = query.replace(/^#/, '').match(/^(\d+(?:\.\d+)*)$/);
  if (numbered) {
    const raw = numbered[1];
    if (raw.includes('.')) {
      const hit = flat.find((node) => node.path === raw);
      if (!hit) throw new Error(`no checklist item at path #${raw}. Checklist: ${listFlat(flat)}`);
      return { node: hit, state: parsed.state, how: 'path' };
    }
    const position = Number(raw) - 1;
    if (position >= 0 && position < flat.length) return { node: flat[position], state: parsed.state, how: 'row' };
    throw new Error(`row #${raw} is out of range; the checklist has ${flat.length} row(s). Checklist: ${listFlat(flat)}`);
  }

  const wanted = normalizeHeading(query);
  const scored = [];
  for (const node of flat) {
    const name = normalizeHeading(node.text);
    if (!name) continue;
    if (name === wanted) scored.push({ node, score: 1 });
    else if (wanted.length >= 3 && name.includes(wanted)) scored.push({ node, score: 0.9 });
    else if (name.length >= 3 && wanted.includes(name)) scored.push({ node, score: 0.8 });
  }
  if (scored.length === 0) {
    throw new Error(`no checklist item matches "${query}". Checklist: ${listFlat(flat)}`);
  }
  const best = Math.max(...scored.map((entry) => entry.score));
  const winners = scored.filter((entry) => entry.score === best);
  if (winners.length > 1) {
    throw new Error(
      `"${query}" matches ${winners.length} items (${winners
        .map((entry) => `#${entry.node.path} "${entry.node.text}"`)
        .join(' | ')}); send a longer snippet, or the item path (\`#2.1\`).`
    );
  }
  return { node: winners[0].node, state: parsed.state, how: 'text' };
}

/** `#1 "a" · #2 "b"` — the compact item list every matcher error carries. */
export function listFlat(flat) {
  return (flat ?? []).map((node) => `#${node.path} "${node.text}"`).join(' · ') || '(empty)';
}

/** Resolve a path against the raw checklist array (paths are positional). */
function itemAtPath(root, path) {
  let list = root;
  let node = null;
  for (const part of String(path).split('.')) {
    if (!Array.isArray(list)) return null;
    node = list[Number(part) - 1];
    if (!node) return null;
    list = node.children;
  }
  return node;
}

/**
 * Set one item's state in place (cascading `done` into a group's subtree).
 * @returns {object} the mutated raw node.
 */
export function setStateAtPath(progress, path, state) {
  const node = itemAtPath(progress?.checklist ?? [], path);
  if (!node) throw new Error(`no checklist item at path #${path}.`);
  if (state === 'done') markSubtreeDone(node);
  else node.state = state;
  finalizeStates(progress.checklist ?? []);
  return node;
}

/** Everything a tick touched, for the tool result. */
function applyStateToMatchers(progress, matchers, state, options = {}) {
  const summary = computeProgress(progress);
  const moved = [];
  const seenPaths = new Set();
  for (const rawMatcher of matchers ?? []) {
    const { node } = matchChecklistItem(summary, rawMatcher);
    if (seenPaths.has(node.path)) continue;
    seenPaths.add(node.path);
    const wasDone = node.state === 'done';
    if (state === 'done' && wasDone && !options.force) {
      moved.push({ path: node.path, text: node.text, already: true });
      continue;
    }
    setStateAtPath(progress, node.path, state);
    moved.push({ path: node.path, text: node.text, already: wasDone && state === 'done' });
  }
  return moved;
}

/**
 * Tick items off. A group matcher cascades `done` into its whole subtree.
 * @returns {{moved: Array<{path: string, text: string, already: boolean}>, ticked: string[]}}
 */
export function checkItems(progress, matchers) {
  const moved = applyStateToMatchers(progress, matchers, 'done');
  return {
    moved,
    ticked: moved.filter((entry) => !entry.already).map((entry) => entry.text)
  };
}

/** Mark items as running (or pending with `state: "pending"`). */
export function setItemsState(progress, matchers, state) {
  if (!ITEM_STATES.includes(state)) throw new Error(`state must be pending | running | done (received ${JSON.stringify(state)}).`);
  return applyStateToMatchers(progress, matchers, state);
}

/**
 * Promote the next pending leaf to `running` — but only when nothing else is running,
 * so the checklist keeps naming exactly one step the session is on.
 * @param {object} progress - the canonical document.
 * @param {string} [afterPath] - the path of the item that just finished.
 * @param {boolean} [force] - clear other running leaves first.
 * @returns {{promoted: object|null, cleared: string[]}}
 */
export function advanceToNext(progress, afterPath = '', force = false) {
  const summary = computeProgress(progress);
  const leaves = summary.flat.filter((node) => !node.isGroup);
  const running = leaves.filter((node) => node.state === 'running');
  const cleared = [];
  if (running.length > 0) {
    if (!force) return { promoted: null, cleared };
    for (const node of running) {
      setStateAtPath(progress, node.path, 'pending');
      cleared.push(node.text);
    }
  }

  const ordered = [];
  const before = [];
  let passed = !afterPath;
  for (const node of leaves) {
    if (node.path === afterPath) {
      passed = true;
      continue;
    }
    (passed ? ordered : before).push(node);
  }
  const candidate = [...ordered, ...before].find((node) => node.state === 'pending');
  if (!candidate) return { promoted: null, cleared };
  setStateAtPath(progress, candidate.path, 'running');
  return { promoted: candidate, cleared };
}

/** Which item the session is on right now: the first running leaf, else the first pending one. */
export function currentItem(summary) {
  const leaves = (summary?.flat ?? []).filter((node) => !node.isGroup);
  return leaves.find((node) => node.state === 'running') ?? leaves.find((node) => node.state === 'pending') ?? null;
}

/** The pending leaves after the current one, for the status tool. */
export function upcomingItems(summary, limit = 3) {
  const leaves = (summary?.flat ?? []).filter((node) => !node.isGroup);
  const current = currentItem(summary);
  const position = current ? leaves.indexOf(current) : -1;
  return leaves
    .slice(position + 1)
    .filter((node) => node.state === 'pending')
    .slice(0, Math.max(0, limit));
}

// ────────────────────────────── checklist editing ────────────────────────────

/** Append items at the root, or inside the group a matcher names. */
export function addChecklistItems(progress, items, parentMatcher = '') {
  const raw = items === undefined || items === null ? [] : items;
  const normalized = normalizeChecklist(Array.isArray(raw) ? raw : [raw]);
  const parent = String(parentMatcher ?? '').trim();
  if (!parent) {
    progress.checklist = [...(progress.checklist ?? []), ...normalized.items];
  } else {
    const summary = computeProgress(progress);
    const { node } = matchChecklistItem(summary, parent);
    if (!node.isGroup && !Array.isArray(itemAtPath(progress.checklist, node.path)?.children)) {
      itemAtPath(progress.checklist, node.path).children = [];
    }
    const target = itemAtPath(progress.checklist, node.path);
    target.children = [...(target.children ?? []), ...normalized.items];
  }
  finalizeStates(progress.checklist ?? []);
  return { added: normalized.items, warnings: normalized.warnings };
}

/** Remove items (a group takes its subtree with it); returns what was removed. */
export function removeChecklistItems(progress, matchers) {
  const removed = [];
  for (const rawMatcher of matchers ?? []) {
    const summary = computeProgress(progress);
    const { node } = matchChecklistItem(summary, rawMatcher);
    const parts = node.path.split('.').map(Number);
    const list = parts.slice(0, -1).reduce((acc, part) => acc?.[part - 1]?.children, progress.checklist);
    if (!Array.isArray(list)) continue;
    const [gone] = list.splice(parts[parts.length - 1] - 1, 1);
    if (gone) removed.push({ path: node.path, text: gone.text });
  }
  finalizeStates(progress.checklist ?? []);
  return removed;
}

/**
 * Patch items in place: `{ match, text?, weight?, state? }`.
 * A `state: "done"` cascades into a group; changing `text`/`weight` never moves boxes.
 */
export function updateChecklistItems(progress, updates) {
  if (!Array.isArray(updates) || updates.length === 0) {
    throw new Error('`update` must be a non-empty array of { match, text?, weight?, state? }.');
  }
  const changed = [];
  for (const update of updates) {
    if (!update || typeof update !== 'object' || !String(update.match ?? '').trim()) {
      throw new Error('every `update` entry needs a `match` (item text snippet or path like "#2.1").');
    }
    const summary = computeProgress(progress);
    const { node } = matchChecklistItem(summary, update.match);
    const rawNode = itemAtPath(progress.checklist, node.path);
    const before = { text: rawNode.text, weight: rawNode.weight, state: rawNode.state };

    if (update.text !== undefined && update.text !== null) {
      const cleaned = extractInlineWeight(stripCheckboxPrefix(String(update.text)).text);
      if (!cleaned.text) throw new Error(`update for "${node.text}" sent an empty \`text\`.`);
      rawNode.text = cleaned.text;
      if (cleaned.weight !== null && update.weight === undefined) {
        rawNode.weight = cleaned.weight;
        rawNode.weightSource = 'declared';
      }
    }
    if (update.weight !== undefined && update.weight !== null) {
      const weight = parseWeightValue(update.weight);
      if (weight === null) throw new Error(`update for "${node.text}" sent weight ${JSON.stringify(update.weight)}; a weight must be a positive number.`);
      rawNode.weight = weight;
      rawNode.weightSource = 'declared';
    }
    if (update.state !== undefined && update.state !== null && update.state !== '') {
      const state = normalizeState(update.state, '');
      if (!ITEM_STATES.includes(state)) throw new Error(`update for "${node.text}" sent state ${JSON.stringify(update.state)}; use pending | running | done.`);
      setStateAtPath(progress, node.path, state);
    }
    changed.push({ path: node.path, text: rawNode.text, before, after: { text: rawNode.text, weight: rawNode.weight, state: rawNode.state } });
  }
  finalizeStates(progress.checklist ?? []);
  return changed;
}

// ─────────────────────────────────- lint/size ─────────────────────────────────

/**
 * Structural validation of a document already on disk (as opposed to an incoming patch,
 * which is validated by {@link normalizeProgress}).
 * @param {object} progress - the parsed document.
 * @returns {{errors: string[], warnings: string[]}}
 */
export function lintProgressData(progress) {
  const errors = [];
  const warnings = [];
  if (!progress || typeof progress !== 'object' || Array.isArray(progress)) {
    return { errors: ['the progress file does not hold a JSON object.'], warnings };
  }
  if (progress.checklist !== undefined && !Array.isArray(progress.checklist)) {
    errors.push('`checklist` is not an array.');
  }

  let count = 0;
  try {
    walkItems(progress.checklist ?? [], '', 1, (item, path, depth) => {
      count += 1;
      if (!String(item.text ?? '').trim()) errors.push(`item #${path} has no text.`);
      if (!Number.isFinite(item.weight) || item.weight <= 0) errors.push(`item #${path} ("${item.text}") has weight ${JSON.stringify(item.weight)}; it must be a positive number.`);
      if (depth > MAX_DEPTH) errors.push(`item #${path} is nested ${depth} levels deep (limit ${MAX_DEPTH}).`);
    });
  } catch (e) {
    errors.push(`the checklist could not be walked: ${e?.message || e}`);
  }
  if (count > MAX_ITEMS) errors.push(`the checklist holds ${count} items (limit ${MAX_ITEMS}).`);
  if (count === 0) warnings.push('the checklist is empty; the panel shows 0% until it has at least one item.');
  if (!String(progress.title ?? '').trim()) warnings.push('the document has no `title`.');

  const bytes = Buffer.byteLength(JSON.stringify(progress ?? {}), 'utf-8');
  if (bytes > 200000) errors.push(`the progress document is ${bytes} bytes; the limit is ~200 KB. Keep the free-text fields to short factual lines.`);
  else if (bytes > 40000) warnings.push(`the progress document is ${bytes} bytes; the budget is ~40 KB. Trim the free-text fields to facts.`);

  return { errors, warnings };
}

// ─────────────────────────── rendering (what the model reads) ────────────────

/** Markdown bullets for the checklist, indented by depth, each showing its share. */
export function renderChecklistLines(progress) {
  const summary = computeProgress(progress);
  if (summary.items.length === 0) return '(empty)';
  const lines = [];
  const walk = (nodes) => {
    for (const node of nodes) {
      const share = `${node.weightPercent}%`;
      lines.push(`${'  '.repeat(node.depth - 1)}- ${boxOf(node.state)} ${node.text} (${share})`);
      walk(node.children);
    }
  };
  walk(summary.items);
  return lines.join('\n');
}

/** The whole document as readable text, for the read tool's `all` view. */
export function renderProgressText(progress) {
  const summary = computeProgress(progress);
  return [
    `# ${progress.title || '(untitled)'}`,
    '',
    '## Overview',
    progress.overview || '(empty)',
    '',
    '## Checklist',
    renderChecklistLines(progress),
    '',
    `Checklist progress: ${summary.tasksDone}/${summary.tasksTotal} items done · ${summary.percent}% weighted`,
    '',
    '## Current Activity',
    progress.currentActivity || '(empty)',
    '',
    '## Next Steps',
    progress.nextSteps || '(empty)',
    '',
    '## Key Findings / Notes',
    progress.notes || '(empty)'
  ].join('\n');
}

/** The document as it is written to disk. */
export function serializeProgress(progress) {
  return `${JSON.stringify(progress, null, 2)}\n`;
}

// ─────────────────────────── markdown migration (v1) ─────────────────────────

/** Canonical section key a localized H2 heading maps to, or null. */
function canonicalSection(name) {
  const normalized = normalizeHeading(name);
  const table = [
    ['overview', ['overview', 'tong quan', 'gioi thieu', 'muc tieu', 'tom tat', 'objective', 'summary']],
    ['checklist', ['checklist', 'check list', 'danh sach cong viec', 'danh sach', 'cong viec', 'viec can lam', 'tasks', 'todo']],
    ['current_activity', ['current activity', 'hoat dong hien tai', 'dang thuc hien', 'dang lam', 'current step', 'hoat dong']],
    ['next_steps', ['next steps', 'buoc tiep theo', 'cac buoc tiep theo', 'ke hoach tiep theo', 'tiep theo', 'plan']],
    ['notes', ['key findings', 'findings', 'phat hien', 'ghi chu', 'ket qua chinh', 'notes', 'note']]
  ];
  for (const [key, aliases] of table) {
    if (aliases.some((alias) => normalized === alias || normalized.startsWith(`${alias} `) || normalized.includes(` ${alias}`))) return key;
  }
  return null;
}

const MD_CHECKBOX = /^(\s*)(?:[-*+]|\d+[.)])\s+\[([ xX\-\/~])\]\s*(.*)$/;

/** Number of leaves in a checklist array (a leaf is an item without children). */
function countLeaves(items) {
  return (Array.isArray(items) ? items : []).reduce(
    (sum, item) => sum + (item.children?.length > 0 ? countLeaves(item.children) : 1),
    0
  );
}

/**
 * Give every item a weight equal to the number of leaves below it.
 *
 * A v1 document had no weights and counted every checkbox line the same, so this is
 * the migration that keeps the old meaning: each finished leaf moves the total by an
 * equal share, and a sub-item splits its parent's share evenly.
 */
function weightSubtreesByLeaves(items) {
  for (const item of Array.isArray(items) ? items : []) {
    item.weight = countLeaves(item.children) || 1;
    item.weightSource = 'default';
    weightSubtreesByLeaves(item.children);
  }
}

/**
 * Read a schema-v1 Markdown progress document into a v2 JSON document.
 *
 * Weights did not exist in v1, so every migrated item gets the default weight (1):
 * all items of a level share that level equally, which reproduces the old
 * "1 per `[x]`, ½ per `[/]`" percentage exactly.
 *
 * @param {string} content - the Markdown document.
 * @param {string} [sessionId] - owning session id.
 * @returns {object} a canonical v2 document.
 */
export function migrateLegacyMarkdown(content, sessionId = '') {
  const text = String(content ?? '').replace(/^\uFEFF/, '');
  const progress = createEmptyProgress(sessionId);
  progress.migratedFrom = 'markdown-v1';

  const fm = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (fm) {
    for (const rawLine of fm[1].split('\n')) {
      const line = rawLine.trim();
      const colon = line.indexOf(':');
      if (colon === -1) continue;
      const key = normalizeHeading(line.slice(0, colon));
      const value = line.slice(colon + 1).trim().replace(/^["']|["']$/g, '');
      if (key === 'status') progress.status = value;
      else if (key === 'current activity' || key === 'activity' || key === 'currentactivity') progress.currentActivity = value;
      else if (key === 'progress' && !progress._legacyPercent) progress._legacyPercent = value;
    }
  }

  const sections = new Map();
  let current = 'overview';
  const checklistLines = [];
  let inFence = false;
  for (const line of text.split(/\r?\n/)) {
    if (/^\s{0,3}(`{3,}|~{3,})/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const h1 = line.match(/^#\s+(\S.*)$/);
    if (h1) {
      if (!progress.title) progress.title = h1[1].trim();
      continue;
    }
    const h2 = line.match(/^##\s+(\S.*)$/);
    if (h2) {
      current = canonicalSection(h2[1]) ?? 'other';
      if (!sections.has(current)) sections.set(current, []);
      continue;
    }
    if (current === 'checklist') checklistLines.push(line);
    else if (current !== 'other') {
      if (!sections.has(current)) sections.set(current, []);
      sections.get(current).push(line);
    }
  }

  const body = (key) => (sections.get(key) ?? []).join('\n').trim();
  progress.overview = body('overview');
  progress.nextSteps = body('next_steps');
  progress.notes = body('notes');
  if (!progress.currentActivity) progress.currentActivity = body('current_activity').replace(/\s+/g, ' ').trim();

  // Rebuild the flat v1 checklist as a tree from each line's indentation.
  const roots = [];
  const stack = [];
  for (const line of checklistLines) {
    const match = line.match(MD_CHECKBOX);
    if (!match) continue;
    const depth = Math.floor(match[1].replace(/\t/g, '  ').length / 2);
    const item = {
      text: match[3].trim() || '(untitled step)',
      weight: 1,
      weightSource: 'default',
      state: normalizeState(match[2], 'pending'),
      children: []
    };
    while (stack.length > depth) stack.pop();
    const parent = stack[depth - 1];
    if (parent) parent.children.push(item);
    else roots.push(item);
    stack[depth] = item;
  }
  progress.checklist = roots;
  weightSubtreesByLeaves(progress.checklist);
  finalizeStates(progress.checklist);

  const { progress: normalized } = normalizeProgress(progress, null, { sessionId });
  return normalized;
}

/**
 * Parse whatever is on disk into a canonical document.
 * @param {string} text - file content (JSON, or a v1 Markdown document).
 * @param {string} [sessionId] - owning session id.
 * @returns {{progress: object, migrated: boolean}}
 */
export function parseProgressFileText(text, sessionId = '') {
  const raw = String(text ?? '').trim();
  if (raw === '') return { progress: createEmptyProgress(sessionId), migrated: false };
  if (raw.startsWith('{')) {
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      throw new Error(`the progress JSON file is not valid JSON: ${e?.message || e}`);
    }
    return { progress: normalizeProgress(parsed, null, { sessionId }).progress, migrated: false };
  }
  return { progress: migrateLegacyMarkdown(raw, sessionId), migrated: true };
}
