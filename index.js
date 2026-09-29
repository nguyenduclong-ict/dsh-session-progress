import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';

import {
  addChecklistItems,
  advanceToNext,
  boxOf,
  checkItems,
  computeProgress,
  createEmptyProgress,
  currentItem,
  deriveStatus,
  lintProgressData,
  matchChecklistItem,
  normalizeHeading,
  normalizeProgress,
  parseProgressFileText,
  removeChecklistItems,
  renderChecklistLines,
  renderProgressText,
  SCHEMA_VERSION,
  serializeProgress,
  setItemsState,
  updateChecklistItems,
  upcomingItems
} from './progress-model.js';

export const name = 'dsh-session-progress';
export const inject = ['webServer'];

// Map: sessionId -> { filePath, uuid, sessionId, createdAt, lastUpdated }
const sessionProgressMap = new Map();
let latestActiveSessionId = null;

// Settings persistence: a per-session override map plus the default that applies to every session
// without an override. The default is what the toolbar toggle switches on a brand-new session
// screen, where no session id exists yet but the user must still be able to turn tracking off.
// `DSH_SESSION_PROGRESS_SETTINGS` redirects the store (used by the test suite, which must not write
// into the real file under the home directory).
const SETTINGS_FILE = process.env.DSH_SESSION_PROGRESS_SETTINGS
  ? path.resolve(process.env.DSH_SESSION_PROGRESS_SETTINGS)
  : path.join(os.homedir(), '.dsh-session-progress-settings.json');
/** sessionId -> explicit enabled flag (an override of the default). */
const sessionEnabledOverrides = new Map();
/** Whether sessions without an override have progress tracking enabled. */
let defaultEnabled = true;

/** The scope key the UI uses for the "applies to new sessions" toggle. */
export const DEFAULT_SCOPE = 'default';

/** Harness 0.1.7 (Desktop v0.10.0) spells agent/UI session ids `session-<uuid>`. */
export const SESSION_ID_PREFIX = 'session-';

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
// A session whose progress tracking is ON already maintains the progress document as its task list,
// so the model-facing `todo_write` tool is denied inside that session's agent scope: one source of
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

// ─────────────────────────── progress document storage (JSON) ───────────────────────────
//
// schema v2 keeps the whole document in ONE JSON file per session. The checklist is a tree whose
// items carry weights, and the percentage is COMPUTED from the boxes on every write — so there is
// no number for the model to keep in sync, which is what made the Markdown format fragile.
//
// v1 files (Markdown) are still found and migrated on first read: the .json sibling is written and
// the record is repointed at it, so an existing session keeps its checklist.

/** Filename prefix shared by both schema generations. */
const PROGRESS_FILE_PREFIX = 'dsh-progress-';

/** Extension of the current (JSON) document. */
const PROGRESS_FILE_EXT = '.json';

/** Extension of the legacy (Markdown) document. */
const LEGACY_FILE_EXT = '.md';

/**
 * Sanitize a string to be safely used as a filename component
 */
function sanitizeKey(str) {
  if (!str) return 'default';
  return String(str).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
}

/** Whether a tmpdir entry is a progress file of either schema generation. */
function isProgressFileName(name) {
  return name.startsWith(PROGRESS_FILE_PREFIX) && (name.endsWith(PROGRESS_FILE_EXT) || name.endsWith(LEGACY_FILE_EXT));
}

/** Newest progress file in a directory matching `prefix`, or null. */
function newestMatchingFile(dir, prefix) {
  let best = null;
  try {
    for (const name of fs.readdirSync(dir)) {
      if (!isProgressFileName(name) || !name.startsWith(prefix)) continue;
      const full = path.join(dir, name);
      try {
        const stat = fs.statSync(full);
        if (!best || stat.mtimeMs > best.mtimeMs) best = { filePath: full, mtimeMs: stat.mtimeMs, createdAt: stat.birthtimeMs || stat.mtimeMs };
      } catch (e) {}
    }
  } catch (e) {}
  return best;
}

/** Split `dsh-progress-<session>-<uuid>.<ext>` into its session and file uuid. */
function splitProgressFileName(fileName) {
  const ext = fileName.endsWith(PROGRESS_FILE_EXT) ? PROGRESS_FILE_EXT : LEGACY_FILE_EXT;
  const inner = fileName.slice(PROGRESS_FILE_PREFIX.length, -ext.length);
  let rawId = inner;
  let uuid = '';
  if (inner.length > 37) {
    uuid = inner.slice(-36);
    rawId = inner.slice(0, -37);
  }
  return { sessionId: rawId, uuid };
}

/**
 * Locate the most relevant active progress record across memory and disk.
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

  // 3. Scan os.tmpdir() for any dsh-progress-* file (JSON first, legacy Markdown too)
  const found = newestMatchingFile(os.tmpdir(), PROGRESS_FILE_PREFIX);
  if (found && found.mtimeMs > bestMtime) {
    const parsed = splitProgressFileName(path.basename(found.filePath));
    bestRecord = {
      sessionId: parsed.sessionId,
      filePath: found.filePath,
      uuid: parsed.uuid,
      createdAt: found.createdAt,
      lastUpdated: found.mtimeMs
    };
  }

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

  const prefix = `${PROGRESS_FILE_PREFIX}${sanitizeKey(sId)}-`;
  const found = newestMatchingFile(os.tmpdir(), prefix);
  if (found) {
    const parsed = splitProgressFileName(path.basename(found.filePath));
    const record = {
      sessionId: sId,
      filePath: found.filePath,
      uuid: parsed.uuid,
      createdAt: found.createdAt,
      lastUpdated: found.mtimeMs
    };
    sessionProgressMap.set(sId, record);
    return record;
  }

  return null;
}

/**
 * Spellings of one session id. Harness 0.1.7 (Desktop v0.10.0) prefixes agent/UI session ids
 * with "session-", while files written by earlier versions carry the bare UUID — so a lookup
 * that only tries the id it was handed reports "no progress file" for the very file that is
 * on disk. The given spelling stays first, so an exact match always wins.
 */
export function sessionIdVariants(sessionId) {
  const id = typeof sessionId === 'string' ? sessionId.trim() : '';
  if (!id || id === 'default' || id === 'undefined' || id === 'null') return [];
  if (id.startsWith(SESSION_ID_PREFIX)) {
    const bare = id.slice(SESSION_ID_PREFIX.length);
    return bare ? [id, bare] : [id];
  }
  return [id, `${SESSION_ID_PREFIX}${id}`];
}

/**
 * Find the record for any spelling of `sessionId`, preferring an exact hit. Read-only: a
 * variant lookup never reserves a path for a session that has no file yet.
 */
function findSessionProgressByAnyId(sessionId) {
  for (const candidate of sessionIdVariants(sessionId)) {
    const cached = sessionProgressMap.get(candidate);
    if (cached?.filePath && fs.existsSync(cached.filePath)) {
      return { record: cached, sessionId: candidate };
    }
  }
  for (const candidate of sessionIdVariants(sessionId)) {
    const found = findExistingSessionProgress(candidate);
    if (found?.filePath && fs.existsSync(found.filePath)) {
      return { record: found, sessionId: candidate };
    }
  }
  return null;
}

/**
 * Locate or allocate a progress file path for a given sessionId. The file is NOT created here:
 * the caller writes it.
 */
