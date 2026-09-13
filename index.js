import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';

export const name = 'dsh-session-progress';
export const inject = ['webServer'];

// Map: sessionId -> { filePath, uuid, sessionId, createdAt, lastUpdated }
const sessionProgressMap = new Map();
let latestActiveSessionId = null;

// Settings persistence: a per-session override map plus the default that applies to every session
// without an override. The default is what the toolbar toggle switches on a brand-new session
// screen, where no session id exists yet but the user must still be able to turn tracking off.
const SETTINGS_FILE = path.join(os.homedir(), '.dsh-session-progress-settings.json');
/** sessionId -> explicit enabled flag (an override of the default). */
const sessionEnabledOverrides = new Map();
/** Whether sessions without an override have progress tracking enabled. */
let defaultEnabled = true;

/** The scope key the UI uses for the "applies to new sessions" toggle. */
export const DEFAULT_SCOPE = 'default';

function loadSettings() {
  try {
    if (!fs.existsSync(SETTINGS_FILE)) return;
    const data = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));

    if (typeof data?.defaultEnabled === 'boolean') {
      defaultEnabled = data.defaultEnabled;
    }
    if (data?.overrides && typeof data.overrides === 'object') {
      sessionEnabledOverrides.clear();
      for (const [sid, enabled] of Object.entries(data.overrides)) {
        if (sid && typeof enabled === 'boolean') sessionEnabledOverrides.set(String(sid), enabled);
      }
    }
    // Legacy shape: a list of disabled session ids, before the default scope existed.
    if (Array.isArray(data?.disabledSessions)) {
      for (const sid of data.disabledSessions) {
        if (sid) sessionEnabledOverrides.set(String(sid), false);
      }
    }
  } catch (e) {
    console.warn('[dsh-session-progress] Failed to load settings:', e?.message || e);
  }
}

function saveSettings() {
  try {
    const data = {
      defaultEnabled,
      overrides: Object.fromEntries(sessionEnabledOverrides)
    };
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.warn('[dsh-session-progress] Failed to save settings:', e?.message || e);
  }
}

loadSettings();

/**
 * Whether progress tracking is switched off for a session. The `default` scope (or a missing id)
 * answers with the default that applies to sessions without their own override.
 * @param {string} sessionId - session id, or `default`.
 * @returns {boolean} true when tracking is disabled.
 */
export function isSessionDisabled(sessionId) {
  if (!sessionId || String(sessionId) === DEFAULT_SCOPE) return !defaultEnabled;
  const sId = String(sessionId);
  const override = sessionEnabledOverrides.get(sId);
  return override === undefined ? !defaultEnabled : !override;
}

/**
 * Record an explicit per-session choice; `default` changes what new sessions inherit.
 * @param {string} sessionId - session id, or `default` for the default scope.
 * @param {boolean} enabled - whether tracking should be on.
 */
export function setSessionEnabled(sessionId, enabled) {
  const sId = sessionId ? String(sessionId) : DEFAULT_SCOPE;
  if (sId === DEFAULT_SCOPE) {
    defaultEnabled = Boolean(enabled);
  } else {
    sessionEnabledOverrides.set(sId, Boolean(enabled));
  }
  saveSettings();
}

/** Back-compat wrapper used by older call sites. */
export function setSessionDisabled(sessionId, disabled) {
  setSessionEnabled(sessionId, !disabled);
}

// --- Todo tool policy -------------------------------------------------------------------------
// A session whose progress tracking is ON already maintains the progress file as its task list, so
// the model-facing `todo_write` tool is denied inside that session's agent scope: one source of
// truth instead of two competing lists. The denial is per agent (never global), and it is lifted
// again the moment tracking is switched off for that session.

/** The model-facing todo tool this plugin takes away while it tracks a session. */
export const TODO_TOOL_NAME = 'todo_write';

/** Whether tracking sessions also drop the todo tool; `apply(ctx, { disableTodoTool: false })` opts out. */
let disableTodoTool = true;

/** agentId (=== its session id) -> disposer of the `tools.restrict()` effect applied for that agent. */
const todoToolRestrictions = new Map();

/** The session id an agent is keyed by; both ids are the same shared value in DSH. */
function agentSessionId(agent) {
  return agent?.session?.id ?? agent?.id ?? null;
}

/** Whether the session's progress tracking is currently on. */
function isTrackingSession(sessionId) {
  return Boolean(sessionId) && !isSessionDisabled(sessionId);
}

/**
 * Whether `todo_write` is visible to this agent right now. A preset without the todo tool (the
 * shipped Minimal mode, or a custom preset with the row removed) answers false, and denying a name
 * the registry does not know would throw — so the policy stays a silent no-op there.
 */
function isTodoToolVisible(agent) {
  try {
    return agent?.ctx?.tools?.get?.(TODO_TOOL_NAME, agent) !== undefined;
  } catch (e) {
    return false;
  }
}

/**
 * Apply or lift the `todo_write` denial for one live agent, following its session's tracking state.
 * Safe to call repeatedly: the disposer is held per agent and lifted exactly once.
 * @param ctx - the plugin context (used for logging).
 * @param agent - the live agent to sync; a falsy agent is ignored.
 */
export function syncTodoToolPolicy(ctx, agent) {
  if (!disableTodoTool) return;
  const agentId = agent?.id ?? agentSessionId(agent);
  const sessionId = agentSessionId(agent);
  if (!agentId || !sessionId) return;

  const held = todoToolRestrictions.get(agentId);
  const shouldDeny = isTrackingSession(sessionId);

  if (shouldDeny && held === undefined) {
    if (!isTodoToolVisible(agent)) return;
    try {
      const disposer = agent.ctx.tools.restrict({ deny: [TODO_TOOL_NAME] });
      todoToolRestrictions.set(agentId, typeof disposer === 'function' ? disposer : () => {});
      ctx.logger?.info?.(
        `[dsh-session-progress] denied "${TODO_TOOL_NAME}" for session ${sessionId} (progress tracking is on)`
      );
    } catch (e) {
      ctx.logger?.warn?.(
        `[dsh-session-progress] could not deny "${TODO_TOOL_NAME}" for session ${sessionId}: ${e?.message || e}`
      );
    }
    return;
  }

  if (!shouldDeny && held !== undefined) {
    try {
      held();
    } catch (e) {
      ctx.logger?.warn?.(`[dsh-session-progress] could not restore "${TODO_TOOL_NAME}": ${e?.message || e}`);
    }
    todoToolRestrictions.delete(agentId);
    ctx.logger?.info?.(
      `[dsh-session-progress] restored "${TODO_TOOL_NAME}" for session ${sessionId} (progress tracking is off)`
    );
  }
}

/**
 * Sync the todo-tool policy for every live agent of a scope that just changed. The `default` scope
 * applies to sessions without their own override, so each live session is re-evaluated by its own id.
 * @param ctx - the plugin context.
 * @param agents - the live agent registry.
 * @param changedSessionId - the session whose switch moved, or `default`.
 */
export function syncTodoToolPolicyForToggle(ctx, agents, changedSessionId) {
  if (!agents) return; // deployment without the agents service: nothing to restrict
  try {
    if (changedSessionId && changedSessionId !== DEFAULT_SCOPE) {
      const agent = agents.get(changedSessionId);
      if (agent) syncTodoToolPolicy(ctx, agent);
      return;
    }
    for (const agent of agents.list?.() ?? []) syncTodoToolPolicy(ctx, agent);
  } catch (e) {
    ctx.logger?.warn?.(`[dsh-session-progress] todo tool policy sync failed: ${e?.message || e}`);
  }
}

/** Drop the bookkeeping for an agent that is going away; its effect dies with the agent scope. */
export function forgetTodoToolPolicy(agent) {
  const agentId = agent?.id ?? agentSessionId(agent);
  if (agentId) todoToolRestrictions.delete(agentId);
}

/**
 * Sanitize a string to be safely used as a filename component
 */
function sanitizeKey(str) {
  if (!str) return 'default';
  return String(str).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
}

/**
 * Locate the most relevant active progress record across memory and disk
 */
