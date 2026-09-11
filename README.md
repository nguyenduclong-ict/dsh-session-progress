# dsh-session-progress

[English](README.md) | [Tiếng Việt](README.vn.md)

---

## 1. Purpose & Overview

<p align="center">
  <img src="assets/preview.png" alt="Session Progress Drawer Preview" width="800" />
</p>

<p align="center">
  <img src="assets/composer-button.png" alt="Composer Toolbar Progress Button & Tooltip Preview" width="800" />
</p>

**dsh-session-progress** is a real-time session progress and task tracking plugin for **DeepSeek Harness (DSH / DSH Desktop)**.

In long-running or complex agentic sessions, it is often challenging for users to quickly determine the overall completion status, active subtasks, or upcoming milestones without sifting through extensive conversation logs. 

**dsh-session-progress** solves this by:
- **System Prompt Injection**: Automatically injects prompt instructions that direct the AI Agent to maintain a structured Markdown progress file in the OS temporary directory (`os.tmpdir()`).
- **Structured YAML Frontmatter & Dual-Engine % Calculation**:
  - Automatically extracts progress percentage, execution status (`starting`, `in_progress`, `blocked`, `completed`), and the active step from the file's YAML frontmatter.
  - Automatically falls back to parsing standard Markdown task checklists (`- [x]`, `- [/]`, `- [ ]`) if frontmatter is omitted.
- **Adaptive Language Alignment**: Instructs the Agent to match the conversation language (e.g., Vietnamese, English) for all section headers, checklists, and task summaries while maintaining English YAML keys.
- **Single-Objective Rewrite on New Task**: The injected prompt states that one progress file tracks exactly ONE active objective. When a new request starts a different objective and the previous work is already finished (delivered, `100%`, `completed`, confirmed by the user, or simply abandoned), the Agent must **rewrite the whole file from scratch** for the new task instead of appending new checklist items under the old ones. Only a genuine refinement/continuation of the same objective updates the file in place.
- **Dedicated Whole-File Writer Tool (`session_progress_write`)**: The plugin registers a tool that always **replaces the entire progress file** — no anchor, no partial edit, no append — and refuses any document that repeats a level-1 title or a section heading, so a stale copy of the previous document can never survive underneath the new one. Every call returns the byte count, the parsed percentage, the checklist counts, and any warnings, so the Agent can verify the write without re-reading the file. This closes the failure mode where an anchored edit whose anchor covered only the YAML frontmatter left the whole previous document appended below the new one.
- **Verbatim Reader Tool (`session_progress_read`) + Withheld Path**: The Agent reads the document through a companion tool that returns the file **verbatim** together with the parsed percentage, status, checklist counts, section names, and a `corrupted` flag (a repeated title or section heading). The file's **path is no longer injected into the system prompt and is not returned by any tool** — so the model cannot address the file with a generic `read` / `write` / `edit` at all, which makes the duplication failure mode structurally impossible rather than merely forbidden. If the tool service is unavailable, the prompt automatically falls back to naming the path and demanding a whole-file write.
- **Composer Toolbar Live Button & Activity Tooltip**: Mounts directly into DSH's composer input toolbar (adjacent to the Model Selector & Context Meter), featuring a sleek circular SVG progress ring, real-time percentage badge, and an interactive popover showing the active task.
- **Per-Session Toggle Control & Interactive Popover**: Toggle progress tracking on or off for individual sessions via an interactive switch in the hover popover or side drawer. Disabling halts prompt injection to conserve context tokens and dims the toolbar button to `OFF`. Settings are persistently remembered across app restarts.
- **Hybrid Responsive Display (Split View & Modal Drawer)**: Dynamically adapts to your workspace layout:
  - **Large Screens (≥ 960px)**: Operates as a seamless side-by-side **Split View** (contracts the main workspace frame by 420px without dark backdrops), allowing full reading and interaction with session conversations and input composer while monitoring live progress.
  - **Compact Screens (< 960px)**: Automatically switches to a traditional **Slide-over Modal Drawer** with backdrop overlay to preserve compact workspace readability.
  - Quick action buttons to open the raw file in the OS default editor (VS Code, Notepad), trigger instant refresh, or close via `✕` / `Esc` / toolbar toggle.

---

## 2. Installation Guide

### For DSH Desktop

#### Windows (PowerShell)
```powershell
cd "$env:APPDATA\dsh-desktop\harness\profiles\web"
& "$env:APPDATA\dsh-desktop\harness\.desktop-bin\pnpm.cmd" add https://github.com/nguyenduclong-ict/dsh-session-progress
```

#### macOS (Terminal)
```bash
cd "$HOME/Library/Application Support/dsh-desktop/harness/profiles/web"
"$HOME/Library/Application Support/dsh-desktop/harness/.desktop-bin/pnpm" add https://github.com/nguyenduclong-ict/dsh-session-progress
```

#### Linux (Terminal)
```bash
cd "$HOME/.config/dsh-desktop/harness/profiles/web"
"$HOME/.config/dsh-desktop/harness/.desktop-bin/pnpm" add https://github.com/nguyenduclong-ict/dsh-session-progress
```

> **Note**: Restart **DSH Desktop** after installation to activate the plugin.

---

### For DSH CLI (Standalone)

Run the following command in your terminal:

```bash
dsh plugin --profile web add https://github.com/nguyenduclong-ict/dsh-session-progress
```

Or install directly within your Cordis workspace profile:

```bash
pnpm add https://github.com/nguyenduclong-ict/dsh-session-progress
```

---

## License

MIT © [nguyenduclong-ict](https://github.com/nguyenduclong-ict)