function getOrCreateSessionProgress(sessionId) {
  if (!sessionId) sessionId = 'default';
  const sId = String(sessionId);

  const existing = findExistingSessionProgress(sId);
  if (existing) return existing;

  const fileUuid = randomUUID();
  const filePath = path.join(os.tmpdir(), `${PROGRESS_FILE_PREFIX}${sanitizeKey(sId)}-${fileUuid}${PROGRESS_FILE_EXT}`);

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
 * Read a session's progress document, migrating a legacy Markdown file to JSON on the way.
 *
 * @param {object} record - the session's record (its `filePath` may be updated in place when a
 *   legacy `.md` document is migrated to its `.json` sibling).
 * @param {string} [sessionId] - owning session id, used when a new document has to be minted.
 * @returns {{exists: boolean, progress: object|null, text: string, bytes: number, migrated: boolean,
 *   corrupted: boolean, error: string, warnings: string[]}}
 */
function loadRecord(record, sessionId = '') {
  const result = {
    exists: false,
    progress: null,
    text: '',
    bytes: 0,
    migrated: false,
    corrupted: false,
    error: '',
    warnings: []
  };
  if (!record?.filePath || !fs.existsSync(record.filePath)) return result;

  try {
    result.text = fs.readFileSync(record.filePath, 'utf-8');
    result.bytes = Buffer.byteLength(result.text, 'utf-8');
  } catch (e) {
    result.exists = true;
    result.error = `the progress file could not be read: ${e?.message || e}`;
    return result;
  }

  try {
    const parsed = parseProgressFileText(result.text, sessionId || record.sessionId || '');
    result.progress = parsed.progress;
    result.exists = true;
    result.migrated = parsed.migrated;

    if (parsed.migrated) {
      // A schema-v1 Markdown document: keep the user's checklist by writing the JSON sibling
      // and repointing the record at it. The old .md file is left alone on disk.
      const target = `${record.filePath.slice(0, -LEGACY_FILE_EXT.length)}${PROGRESS_FILE_EXT}`;
      writeFileAtomically(target, serializeProgress(parsed.progress));
      record.filePath = target;
      record.uuid = splitProgressFileName(path.basename(target)).uuid;
      record.lastUpdated = Date.now();
    }
  } catch (e) {
    result.exists = true;
    result.error = e?.message || String(e);
    return result;
  }

  const lint = lintProgressData(result.progress);
  result.corrupted = lint.errors.length > 0;
  result.warnings = lint.warnings;
  return result;
}

/** The session a tool call belongs to; the owning-session check every progress tool shares. */
function toolSessionId(exec, toolName) {
  const session = exec?.agent?.session;
  const sessionId = session?.header?.id || session?.id || latestActiveSessionId;
  if (!sessionId || sessionId === 'default') {
    throw new Error(`${toolName} requires an owning agent session.`);
  }
  return sessionId;
}

/** The record + document a tool call works on, or an actionable error. */
function openSessionDocument(exec, toolName, options = {}) {
  const sessionId = toolSessionId(exec, toolName);
  const record = options.create ? getOrCreateSessionProgress(sessionId) : findSessionProgressByAnyId(sessionId)?.record;
  if (!record?.filePath) {
    if (options.allowMissing) return { sessionId, record: null, loaded: null };
    throw new Error(
      `${toolName} has no progress document for this session yet: create it first with ${PROGRESS_WRITE_TOOL_NAME} ({ content: { title, checklist: [...] } }).`
    );
  }
  const loaded = loadRecord(record, sessionId);
  if (loaded.error && !options.tolerateError) {
    throw new Error(
      `${toolName} could not read the stored progress document (${loaded.error}). Replace it with one complete document: ` +
        `${PROGRESS_WRITE_TOOL_NAME} ({ content: { title: "…", checklist: [ { text: "…", weight: 1 } ] } }).`
    );
  }
  return { sessionId, record, loaded };
}

// ─────────────────────────────── write-result nudging ───────────────────────────────
//
// The percentage is computed from the boxes, so the failure mode left is a model that reports work
// in prose twice in a row while the boxes stay where they were. The plugin cannot verify the work,
// but it CAN see that exact pattern: two consecutive writes with an identical box fingerprint and
// steps still pending. That is the one moment it speaks up.

/** sessionId -> the checklist fingerprint of that session's previous write. */
const checklistFingerprints = new Map();

/** `1:pending|1.1:done|…` — the box state of every row, in display order. */
function checklistFingerprint(summary) {
  return (summary?.flat ?? []).map((node) => `${node.path}:${node.state}`).join('|');
}

/** Remember the state a write left behind, and report a twice-stalled checklist once. */
function stalenessHint(sessionId, summary) {
  const fingerprint = checklistFingerprint(summary);
  const before = checklistFingerprints.get(sessionId);
  checklistFingerprints.set(sessionId, fingerprint);
  if (!before || before !== fingerprint || fingerprint === '') return '';
  if (summary.tasksPending + summary.tasksInProgress === 0) return '';
  return (
    `The checklist is unchanged across two consecutive writes (${summary.tasksDone}/${summary.tasksTotal} items done, ` +
    `${summary.tasksPending} pending). The percentage is computed from the boxes, so an unticked box keeps the panel — and the user — behind ` +
    `the work you reported: move it now with ${PROGRESS_CHECK_DONE_TOOL_NAME} ({ item: "<snippet of the finished step>" }), or ` +
    `${PROGRESS_WRITE_TOOL_NAME} ({ check: ["<snippet>", "…"] }) for several at once.`
  );
}

// ──────────────────────────────── the write tool ────────────────────────────────

export const PROGRESS_WRITE_TOOL_NAME = 'session_progress_write';
export const PROGRESS_READ_TOOL_NAME = 'session_progress_read';
export const PROGRESS_STATUS_TOOL_NAME = 'session_progress_status';
export const PROGRESS_CHECK_DONE_TOOL_NAME = 'session_progress_check_done';

/** Fields of the write tool that form a patch (as opposed to the whole-document `content`). */
const WRITE_PATCH_KEYS = [
  'title',
  'overview',
  'status',
  'current_activity',
  'next_steps',
  'notes',
  'checklist',
  'checklist_mode',
  'add',
  'parent',
  'update',
  'check',
  'start',
  'uncheck',
  'remove'
];

/** A checklist item, as accepted by the write tool. */
const ITEM_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    text: { type: 'string', description: 'The step itself, e.g. "Viết parser". A trailing "(20%)" is read as the weight.' },
    weight: { type: 'number', description: 'Share of the job among its siblings (see the plugin prompt). Omit to count as 1.' },
    state: { type: 'string', enum: ['pending', 'running', 'done'], description: 'pending (default) · running · done. A group\'s state is derived from its children.' },
    children: { type: 'array', items: { type: 'object', additionalProperties: true }, description: 'Sub-checklist: the same item shape, nested.' }
  }
};

/**
 * Build the `session_progress_write` tool definition.
 *
 * Registered as a plain registry definition (raw JSON Schema), matching how first-party plugins that
 * cannot import `@deepseek-ai/tools` register tools, so this plugin keeps zero runtime deps.
 *
 * @returns {object} a registry-ready tool definition.
 */
