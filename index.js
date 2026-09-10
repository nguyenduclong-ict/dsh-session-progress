import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';

export const name = 'dsh-session-progress';
export const inject = ['webServer'];

// Map: sessionId -> { filePath, uuid, sessionId, createdAt, lastUpdated }
const sessionProgressMap = new Map();

/**
 * Sanitize a string to be safely used as a filename component
 */
function sanitizeKey(str) {
  if (!str) return 'default';
  return String(str).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
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

  // Otherwise create a fresh file
  const fileUuid = randomUUID();
  const fileName = `dsh-progress-${safeId}-${fileUuid}.md`;
  const filePath = path.join(tmpDir, fileName);

  const initialContent = `# Session Progress
**Progress**: 0%

## Overview
Session started. Waiting for task initialization.

## Checklist
- [ ] Initialize task plan

## Current Activity
Idle / Preparing task execution.

## Next Steps
- Define milestones and begin task execution.
`;

  try {
    fs.writeFileSync(filePath, initialContent, 'utf-8');
  } catch (e) {}

  const record = {
    sessionId: sId,
    filePath,
    uuid: fileUuid,
    createdAt: Date.now(),
    lastUpdated: Date.now()
  };
  sessionProgressMap.set(sId, record);
  return record;
}

/**
 * Parse Markdown content to compute completion percentage and checklist summary
 */
export function parseProgress(content) {
  if (!content || typeof content !== 'string') {
    return {
      percent: 0,
      explicitPercent: null,
      checklistPercent: null,
      tasksTotal: 0,
      tasksDone: 0,
      tasksInProgress: 0,
      tasksPending: 0
    };
  }

  // 1. Explicit declaration extraction:
  // e.g. "**Progress**: 65%", "Progress: 65%", "Tiến độ: 65%", "> **Progress**: 65%"
  let explicitPercent = null;
  const explicitMatch = content.match(/(?:\*{1,2}|_)?(?:progress|tiến\s*độ)(?:\*{1,2}|_)?\s*[:=]\s*(\d{1,3})\s*%/i);
  if (explicitMatch && explicitMatch[1]) {
    const val = parseInt(explicitMatch[1], 10);
    if (!isNaN(val) && val >= 0 && val <= 100) {
      explicitPercent = val;
    }
  }

  // 2. Checklist parsing:
  // - [x] Done
  // - [/] or [-] In progress
  // - [ ] Pending
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

  // 3. Overall resolution
  let percent = 0;
  if (explicitPercent !== null) {
    percent = explicitPercent;
  } else if (checklistPercent !== null) {
    percent = checklistPercent;
  } else if (content.trim().length > 50) {
    // If no explicit % and no checklist, check for completion keywords
    if (/(?:all\s+tasks\s+completed|all\s+goals\s+achieved|hoàn\s+thành\s+toàn\s+bộ)/i.test(content)) {
      percent = 100;
    } else {
      percent = 0;
    }
  }

  return {
    percent,
    explicitPercent,
    checklistPercent,
    tasksTotal,
    tasksDone,
    tasksInProgress,
    tasksPending
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
          const record = getOrCreateSessionProgress(sessionId);

          return `
# LIVE SESSION PROGRESS TRACKING
You MUST maintain and continuously update a Markdown progress file for this session at:
\`${record.filePath}\`

## RULES & REQUIREMENTS:
1. Whenever you begin a new task, complete a subtask, change execution phases, or observe significant milestones, update this file using write or edit tools.
2. At the top of the file, specify the overall completion percentage using this exact syntax:
   **Progress**: <0-100>%
3. Maintain a structured checklist with standard Markdown checkboxes:
   - [x] Completed task description
   - [/] In-progress task description
   - [ ] Pending task description
4. Organize the document with the following clean sections:
   # Session Progress: <Goal / Task Title>
   **Progress**: <0-100>%

   ## Overview
   <Brief summary of session objective and current status>

   ## Checklist
   - [x] Completed milestone 1
   - [/] Current active subtask
   - [ ] Remaining subtask 1
   - [ ] Remaining subtask 2

   ## Current Activity
   <Details of the current action being executed>

   ## Next Steps
   <Immediate planned actions once the current activity finishes>

   ## Key Findings / Notes
   <Important insights, outputs, decisions, or blocker alerts>

Always keep this file concise, clear, and up-to-date so the user can follow live progress in real-time.
`;
        }
      });
      ctx.logger?.info?.('dsh-session-progress registered systemPrompt section "session:progress"');
    } catch (e) {
      ctx.logger?.warn?.(`[dsh-session-progress] Failed to register systemPrompt section: ${e?.message || e}`);
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

    const qSessionId = reqUrl.searchParams.get('sessionId') || 'default';
    const qFilePath = reqUrl.searchParams.get('filePath');

    let targetPath = qFilePath;
    let record = sessionProgressMap.get(qSessionId);

    if (!targetPath) {
      if (!record) {
        record = getOrCreateSessionProgress(qSessionId);
      }
      targetPath = record?.filePath;
    }

    if (!targetPath || !fs.existsSync(targetPath)) {
      record = getOrCreateSessionProgress(qSessionId);
      targetPath = record?.filePath;
    }

    if (targetPath && fs.existsSync(targetPath)) {
      try {
        const content = fs.readFileSync(targetPath, 'utf-8');
        const stat = fs.statSync(targetPath);
        const parsed = parseProgress(content);

        return res.end(JSON.stringify({
          success: true,
          found: true,
          sessionId: qSessionId,
          filePath: targetPath,
          fileName: path.basename(targetPath),
          percent: parsed.percent,
          explicitPercent: parsed.explicitPercent,
          checklistPercent: parsed.checklistPercent,
          tasksTotal: parsed.tasksTotal,
          tasksDone: parsed.tasksDone,
          tasksInProgress: parsed.tasksInProgress,
          tasksPending: parsed.tasksPending,
          content,
          lastModified: stat.mtimeMs
        }));
      } catch (err) {
        return res.end(JSON.stringify({
          success: false,
          found: false,
          error: `Failed to read progress file: ${err?.message || err}`,
          sessionId: qSessionId,
          filePath: targetPath,
          percent: 0,
          content: ''
        }));
      }
    }

    return res.end(JSON.stringify({
      success: false,
      found: false,
      sessionId: qSessionId,
      filePath: null,
      percent: 0,
      tasksTotal: 0,
      tasksDone: 0,
      tasksPending: 0,
      content: '',
      message: 'No progress file found for session'
    }));
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
  ctx.webServer.register({ kind: 'exact', path: '/api/session-progress/open', handler: handleOpen });

  // Backward compatibility alias routes
  ctx.webServer.register({ kind: 'exact', path: '/api/task-progress/content', handler: handleContent });
  ctx.webServer.register({ kind: 'exact', path: '/api/task-progress/open', handler: handleOpen });

  ctx.logger?.info?.('dsh-session-progress endpoints /api/session-progress/content and /api/session-progress/open ready');
}
