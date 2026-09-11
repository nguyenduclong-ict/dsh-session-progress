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

## RULES & SPECIFICATIONS:
1. YAML FRONTMATTER (REQUIRED):
   Always keep YAML frontmatter at the very top of the file enclosed by \`---\`.
   Specify:
   - \`progress\`: integer or percentage string (e.g. \`65%\`)
   - \`status\`: \`starting\` | \`in_progress\` | \`blocked\` | \`completed\`
   - \`current_activity\`: short one-line description of the active step
   Keep the YAML frontmatter keys strictly in English.

2. LANGUAGE ALIGNMENT:
   Match the primary language of the conversation!
   - If the user communicates in Vietnamese, write all section headings (Tổng quan, Checklist, Hoạt động hiện tại, Các bước tiếp theo, Ghi chú quan trọng), task descriptions, and narrative text in Vietnamese.
   - If the user communicates in English, write them in English.

3. STRUCTURED CHECKLIST:
   Maintain milestones and subtasks using standard Markdown checkboxes:
   - \`- [x]\` Completed milestone
   - \`- [/]\` Current in-progress milestone
   - \`- [ ]\` Pending milestone

4. ZERO-STEP MANDATE & REAL-TIME UPDATES (STRICT & CRITICAL):
   - FIRST TOOL CALL MANDATE: Whenever the user assigns a new task or follow-up instruction, your VERY FIRST ACTION / TOOL CALL (before reading code, searching files, or executing terminal commands) MUST be updating this progress file.
   - 100% RESET TRIGGER: If the current progress is 100% or marked as completed from a prior task, you MUST IMMEDIATELY reset \`progress: 0%\` (or \`5%\`), set \`status: in_progress\`, update \`current_activity\` to describe the new task, and refresh the checklist with the new plan.
   - WHY THIS IS MANDATORY: The user is actively monitoring the live progress bar on the UI. Delaying the progress update while investigating code or running commands makes the system appear frozen, stalled, or stuck at 100%.
   - Keep this file continuously updated as subtasks complete or new steps emerge throughout the session.

## TEMPLATE (ENGLISH):
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
<Important takeaways, metrics, or blocker alerts>

## TEMPLATE (VIETNAMESE):
---
progress: 65%
status: in_progress
current_activity: "Đang chạy bộ kiểm thử"
---

# Tiến độ phiên làm việc: <Tiêu đề mục tiêu>

## Tổng quan
<Tóm tắt ngắn gọn mục tiêu phiên làm việc và trạng thái hiện tại>

## Checklist
- [x] Bước 1 đã hoàn thành
- [/] Bước 2 đang xử lý
- [ ] Bước 3 đang chờ

## Hoạt động hiện tại
<Chi tiết công việc đang thực thi ngay lúc này>

## Các bước tiếp theo
<Các công việc dự kiến tiếp theo>

## Ghi chú quan trọng
<Các phát hiện, kết quả hoặc cảnh báo quan trọng>

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
          hasFile: true,
          sessionId: qSessionId,
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
      hasFile: false,
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