export function buildProgressWriteTool() {
  return {
    name: PROGRESS_WRITE_TOOL_NAME,
    description:
      'Create or update the session progress document (a JSON document holding the goal, the checklist and the plan). ' +
      'The overall percentage is COMPUTED from the checklist and its weights — never send a percentage. ' +
      'Send EITHER `content` (one complete document: an object, or a JSON string) to create or replace the document, OR a patch: any of `title`, `overview`, `status`, `current_activity`, `next_steps`, `notes`, `checklist` (+ `checklist_mode`: replace | append | merge), ' +
      '`add` [{ text, weight?, state?, children? }] (+ optional `parent` matcher), `update` [{ match, text?, weight?, state? }], `check` / `start` / `uncheck` / `remove` [matchers]. ' +
      'A matcher is a distinctive text snippet, a row number (`#3`) or an item path (`#2.1`); an unknown or ambiguous matcher is refused with the full item list, and nothing is written. ' +
      'Items may nest (`children`), and checking a group off cascades `done` into its whole subtree. Status is derived too (all leaves done ⇒ completed), except `blocked`.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        content: {
          type: 'object',
          additionalProperties: true,
          description: 'The complete progress document as an object: { title, overview, status, current_activity, checklist: [...], next_steps, notes }. Replaces the document. A JSON string of the same object is also accepted. Never combine with a patch field.'
        },
        title: { type: 'string', description: 'Goal title, one line.' },
        overview: { type: 'string', description: 'Objective plus the current status, as short factual lines.' },
        status: { type: 'string', enum: ['starting', 'in_progress', 'blocked', 'completed'], description: 'Optional: it is derived from the checklist, except `blocked`, which only you can declare.' },
        current_activity: { type: 'string', description: 'One line describing the step running now.' },
        next_steps: { type: 'string', description: 'The plan after the current step.' },
        notes: { type: 'string', description: 'Decisions, chosen values, blockers — facts only.' },
        checklist: { type: 'array', items: ITEM_SCHEMA, description: 'The checklist tree as the write leaves it; combined with `checklist_mode`.' },
        checklist_mode: { type: 'string', enum: ['replace', 'append', 'merge'], description: 'How `checklist` combines with the stored one: replace (default) | append (add at the end) | merge (patch in place by position).' },
        add: { type: 'array', items: ITEM_SCHEMA, description: 'Items to append; `parent` picks a group to append into.' },
        parent: { type: 'string', description: 'Matcher for the group that `add` appends into; omitted ⇒ the top level.' },
        update: {
          type: 'array',
          description: 'Patch existing items in place (text, weight and/or state).',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['match'],
            properties: {
              match: { type: 'string', description: 'Text snippet, row number (`#3`) or path (`#2.1`).' },
              text: { type: 'string', description: 'New text; a trailing "(20%)" is read as the weight.' },
              weight: { type: 'number', description: 'New weight among its siblings.' },
              state: { type: 'string', enum: ['pending', 'running', 'done'] }
            }
          }
        },
        check: { type: 'array', items: { type: 'string' }, description: 'Matchers to mark done. A group matcher cascades into its subtree. Does not promote a next step — use session_progress_check_done for that.' },
        start: { type: 'array', items: { type: 'string' }, description: 'Matchers to mark running.' },
        uncheck: { type: 'array', items: { type: 'string' }, description: 'Matchers to mark pending again.' },
        remove: { type: 'array', items: { type: 'string' }, description: 'Matchers for items to delete (a group takes its subtree with it).' }
      }
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          mode: { type: 'string' },
          bytes: { type: 'integer' },
          previousBytes: { type: 'integer' },
          replaced: { type: 'boolean' },
          repaired: { type: 'boolean' },
          migrated: { type: 'boolean' },
          percent: { type: 'integer' },
          exactPercent: { type: 'number' },
          status: { type: 'string' },
          currentActivity: { type: 'string' },
          tasksTotal: { type: 'integer' },
          tasksDone: { type: 'integer' },
          tasksInProgress: { type: 'integer' },
          tasksPending: { type: 'integer' },
          checked: { type: 'array', items: { type: 'string' } },
          started: { type: 'array', items: { type: 'string' } },
          unchecked: { type: 'array', items: { type: 'string' } },
          added: { type: 'array', items: { type: 'string' } },
          updated: { type: 'array', items: { type: 'string' } },
          removed: { type: 'array', items: { type: 'string' } },
          checklistHint: { type: 'string' },
          warnings: { type: 'array', items: { type: 'string' } }
        }
      },
      render: (_args, value) => [{ type: 'text', text: renderProgressWriteResult(value) }]
    },
    presentCall: (args) => {
      const whole = args?.content !== undefined;
      const keys = WRITE_PATCH_KEYS.filter((key) => args?.[key] !== undefined);
      return {
        card: 'generic',
        title: whole ? 'Write the session progress document' : 'Update session progress',
        kind: 'other',
        rawInput: whole ? '' : keys.join(' · ')
      };
    },
    execute(args, exec) {
      const hasContent = args?.content !== undefined && args?.content !== null && !(typeof args.content === 'string' && args.content.trim() === '');
      const patchKeys = WRITE_PATCH_KEYS.filter((key) => args?.[key] !== undefined);
      if (hasContent && patchKeys.length > 0) {
        throw new Error(
          `${PROGRESS_WRITE_TOOL_NAME} takes EITHER \`content\` (the whole document) OR a patch (${patchKeys.join(', ')}), never both. Nothing was written.`
        );
      }
      if (!hasContent && patchKeys.length === 0) {
        throw new Error(
          `${PROGRESS_WRITE_TOOL_NAME} needs either \`content\` (the complete document) or at least one patch field (${WRITE_PATCH_KEYS.join(', ')}). Nothing was written.`
        );
      }
      if (args?.checklist_mode !== undefined && args?.checklist === undefined) {
        throw new Error('`checklist_mode` only makes sense together with `checklist`. Nothing was written.');
      }

      const { sessionId, record, loaded } = openSessionDocument(exec, PROGRESS_WRITE_TOOL_NAME, {
        create: true,
        tolerateError: true
      });
      // A patch needs a readable document to patch. A whole-document write does not: replacing an
      // unreadable file is exactly the repair path the read tools point the model at.
      if (loaded.error && !hasContent) {
        throw new Error(
          `${PROGRESS_WRITE_TOOL_NAME} cannot patch the stored progress document (${loaded.error}). ` +
            `Send the whole document instead: ${PROGRESS_WRITE_TOOL_NAME} ({ content: { title: "…", checklist: [ … ] } }).`
        );
      }
      const previous = loaded.error ? null : loaded.progress;
      const previousSummary = previous ? computeProgress(previous) : null;

      const warnings = [...loaded.warnings];
      const checked = [];
      const started = [];
      const unchecked = [];
      const added = [];
      const updated = [];
      const removed = [];
      let next = null;
      let mode = 'partial';

      if (hasContent) {
        mode = 'full';
        let source = args.content;
        if (typeof source === 'string') {
          try {
            source = JSON.parse(source);
          } catch (e) {
            throw new Error(`\`content\` was sent as a string but is not valid JSON (${e?.message || e}). Send the document as an object, or fix the JSON. Nothing was written.`);
          }
        }
        next = normalizeProgress(source, null, { sessionId }).progress;
      } else {
        const patch = {};
        for (const key of ['title', 'overview', 'status', 'current_activity', 'next_steps', 'notes']) {
          if (args[key] !== undefined) patch[key] = args[key];
        }
        if (args.checklist !== undefined) patch.checklist = args.checklist;

        next = normalizeProgress(patch, previous ?? createEmptyProgress(sessionId), {
          sessionId,
          checklistMode: args.checklist_mode
        }).progress;

        try {
          if (args.add !== undefined) {
            const result = addChecklistItems(next, args.add, args.parent ?? '');
            added.push(...result.added.map((item) => item.text));
            warnings.push(...result.warnings);
          }
          if (args.update !== undefined) updated.push(...updateChecklistItems(next, args.update).map((entry) => entry.text));
          if (args.check !== undefined) checked.push(...checkItems(next, args.check).ticked);
          if (args.start !== undefined) started.push(...setItemsState(next, args.start, 'running').moved.map((entry) => entry.text));
          if (args.uncheck !== undefined) unchecked.push(...setItemsState(next, args.uncheck, 'pending').moved.map((entry) => entry.text));
          if (args.remove !== undefined) removed.push(...removeChecklistItems(next, args.remove).map((entry) => entry.text));
        } catch (e) {
          throw new Error(`${PROGRESS_WRITE_TOOL_NAME} rejected this edit, so nothing was written:\n- ${e?.message || e}`);
        }
      }

      const derived = deriveStatus(next, computeProgress(next));
      next.status = derived.status;
      if (derived.warning) warnings.push(derived.warning);

      const summary = computeProgress(next);
      const lint = lintProgressData(next);
      if (lint.errors.length > 0) {
        throw new Error(
          `${PROGRESS_WRITE_TOOL_NAME} rejected this document, so nothing was written:\n- ${lint.errors.join('\n- ')}\nFix it and call the tool again.`
        );
      }
      warnings.push(...lint.warnings);

      writeFileAtomically(record.filePath, serializeProgress(next));
      record.lastUpdated = Date.now();

      const checklistTouched = checked.length + started.length + unchecked.length + added.length + updated.length + removed.length > 0;
      if (!checklistTouched && previousSummary) warnings.push(...[stalenessHint(sessionId, summary)].filter(Boolean));
      else checklistFingerprints.set(sessionId, checklistFingerprint(summary));

      if (isSessionDisabled(sessionId)) {
        warnings.push('progress tracking is currently switched OFF for this session, so the UI does not surface this update.');
      }

      return {
        mode,
        bytes: Buffer.byteLength(serializeProgress(next), 'utf-8'),
        previousBytes: loaded.bytes,
        replaced: loaded.bytes > 0,
        repaired: loaded.corrupted || Boolean(loaded.error),
        migrated: loaded.migrated,
        percent: summary.percent,
        exactPercent: summary.exactPercent,
        status: next.status,
        ...(next.currentActivity ? { currentActivity: next.currentActivity } : {}),
        tasksTotal: summary.tasksTotal,
        tasksDone: summary.tasksDone,
        tasksInProgress: summary.tasksInProgress,
        tasksPending: summary.tasksPending,
        checked,
        started,
        unchecked,
        added,
        updated,
        removed,
        checklistHint: '',
        warnings
      };
    }
  };
}