export function findLatestSessionProgress() {
  // 1. If latestActiveSessionId is known and its file exists, prioritize it
  if (latestActiveSessionId && sessionProgressMap.has(latestActiveSessionId)) {
    const rec = sessionProgressMap.get(latestActiveSessionId);
    if (rec?.filePath && fs.existsSync(rec.filePath)) {
      try {
        const stat = fs.statSync(rec.filePath);
        return { ...rec, lastUpdated: stat.mtimeMs };
      } catch (e) {}
    }
  }

  // 2. Scan sessionProgressMap for the newest file
  let bestRecord = null;
  let bestMtime = 0;
  for (const [sId, rec] of sessionProgressMap.entries()) {
    if (rec?.filePath && fs.existsSync(rec.filePath)) {
      try {
        const stat = fs.statSync(rec.filePath);
        if (stat.mtimeMs > bestMtime) {
          bestMtime = stat.mtimeMs;
          bestRecord = { ...rec, sessionId: sId, lastUpdated: stat.mtimeMs };
        }
      } catch (e) {}
    }
  }

  // 3. Scan os.tmpdir() for all dsh-progress-*.md files
  const tmpDir = os.tmpdir();
  try {
    const files = fs.readdirSync(tmpDir);
    for (const f of files) {
      if (f.startsWith('dsh-progress-') && f.endsWith('.md')) {
        const full = path.join(tmpDir, f);
        try {
          const stat = fs.statSync(full);
          if (stat.mtimeMs > bestMtime) {
            const inner = f.slice('dsh-progress-'.length, -3);
            let rawId = inner;
            let fileUuid = '';
            if (inner.length > 37) {
              fileUuid = inner.slice(-36);
              rawId = inner.slice(0, -37);
            }
            bestMtime = stat.mtimeMs;
            bestRecord = {
              sessionId: rawId,
              filePath: full,
              uuid: fileUuid,
              createdAt: stat.birthtimeMs || stat.mtimeMs,
              lastUpdated: stat.mtimeMs
            };
          }
        } catch (e) {}
      }
    }
  } catch (e) {}

  return bestRecord;
}

/**
 * Locate an existing progress record for a sessionId WITHOUT allocating one.
 * Read-only callers (the read tool) must never reserve a new path as a side effect.
 */
function findExistingSessionProgress(sessionId) {
  if (!sessionId) return null;
  const sId = String(sessionId);

  const cached = sessionProgressMap.get(sId);
  if (cached?.filePath && fs.existsSync(cached.filePath)) {
    return cached;
  }

  // Check if a progress file already exists in os.tmpdir() for this session
  const safeId = sanitizeKey(sId);
  const tmpDir = os.tmpdir();
  const prefix = `dsh-progress-${safeId}-`;
  try {
    const matched = fs.readdirSync(tmpDir).filter((f) => f.startsWith(prefix) && f.endsWith('.md'));
    let newest = null;
    let newestMtime = 0;
    for (const f of matched) {
      const full = path.join(tmpDir, f);
      try {
        const stat = fs.statSync(full);
        if (stat.mtimeMs > newestMtime) {
          newestMtime = stat.mtimeMs;
          newest = full;
        }
      } catch (e) {}
    }
    if (newest) {
      const record = {
        sessionId: sId,
        filePath: newest,
        uuid: path.basename(newest).slice(prefix.length, -3),
        createdAt: Date.now(),
        lastUpdated: newestMtime
      };
      sessionProgressMap.set(sId, record);
      return record;
    }
  } catch (e) {}

  return null;
}

/**
 * Locate or allocate a progress file for a given sessionId
 */
function getOrCreateSessionProgress(sessionId) {
  if (!sessionId) sessionId = 'default';
  const sId = String(sessionId);

  const existing = findExistingSessionProgress(sId);
  if (existing) return existing;

  // Allocate a designated file path (DO NOT create on disk until agent writes to it)
  const fileUuid = randomUUID();
  const fileName = `dsh-progress-${sanitizeKey(sId)}-${fileUuid}.md`;
  const filePath = path.join(os.tmpdir(), fileName);

  const record = {
    sessionId: sId,
    filePath,
    uuid: fileUuid,
    createdAt: Date.now(),
    lastUpdated: 0
  };
  sessionProgressMap.set(sId, record);
  return record;
}

/**
 * Parse Markdown content with YAML Frontmatter support to compute completion percentage and checklist summary
 */
