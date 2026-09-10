# dsh-session-progress

> **Session Progress Tracker for DeepSeek Harness (DSH)**

`dsh-session-progress` is a DSH plugin that enables real-time progress tracking for sessions. It instructs the AI Agent to maintain a parallel Markdown progress file in the system's temporary directory (`os.tmpdir()`), automatically calculates completion percentages (`%`), mounts a live progress button onto the Top Header, and renders an interactive **Slide-over Side Drawer** for instant status inspection.

---

## Features

- **System Prompt Injection**: Injects instructions into `ctx.systemPrompt` directing the agent to maintain a live markdown file with milestones, checklists, and percentages at `dsh-progress-${sessionId}-${uuid}.md` in `os.tmpdir()`.
- **Dual-Engine Progress Calculation**:
  - **Explicit Engine**: Detects explicit percentage declarations (e.g. `**Progress**: 75%`, `Progress: 75%`, `Tiến độ: 75%`).
  - **Checklist Engine**: Calculates completion percentage based on checklist items (`- [x]`, `- [/]`, `- [ ]`).
- **Top Header Live Button**:
  - Registered directly into DSH's native slot `conversation.session.header.utilities` (ordered before `Session log`).
  - Displays `📋 Progress XX%` with an animated pill badge (green when 100% completed).
  - Includes automated DOM observer fallback.
- **Slide-over Side Drawer (Right Panel)**:
  - 440px wide sliding drawer smoothly transitioning from the right edge.
  - Graphical gradient progress bar (`#3b82f6` -> `#10b981`).
  - Lightweight built-in Markdown renderer with custom styling for headers, blockquotes, code snippets, and checklists.
  - Quick action toolbar:
    - **Open File**: Opens the raw Markdown progress file directly in the OS default editor (VS Code, Notepad, etc.).
    - **Copy**: Copies the raw Markdown to the clipboard.
    - **Refresh**: Manually triggers an immediate synchronization.
    - **Close / Escape**: Quickly dismisses the drawer.
- **Live Auto-polling**: Real-time updates every 1.5s when the drawer is open, and 3s when closed.

---

## Installation & Registration

### 1. Register in `cordis.patch.yml`

```yaml
- insert:
    - id: dsh-session-progress
      name: dsh-session-progress
```

### 2. Client Injection

In `package.json`:
```json
{
  "dsh": {
    "bundle": {
      "patch": "./cordis.patch.yml"
    },
    "client": {
      "inject": [
        "@deepseek-ai/dsh-client-ui-primitives",
        "@deepseek-ai/dsh-client-ui-slots"
      ],
      "immediately": true,
      "platform": "web"
    }
  }
}
```

---

## API Endpoints

### `GET /api/session-progress/content?sessionId=<id>`
Returns JSON with the parsed progress and raw markdown content:
```json
{
  "success": true,
  "found": true,
  "sessionId": "session-1234",
  "filePath": "/tmp/dsh-progress-session-1234-uuid.md",
  "fileName": "dsh-progress-session-1234-uuid.md",
  "percent": 65,
  "tasksTotal": 10,
  "tasksDone": 6,
  "tasksInProgress": 1,
  "tasksPending": 3,
  "content": "# Session Progress\n**Progress**: 65%\n...",
  "lastModified": 1726000000000
}
```

### `POST /api/session-progress/open`
Opens the progress file on the host OS:
```json
{
  "sessionId": "session-1234",
  "filePath": "C:\\Users\\...\\dsh-progress-...md"
}
```

*(Note: `/api/task-progress/*` endpoints are also supported as backward-compatible aliases)*

---

## License

MIT © [nguyenduclong-ict](https://github.com/nguyenduclong-ict)