/**
 * Render the tool result the model reads back after a write.
 * @param {object} value - the structured tool result.
 * @returns {string} a one-paragraph summary.
 */
export function renderProgressWriteResult(value) {
  const parts = [
    value.mode === 'full'
      ? `Progress document written in full (${value.previousBytes} → ${value.bytes} bytes).`
      : `Progress updated in place (${value.previousBytes} → ${value.bytes} bytes).`
  ];
  if (value.migrated) parts.push('The previous Markdown progress file was migrated to JSON.');
  if (value.repaired) parts.push('The stored document was invalid and is now clean.');
  parts.push(
    `${value.percent}% · ${value.status} · ${value.tasksDone}/${value.tasksTotal} item(s) done` +
      `${value.tasksInProgress ? `, ${value.tasksInProgress} running` : ''}${value.tasksPending ? `, ${value.tasksPending} pending` : ''}.`
  );
  if (value.currentActivity) parts.push(`Now: ${value.currentActivity}.`);
  if (value.checked.length > 0) parts.push(`Checked: ${value.checked.join(' · ')}.`);
  if (value.started.length > 0) parts.push(`Running: ${value.started.join(' · ')}.`);
  if (value.unchecked.length > 0) parts.push(`Reopened: ${value.unchecked.join(' · ')}.`);
  if (value.added.length > 0) parts.push(`Added: ${value.added.join(' · ')}.`);
  if (value.updated.length > 0) parts.push(`Edited: ${value.updated.join(' · ')}.`);
  if (value.removed.length > 0) parts.push(`Removed: ${value.removed.join(' · ')}.`);
  if (value.checklistHint) parts.push(value.checklistHint);
  if (Array.isArray(value.warnings) && value.warnings.length > 0) parts.push(value.warnings.join(' '));
  return parts.join(' ');
}

// ──────────────────────────────── the read tool ────────────────────────────────

/** Canonical section keys of the document, in order, with their localized aliases. */
const READ_SECTIONS = [
  ['overview', 'Overview', ['overview', 'tong quan', 'gioi thieu', 'muc tieu', 'tom tat', 'objective', 'summary']],
  ['checklist', 'Checklist', ['checklist', 'check list', 'danh sach cong viec', 'danh sach', 'cong viec', 'viec can lam', 'tasks', 'todo']],
  ['current_activity', 'Current Activity', ['current activity', 'hoat dong hien tai', 'dang thuc hien', 'dang lam', 'current step', 'hoat dong']],
  ['next_steps', 'Next Steps', ['next steps', 'buoc tiep theo', 'cac buoc tiep theo', 'ke hoach tiep theo', 'tiep theo', 'plan']],
  ['notes', 'Key Findings / Notes', ['key findings', 'findings', 'phat hien', 'ghi chu', 'ket qua chinh', 'notes', 'note']]
];