export function parseProgress(content) {
  if (!content || typeof content !== 'string') {
    return {
      percent: 0,
      status: 'starting',
      currentActivity: null,
      explicitPercent: null,
      checklistPercent: null,
      tasksTotal: 0,
      tasksDone: 0,
      tasksInProgress: 0,
      tasksPending: 0,
      frontmatter: null
    };
  }

  let explicitPercent = null;
  let status = null;
  let currentActivity = null;
  let frontmatter = null;

  // 1. YAML Frontmatter Extraction (Highest Priority)
  // Format:
  // ---
  // progress: 65%
  // status: in_progress
  // current_activity: "..."
  // ---
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (fmMatch && fmMatch[1]) {
    frontmatter = {};
    const fmLines = fmMatch[1].split('\n');
    for (const rawLine of fmLines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const colonIdx = line.indexOf(':');
      if (colonIdx !== -1) {
        const key = line.slice(0, colonIdx).trim().toLowerCase();
        let val = line.slice(colonIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        frontmatter[key] = val;

        if (key === 'progress' || key === 'percentage' || key === 'percent' || key === 'tien_do') {
          const numMatch = val.match(/(\d{1,3})/);
          if (numMatch) {
            const num = parseInt(numMatch[1], 10);
            if (!isNaN(num) && num >= 0 && num <= 100) {
              explicitPercent = num;
            }
          }
        } else if (key === 'status') {
          status = val;
        } else if (key === 'current_activity' || key === 'activity' || key === 'currentactivity') {
          currentActivity = val;
        }
      }
    }
  }

  // 2. Inline Explicit Declaration Extraction (Secondary)
  if (explicitPercent === null) {
    const explicitMatch = content.match(/(?:\*{1,2}|_)?(?:progress|tiến\s*độ)(?:\*{1,2}|_)?\s*[:=]\s*(\d{1,3})\s*%/i);
    if (explicitMatch && explicitMatch[1]) {
      const val = parseInt(explicitMatch[1], 10);
      if (!isNaN(val) && val >= 0 && val <= 100) {
        explicitPercent = val;
      }
    }
  }

  // 3. Checklist Parsing
  const doneMatches = content.match(/^[\s*>-]*\[[xX]\]\s*(.+)$/gm) || [];
  const inProgressMatches = content.match(/^[\s*>-]*\[[\-\/~]\]\s*(.+)$/gm) || [];
  const pendingMatches = content.match(/^[\s*>-]*\[\s\]\s*(.+)$/gm) || [];

  const tasksDone = doneMatches.length;
  const tasksInProgress = inProgressMatches.length;
  const tasksPending = pendingMatches.length;
  const tasksTotal = tasksDone + tasksInProgress + tasksPending;

  let checklistPercent = null;
  if (tasksTotal > 0) {
    checklistPercent = Math.min(100, Math.max(0, Math.round(((tasksDone + (tasksInProgress * 0.5)) / tasksTotal) * 100)));
  }

  // 4. Overall Resolution
  let percent = 0;
  if (explicitPercent !== null) {
    percent = explicitPercent;
  } else if (checklistPercent !== null) {
    percent = checklistPercent;
  } else if (content.trim().length > 50) {
    if (/(?:all\s+tasks\s+completed|all\s+goals\s+achieved|hoàn\s+thành\s+toàn\s+bộ)/i.test(content) || status === 'completed') {
      percent = 100;
    } else {
      percent = 0;
    }
  }

  if (percent === 100 && !status) {
    status = 'completed';
  } else if (!status) {
    status = percent > 0 ? 'in_progress' : 'starting';
  }

  return {
    percent,
    status,
    currentActivity,
    explicitPercent,
    checklistPercent,
    tasksTotal,
    tasksDone,
    tasksInProgress,
    tasksPending,
    frontmatter
  };
}

// ───────────────────────── Whole-file progress writer tool ─────────────────────────
//
// History: progress files used to be updated with an anchored `edit` whose `old_string` covered only
// the YAML frontmatter while `new_string` carried a complete new document. The anchored edit replaced
// just the frontmatter, so the previous document survived below the new one and the file ended up
// holding TWO concatenated documents. This tool removes that failure mode entirely: it has no anchor,
// it always replaces the whole file, and it refuses to persist a document that already looks doubled.

export const PROGRESS_WRITE_TOOL_NAME = 'session_progress_write';
export const PROGRESS_READ_TOOL_NAME = 'session_progress_read';

/**
 * Inspect a candidate progress document for structural corruption.
 *
 * Language agnostic by design: the canonical sections are localized, so duplication is detected from
 * repeated heading text (and repeated level-1 titles) instead of a fixed section vocabulary.
 *
 * @param {string} content - the complete Markdown document.
 * @returns {{ errors: string[], warnings: string[], h1: string[], sections: string[] }}
 */
export function lintProgressDocument(content) {
  const errors = [];
  const warnings = [];
  const h1 = [];
  const sections = [];
  const sectionCounts = new Map();

  const text = String(content ?? '');
  const lines = text.split(/\r?\n/);
  let lastSectionStart = -1;
  const lineOccurrences = new Map();

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const titleMatch = line.match(/^#\s+(\S.*)$/);
    if (titleMatch) {
      h1.push(titleMatch[1].trim());
      continue;
    }
    const sectionMatch = line.match(/^##\s+(\S.*)$/);
    if (sectionMatch) {
      const raw = sectionMatch[1].replace(/[*_`\s]+$/, '').trim();
      if (!raw) continue;
      sections.push(raw);
      lastSectionStart = index;
      const key = raw.toLowerCase();
      sectionCounts.set(key, (sectionCounts.get(key) || 0) + 1);
      continue;
    }
    // Facts belong once in the file; a repeated sentence is a duplicated fact or a stale copy.
    const trimmed = line.trim();
    if (trimmed.length >= 20 && !trimmed.startsWith('|') && !trimmed.startsWith('- [') && !/^[#>`]/.test(trimmed)) {
      lineOccurrences.set(trimmed, (lineOccurrences.get(trimmed) || 0) + 1);
    }
  }

  if (h1.length > 1) {
    errors.push(
      `the document has ${h1.length} level-1 titles (${h1.map((t) => `"${t}"`).join(', ')}) — that is two documents concatenated into one file. Send exactly ONE document.`
    );
  }

  const repeated = [...sectionCounts.entries()].filter(([, count]) => count > 1);
  if (repeated.length > 0) {
    errors.push(
      `the document repeats section heading(s) ${repeated.map(([name, count]) => `"${name}" ×${count}`).join(', ')} — a duplicated or stale copy of the document is present. Send exactly ONE document containing each section once.`
    );
  }

  // ── brevity budget: the file is a status snapshot, not a report or a log ────────────────────────
  const bytes = Buffer.byteLength(text, 'utf-8');
  const contentLines = lines.filter((line) => line.trim() !== '').length;
  const lastSectionLines = lastSectionStart >= 0 ? lines.slice(lastSectionStart + 1).filter((line) => line.trim() !== '').length : 0;

  if (contentLines > 400 || bytes > 60000) {
    errors.push(
      `the document is ${contentLines} lines / ${bytes} bytes — far past what a status snapshot needs. Compress it to facts (chosen values, thresholds, blockers, one-line results) and write it again.`
    );
  } else if (contentLines > 150 || bytes > 12000) {
    warnings.push(
      `the document is ${contentLines} lines / ${bytes} bytes; the budget is ~150 lines / ~12 KB. Cut the analysis down to the facts a human needs to see the state of the work.`
    );
  }

  if (lastSectionLines > 40) {
    warnings.push(
      `the last section (Key Findings / Notes) holds ${lastSectionLines} lines; its budget is ~40. Replace studies, benchmark tables, per-run logs and method/timing notes with one-line facts.`
    );
  }

  const echoed = [...lineOccurrences.entries()].filter(([, count]) => count > 1);
  if (echoed.length > 0) {
    const examples = echoed.slice(0, 3).map(([line, count]) => `"${line.slice(0, 60)}${line.length > 60 ? '…' : ''}" ×${count}`).join('; ');
    warnings.push(`the same sentence appears more than once (${examples}); state each fact once, in one section.`);
  }

  const hasFrontmatter = /^---\r?\n[\s\S]*?\r?\n---/.test(text);
  const parsed = parseProgress(content);

  if (!hasFrontmatter) {
    warnings.push('no YAML frontmatter block was found at the top of the document; it should carry `progress`, `status`, and `current_activity`.');
  } else {
    const frontmatter = parsed.frontmatter || {};
    if (frontmatter.progress === undefined) warnings.push('frontmatter has no `progress` key.');
    if (!frontmatter.status) warnings.push('frontmatter has no `status` key.');
    if (!frontmatter.current_activity) warnings.push('frontmatter has no `current_activity` key.');
  }

  if (h1.length === 0) warnings.push('no level-1 title was found; the document should start with `# <Goal Title>`.');
  if (sections.length < 5) {
    warnings.push(`only ${sections.length} level-2 section(s) were found; the canonical document carries 5.`);
  }
  if (parsed.explicitPercent !== null && parsed.checklistPercent !== null && Math.abs(parsed.explicitPercent - parsed.checklistPercent) > 25) {
    warnings.push(
      `frontmatter progress (${parsed.explicitPercent}%) is far from the checklist-derived value (${parsed.checklistPercent}%); recheck the numbers or the checkboxes.`
    );
  }

  return { errors, warnings, h1, sections, lines: contentLines, bytes, lastSectionLines };
}

// ───────────────────────── Section-level access (the token-lean path) ─────────────────────────
//
// The progress file is read AND rewritten by the model on nearly every turn, so shipping the whole
// document in and out is the plugin's biggest token cost. Both tools therefore address sections:
// `session_progress_read({ sections })` returns only the requested H2 sections, and
// `session_progress_write({ updates, frontmatter })` patches only the parts that changed. The
// whole-document `content` path stays for creating the file and for rewriting a corrupted document.

/** The frontmatter keys the plugin owns, in the order they are written. */
const CANONICAL_FRONTMATTER_KEYS = ['progress', 'status', 'current_activity'];

/** Accepted spellings of each canonical frontmatter key (old documents and other languages). */
const FRONTMATTER_KEY_ALIASES = {
  progress: ['progress', 'percentage', 'percent', 'tien_do', 'tiendo'],
  status: ['status', 'trang_thai', 'trangthai'],
  current_activity: ['current_activity', 'currentactivity', 'activity', 'hoat_dong', 'hoatdong']
};

/** Localized spellings of the five canonical sections, for tolerant name matching. */
const SECTION_ALIASES = [
  ['overview', ['overview', 'tong quan', 'gioi thieu', 'muc tieu', 'tom tat', 'objective', 'summary']],
  ['checklist', ['checklist', 'check list', 'danh sach cong viec', 'danh sach', 'cong viec', 'viec can lam', 'tasks', 'todo']],
  ['current_activity', ['current activity', 'hoat dong hien tai', 'dang thuc hien', 'dang lam', 'current step', 'hoat dong']],
  ['next_steps', ['next steps', 'buoc tiep theo', 'cac buoc tiep theo', 'ke hoach tiep theo', 'tiep theo', 'plan']],
  ['notes', ['key findings', 'findings', 'phat hien', 'ghi chu', 'ket qua chinh', 'notes', 'note']]
];

/** Section edit modes accepted by `session_progress_write({ updates })`. */
export const SECTION_MODES = ['replace', 'append', 'prepend'];

/** Longest-alias-first index, so "buoc tiep theo" wins over a shorter alias. */
const SECTION_ALIAS_INDEX = SECTION_ALIASES.flatMap(([key, aliases]) => aliases.map((alias) => ({ key, alias }))).sort(
  (a, b) => b.alias.length - a.alias.length
);

/**
 * Normalize a heading (or a key) for tolerant comparison: diacritics and punctuation removed,
 * lowercase, single spaces.
 * @param {string} text - raw heading text.
 * @returns {string} the normalized form.
 */
export function normalizeHeading(text) {
  return String(text ?? '')
    .replace(/[Đđ]/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * The canonical section a normalized heading belongs to, or null when it is not one of the five.
 * @param {string} normalized - output of {@link normalizeHeading}.
 * @returns {string|null} canonical section key.
 */
function canonicalSectionKey(normalized) {
  if (!normalized) return null;
  for (const { key, alias } of SECTION_ALIAS_INDEX) {
    if (normalized === alias || normalized.startsWith(`${alias} `) || normalized.includes(` ${alias}`)) return key;
  }
  return null;
}

/**
 * The canonical frontmatter key a raw key spelling maps to, or null when the plugin does not own it.
 * @param {string} rawKey - key as written in the document.
 * @returns {string|null} canonical key.
 */
function frontmatterKeyOf(rawKey) {
  const normalized = normalizeHeading(rawKey);
  if (!normalized) return null;
  for (const key of CANONICAL_FRONTMATTER_KEYS) {
    if (FRONTMATTER_KEY_ALIASES[key].some((alias) => normalizeHeading(alias) === normalized)) return key;
  }
  return null;
}

/** Drop leading and trailing blank lines without touching the inner formatting. */
function trimBlankLines(lines) {
  const out = [...lines];
  while (out.length > 0 && out[0].trim() === '') out.shift();
  while (out.length > 0 && out[out.length - 1].trim() === '') out.pop();
  return out;
}

/**
 * Split a progress document into frontmatter, H1 title and H2 sections, ignoring headings that sit
 * inside a fenced code block.
 * @param {string} content - the complete document.
 * @returns {{eol: string, lines: string[], frontmatter: {startLine: number, endLine: number}|null, title: string|null, sections: Array<{name: string, startLine: number, endLine: number, body: string}>}}
 */
export function splitProgressDocument(content) {
  const text = String(content ?? '').replace(/^\uFEFF/, '');
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = text.split(/\r?\n/);

  let frontmatter = null;
  if (lines[0]?.trim() === '---') {
    for (let index = 1; index < lines.length; index += 1) {
      if (lines[index].trim() === '---') {
        frontmatter = { startLine: 0, endLine: index };
        break;
      }
    }
  }

  const headings = [];
  let fenceChar = null;
  const from = frontmatter ? frontmatter.endLine + 1 : 0;
  for (let index = from; index < lines.length; index += 1) {
    const line = lines[index];
    const fence = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (fence) {
      const char = fence[1][0];
      if (fenceChar === null) fenceChar = char;
      else if (fenceChar === char) fenceChar = null;
      continue;
    }
    if (fenceChar !== null) continue;

    const level1 = line.match(/^#\s+(\S.*)$/);
    if (level1) {
      headings.push({ level: 1, name: level1[1].trim(), line: index });
      continue;
    }
    const level2 = line.match(/^##\s+(\S.*)$/);
    if (level2) {
      headings.push({ level: 2, name: level2[1].replace(/[*_`\s]+$/, '').trim(), line: index });
    }
  }

  const sections = headings
    .filter((heading) => heading.level === 2)
    .map((heading) => {
      const next = headings.find((candidate) => candidate.line > heading.line);
      const endLine = next ? next.line : lines.length;
      return {
        name: heading.name,
        startLine: heading.line,
        endLine,
        body: lines.slice(heading.line + 1, endLine).join(eol)
      };
    });

  return {
    eol,
    lines,
    frontmatter,
    title: headings.find((heading) => heading.level === 1)?.name ?? null,
    sections
  };
}

/**
 * Resolve one section name from the model against the document's actual headings.
 *
 * Tolerates casing, diacritics, punctuation, partial names, localized names (English ↔ Vietnamese)
 * and 1-based indexes, so a request never has to guess the exact heading text.
 *
 * @param {Array<{name: string}>} sections - sections of the document, in order.
 * @param {string} query - the name the model asked for.
 * @returns {{section: object, score: number, how: string}|null} the best match, or null.
 */
export function matchProgressSection(sections, query) {
  const list = Array.isArray(sections) ? sections : [];
  const raw = String(query ?? '').trim();
  if (!raw) return null;

  const asIndex = raw.match(/^(?:#|section\s*)?(\d{1,2})$/i);
  if (asIndex) {
    const section = list[Number(asIndex[1]) - 1];
    return section ? { section, score: 0.5, how: 'index' } : null;
  }

  const wanted = normalizeHeading(raw);
  const wantedKey = canonicalSectionKey(wanted);
  let best = null;

  for (const section of list) {
    const name = normalizeHeading(section.name);
    let score = 0;
    if (name && name === wanted) score = 1;
    else if (name && wanted && (name.startsWith(`${wanted} `) || wanted.startsWith(`${name} `))) score = 0.9;
    else if (name.length >= 4 && wanted.length >= 4 && wanted && name && (name.includes(wanted) || wanted.includes(name))) score = 0.8;

    if (wantedKey && canonicalSectionKey(name) === wantedKey) score = Math.max(score, 0.95);
    if (score > 0 && (best === null || score > best.score)) {
      best = { section, score, how: score >= 0.9 ? 'name' : 'fuzzy' };
    }
  }

  return best;
}

/**
 * Normalize `frontmatter` from the write tool into canonical keys, rejecting anything the plugin
 * does not own so the document cannot drift away from its three keys.
 * @param {object} patch - raw `frontmatter` argument.
 * @returns {object|null} canonical patch, or null when there is nothing to change.
 */
export function normalizeFrontmatterPatch(patch) {
  if (patch === undefined || patch === null) return null;
  if (typeof patch !== 'object' || Array.isArray(patch)) {
    throw new Error('`frontmatter` must be an object like { progress: 70, status: "in_progress", current_activity: "..." }.');
  }

  const out = {};
  for (const [rawKey, value] of Object.entries(patch)) {
    if (value === undefined || value === null) continue;
    const canonical = frontmatterKeyOf(rawKey);
    if (!canonical) {
      throw new Error(
        `\`frontmatter\` has unsupported key "${rawKey}"; the plugin owns ${CANONICAL_FRONTMATTER_KEYS.join(', ')}.`
      );
    }
    out[canonical] = value;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/** Render one frontmatter line for a canonical key, validating the value. */
function frontmatterValueLine(key, value) {
  if (key === 'progress') {
    const num = typeof value === 'number' ? Math.round(value) : Number.parseInt(String(value).replace(/[^\d]/g, ''), 10);
    if (!Number.isFinite(num) || num < 0 || num > 100) {
      throw new Error(`\`frontmatter.progress\` must be 0-100 (received ${JSON.stringify(value)}).`);
    }
    return `progress: ${num}%`;
  }

  const text = String(value).replace(/\s+/g, ' ').trim();
  if (!text) throw new Error(`\`frontmatter.${key}\` must not be empty.`);
  if (key === 'status') return `status: ${text}`;
  return `${key}: "${text.replace(/"/g, '\\"')}"`;
}

/**
 * Patch `progress` / `status` / `current_activity` in place, leaving every other byte untouched.
 * A document without a frontmatter block gets one created at the top instead of failing.
 * @param {string} content - the complete document.
 * @param {object} patch - raw `frontmatter` argument.
 * @returns {{content: string, changed: string[], warnings: string[]}}
 */
export function patchProgressFrontmatter(content, patch) {
  const normalized = normalizeFrontmatterPatch(patch);
  const text = String(content ?? '').replace(/^\uFEFF/, '');
  const changed = [];
  const warnings = [];
  if (!normalized) return { content: text, changed, warnings };

  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = text.split(/\r?\n/);
  const wanted = CANONICAL_FRONTMATTER_KEYS.filter((key) => normalized[key] !== undefined).map((key) => ({
    key,
    line: frontmatterValueLine(key, normalized[key])
  }));

  let frontmatter = null;
  if (lines[0]?.trim() === '---') {
    for (let index = 1; index < lines.length; index += 1) {
      if (lines[index].trim() === '---') {
        frontmatter = { startLine: 0, endLine: index };
        break;
      }
    }
  }

  if (!frontmatter) {
    warnings.push('the document had no YAML frontmatter block, so one was created at the top of the file.');
    for (const item of wanted) changed.push(item.key);
    const block = ['---', ...wanted.map((item) => item.line), '---', ''];
    return { content: [...block, ...lines].join(eol), changed, warnings };
  }

  const block = lines.slice(frontmatter.startLine + 1, frontmatter.endLine);
  for (const item of wanted) {
    let index = -1;
    for (let cursor = 0; cursor < block.length; cursor += 1) {
      const match = block[cursor].match(/^\s*([A-Za-z_][\w-]*)\s*:/);
      if (match && frontmatterKeyOf(match[1]) === item.key) {
        index = cursor;
        break;
      }
    }
    if (index >= 0) {
      if (block[index] !== item.line) {
        block[index] = item.line;
        changed.push(item.key);
      }
    } else {
      block.push(item.line);
      changed.push(item.key);
    }
  }

  const next = [...lines.slice(0, frontmatter.startLine + 1), ...block, ...lines.slice(frontmatter.endLine)];
  return { content: next.join(eol), changed, warnings };
}

/** Build the replacement body lines of one section for the requested edit mode. */
function renderSectionBody(section, mode, incomingBody) {
  const existing = trimBlankLines(String(section?.body ?? '').split(/\r?\n/));
  const incoming = trimBlankLines(String(incomingBody ?? '').replace(/\r\n/g, '\n').split('\n'));
  const gap = existing.length > 0 && incoming.length > 0 ? [''] : [];

  let body;
  if (mode === 'append') body = [...existing, ...gap, ...incoming];
  else if (mode === 'prepend') body = [...incoming, ...gap, ...existing];
  else body = incoming;

  return body.length > 0 ? [...body, ''] : [''];
}

/**
 * Rewrite only the named H2 sections of a document, leaving frontmatter, title and every untouched
 * section byte-identical.
 *
 * @param {string} content - the complete document.
 * @param {Array<{section: string, content: string, mode?: string}>} updates - requested edits.
 * @returns {{content: string, changed: string[], warnings: string[]}}
 */
export function applyProgressSectionUpdates(content, updates) {
  if (!Array.isArray(updates) || updates.length === 0) {
    throw new Error('`updates` must be a non-empty array of { section, content, mode? }.');
  }

  const text = String(content ?? '').replace(/^\uFEFF/, '');
  const doc = splitProgressDocument(text);
  const eol = doc.eol;
  let lines = doc.lines;
  const changed = [];
  const warnings = [];

  const available = doc.sections.map((section) => `"${section.name}"`).join(', ') || '(none)';
  const jobs = updates.map((update, position) => {
    const name = String(update?.section ?? update?.name ?? '').trim();
    if (!name) {
      throw new Error(`\`updates[${position}]\` needs a \`section\` name; this document has ${available}.`);
    }
    const mode = String(update?.mode ?? 'replace').trim().toLowerCase();
    if (!SECTION_MODES.includes(mode)) {
      throw new Error(
        `\`updates[${position}].mode\` must be one of ${SECTION_MODES.join(' | ')} (received ${JSON.stringify(update?.mode)}).`
      );
    }
    if (typeof update?.content !== 'string') {
      throw new Error(`\`updates[${position}].content\` must be a string holding that section's new body ("" empties it).`);
    }

    const hit = matchProgressSection(doc.sections, name);
    if (!hit) {
      throw new Error(
        `\`updates[${position}].section\` "${name}" was not found in the progress file, so nothing was written. ` +
          `This document has: ${available}. Use one of those names (read the file with session_progress_read if unsure), or send the whole document as \`content\`.`
      );
    }
    return { position, requestedAs: name, mode, body: update.content, section: hit.section };
  });

  const seen = new Map();
  for (const job of jobs) {
    if (seen.has(job.section.startLine)) {
      throw new Error(
        `\`updates\` addresses section "${job.section.name}" twice ("${seen.get(job.section.startLine)}" and "${job.requestedAs}"); merge them into one entry.`
      );
    }
    seen.set(job.section.startLine, job.requestedAs);
  }

  // Bottom-up, so every earlier line index keeps pointing at the same line while we splice.
  const ordered = [...jobs].sort((a, b) => b.section.startLine - a.section.startLine);
  for (const job of ordered) {
    const body = renderSectionBody(job.section, job.mode, job.body);
    lines = [...lines.slice(0, job.section.startLine + 1), ...body, ...lines.slice(job.section.endLine)];
    changed.push(job.section.name);
  }

  return { content: lines.join(eol), changed: changed.reverse(), warnings };
}

/**
 * The checklist is the user's only visible measure of the work, and in practice a model that reports
 * a finished step tends to keep writing prose while the boxes stay behind. Nothing can verify the
 * work itself, so the plugin does what it CAN verify: it compares the checklist of the file before
 * and after every write and, when the boxes did not move while the state did, says so in the write
 * result — the one moment the model is provably looking at this file.
 *
 * @param {object} previousParsed - {@link parseProgress} of the file before the write.
 * @param {object} parsed - {@link parseProgress} of the file after the write.
 * @returns {string} the nudge, or '' when the checklist moved or nothing is left to tick.
 */
export function buildChecklistHint(previousParsed, parsed) {
  if (!parsed || parsed.tasksTotal === 0) return '';
  if (parsed.tasksDone !== (previousParsed?.tasksDone ?? 0)) return '';
  if (parsed.tasksPending + parsed.tasksInProgress === 0) return '';

  const before = previousParsed?.percent ?? 0;
  const boxState = `${parsed.tasksDone}/${parsed.tasksTotal} done · ${parsed.tasksInProgress} running · ${parsed.tasksPending} pending`;
  const fix = 'session_progress_write({ updates: [{ section: "Checklist", content: "..." }] })';

  if (parsed.percent - before >= 5) {
    return `The checklist did not move (${boxState}) while progress went ${before}% → ${parsed.percent}%: the boxes are what the user reads, so tick every step that is really finished — or correct \`progress\` — with ${fix}.`;
  }
  return `The checklist did not move (${boxState}). If a step is finished — including one you finished earlier and left unticked — tick it in this same turn with ${fix}, and keep \`[/]\` on the step running now.`;
}

/**
 * Replace a file atomically: write a sibling temp file, then rename over the target.
 * @param {string} filePath - destination file.
 * @param {string} content - complete replacement content.
 */
function writeFileAtomically(filePath, content) {
  const tempPath = `${filePath}.tmp-${randomUUID()}`;
  try {
    fs.writeFileSync(tempPath, content, 'utf-8');
    fs.renameSync(tempPath, filePath);
  } catch (e) {
    try {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    } catch (cleanupError) {}
    throw e;
  }
}

/**
 * Render the tool result the model reads back after a write.
 * @param {object} value - the structured tool result.
 * @returns {string} a one-paragraph summary.
 */
export function renderProgressWriteResult(value) {
  const partial = value.mode === 'partial';
  const parts = [
    partial
      ? `Progress updated in place (${value.previousBytes} → ${value.bytes} bytes).`
      : `Progress written in full (${value.previousBytes} → ${value.bytes} bytes).`
  ];
  if (partial && Array.isArray(value.sectionsChanged) && value.sectionsChanged.length > 0) {
    parts.push(`Sections: ${value.sectionsChanged.join(', ')}.`);
  }
  if (partial && Array.isArray(value.frontmatterChanged) && value.frontmatterChanged.length > 0) {
    parts.push(`Frontmatter: ${value.frontmatterChanged.join(', ')}.`);
  }
  parts.push(`${value.percent}% · ${value.status}${value.currentActivity ? ` · ${value.currentActivity}` : ''}.`);
  parts.push(`${value.tasksDone}/${value.tasksTotal} checklist item(s) done.`);
  if (value.repaired) {
    parts.push('The previous file was duplicated and is now a single clean document.');
  }
  if (value.checklistHint) {
    parts.push(value.checklistHint);
  }
  if (Array.isArray(value.warnings) && value.warnings.length > 0) {
    parts.push(value.warnings.join(' '));
  }
  return parts.join(' ');
}

/**
 * Build the `session_progress_write` tool definition.
 *
 * Registered as a plain registry definition (raw JSON Schema), matching how first-party plugins that
 * cannot import `@deepseek-ai/dsh-tools` register tools, so this plugin keeps zero runtime deps.
 *
 * @returns {object} a registry-ready tool definition.
 */
export function buildProgressWriteTool() {
  return {
    name: PROGRESS_WRITE_TOOL_NAME,
    description:
      'Create or update the session progress file. Send EITHER `updates` [{ section, content, mode? }] plus optional `frontmatter` { progress, status, current_activity } to patch only those parts — the ordinary per-turn path — OR `content` to replace the whole document (creating the file, or repairing one reported `corrupted`). ' +
      '`mode`: replace (default) | append | prepend. Section names match loosely (case, accents, partial/localized names, 1-based index); an unknown name is refused with the names that do exist. ' +
      'Each section `content` is its body WITHOUT the `## heading` line. The assembled result is linted as one document, so nothing is written when it would repeat a title or an H2 heading.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        updates: {
          type: 'array',
          description:
            'Partial edit: one entry per section to change. Never combine with `content`.',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['section', 'content'],
            properties: {
              section: { type: 'string', description: 'Section to change: its heading (e.g. "Checklist"), a localized form, or a 1-based index.' },
              content: { type: 'string', description: 'The new body of that section, WITHOUT its `## heading` line. Empty string empties the section.' },
              mode: { type: 'string', enum: SECTION_MODES, description: 'replace (default) · append · prepend.' }
            }
          }
        },
        frontmatter: {
          type: 'object',
          additionalProperties: false,
          description: 'Partial edit: frontmatter keys to set. Never combine with `content`.',
          properties: {
            progress: { type: 'integer', description: 'Total progress 0-100, e.g. 65 (stored as `progress: 65%`).' },
            status: { type: 'string', description: 'starting | in_progress | blocked | completed.' },
            current_activity: { type: 'string', description: 'One line describing the step running now.' }
          }
        },
        content: {
          type: 'string',
          description: 'The complete progress document (YAML frontmatter + the five sections). Fully replaces the file. Never combine with `updates`/`frontmatter`.'
        }
      }
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          bytes: { type: 'integer' },
          previousBytes: { type: 'integer' },
          replaced: { type: 'boolean' },
          repaired: { type: 'boolean' },
          mode: { type: 'string' },
          sectionsChanged: { type: 'array', items: { type: 'string' } },
          frontmatterChanged: { type: 'array', items: { type: 'string' } },
          percent: { type: 'integer' },
          status: { type: 'string' },
          currentActivity: { type: 'string' },
          checklistHint: { type: 'string' },
          tasksTotal: { type: 'integer' },
          tasksDone: { type: 'integer' },
          warnings: { type: 'array', items: { type: 'string' } }
        }
      },
      render: (_args, value) => [{ type: 'text', text: renderProgressWriteResult(value) }]
    },
    presentCall: (args) => {
      const partial = Array.isArray(args?.updates) || (args?.frontmatter && typeof args.frontmatter === 'object');
      const summary = partial
        ? [
            ...(Array.isArray(args?.updates)
              ? args.updates.map((update) => `${update?.section ?? '?'} (${update?.mode ?? 'replace'})`)
              : []),
            ...(args?.frontmatter && typeof args.frontmatter === 'object' ? [`frontmatter: ${Object.keys(args.frontmatter).join(', ')}`] : [])
          ].join(' · ')
        : '';
      return {
        card: 'generic',
        title: partial ? 'Update session progress' : 'Write session progress',
        kind: 'other',
        rawInput: partial ? summary : typeof args?.content === 'string' ? args.content : ''
      };
    },
    execute(args, exec) {
      const content = typeof args?.content === 'string' ? args.content : '';
      const updates = args?.updates;
      const frontmatterPatch = normalizeFrontmatterPatch(args?.frontmatter);

      if (updates !== undefined && updates !== null && (!Array.isArray(updates) || updates.length === 0)) {
        throw new Error(
          `${PROGRESS_WRITE_TOOL_NAME}: \`updates\` must be a non-empty array of { section, content, mode? }. Nothing was written.`
        );
      }

      const wantsFull = content.trim() !== '';
      const wantsPartial = Array.isArray(updates) || frontmatterPatch !== null;

      if (wantsFull && wantsPartial) {
        throw new Error(
          `${PROGRESS_WRITE_TOOL_NAME} takes EITHER \`content\` (the whole document) OR \`updates\`/\`frontmatter\` (a partial edit), never both. Nothing was written.`
        );
      }
      if (!wantsFull && !wantsPartial) {
        throw new Error(
          `${PROGRESS_WRITE_TOOL_NAME} requires either \`content\` (the complete document) or a partial edit \`updates\`/\`frontmatter\`.`
        );
      }

      const session = exec?.agent?.session;
      const sessionId = session?.header?.id || session?.id || latestActiveSessionId;
      if (!sessionId || sessionId === 'default') {
        throw new Error(`${PROGRESS_WRITE_TOOL_NAME} requires an owning agent session.`);
      }

      const record = getOrCreateSessionProgress(sessionId);
      if (!record?.filePath) {
        throw new Error(`${PROGRESS_WRITE_TOOL_NAME} could not resolve a progress file path for session ${sessionId}.`);
      }

      let previous = '';
      try {
        if (fs.existsSync(record.filePath)) previous = fs.readFileSync(record.filePath, 'utf-8');
      } catch (e) {
        previous = '';
      }
      const previousWasCorrupted = previous.trim() !== '' && lintProgressDocument(previous).errors.length > 0;

      if (!wantsFull && previous.trim() === '') {
        throw new Error(
          `${PROGRESS_WRITE_TOOL_NAME} has no progress file to patch for this session: send \`content\` with the complete document to create it.`
        );
      }
      if (!wantsFull && previousWasCorrupted) {
        throw new Error(
          `${PROGRESS_WRITE_TOOL_NAME} refuses to patch a corrupted file (it repeats a title or a section heading). Rewrite the whole document as ONE \`content\` value — keeping the single most complete version — and call the tool again.`
        );
      }

      const sectionsChanged = [];
      const frontmatterChanged = [];
      const patchWarnings = [];
      let next = wantsFull ? content : previous;

      if (!wantsFull) {
        try {
          if (frontmatterPatch) {
            const patched = patchProgressFrontmatter(next, frontmatterPatch);
            next = patched.content;
            frontmatterChanged.push(...patched.changed);
            patchWarnings.push(...patched.warnings);
          }
          if (Array.isArray(updates) && updates.length > 0) {
            const patched = applyProgressSectionUpdates(next, updates);
            next = patched.content;
            sectionsChanged.push(...patched.changed);
            patchWarnings.push(...patched.warnings);
          }
        } catch (e) {
          throw new Error(`${PROGRESS_WRITE_TOOL_NAME} rejected this edit, so nothing was written:\n- ${e?.message || e}`);
        }
        if (sectionsChanged.length === 0 && frontmatterChanged.length === 0) {
          patchWarnings.push('the edit changed nothing (the values you sent are already in the file).');
        }
      }

      const lint = lintProgressDocument(next);
      if (lint.errors.length > 0) {
        throw new Error(
          `${PROGRESS_WRITE_TOOL_NAME} rejected this document, so nothing was written:\n- ${lint.errors.join('\n- ')}\nRewrite it as ONE complete document (or fix the section names/values) and call the tool again.`
        );
      }

      writeFileAtomically(record.filePath, next);
      record.lastUpdated = Date.now();

      const parsed = parseProgress(next);
      const previousParsed = parseProgress(previous);
      // The nudge only exists once a document was already there: creating a file from scratch is not
      // a missed tick, and an emptied file has nothing to compare against.
      const checklistHint = previous.trim() === '' ? '' : buildChecklistHint(previousParsed, parsed);
      const warnings = [...patchWarnings, ...lint.warnings];
      if (isSessionDisabled(sessionId)) {
        warnings.push('progress tracking is currently switched OFF for this session, so the UI will not surface this update.');
      }

      return {
        bytes: Buffer.byteLength(next, 'utf-8'),
        previousBytes: Buffer.byteLength(previous, 'utf-8'),
        replaced: previous.length > 0,
        repaired: previousWasCorrupted,
        mode: wantsFull ? 'full' : 'partial',
        sectionsChanged,
        frontmatterChanged,
        percent: parsed.percent,
        status: parsed.status,
        ...(parsed.currentActivity ? { currentActivity: parsed.currentActivity } : {}),
        checklistHint,
        tasksTotal: parsed.tasksTotal,
        tasksDone: parsed.tasksDone,
        warnings
      };
    }
  };
}

/**
 * Render the read-tool result: the file VERBATIM, plus an actionable trailer when the plugin has
 * something the raw document cannot say by itself (corruption, tracking switched off).
 * @param {object} value - the structured read result.
 * @returns {string} the text the model receives.
 */
export function renderProgressReadResult(value) {
  if (!value.exists) {
    return 'No progress file yet for this session. Create it with session_progress_write, sending the complete document.';
  }
  const notes = [];
  if (value.corrupted) {
    notes.push(
      'CORRUPTED: this file repeats a title or a section heading — keep the most complete document and rewrite it now with session_progress_write.'
    );
  }
  if (Array.isArray(value.missing) && value.missing.length > 0) {
    notes.push(
      `section(s) not found: ${value.missing.join(', ')}. This document has: ${value.available?.join(', ') || '(none)'}.`
    );
  }
  if (Array.isArray(value.warnings)) {
    for (const warning of value.warnings) notes.push(warning);
  }
  const trailer = notes.length > 0 ? `\n\n---\n[plugin] ${notes.join(' ')}` : '';

  if (value.mode === 'full') {
    return `${value.content}${trailer}`;
  }

  const parts = [
    value.title ? `Goal: ${value.title}` : null,
    `Progress: ${value.percent}% · ${value.status}${value.currentActivity ? ` · ${value.currentActivity}` : ''}`,
    `Checklist: ${value.tasksDone}/${value.tasksTotal} done · ${value.tasksInProgress} running · ${value.tasksPending} pending`,
    `Read ${value.sections.length} of ${value.available?.length ?? 0} section(s): ${value.sections.map((section) => section.name).join(', ') || '(none)'}`
  ].filter(Boolean);
  if (value.frontmatter) parts.push('', '```yaml', value.frontmatter, '```');
  for (const section of value.sections) parts.push('', `## ${section.name}`, section.content);
  return `${parts.join('\n')}${trailer}`;
}

/**
 * Build the `session_progress_read` tool definition: the ONLY supported way to see the file.
 *
 * The progress file's path is deliberately never exposed (neither in the prompt nor in any tool
 * result), so the model cannot address it with a generic `read`/`write`/`edit` — an anchored edit
 * whose anchor covered only the YAML frontmatter is what once produced duplicated documents.
 *
 * @returns {object} a registry-ready tool definition.
 */
export function buildProgressReadTool() {
  return {
    name: PROGRESS_READ_TOOL_NAME,
    description:
      'Read the session progress file. Pass `sections` to get ONLY those H2 sections back (parsed state + frontmatter always come along) — the cheap path when you are about to touch one or two sections; omit it for the whole document. ' +
      'Section names match loosely (case, accents, partial/localized names, 1-based index); unmatched names come back in `missing`. ' +
      'This is the only supported way to see the document — never look for its path with generic file tools.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        sections: {
          type: 'array',
          items: { type: 'string' },
          description:
            'H2 sections to return, e.g. ["Checklist", "Next Steps"]. Omit (or pass ["all"]) to read the whole document.'
        }
      }
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          exists: { type: 'boolean' },
          mode: { type: 'string' },
          title: { type: 'string' },
          percent: { type: 'integer' },
          status: { type: 'string' },
          currentActivity: { type: 'string' },
          tasksTotal: { type: 'integer' },
          tasksDone: { type: 'integer' },
          tasksInProgress: { type: 'integer' },
          tasksPending: { type: 'integer' },
          corrupted: { type: 'boolean' },
          warnings: { type: 'array', items: { type: 'string' } },
          frontmatter: { type: 'string' },
          available: { type: 'array', items: { type: 'string' } },
          missing: { type: 'array', items: { type: 'string' } },
          sections: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: { name: { type: 'string' }, content: { type: 'string' } }
            }
          },
          content: { type: 'string' }
        }
      },
      render: (_args, value) => [{ type: 'text', text: renderProgressReadResult(value) }]
    },
    presentCall: (args) => {
      const sections = Array.isArray(args?.sections) ? args.sections.filter((entry) => typeof entry === 'string') : [];
      return {
        card: 'generic',
        title: sections.length > 0 ? `Read session progress: ${sections.join(', ')}` : 'Read session progress',
        kind: 'other',
        rawInput: sections.join(', ')
      };
    },
    execute(args, exec) {
      const requested = (Array.isArray(args?.sections) ? args.sections : [])
        .map((entry) => String(entry ?? '').trim())
        .filter((entry) => entry !== '');
      const wantsFull =
        requested.length === 0 || requested.some((entry) => ['all', 'full', 'everything', '*'].includes(normalizeHeading(entry)) || entry === '*');

      const session = exec?.agent?.session;
      const sessionId = session?.header?.id || session?.id || latestActiveSessionId;
      if (!sessionId || sessionId === 'default') {
        throw new Error(`${PROGRESS_READ_TOOL_NAME} requires an owning agent session.`);
      }

      const empty = {
        exists: false,
        mode: wantsFull ? 'full' : 'sections',
        title: '',
        percent: 0,
        status: 'starting',
        tasksTotal: 0,
        tasksDone: 0,
        tasksInProgress: 0,
        tasksPending: 0,
        corrupted: false,
        warnings: [],
        frontmatter: '',
        available: [],
        missing: [],
        sections: [],
        content: ''
      };

      const record = findExistingSessionProgress(sessionId);
      if (!record?.filePath) return empty;

      const content = fs.readFileSync(record.filePath, 'utf-8');
      const parsed = parseProgress(content);
      const lint = lintProgressDocument(content);
      const warnings = [...lint.warnings];
      if (isSessionDisabled(sessionId)) {
        warnings.push('progress tracking is currently switched OFF for this session, so the UI does not surface this file.');
      }

      const doc = splitProgressDocument(content);
      const frontmatter = doc.frontmatter
        ? doc.lines
            .slice(doc.frontmatter.startLine + 1, doc.frontmatter.endLine)
            .join('\n')
            .trim()
        : '';
      const available = doc.sections.map((section) => section.name);

      const base = {
        exists: true,
        mode: wantsFull ? 'full' : 'sections',
        title: doc.title ?? '',
        percent: parsed.percent,
        status: parsed.status,
        ...(parsed.currentActivity ? { currentActivity: parsed.currentActivity } : {}),
        tasksTotal: parsed.tasksTotal,
        tasksDone: parsed.tasksDone,
        tasksInProgress: parsed.tasksInProgress,
        tasksPending: parsed.tasksPending,
        corrupted: lint.errors.length > 0,
        warnings,
        frontmatter,
        available
      };

      if (wantsFull) {
        return { ...base, missing: [], sections: [], content };
      }

      const missing = [];
      const picked = [];
      for (const name of requested) {
        const hit = matchProgressSection(doc.sections, name);
        if (!hit) {
          missing.push(name);
          continue;
        }
        if (!picked.some((entry) => entry.section.startLine === hit.section.startLine)) {
          picked.push({ section: hit.section });
        }
      }

      return {
        ...base,
        missing,
        sections: picked
          .sort((a, b) => a.section.startLine - b.section.startLine)
          .map((entry) => ({
            name: entry.section.name,
            content: trimBlankLines(entry.section.body.split(/\r?\n/)).join('\n')
          })),
        content: ''
      };
    }
  };
}

