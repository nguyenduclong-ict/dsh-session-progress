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

// Settings persistence for disabled sessions
const SETTINGS_FILE = path.join(os.homedir(), '.dsh-session-progress-settings.json');
const disabledSessions = new Set();

function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
      const data = JSON.parse(raw);
      if (Array.isArray(data?.disabledSessions)) {
        disabledSessions.clear();
        for (const sid of data.disabledSessions) {
          if (sid) disabledSessions.add(String(sid));
        }
      }
    }
  } catch (e) {
    console.warn('[dsh-session-progress] Failed to load settings:', e?.message || e);
  }
}

function saveSettings() {
  try {
    const data = {
      disabledSessions: Array.from(disabledSessions)
    };
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.warn('[dsh-session-progress] Failed to save settings:', e?.message || e);
  }
}

loadSettings();

export function isSessionDisabled(sessionId) {
  if (!sessionId) return false;
  return disabledSessions.has(String(sessionId));
}

export function setSessionDisabled(sessionId, disabled) {
  if (!sessionId) return;
  const sId = String(sessionId);
  if (disabled) {
    disabledSessions.add(sId);
  } else {
    disabledSessions.delete(sId);
  }
  saveSettings();
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
 * Locate or allocate a progress file for a given sessionId
 */
function getOrCreateSessionProgress(sessionId) {
  if (!sessionId) sessionId = 'default';
  const sId = String(sessionId);

  if (sessionProgressMap.has(sId)) {
    const entry = sessionProgressMap.get(sId);
    if (fs.existsSync(entry.filePath)) {
      return entry;
    }
  }

  // Check if a progress file already exists in os.tmpdir() for this session
  const safeId = sanitizeKey(sId);
  const tmpDir = os.tmpdir();
  try {
    const files = fs.readdirSync(tmpDir);
    const prefix = `dsh-progress-${safeId}-`;
    const matched = files.filter(f => f.startsWith(prefix) && f.endsWith('.md'));
    if (matched.length > 0) {
      // Find the most recently modified file
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
        const fileUuid = newest.slice(prefix.length, -3);
        const record = {
          sessionId: sId,
          filePath: newest,
          uuid: fileUuid,
          createdAt: Date.now(),
          lastUpdated: newestMtime
        };
        sessionProgressMap.set(sId, record);
        return record;
      }
    }
  } catch (e) {}


  // Allocate a designated file path (DO NOT create on disk until agent writes to it)
  const fileUuid = randomUUID();
  const fileName = `dsh-progress-${safeId}-${fileUuid}.md`;
  const filePath = path.join(tmpDir, fileName);

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

  for (const line of String(content ?? '').split(/\r?\n/)) {
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
      const key = raw.toLowerCase();
      sectionCounts.set(key, (sectionCounts.get(key) || 0) + 1);
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

  const hasFrontmatter = /^---\r?\n[\s\S]*?\r?\n---/.test(String(content ?? ''));
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

  return { errors, warnings, h1, sections };
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
    `Session progress replaced in full (${value.bytes} bytes written to ${value.filePath}).`,
    `${value.percent}% · ${value.status}${value.currentActivity ? ` · ${value.currentActivity}` : ''}.`,
    `${value.tasksTotal} checklist item(s): ${value.tasksDone} done, ${value.tasksInProgress} in progress, ${value.tasksPending} pending.`
  ];
  if (value.repaired) {
    parts.push('The previous file contained duplicated content and has now been replaced by this single clean document.');
  }
  if (Array.isArray(value.warnings) && value.warnings.length > 0) {
    parts.push(`Warnings: ${value.warnings.join(' ')}`);
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
      'Replace the ENTIRE session progress file with `content`. This tool always overwrites the whole document — there is no anchor, no partial edit, and no append, so it can never leave a stale or duplicated copy behind. ' +
      'Send the COMPLETE document on every call: YAML frontmatter (`progress`, `status`, `current_activity`) followed by the five canonical sections (Overview, Checklist, Current Activity, Next Steps, Key Findings / Notes), localized to the conversation language. ' +
      'Use this tool for every progress update instead of anchored edits. When the user starts a different objective and the previous one is finished, send a brand-new document for the new task only.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['content'],
      properties: {
        content: {
          type: 'string',
          description:
            'The COMPLETE progress document in Markdown: YAML frontmatter followed by the five canonical sections. This value fully replaces the file.'
        }
      }
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        required: [
          'filePath',
          'bytes',
          'replaced',
          'repaired',
          'percent',
          'status',
          'tasksTotal',
          'tasksDone',
          'tasksInProgress',
          'tasksPending',
          'sections',
          'warnings'
        ],
        properties: {
          filePath: { type: 'string' },
          bytes: { type: 'integer' },
          replaced: { type: 'boolean' },
          repaired: { type: 'boolean' },
          percent: { type: 'integer' },
          status: { type: 'string' },
          currentActivity: { type: 'string' },
          tasksTotal: { type: 'integer' },
          tasksDone: { type: 'integer' },
          tasksInProgress: { type: 'integer' },
          tasksPending: { type: 'integer' },
          sections: { type: 'array', items: { type: 'string' } },
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
        filePath: record.filePath,
        bytes: Buffer.byteLength(content, 'utf-8'),
        replaced: previous.length > 0,
        repaired: previousWasCorrupted,
        percent: parsed.percent,
        status: parsed.status,
        ...(parsed.currentActivity ? { currentActivity: parsed.currentActivity } : {}),
        tasksTotal: parsed.tasksTotal,
        tasksDone: parsed.tasksDone,
        tasksInProgress: parsed.tasksInProgress,
        tasksPending: parsed.tasksPending,
        sections: lint.sections,
        warnings
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

export function apply(ctx) {
  ctx.logger?.info?.('dsh-session-progress plugin loading...');

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
          const record = getOrCreateSessionProgress(sessionId);

          return `
# LIVE SESSION PROGRESS TRACKING
You MUST maintain and continuously update a Markdown progress file for this session at:
\`${record.filePath}\`

## RULES & SPECIFICATIONS:
1. YAML FRONTMATTER (REQUIRED):
   Always keep YAML frontmatter at the very top of the file enclosed by \`---\`.
   Specify:
   - \`progress\`: integer or percentage string (e.g. \`65%\`)
   - \`status\`: \`starting\` | \`in_progress\` | \`blocked\` | \`completed\`
   - \`current_activity\`: short one-line description of the active step
   Keep the YAML frontmatter keys strictly in English.

2. LANGUAGE ALIGNMENT (AUTOMATIC DETECTION):
   Automatically detect the primary language of the conversation (e.g. Vietnamese, English, Chinese, etc.).
   Adapt all section headings, checklists, task summaries, and narrative content to match that language naturally.
   Keep the YAML frontmatter keys strictly in English.

3. STRUCTURED CHECKLIST:
   Maintain milestones and subtasks using standard Markdown checkboxes:
   - \`- [x]\` Completed milestone
   - \`- [/]\` Current in-progress milestone
   - \`- [ ]\` Pending milestone

4. ZERO-STEP MANDATE & REAL-TIME UPDATES (STRICT & CRITICAL):
   - FIRST TOOL CALL MANDATE: Whenever the user assigns a new task or follow-up instruction, your VERY FIRST ACTION / TOOL CALL (before reading code, searching files, or executing terminal commands) MUST be updating this progress file (through the \`session_progress_write\` tool — see rule 7).
   - 100% RESET TRIGGER: If the current progress is 100% or marked as completed from a prior task, you MUST IMMEDIATELY reset \`progress: 0%\` (or \`5%\`), set \`status: in_progress\`, update \`current_activity\` to describe the new task, and refresh the checklist with the new plan (see rule 5 for the required full rewrite).
   - WHY THIS IS MANDATORY: The user is actively monitoring the live progress bar on the UI. Delaying the progress update while investigating code or running commands makes the system appear frozen, stalled, or stuck at 100%.
   - Keep this file continuously updated as subtasks complete or new steps emerge throughout the session.

5. NEW TASK = FULL REWRITE, NEVER ACCUMULATE (STRICT & CRITICAL):
   - ONE OBJECTIVE PER FILE: This file tracks exactly ONE active objective at a time. It is NOT a session-wide log of everything done in the session.
   - DETECT A NEW TASK: The user's message starts a NEW task when it targets a DIFFERENT objective than the one this file currently tracks (different problem, different feature, unrelated request), OR when the previously tracked objective is already finished. An objective counts as FINISHED when ANY of these is true: it has been delivered/completed, its \`progress\` is \`100%\`, its \`status\` is \`completed\`, the user confirms it is done, or the user moves on to an unrelated request without asking for more work on it.
   - REQUIRED ACTION — REWRITE THE WHOLE FILE: In that situation you MUST discard the old document and WRITE THIS FILE FROM SCRATCH for the new task, in that same first tool call. The old title, the old frontmatter (\`progress\`, \`status\`, \`current_activity\`), the old \`Overview\`, the old \`Checklist\`, and the old \`Current Activity\` are ALL REPLACED — not merged, not appended. The new document starts with the new goal title, \`progress: 0%\` (or \`5%\`), \`status: in_progress\`, a new one-line \`current_activity\` describing the new task, and a brand-new checklist built only from the new task.
   - STRICTLY FORBIDDEN: Keeping the previous task's checklist and merely "adding a few items" for the new task; ticking old items to fake continuity; carrying the old percentage into the new task; tracking two objectives or two checklists in one file; leaving the old content in place and only appending a new section at the bottom.
   - CONTINUATION IS THE ONLY EXCEPTION: If the message refines, extends, corrects, or continues the SAME objective already tracked in this file, keep the existing document and update it in place (tick finished milestones, add new subtasks, adjust \`progress\`, refresh \`current_activity\`).
   - PRESERVE ONLY WHAT MATTERS: If something from the previous task is still relevant (a constraint, a decision, a file path, an unfinished side effect), compress it into ONE short line under \`Key Findings / Notes\`; never keep its checklist. If the user abandons an unfinished task and starts another, do not silently carry its percentage: give the new task its own percentage and record the abandoned task in one line under \`Key Findings / Notes\` (e.g. "Tác vụ trước bị bỏ dở: ...").
   - SELF-CHECK BEFORE WRITING: Ask yourself "Is this the same objective this file already tracks?" If NO, the write MUST be a complete replacement of the file content, never an edit that adds to it.

6. STRICT 5-SECTION STRUCTURE & NO DUPLICATION (MANDATORY):
   The document body MUST contain ONLY the 5 canonical H2 sections in exact order:
   - Overview
   - Checklist
   - Current Activity
   - Next Steps
   - Key Findings / Notes
   (Translate section titles naturally if communicating in another language, e.g. Vietnamese: Tổng quan, Checklist, Hoạt động hiện tại, Các bước tiếp theo, Ghi chú quan trọng).

   STRICT NEGATIVE CONSTRAINTS:
   - NEVER create extra H1 (#) or H2 (##) headings. Do NOT invent custom sections like "## COMPARISON...", "## BEST CONFIG...", or "## EVIDENCE...".
   - NEVER duplicate sections or keep stale history (e.g. NEVER write "## Current Activity (Old)").
   - ALL findings, ablation results, comparison tables, metrics, and investigation notes MUST be placed under "## Key Findings / Notes" using H3 (###) or tables.
   - Always overwrite the file cleanly to reflect the latest state; do not let the document grow into an unorganized scratchpad.

7. WRITE THROUGH THE \`session_progress_write\` TOOL (STRICT & CRITICAL):
   - ALWAYS USE THE TOOL: every create, refresh, or rewrite of this file MUST go through the \`session_progress_write\` tool, passing the COMPLETE document in its \`content\` argument. That tool has no anchor — it atomically replaces the whole file, so a stale copy can never survive underneath.
   - NEVER USE AN ANCHORED EDIT ON THIS FILE: do NOT call \`edit\` / str-replace on the progress file, and NEVER pass a whole new document as the replacement for a short anchor such as the YAML frontmatter. That replaces only the anchored fragment and leaves the previous document's title and body in place, leaving the file with TWO concatenated documents.
   - FALLBACK: if \`session_progress_write\` is unavailable in this session, use the whole-file \`write\` tool (create or fully replace) with the complete document — still never an anchored edit.
   - IF THE FILE IS ALREADY CORRUPTED: if the file holds more than one level-1 title or any section heading appears twice, it is corrupted. Keep only the most recent/complete document and immediately call \`session_progress_write\` with that single clean document.
   - DOUBLED DOCUMENTS ARE REJECTED: a call that repeats a level-1 title or any section heading is refused with an explanation and nothing is written — correct the document and call again.
   - VERIFY FROM THE RESULT: the tool answers with the byte count, the parsed percentage, the checklist counts, and any warnings. Rely on that result instead of re-reading the file.

## TEMPLATE:
---
progress: 65%
status: in_progress
current_activity: "Running test suites"
---

# Session Progress: <Goal Title>

## Overview
<Brief summary of session objective and current status>

## Checklist
- [x] Step 1 completed
- [/] Step 2 currently executing
- [ ] Step 3 pending

## Current Activity
<Details of what is currently executing>

## Next Steps
<Planned immediate actions>

## Key Findings / Notes
<Important takeaways, metrics, tables, or blocker alerts. All detailed findings MUST be placed here as subsections or tables.>

`;
        }
      });
      ctx.logger?.info?.('dsh-session-progress registered systemPrompt section "session:progress"');
    } catch (e) {
      ctx.logger?.warn?.(`[dsh-session-progress] Failed to register systemPrompt section: ${e?.message || e}`);
    }
  });

  // 2. Register the whole-file progress writer tool
  ctx.inject(['tools'], (toolCtx) => {
    try {
      toolCtx.tools.register(buildProgressWriteTool());
      ctx.logger?.info?.(`dsh-session-progress registered tool "${PROGRESS_WRITE_TOOL_NAME}"`);
    } catch (e) {
      ctx.logger?.warn?.(`[dsh-session-progress] Failed to register tool "${PROGRESS_WRITE_TOOL_NAME}": ${e?.message || e}`);
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
        targetEnabled = isSessionDisabled(qSessionId); // toggle
      }
      setSessionDisabled(qSessionId, !targetEnabled);
      const isNowEnabled = !isSessionDisabled(qSessionId);
      ctx.logger?.info?.(`[dsh-session-progress] Session ${qSessionId} progress enabled set to ${isNowEnabled}`);
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