/** Resolve one requested section name against the canonical five, tolerating aliases and indexes. */
function resolveReadSection(query) {
  const raw = String(query ?? '').trim();
  if (!raw) return null;
  const asIndex = raw.match(/^(?:#|section\s*)?(\d{1,2})$/i);
  if (asIndex) {
    const entry = READ_SECTIONS[Number(asIndex[1]) - 1];
    return entry ? entry[0] : null;
  }
  const wanted = normalizeHeading(raw);
  if (!wanted) return null;
  for (const [key, , aliases] of READ_SECTIONS) {
    if (aliases.some((alias) => wanted === alias || wanted.startsWith(`${alias} `) || wanted.includes(` ${alias}`))) return key;
  }
  return null;
}

/** The body text of one section of a document. */
function sectionText(progress, key) {
  switch (key) {
    case 'overview':
      return progress.overview || '(empty)';
    case 'checklist':
      return renderChecklistLines(progress);
    case 'current_activity':
      return progress.currentActivity || '(empty)';
    case 'next_steps':
      return progress.nextSteps || '(empty)';
    case 'notes':
      return progress.notes || '(empty)';
    default:
      return '';
  }
}

/**
 * Build the `session_progress_read` tool definition: the ONLY supported way to see the document.
 *
 * The document's path is deliberately never exposed (neither in the prompt nor in any tool
 * result), so the model cannot address it with a generic `read`/`write`/`edit`.
 *
 * @returns {object} a registry-ready tool definition.
 */
export function buildProgressReadTool() {
  return {
    name: PROGRESS_READ_TOOL_NAME,
    description:
      'Read the session progress document. Pass `sections` to get ONLY those back (the parsed state always comes along) — the cheap path when you are about to touch one or two of them; omit it for the whole document. ' +
      'Sections: Overview · Checklist · Current Activity · Next Steps · Notes; names match loosely (case, accents, partial/localized names, 1-based index) and unmatched names come back in `missing`. ' +
      'Each checklist row is rendered as `- [x] text (share%)`, where the share is computed from the weights, not declared. ' +
      'This is the only supported way to see the document — never look for its path with generic file tools.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        sections: {
          type: 'array',
          items: { type: 'string' },
          description: 'Sections to return, e.g. ["Checklist", "Next Steps"]. Omit (or pass ["all"]) to read the whole document.'
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
          exactPercent: { type: 'number' },
          status: { type: 'string' },
          currentActivity: { type: 'string' },
          tasksTotal: { type: 'integer' },
          tasksDone: { type: 'integer' },
          tasksInProgress: { type: 'integer' },
          tasksPending: { type: 'integer' },
          corrupted: { type: 'boolean' },
          migrated: { type: 'boolean' },
          warnings: { type: 'array', items: { type: 'string' } },
          available: { type: 'array', items: { type: 'string' } },
          missing: { type: 'array', items: { type: 'string' } },
          checklist: { type: 'array', items: { type: 'object', additionalProperties: true } },
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

      const { sessionId, loaded } = openSessionDocument(exec, PROGRESS_READ_TOOL_NAME, { allowMissing: true });

      const empty = {
        exists: false,
        mode: wantsFull ? 'full' : 'sections',
        title: '',
        percent: 0,
        exactPercent: 0,
        status: 'starting',
        tasksTotal: 0,
        tasksDone: 0,
        tasksInProgress: 0,
        tasksPending: 0,
        corrupted: false,
        migrated: false,
        warnings: [],
        available: [],
        missing: [],
        checklist: [],
        sections: [],
        content: ''
      };
      if (!loaded?.exists) return empty;

      const progress = loaded.progress;
      const summary = computeProgress(progress);
      const derived = deriveStatus(progress, summary);
      const warnings = [...loaded.warnings];
      if (derived.status !== progress.status) {
        warnings.push(`the stored status "${progress.status}" does not match the checklist; the derived status is "${derived.status}".`);
      }
      if (isSessionDisabled(sessionId)) {
        warnings.push('progress tracking is currently switched OFF for this session, so the UI does not surface this document.');
      }

      const base = {
        exists: true,
        mode: wantsFull ? 'full' : 'sections',
        title: progress.title ?? '',
        percent: summary.percent,
        exactPercent: summary.exactPercent,
        status: derived.status,
        ...(progress.currentActivity ? { currentActivity: progress.currentActivity } : {}),
        tasksTotal: summary.tasksTotal,
        tasksDone: summary.tasksDone,
        tasksInProgress: summary.tasksInProgress,
        tasksPending: summary.tasksPending,
        corrupted: loaded.corrupted,
        migrated: loaded.migrated,
        warnings,
        available: READ_SECTIONS.map(([, label]) => label),
        checklist: summary.items
      };

      if (wantsFull) {
        return { ...base, missing: [], sections: [], content: renderProgressText(progress) };
      }

      const missing = [];
      const picked = [];
      for (const name of requested) {
        const key = resolveReadSection(name);
        if (!key) {
          missing.push(name);
          continue;
        }
        if (!picked.includes(key)) picked.push(key);
      }

      return {
        ...base,
        missing,
        sections: picked.map((key) => ({
          name: READ_SECTIONS.find(([candidate]) => candidate === key)[1],
          content: sectionText(progress, key)
        })),
        content: ''
      };
    }
  };
}

/**
 * Render the read-tool result: the document (or the requested sections), plus an actionable trailer
 * when the plugin has something the raw document cannot say by itself.
 * @param {object} value - the structured read result.
 * @returns {string} the text the model receives.
 */
export function renderProgressReadResult(value) {
  if (!value.exists) {
    return 'No progress document yet for this session. Create it with session_progress_write, sending `content` with the whole document.';
  }
  const notes = [];
  if (value.corrupted) {
    notes.push(
      'CORRUPTED: the stored document fails validation (see the warnings). Keep the most complete version and write it again with session_progress_write({ content: … }).'
    );
  }
  if (value.migrated) notes.push('the previous Markdown progress file was migrated to JSON.');
  if (Array.isArray(value.missing) && value.missing.length > 0) {
    notes.push(`section(s) not found: ${value.missing.join(', ')}. This document has: ${value.available?.join(', ') || '(none)'}.`);
  }
  if (Array.isArray(value.warnings)) {
    for (const warning of value.warnings) notes.push(warning);
  }
  const trailer = notes.length > 0 ? `\n\n---\n[plugin] ${notes.join(' ')}` : '';

  if (value.mode === 'full') return `${value.content}${trailer}`;

  const parts = [
    value.title ? `Goal: ${value.title}` : null,
    `Progress: ${value.percent}% (computed) · ${value.status}${value.currentActivity ? ` · ${value.currentActivity}` : ''}`,
    `Checklist: ${value.tasksDone}/${value.tasksTotal} done · ${value.tasksInProgress} running · ${value.tasksPending} pending`
  ].filter(Boolean);
  for (const section of value.sections) parts.push('', `## ${section.name}`, section.content);
  return `${parts.join('\n')}${trailer}`;
}

// ──────────────────── step tools (where am I, and finish the step I am on) ────────────────────
//
// `session_progress_read` answers "what does the document say". These two answer the two questions a
// model asks mid-turn, for a fraction of the tokens: `session_progress_status` = the step in
// progress, the steps after it and the plan; `session_progress_check_done` = finish the step in
// progress, promote the next one, and let the plugin recompute the percentage in the same write.

/**
 * The cheap "where am I" view of a document.
 * @param {object} progress - the canonical document.
 * @param {number} upcomingLimit - how many upcoming steps to list.
 * @returns {object} the summary both the status tool and the check-done result render.
 */
function summarizeStep(progress, upcomingLimit) {
  const summary = computeProgress(progress);
  const derived = deriveStatus(progress, summary);
  const current = currentItem(summary);
  return {
    title: progress.title ?? '',
    percent: summary.percent,
    exactPercent: summary.exactPercent,
    status: derived.status,
    currentActivity: progress.currentActivity ?? '',
    current: current
      ? { text: current.text, path: current.path, index: summary.flat.indexOf(current) + 1, box: boxOf(current.state), weightPercent: current.weightPercent }
      : null,
    upcoming: upcomingItems(summary, upcomingLimit).map((node) => ({ path: node.path, text: node.text, weightPercent: node.weightPercent })),
    nextSteps: String(progress.nextSteps ?? ''),
    tasksTotal: summary.tasksTotal,
    tasksDone: summary.tasksDone,
    tasksInProgress: summary.tasksInProgress,
    tasksPending: summary.tasksPending
  };
}

/**
 * Build the `session_progress_status` tool: the step in progress, the next steps and the plan, in one
 * cheap read that never touches the document.
 * @returns {object} a registry-ready tool definition.
 */
export function buildProgressStatusTool() {
  return {
    name: PROGRESS_STATUS_TOOL_NAME,
    description:
      'Where the session stands right now, in ONE cheap call: the current activity, the checklist step in progress, the pending steps after it, and the Next Steps plan. ' +
      'The percentage shown is computed from the checklist boxes and their weights. ' +
      'This is the first progress action to reach for at the start of a turn — it costs a fraction of reading the document. Read-only: it never creates or changes anything.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        upcoming: { type: 'integer', description: 'How many upcoming pending steps to list (default 3, max 10).' }
      }
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          exists: { type: 'boolean' },
          title: { type: 'string' },
          percent: { type: 'integer' },
          exactPercent: { type: 'number' },
          status: { type: 'string' },
          currentActivity: { type: 'string' },
          current: {
            type: 'object',
            additionalProperties: false,
            properties: {
              text: { type: 'string' },
              path: { type: 'string' },
              index: { type: 'integer' },
              box: { type: 'string' },
              weightPercent: { type: 'number' }
            }
          },
          upcoming: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: { path: { type: 'string' }, text: { type: 'string' }, weightPercent: { type: 'number' } }
            }
          },
          nextSteps: { type: 'string' },
          tasksTotal: { type: 'integer' },
          tasksDone: { type: 'integer' },
          tasksInProgress: { type: 'integer' },
          tasksPending: { type: 'integer' },
          warnings: { type: 'array', items: { type: 'string' } }
        }
      },
      render: (_args, value) => [{ type: 'text', text: renderProgressStatusResult(value) }]
    },
    presentCall: () => ({ card: 'generic', title: 'Read where the session stands', kind: 'other', rawInput: '' }),
    execute(args, exec) {
      const requested = Number(args?.upcoming);
      const limit = Number.isFinite(requested) ? Math.max(1, Math.min(10, Math.round(requested))) : 3;
      const { sessionId, loaded } = openSessionDocument(exec, PROGRESS_STATUS_TOOL_NAME, { allowMissing: true });

      if (!loaded?.exists) {
        return {
          exists: false,
          title: '',
          percent: 0,
          exactPercent: 0,
          status: 'starting',
          currentActivity: '',
          upcoming: [],
          nextSteps: '',
          tasksTotal: 0,
          tasksDone: 0,
          tasksInProgress: 0,
          tasksPending: 0,
          warnings: []
        };
      }

      const warnings = [...loaded.warnings];
      if (loaded.corrupted) warnings.push('the stored document fails validation; rewrite it with session_progress_write({ content: … }).');
      if (isSessionDisabled(sessionId)) {
        warnings.push('progress tracking is currently switched OFF for this session, so the UI does not surface this document.');
      }
      return { exists: true, ...summarizeStep(loaded.progress, limit), warnings };
    }
  };
}