/**
 * Open file in the operating system's default editor/viewer
 */
function openInDefaultApp(targetPath) {
  if (!fs.existsSync(targetPath)) return false;

  const platform = process.platform;
  if (platform === 'win32') {
    execFile('cmd', ['/c', 'start', '', targetPath], (err) => {
      if (err) console.error('[dsh-session-progress] Failed to open file on Windows:', err);
    });
  } else if (platform === 'darwin') {
    execFile('open', [targetPath], (err) => {
      if (err) console.error('[dsh-session-progress] Failed to open file on macOS:', err);
    });
  } else {
    execFile('xdg-open', [targetPath], (err) => {
      if (err) console.error('[dsh-session-progress] Failed to open file on Linux:', err);
    });
  }
  return true;
}

/**
 * The injected system-prompt section.
 *
 * Kept deliberately terse: it is re-sent on every request, so every sentence has to earn its tokens.
 * The file is reachable ONLY through the plugin's tools, and its path is never named (a partial
 * anchored edit on that path once produced files holding two concatenated documents).
 */
const PROGRESS_PROMPT_SECTION = `# SESSION PROGRESS
Keep the session progress file current through this plugin's tools ONLY: \`session_progress_read\` and \`session_progress_write\`. Never use read/write/edit/shell on it, and never look for its path.

1. READ THE LEAST YOU NEED — \`session_progress_read({ sections: ["Checklist", "Next Steps"] })\` returns only those H2 sections (frontmatter + parsed state always come along). Omit \`sections\` only when you truly need the whole document. Section names are matched loosely (case, accents, partial or localized names, 1-based index).
2. WRITE ONCE PER TURN — prefer the partial edit \`session_progress_write({ updates: [{ section, content, mode }], frontmatter: { progress, status, current_activity } })\`; \`mode\`: replace (default) · append · prepend. Use the whole-document \`content\` ONLY to create the file or to rewrite one reported \`corrupted\`/over budget. Never send both. Each section's \`content\` is its body WITHOUT the \`## heading\` line; an unknown section name is refused.
3. THE CHECKLIST IS A LIVE LEDGER — it is how the user measures the work, so it must be TRUE at the end of every turn, not at the end of the task. The moment a step is verifiably finished, tick it to \`- [x]\` in that SAME write (never "next turn"); keep \`- [/]\` on the step running right now and \`- [ ]\` on the rest; never tick a step that is not done, and never untick one that is. Before you end a turn that moved the work, look at the boxes again: if work moved and the boxes did not, a write is owed — the write result tells you when this happened, so act on it instead of ignoring it.
4. FRONTMATTER FIRST, keys in English: \`progress\` 0-100 · \`status\` starting|in_progress|blocked|completed · \`current_activity\` (one line). \`progress\` tracks the checklist: do not raise it while the boxes say otherwise.
5. BODY = exactly these 5 H2 sections, in this order, in the conversation's language, nothing else: Overview · Checklist · Current Activity · Next Steps · Key Findings / Notes. \`Checklist\` holds ONLY the user's actual work — never the tracking itself: no "read/update the progress file", "write progress", "sync tracking", "start tracking" or any other item about this document, and no meta-steps describing the tracking ritual.
6. FIRST TOOL CALL of every user turn is a progress action — a partial write, or a read first when you must check the current content — but that action is BOOKKEEPING, not work: never list it in \`Checklist\`, \`Current Activity\` or \`Next Steps\`. \`session_progress_read\` reports \`corrupted: true\` when the file repeats a title or section: then rewrite the whole document.
7. NEW OBJECTIVE while the tracked one is finished → write a brand-new document for the new task only (new title, \`progress: 0-5%\`, new checklist); never keep or append the old one. Same objective → update in place (tick items, adjust \`progress\` and \`current_activity\`).
8. FACTS, NOT PROSE — budget ~150 lines / ~12 KB, last section ~40 lines: \`key = value\` for settings, one table for repeating tuples, one statement per fact, no studies, logs, timings, machine specs or tool inventories; delete superseded text on every write. Over budget → the tool warns or refuses.
9. Trust the write result (bytes, percent, counts, warnings) instead of re-reading the file.

TEMPLATE
---
progress: 65%
status: in_progress
current_activity: "..."
---

# <Goal Title>

## Overview
<objective + current status>

## Checklist
- [x] ...
- [/] ...
- [ ] ...

## Current Activity
<step running now>

## Next Steps
<planned actions>

## Key Findings / Notes
<decisions, chosen values, blockers — facts only>
`;

