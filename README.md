# dsh-session-progress

[English](README.md) | [Tiếng Việt](README.vn.md)

---

## 1. Tools

The plugin gives the Agent two tools for its session progress file — a Markdown document kept in the OS temp directory while it works. The injected prompt requires every create, refresh, and rewrite to go through these tools.

### `session_progress_write`

Replaces the **entire** progress document with `content`.

- `content` (required, string) — the **complete** Markdown document: YAML frontmatter (`progress`, `status`, `current_activity`) followed by the five canonical sections (Overview, Checklist, Current Activity, Next Steps, Key Findings / Notes), written in the conversation's language.
- No anchor, no partial edit, no append: the whole file is replaced **atomically** (temp file + rename), so a stale copy can never survive underneath and a reader never sees a half-written document.
- The document is **refused** (nothing is written) when it repeats a level-1 title or repeats any `##` section heading — the exact shape of a duplicated/concatenated document.
- Soft **warnings** (the write still succeeds) cover a missing frontmatter block or missing keys, a missing level-1 title, fewer than five sections, and a frontmatter percentage far from the checklist-derived value.
- **Result** — `fileName`, `bytes`, `replaced`, `repaired` (the previous file was duplicated and has now been replaced), `percent`, `status`, `currentActivity`, the checklist counts, the detected section names, and `warnings`.

### `session_progress_read`

Returns the current document **verbatim**.

- No arguments. Returns `content` plus `exists`, `fileName`, `bytes`, `percent`, `status`, `currentActivity`, the checklist counts, `sections`, `warnings`, and `corrupted`.
- `corrupted: true` means the file repeats a level-1 title or a section heading; the result then tells the Agent to rewrite it with `session_progress_write` using the single most complete document.
- When no file exists yet it answers `exists: false` instead of erroring, and never creates one as a side effect.

### Why the file path is withheld

Neither tool returns the file path and the injected prompt never names it, so the Agent has no handle for a generic `read` / `write` / `edit` on the progress file — the failure mode where a partial anchored edit left two concatenated documents becomes structurally impossible instead of merely forbidden. The path stays visible in the plugin's UI drawer, which can also open the file in your editor. If the tool service is unavailable, the prompt falls back to naming the path and demanding a whole-file write.

---

## 2. Installation

### DSH Desktop

**Windows (PowerShell)**
```powershell
cd "$env:APPDATA\dsh-desktop\harness\profiles\web"
& "$env:APPDATA\dsh-desktop\harness\.desktop-bin\pnpm.cmd" add https://github.com/nguyenduclong-ict/dsh-session-progress
```

**macOS (Terminal)**
```bash
cd "$HOME/Library/Application Support/dsh-desktop/harness/profiles/web"
"$HOME/Library/Application Support/dsh-desktop/harness/.desktop-bin/pnpm" add https://github.com/nguyenduclong-ict/dsh-session-progress
```

**Linux (Terminal)**
```bash
cd "$HOME/.config/dsh-desktop/harness/profiles/web"
"$HOME/.config/dsh-desktop/harness/.desktop-bin/pnpm" add https://github.com/nguyenduclong-ict/dsh-session-progress
```

> **Note**: restart **DSH Desktop** after installation to activate the plugin.

### DSH CLI

```bash
dsh plugin --profile web add https://github.com/nguyenduclong-ict/dsh-session-progress
```

Or install directly inside your Cordis workspace profile:

```bash
pnpm add https://github.com/nguyenduclong-ict/dsh-session-progress
```

---

## License

MIT © [nguyenduclong-ict](https://github.com/nguyenduclong-ict)