/** Render the status tool's result: one screen, no whole document. */
export function renderProgressStatusResult(value) {
  if (!value.exists) {
    return 'No progress document yet for this session. Create it with session_progress_write, sending `content` with the whole document.';
  }
  const parts = [
    value.title ? `Goal: ${value.title}` : null,
    `Progress: ${value.percent}% (computed) · ${value.status}${value.currentActivity ? ` · ${value.currentActivity}` : ''}`,
    `Checklist: ${value.tasksDone}/${value.tasksTotal} done · ${value.tasksInProgress} running · ${value.tasksPending} pending`,
    value.current
      ? `Now: ${value.current.box} ${value.current.text} (#${value.current.path}, ${value.current.weightPercent}% of the job)`
      : 'Now: no step in progress (every item is done, or the Checklist is empty).',
    value.upcoming.length > 0
      ? `Next: ${value.upcoming.map((item) => `${item.text} (#${item.path}, ${item.weightPercent}%)`).join(' · ')}`
      : 'Next: nothing pending.'
  ].filter(Boolean);
  if (value.nextSteps) parts.push('', 'Next Steps:', value.nextSteps);
  if (Array.isArray(value.warnings)) {
    for (const warning of value.warnings) parts.push('', `[plugin] ${warning}`);
  }
  return parts.join('\n');
}

/**
 * Build the `session_progress_check_done` tool: finish the step the session is on, promote the next
 * one, and let the plugin recompute the percentage — one call instead of a read plus a write.
 * @returns {object} a registry-ready tool definition.
 */
export function buildProgressCheckDoneTool() {
  return {
    name: PROGRESS_CHECK_DONE_TOOL_NAME,
    description:
      'Finish the checklist step the session is on, in ONE call: it ticks that step (the running one by default, or the one you name), promotes the next pending step to running, and recomputes the percentage from the weights. ' +
      'There is no percentage to pass — it follows the boxes. Only the named items move; every other item, weight and text stays as it was. ' +
      '`item` takes a distinctive text snippet, a row number (`#3`) or an item path (`#2.1`); omit it to finish the step in progress. ' +
      'Prefer this over rewriting the checklist with session_progress_write.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        item: {
          type: 'string',
          description: 'The step to finish: a distinctive snippet of its text, a row number (`#3`) or a path (`#2.1`). Default: the step in progress (the first running item), else the first pending one.'
        },
        activity: { type: 'string', description: 'New `current_activity` line; omit to keep the current one.' },
        advance: { type: 'boolean', description: 'Promote the next pending step to running (default true). Set false to leave nothing running.' }
      }
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          checked: { type: 'string' },
          checkedPath: { type: 'string' },
          checkedIndex: { type: 'integer' },
          alreadyDone: { type: 'boolean' },
          promoted: { type: 'string' },
          promotedPath: { type: 'string' },
          next: { type: 'string' },
          bytes: { type: 'integer' },
          previousBytes: { type: 'integer' },
          percent: { type: 'integer' },
          exactPercent: { type: 'number' },
          status: { type: 'string' },
          currentActivity: { type: 'string' },
          tasksTotal: { type: 'integer' },
          tasksDone: { type: 'integer' },
          tasksInProgress: { type: 'integer' },
          tasksPending: { type: 'integer' },
          warnings: { type: 'array', items: { type: 'string' } }
        }
      },
      render: (_args, value) => [{ type: 'text', text: renderProgressCheckDoneResult(value) }]
    },
    presentCall: (args) => ({
      card: 'generic',
      title: 'Check off the current step',
      kind: 'other',
      rawInput: typeof args?.item === 'string' ? args.item : ''
    }),
    execute(args, exec) {
      const { sessionId, record, loaded } = openSessionDocument(exec, PROGRESS_CHECK_DONE_TOOL_NAME);
      if (loaded.corrupted) {
        throw new Error(
          `${PROGRESS_CHECK_DONE_TOOL_NAME} refuses to edit an invalid document (see ${PROGRESS_READ_TOOL_NAME} for the warnings). ` +
            `Rewrite it with ${PROGRESS_WRITE_TOOL_NAME} ({ content: { … } }) first.`
        );
      }

      const progress = loaded.progress;
      const summary = computeProgress(progress);
      if (summary.flat.length === 0) {
        throw new Error(`${PROGRESS_CHECK_DONE_TOOL_NAME} found no checklist item to check off; add items with ${PROGRESS_WRITE_TOOL_NAME} first.`);
      }

      const requested = String(args?.item ?? '').trim();
      const target = requested ? matchChecklistItem(summary, requested).node : currentItem(summary);
      if (!target) {
        throw new Error(
          `${PROGRESS_CHECK_DONE_TOOL_NAME} has nothing to check off: every item is already done. Add the next step to the checklist, or name one with \`item\`.`
        );
      }

      const alreadyDone = target.state === 'done';
      if (!alreadyDone) checkItems(progress, [`#${target.path}`]);

      let promoted = null;
      if (args?.advance !== false) {
        const leaves = summary.flat.filter((node) => !node.isGroup);
        const prefix = `${target.path}.`;
        const subtreeLeaves = leaves.filter((node) => node.path === target.path || node.path.startsWith(prefix));
        const afterPath = subtreeLeaves.length > 0 ? subtreeLeaves[subtreeLeaves.length - 1].path : target.path;
        promoted = advanceToNext(progress, afterPath).promoted;
      }

      if (typeof args?.activity === 'string' && args.activity.trim() !== '') {
        progress.currentActivity = args.activity.trim();
      }
      progress.updatedAt = Date.now();
      progress.status = deriveStatus(progress, computeProgress(progress)).status;

      const lint = lintProgressData(progress);
      if (lint.errors.length > 0) {
        throw new Error(`${PROGRESS_CHECK_DONE_TOOL_NAME} rejected this document, so nothing was written:\n- ${lint.errors.join('\n- ')}`);
      }

      writeFileAtomically(record.filePath, serializeProgress(progress));
      record.lastUpdated = Date.now();
      checklistFingerprints.set(sessionId, checklistFingerprint(computeProgress(progress)));

      const after = computeProgress(progress);
      const warnings = [...loaded.warnings, ...lint.warnings];
      if (isSessionDisabled(sessionId)) {
        warnings.push('progress tracking is currently switched OFF for this session, so the UI does not surface this update.');
      }

      return {
        checked: target.text,
        checkedPath: target.path,
        checkedIndex: summary.flat.indexOf(target) + 1,
        alreadyDone,
        promoted: promoted ? promoted.text : '',
        promotedPath: promoted ? promoted.path : '',
        next: upcomingItems(after, 3)
          .map((item) => `${item.text} (#${item.path})`)
          .join(' · '),
        bytes: Buffer.byteLength(serializeProgress(progress), 'utf-8'),
        previousBytes: loaded.bytes,
        percent: after.percent,
        exactPercent: after.exactPercent,
        status: progress.status,
        ...(progress.currentActivity ? { currentActivity: progress.currentActivity } : {}),
        tasksTotal: after.tasksTotal,
        tasksDone: after.tasksDone,
        tasksInProgress: after.tasksInProgress,
        tasksPending: after.tasksPending,
        warnings
      };
    }
  };
}