export function apply(ctx, config = {}) {
  ctx.logger?.info?.('dsh-session-progress plugin loading...');
  disableTodoTool = config?.disableTodoTool !== false;
  // 1. Inject System Prompt instructions
  ctx.inject(['systemPrompt'], (promptCtx) => {
    try {
      promptCtx.systemPrompt.section({
        name: 'session:progress',
        order: promptCtx.systemPrompt.getSectionOrder?.('PLAN_POLICY') ?? 500,
        text: (context) => {
          const agent = context?.agent || context?.scope;
          const session = agent?.session;
          const sessionId = session?.header?.id || session?.id || 'default';
          if (sessionId && sessionId !== 'default') {
            latestActiveSessionId = sessionId;
          }
          if (isSessionDisabled(sessionId)) {
            return '';
          }
          return PROGRESS_PROMPT_SECTION;
        }
      });
      ctx.logger?.info?.('dsh-session-progress registered systemPrompt section "session:progress"');
    } catch (e) {
      ctx.logger?.warn?.(`[dsh-session-progress] Failed to register systemPrompt section: ${e?.message || e}`);
    }
  });

  // 2. Register the progress tools (the ONLY supported way to read/replace the file)
  ctx.inject(['tools'], (toolCtx) => {
    try {
      toolCtx.tools.register(buildProgressReadTool());
      toolCtx.tools.register(buildProgressWriteTool());
      ctx.logger?.info?.(
        `dsh-session-progress registered tools "${PROGRESS_READ_TOOL_NAME}" and "${PROGRESS_WRITE_TOOL_NAME}"`
      );
    } catch (e) {
      ctx.logger?.warn?.(`[dsh-session-progress] Failed to register progress tools: ${e?.message || e}`);
    }
  });

  // 3. Keep the todo tool out of every session this plugin tracks. `agents` is provided by
  // @deepseek-ai/dsh-agent; injecting it here (instead of at module scope) keeps the rest of the
  // plugin working on a deployment that ships without it.
  ctx.inject(['agents'], (agentCtx) => {
    try {
      agentCtx.on('agent/created', ({ agent }) => syncTodoToolPolicy(ctx, agent));
      agentCtx.on('agent/disposed', ({ agent }) => forgetTodoToolPolicy(agent));
      // Agents that were already live when this plugin applied (plugin reload mid-session).
      for (const agent of agentCtx.agents.list?.() ?? []) syncTodoToolPolicy(ctx, agent);
      ctx.logger?.info?.(
        `[dsh-session-progress] todo tool policy active (deny "${TODO_TOOL_NAME}" while tracking)`
      );
    } catch (e) {
      ctx.logger?.warn?.(`[dsh-session-progress] Failed to attach todo tool policy: ${e?.message || e}`);
    }
  });

  // Handler for reading content
  const handleContent = async (req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      return res.end();
    }

    let reqUrl;
    try {
      reqUrl = new URL(req.url ?? '/', 'http://127.0.0.1');
    } catch (e) {
      reqUrl = { searchParams: new URLSearchParams() };
    }

    const qSessionId = reqUrl.searchParams.get('sessionId');
    const qFilePath = reqUrl.searchParams.get('filePath');

    let targetPath = qFilePath;
    let effectiveSessionId = qSessionId || 'default';
    let record = null;

    if (targetPath && fs.existsSync(targetPath)) {
      effectiveSessionId = qSessionId || 'default';
    } else if (qSessionId && qSessionId !== 'default' && qSessionId !== 'undefined' && qSessionId !== 'null') {
      record = sessionProgressMap.get(qSessionId);
      if (!record || !fs.existsSync(record.filePath)) {
        record = getOrCreateSessionProgress(qSessionId);
      }
      if (record?.filePath && fs.existsSync(record.filePath)) {
        targetPath = record.filePath;
        effectiveSessionId = qSessionId;
      }
    }

    if (targetPath && fs.existsSync(targetPath)) {
      try {
        const content = fs.readFileSync(targetPath, 'utf-8');
        const stat = fs.statSync(targetPath);
        const parsed = parseProgress(content);

        return res.end(JSON.stringify({
          success: true,
          found: true,
          hasFile: true,
          enabled: !isSessionDisabled(effectiveSessionId),
          sessionId: effectiveSessionId,
          filePath: targetPath,
          fileName: path.basename(targetPath),
          percent: parsed.percent,
          status: parsed.status,
          currentActivity: parsed.currentActivity,
          explicitPercent: parsed.explicitPercent,
          checklistPercent: parsed.checklistPercent,
          tasksTotal: parsed.tasksTotal,
          tasksDone: parsed.tasksDone,
          tasksInProgress: parsed.tasksInProgress,
          tasksPending: parsed.tasksPending,
          frontmatter: parsed.frontmatter,
          content,
          lastModified: stat.mtimeMs
        }));
      } catch (err) {
        return res.end(JSON.stringify({
          success: false,
          found: false,
          hasFile: false,
          enabled: !isSessionDisabled(effectiveSessionId || qSessionId),
          error: `Failed to read progress file: ${err?.message || err}`,
          sessionId: qSessionId,
          filePath: targetPath,
          percent: 0,
          content: ''
        }));
      }
    }

    return res.end(JSON.stringify({
      success: true,
      found: false,
      hasFile: false,
      enabled: !isSessionDisabled(effectiveSessionId),
      sessionId: effectiveSessionId,
      filePath: null,
      percent: 0,
      tasksTotal: 0,
      tasksDone: 0,
      tasksPending: 0,
      content: '',
      message: 'No progress file found for session'
    }));
  };

  // Handler for checking or toggling session progress enabled state
  const handleToggle = async (req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      return res.end();
    }

    if (req.method === 'GET') {
      let reqUrl;
      try {
        reqUrl = new URL(req.url ?? '/', 'http://127.0.0.1');
      } catch (e) {
        reqUrl = { searchParams: new URLSearchParams() };
      }
      const qSessionId = reqUrl.searchParams.get('sessionId') || 'default';
      const enabled = !isSessionDisabled(qSessionId);
      return res.end(JSON.stringify({ success: true, sessionId: qSessionId, enabled }));
    }

    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      let params = {};
      try { params = JSON.parse(body || '{}'); } catch (e) {}
      const qSessionId = params.sessionId || 'default';
      let targetEnabled = params.enabled;
      if (typeof targetEnabled !== 'boolean') {
        targetEnabled = !isSessionDisabled(qSessionId); // toggle
      }
      setSessionEnabled(qSessionId, targetEnabled);
      const isNowEnabled = !isSessionDisabled(qSessionId);
      // Move the todo tool with the switch: on ⇒ denied for that session's agent, off ⇒ restored.
      // The `default` scope re-evaluates every live session, since it is what sessions without their
      // own override inherit.
      syncTodoToolPolicyForToggle(ctx, ctx.agents, qSessionId);
      const scope = qSessionId === DEFAULT_SCOPE ? 'default (new sessions)' : `session ${qSessionId}`;
      ctx.logger?.info?.(`[dsh-session-progress] ${scope} progress enabled set to ${isNowEnabled}`);
      return res.end(JSON.stringify({
        success: true,
        sessionId: qSessionId,
        enabled: isNowEnabled
      }));
    });
  };

  // Handler for opening file in OS editor
  const handleOpen = async (req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      return res.end();
    }

    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      let params = {};
      try {
        params = JSON.parse(body || '{}');
      } catch (e) {}

      const qSessionId = params.sessionId;
      let targetPath = params.filePath;

      if (!targetPath && qSessionId) {
        const record = sessionProgressMap.get(qSessionId);
        targetPath = record?.filePath;
      }

      if (targetPath && fs.existsSync(targetPath)) {
        openInDefaultApp(targetPath);
        return res.end(JSON.stringify({
          success: true,
          filePath: targetPath
        }));
      }

      return res.end(JSON.stringify({
        success: false,
        error: 'File path not found or does not exist on disk'
      }));
    });
  };

  // 2. HTTP Endpoints (Primary & Compatibility aliases)
  ctx.webServer.register({ kind: 'exact', path: '/api/session-progress/content', handler: handleContent });
  ctx.webServer.register({ kind: 'exact', path: '/api/session-progress/toggle', handler: handleToggle });
  ctx.webServer.register({ kind: 'exact', path: '/api/session-progress/open', handler: handleOpen });

  // Backward compatibility alias routes
  ctx.webServer.register({ kind: 'exact', path: '/api/task-progress/content', handler: handleContent });
  ctx.webServer.register({ kind: 'exact', path: '/api/task-progress/toggle', handler: handleToggle });
  ctx.webServer.register({ kind: 'exact', path: '/api/task-progress/open', handler: handleOpen });

  ctx.logger?.info?.('dsh-session-progress endpoints /api/session-progress/content, /toggle, and /open ready');
}
