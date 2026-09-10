# dsh-session-progress

> **Session Progress Tracker for DeepSeek Harness (DSH)**

`dsh-session-progress` is a DSH plugin that enables real-time progress tracking for sessions. It instructs the AI Agent to maintain a parallel Markdown progress file with structured YAML frontmatter in the system's temporary directory (`os.tmpdir()`), automatically calculates completion percentages (`%`), mounts a live progress button onto the Top Header, and renders an interactive **Slide-over Side Drawer** for instant status inspection.

---

## Features

- **System Prompt Injection with Language Alignment**:
  - Injects instructions into `ctx.systemPrompt` directing the agent to maintain a live markdown file with milestones, checklists, and YAML frontmatter at `dsh-progress-${sessionId}-${uuid}.md` in `os.tmpdir()`.
  - **Adaptive Language Support**: Prompts the Agent to write headings, descriptions, and checklists in Vietnamese when the user chats in Vietnamese, or English when chatting in English, while keeping machine-readable YAML keys strictly in English.
- **YAML Frontmatter & Dual-Engine Progress Calculation**:
  - **YAML Frontmatter Engine (Highest Priority)**: Parses structured metadata at the top of the file:
    ```yaml
    ---
    progress: 65%
    status: in_progress
    current_activity: "Running backtest wave 3"
    ---
    ```
  - **Checklist Engine (Automatic Fallback)**: Calculates completion percentage based on checklist items (`- [x]`, `- [/]`, `- [ ]`).
- **Top Header Live Button**:
  - Registered directly into DSH's native slot `conversation.session.header.utilities` (ordered before `Session log`).
  - Displays `📋 Progress XX%` with an animated pill badge (green when 100% completed).
  - Includes automated DOM observer fallback.
- **Slide-over Side Drawer (Right Panel)**:
  - 440px wide sliding drawer smoothly transitioning from the right edge.
  - Header with title, live status badge (`IN PROGRESS`, `COMPLETED`, `PAUSED`), and active step banner (`⚡ <current_activity>`).
  - Graphical gradient progress bar (`#3b82f6` -> `#10b981`).
  - Lightweight built-in Markdown renderer with custom styling for headers, blockquotes, code snippets, and checklists (cleanly stripping raw frontmatter from the visible body).
  - Quick action toolbar:
    - **Open File**: Opens the raw Markdown progress file directly in the OS default editor (VS Code, Notepad, etc.).
    - **Copy**: Copies the raw Markdown to the clipboard.
    - **Refresh**: Manually triggers an immediate synchronization.
    - **Close / Escape**: Quickly dismisses the drawer.
- **Live Auto-polling**: Real-time updates every 1.5s when the drawer is open, and 3s when closed.

---

## Markdown File Structure

```markdown
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
```

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
Returns JSON with the parsed progress, frontmatter metadata, and raw markdown content:
```json
{
  "success": true,
  "found": true,
  "sessionId": "session-1234",
  "filePath": "/tmp/dsh-progress-session-1234-uuid.md",
  "fileName": "dsh-progress-session-1234-uuid.md",
  "percent": 65,
  "status": "in_progress",
  "currentActivity": "Running test suites",
  "tasksTotal": 10,
  "tasksDone": 6,
  "tasksInProgress": 1,
  "tasksPending": 3,
  "content": "---\nprogress: 65%\n...",
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

---

## License

MIT © [nguyenduclong-ict](https://github.com/nguyenduclong-ict)