/** Render the check-done tool's result. */
export function renderProgressCheckDoneResult(value) {
  const parts = [
    value.alreadyDone
      ? `"${value.checked}" (#${value.checkedPath}) was already ticked.`
      : `Checked off "${value.checked}" (#${value.checkedPath}, row ${value.checkedIndex}).`
  ];
  if (value.promoted) parts.push(`Now running: ${value.promoted} (#${value.promotedPath}).`);
  parts.push(
    `${value.percent}% (computed) · ${value.status} · ${value.tasksDone}/${value.tasksTotal} done, ${value.tasksPending} pending.`
  );
  if (value.next) parts.push(`Next: ${value.next}.`);
  if (Array.isArray(value.warnings) && value.warnings.length > 0) parts.push(value.warnings.join(' '));
  return parts.join(' ');
}

// ─────────────────────────────── the injected prompt ───────────────────────────────

const PROGRESS_PROMPT_SECTION = `# SESSION PROGRESS
Keep the session progress document current through this plugin's tools ONLY: \`session_progress_status\`, \`session_progress_check_done\`, \`session_progress_write\`, \`session_progress_read\`. It is a JSON document — never look for its path, and never touch it with read/write/edit/shell.

1. THE PERCENTAGE IS COMPUTED, NEVER WRITTEN. Every checklist item carries a \`weight\` (its share among its siblings) and the plugin derives the total from the boxes: a leaf counts 1 when \`done\`, ½ when \`running\`, 0 when \`pending\`, and a group is the weighted average of its children. There is no percentage to pass and none is accepted — declare the weights once, then only move boxes.
2. WEIGHTS. Top-level weights read best as percent of the whole job (\`20 / 30 / 50\`). A sub-item's weight is relative to its siblings, so children that sum to their parent's weight keep their absolute meaning (\`item 3 (50%)\` with sub-items \`25 / 15 / 10\`). A missing weight counts as 1; a group may not mix declared and defaulted child weights. \`session_progress_read\` and \`session_progress_status\` report each item's real share, so check what you declared.
3. NESTING. Any item may carry \`children\` (a sub-checklist), up to 6 levels. Checking a group off cascades \`done\` into its whole subtree, so a group is the natural way to check off a finished phase. \`status\` is derived too: all leaves done ⇒ \`completed\`, some progress ⇒ \`in_progress\`, nothing started ⇒ \`starting\`; \`blocked\` is the only status you set yourself.
4. WRITE SHAPES. \`session_progress_write({ content })\` replaces the whole document (an object, or a JSON string) — use it to create the document or to repair one reported \`corrupted\`. Otherwise send a patch: any of \`title\`, \`overview\`, \`status\`, \`current_activity\`, \`next_steps\`, \`notes\`, \`checklist\` (with \`checklist_mode\`: replace | append | merge), \`add\` [{ text, weight?, state?, children? }] (+ \`parent\` matcher), \`update\` [{ match, text?, weight?, state? }], \`check\` / \`start\` / \`uncheck\` / \`remove\` [matchers]. \`content\` never combines with a patch.
5. WRITE ONCE OR TWICE PER TURN — a bookkeeping patch near the start, plus ONE close-out write when the work moved. Finishing a step is ONE call: \`session_progress_check_done({ item?: "snippet or #2.1" })\` ticks the step in progress (or the one you name), promotes the next \`[ ]\` step to running and recomputes the percentage. Use \`session_progress_write({ check: [...] })\` to move several boxes without promoting. The checklist is the user's measure of the work, so it must be TRUE at the end of every turn, never "next turn". Never rewrite the checklist just to move a box — a re-planned list silently drops the boxes the user was reading, and the write result tells you when the boxes did not move.
6. MATCHERS. A matcher is a distinctive text snippet, a row number (\`#3\`, rows as displayed) or a path (\`#2.1\` = 2nd item, 1st child). An unknown or ambiguous matcher is refused with the full item list, so nothing is silently missed.
7. READ THE LEAST YOU NEED — \`session_progress_status()\` is the cheapest first look of a turn: the step in progress, the pending steps after it and the plan, without the document. \`session_progress_read({ sections: ["Checklist"] })\` returns the sections you name (Overview · Checklist · Current Activity · Next Steps · Notes); omit \`sections\` only when you truly need everything. The first tool call of every user turn is a progress action, but that action is BOOKKEEPING: never list it in the Checklist, and it does not replace the close-out of rule 5.
8. FACTUAL PROSE — \`overview\`, \`next_steps\` and \`notes\` are a status snapshot, not a report: \`key = value\` for settings, one statement per fact, no logs, timings, method notes or tool inventories, and delete superseded text on every write. Keep the whole document under ~40 KB.
9. NEW OBJECTIVE while the tracked one is finished → write a brand-new document for the new task only (new title, fresh checklist and weights); never append the old one. Same objective → patch in place.
10. Trust the write result (percent, counts, warnings) instead of re-reading the document.

TEMPLATE (create with one call; weights are the item's share of the job)
session_progress_write({ content: {
  title: "<Goal Title>",
  overview: "<objective + current status>",
  status: "in_progress",
  current_activity: "<step running now>",
  checklist: [
    { text: "<step>", weight: 20 },
    { text: "<step>", weight: 30 },
    { text: "<step>", weight: 50, children: [ { text: "<sub-step>", weight: 1 }, { text: "<sub-step>", weight: 1, state: "running" } ] }
  ],
  next_steps: "<planned actions>",
  notes: "<decisions, chosen values, blockers — facts only>"
} })
`;

