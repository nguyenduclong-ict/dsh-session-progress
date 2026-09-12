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
  const parts = [
    `Progress written in full (${value.bytes} bytes).`,
    `${value.percent}% · ${value.status}${value.currentActivity ? ` · ${value.currentActivity}` : ''}.`,
    `${value.tasksDone}/${value.tasksTotal} checklist item(s) done.`
  ];
  if (value.repaired) {
    parts.push('The previous file was duplicated and is now a single clean document.');
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
      'Replace the ENTIRE session progress file with `content` (frontmatter + the five sections). Whole-document replacement only: no anchor, no partial edit, no append, so nothing stale survives underneath. ' +
      'Refused when the document repeats a title or a section heading, or when it is far over the brevity budget. Call `session_progress_read` first when you need the current document.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['content'],
      properties: {
        content: {
          type: 'string',
          description: 'The complete progress document (YAML frontmatter + the five sections). Fully replaces the file.'
        }
      }
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          bytes: { type: 'integer' },
          replaced: { type: 'boolean' },
          repaired: { type: 'boolean' },
          percent: { type: 'integer' },
          status: { type: 'string' },
          currentActivity: { type: 'string' },
          tasksTotal: { type: 'integer' },
          tasksDone: { type: 'integer' },
          warnings: { type: 'array', items: { type: 'string' } }
        }
      },
      render: (_args, value) => [{ type: 'text', text: renderProgressWriteResult(value) }]
    },
    presentCall: (args) => ({
      card: 'generic',
      title: 'Write session progress',
      kind: 'other',
      rawInput: typeof args?.content === 'string' ? args.content : ''
    }),
    execute(args, exec) {
      const content = typeof args?.content === 'string' ? args.content : '';
      if (!content.trim()) {
        throw new Error(`${PROGRESS_WRITE_TOOL_NAME} requires a non-empty \`content\` string holding the complete document.`);
      }

      const session = exec?.agent?.session;
      const sessionId = session?.header?.id || session?.id || latestActiveSessionId;
      if (!sessionId || sessionId === 'default') {
        throw new Error(`${PROGRESS_WRITE_TOOL_NAME} requires an owning agent session.`);
      }

      const lint = lintProgressDocument(content);
      if (lint.errors.length > 0) {
        throw new Error(
          `${PROGRESS_WRITE_TOOL_NAME} rejected this document, so nothing was written:\n- ${lint.errors.join('\n- ')}\nRewrite the file as ONE complete document and call the tool again.`
        );
      }

      const record = getOrCreateSessionProgress(sessionId);
      let previous = '';
      let previousWasCorrupted = false;
      try {
        if (record?.filePath && fs.existsSync(record.filePath)) {
          previous = fs.readFileSync(record.filePath, 'utf-8');
          previousWasCorrupted = lintProgressDocument(previous).errors.length > 0;
        }
      } catch (e) {
        previous = '';
      }

      if (!record?.filePath) {
        throw new Error(`${PROGRESS_WRITE_TOOL_NAME} could not resolve a progress file path for session ${sessionId}.`);
      }

      writeFileAtomically(record.filePath, content);
      record.lastUpdated = Date.now();

      const parsed = parseProgress(content);
      const warnings = [...lint.warnings];
      if (isSessionDisabled(sessionId)) {
        warnings.push('progress tracking is currently switched OFF for this session, so the UI will not surface this update.');
      }

      return {
        bytes: Buffer.byteLength(content, 'utf-8'),
        replaced: previous.length > 0,
        repaired: previousWasCorrupted,
        percent: parsed.percent,
        status: parsed.status,
        ...(parsed.currentActivity ? { currentActivity: parsed.currentActivity } : {}),
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
  if (Array.isArray(value.warnings)) {
    for (const warning of value.warnings) notes.push(warning);
  }
  const trailer = notes.length > 0 ? `\n\n---\n[plugin] ${notes.join(' ')}` : '';
  return `${value.content}${trailer}`;
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
      'Read the session progress file verbatim (frontmatter + the five sections) together with its parsed state: percent, status, checklist counts, warnings and a `corrupted` flag. ' +
      'This is the only supported way to see the document — never look for its path with generic file tools. Read before deciding whether a request continues the tracked objective or starts a new one.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {}
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          exists: { type: 'boolean' },
          percent: { type: 'integer' },
          status: { type: 'string' },
          tasksTotal: { type: 'integer' },
          tasksDone: { type: 'integer' },
          corrupted: { type: 'boolean' },
          warnings: { type: 'array', items: { type: 'string' } },
          content: { type: 'string' }
        }
      },
      render: (_args, value) => [{ type: 'text', text: renderProgressReadResult(value) }]
    },
    presentCall: () => ({
      card: 'generic',
      title: 'Read session progress',
      kind: 'other',
      rawInput: ''
    }),
    execute(_args, exec) {
      const session = exec?.agent?.session;
      const sessionId = session?.header?.id || session?.id || latestActiveSessionId;
      if (!sessionId || sessionId === 'default') {
        throw new Error(`${PROGRESS_READ_TOOL_NAME} requires an owning agent session.`);
      }

      const record = findExistingSessionProgress(sessionId);
      if (!record?.filePath) {
        return {
          exists: false,
          percent: 0,
          status: 'starting',
          tasksTotal: 0,
          tasksDone: 0,
          corrupted: false,
          warnings: [],
          content: ''
        };
      }

      const content = fs.readFileSync(record.filePath, 'utf-8');
      const parsed = parseProgress(content);
      const lint = lintProgressDocument(content);
      const warnings = [...lint.warnings];
      if (isSessionDisabled(sessionId)) {
        warnings.push('progress tracking is currently switched OFF for this session, so the UI does not surface this file.');
      }

      return {
        exists: true,
        percent: parsed.percent,
        status: parsed.status,
        tasksTotal: parsed.tasksTotal,
        tasksDone: parsed.tasksDone,
        corrupted: lint.errors.length > 0,
        warnings,
        content
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
Keep the session progress file current through this plugin's tools ONLY: \`session_progress_read\` (verbatim content + parsed state) and \`session_progress_write\` (replaces the whole document). Never use read/write/edit/shell on it, and never look for its path.

1. WRITE THE WHOLE DOCUMENT — no anchor, no partial edit, no append. A write that repeats a title or a section heading is refused.
2. FRONTMATTER FIRST, keys in English: \`progress\` 0-100 · \`status\` starting|in_progress|blocked|completed · \`current_activity\` (one line).
3. BODY = exactly these 5 H2 sections, in this order, in the conversation's language, nothing else: Overview · Checklist · Current Activity · Next Steps · Key Findings / Notes. Checklist marks: \`- [x]\` done · \`- [/]\` running · \`- [ ]\` pending. \`Checklist\` holds ONLY the user's actual work — never the tracking itself: no "read/update the progress file", "write progress", "sync tracking", "start tracking" or any other item about this document, and no meta-steps describing the tracking ritual.
4. FIRST TOOL CALL of every user turn is a progress action — a write, or a read first when you must check the current content — but that action is BOOKKEEPING, not work: never list it in \`Checklist\`, \`Current Activity\` or \`Next Steps\`. \`session_progress_read\` reports \`corrupted: true\` when the file repeats a title or section: then rewrite it from the single most complete document.
5. NEW OBJECTIVE while the tracked one is finished → write a brand-new document for the new task only (new title, \`progress: 0-5%\`, new checklist); never keep or append the old one. Same objective → update in place (tick items, adjust \`progress\` and \`current_activity\`).
6. FACTS, NOT PROSE — budget ~150 lines / ~12 KB, last section ~40 lines: \`key = value\` for settings, one table for repeating tuples, one statement per fact, no studies, logs, timings, machine specs or tool inventories; delete superseded text on every write. Over budget → the tool warns or refuses.
7. The user watches this file: keep \`current_activity\` and the checklist truthful, and trust the write result (bytes, percent, counts, warnings) instead of re-reading.

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