/** The prompt section. Kept as a function so a future per-deployment variant can vary it. */
export function progressPromptSection() {
  return PROGRESS_PROMPT_SECTION;
}

// ─────────────────────────────── HTTP payload builder ───────────────────────────────

/**
 * Everything the panel and the endpoints need about one stored document.
 * @param {object} record - the session's record (may be repointed by a migration).
 * @param {string} sessionId - effective session id.
 * @returns {object} the JSON payload (never throws).
 */
function describeRecord(record, sessionId) {
  let loaded;
  try {
    loaded = loadRecord(record, sessionId);
  } catch (e) {
    return { success: false, found: false, hasFile: false, enabled: !isSessionDisabled(sessionId), error: e?.message || String(e), sessionId, content: '', checklist: [] };
  }
  if (!loaded.exists) {
    return {
      success: true,
      found: false,
      hasFile: false,
      enabled: !isSessionDisabled(sessionId),
      sessionId,
      filePath: null,
      percent: 0,
      exactPercent: 0,
      status: 'starting',
      tasksTotal: 0,
      tasksDone: 0,
      tasksInProgress: 0,
      tasksPending: 0,
      checklist: [],
      content: '',
      message: 'No progress document found for session'
    };
  }
  if (loaded.error || !loaded.progress) {
    return {
      success: false,
      found: true,
      hasFile: true,
      enabled: !isSessionDisabled(sessionId),
      sessionId,
      filePath: record.filePath,
      error: loaded.error || 'the progress document could not be parsed',
      percent: 0,
      content: loaded.text,
      checklist: []
    };
  }

  let stat = { mtimeMs: record.lastUpdated || Date.now() };
  try {
    stat = fs.statSync(record.filePath);
  } catch (e) {}

  const progress = loaded.progress;
  const summary = computeProgress(progress);
  const derived = deriveStatus(progress, summary);
  const warnings = [...loaded.warnings];
  if (loaded.corrupted) warnings.push('the stored document fails validation; rewrite it with session_progress_write({ content: … }).');

  return {
    success: true,
    found: true,
    hasFile: true,
    enabled: !isSessionDisabled(sessionId),
    sessionId,
    filePath: record.filePath,
    fileName: path.basename(record.filePath),
    version: SCHEMA_VERSION,
    percent: summary.percent,
    exactPercent: summary.exactPercent,
    status: derived.status,
    currentActivity: progress.currentActivity || '',
    title: progress.title || '',
    overview: progress.overview || '',
    nextSteps: progress.nextSteps || '',
    notes: progress.notes || '',
    tasksTotal: summary.tasksTotal,
    tasksDone: summary.tasksDone,
    tasksInProgress: summary.tasksInProgress,
    tasksPending: summary.tasksPending,
    groups: summary.groups,
    checklist: summary.items,
    createdAt: progress.createdAt || 0,
    updatedAt: progress.updatedAt || 0,
    content: serializeProgress(progress),
    corrupted: loaded.corrupted,
    migrated: loaded.migrated,
    warnings,
    lastModified: stat.mtimeMs
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
          return progressPromptSection();
        }
      });
      ctx.logger?.info?.('dsh-session-progress registered systemPrompt section "session:progress"');
    } catch (e) {
      ctx.logger?.warn?.(`[dsh-session-progress] Failed to register systemPrompt section: ${e?.message || e}`);
    }
  });

  // 2. Register the progress tools (the ONLY supported way to read/replace the document)
  ctx.inject(['tools'], (toolCtx) => {
    try {
      toolCtx.tools.register(buildProgressReadTool());
      toolCtx.tools.register(buildProgressWriteTool());
      toolCtx.tools.register(buildProgressStatusTool());
      toolCtx.tools.register(buildProgressCheckDoneTool());
      ctx.logger?.info?.(
        `dsh-session-progress registered tools "${PROGRESS_READ_TOOL_NAME}", "${PROGRESS_WRITE_TOOL_NAME}", "${PROGRESS_STATUS_TOOL_NAME}" and "${PROGRESS_CHECK_DONE_TOOL_NAME}"`
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
      ctx.logger?.info?.(`[dsh-session-progress] todo tool policy active (deny "${TODO_TOOL_NAME}" while tracking)`);
    } catch (e) {
      ctx.logger?.warn?.(`[dsh-session-progress] Failed to attach todo tool policy: ${e?.message || e}`);
    }
  });

  // Handler for reading the progress document
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
      // Look the id up under every spelling it has had across harness versions (the
      // "session-" prefix), so a UI that names the session differently still finds its file.
      const hit = findSessionProgressByAnyId(qSessionId);
      if (hit) {
        record = hit.record;
        targetPath = hit.record.filePath;
        effectiveSessionId = hit.sessionId;
      } else {
        // No file yet: reserve the path for this spelling, which is what keeps the panel on
        // its empty state instead of confusing two sessions.
        record = getOrCreateSessionProgress(qSessionId);
        if (record?.filePath && fs.existsSync(record.filePath)) {
          targetPath = record.filePath;
          effectiveSessionId = record.sessionId || qSessionId;
        }
      }
    }

    if (targetPath && fs.existsSync(targetPath)) {
      try {
        return res.end(JSON.stringify(describeRecord(record ?? { filePath: targetPath, sessionId: effectiveSessionId }, effectiveSessionId)));
      } catch (err) {
        return res.end(
          JSON.stringify({
            success: false,
            found: false,
            hasFile: false,
            enabled: !isSessionDisabled(effectiveSessionId || qSessionId),
            error: `Failed to read the progress document: ${err?.message || err}`,
            sessionId: qSessionId,
            filePath: targetPath,
            percent: 0,
            content: ''
          })
        );
      }
    }

    return res.end(
      JSON.stringify({
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
        checklist: [],
        content: '',
        message: 'No progress document found for session'
      })
    );
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
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      let params = {};
      try {
        params = JSON.parse(body || '{}');
      } catch (e) {}
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
      return res.end(
        JSON.stringify({
          success: true,
          sessionId: qSessionId,
          enabled: isNowEnabled
        })
      );
    });
  };

  // Handler for opening the document in the OS editor
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
    req.on('data', (chunk) => {
      body += chunk;
    });
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
        return res.end(JSON.stringify({ success: true, filePath: targetPath }));
      }

      return res.end(JSON.stringify({ success: false, error: 'File path not found or does not exist on disk' }));
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
