window.__ModuleLoader__.load({
  id: 'dsh-session-progress',
  factory: (require) => {
    const module = { exports: {} };
    const exports = module.exports;

    console.log('[dsh-session-progress] client factory loaded!');

    const React = require('react');

    const STYLE_ID = 'dsh-session-progress-style';

    /**
     * Identity of this plugin inside DSH's right Sidebar tab system.
     *
     * The right sidebar is a dock of typed tabs. `TAB_ID` is the identity our body
     * and chip title register under (the registry's `id`, and the `key` of the two
     * keyed seats we fill); `TAB_KIND` is the page kind `ctx.sidebarRight.openTab()`
     * is asked for. The shipped Files and Document-preview tabs work exactly this
     * way, so the panel is a real sidebar tab — draggable, floatable, splittable —
     * instead of a hand-rolled fixed-position drawing surface.
     */
    const TAB_ID = '@nguyenduclong-ict/dsh-session-progress';
    const TAB_KIND = 'session-progress';
    const TAB_TITLE = 'Session Progress';

    const RING_CIRCUMFERENCE = 34.56;

    function ensureStyles() {
      if (document.getElementById(STYLE_ID)) return;
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = `
        /* --- Composer Trailing Toolbar Progress Button --- */
        .dsh-session-progress-button {
          position: relative;
          height: 28px;
          border: none;
          border-radius: 999px;
          background: transparent;
          color: var(--dsw-alias-label-secondary, #a1a1aa);
          font-family: var(--dsw-font-family, system-ui, sans-serif);
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 0 8px;
          font-size: 12px;
          font-weight: 600;
          line-height: 20px;
          user-select: none;
          flex: none;
          transition: all 0.15s ease;
          outline: none;
        }

        .dsh-session-progress-button:hover {
          background: var(--dsw-alias-interactive-bg-hover, rgba(255, 255, 255, 0.08));
          color: var(--dsw-alias-label-primary, #ffffff);
        }

        .dsh-session-progress-button:active {
          transform: scale(0.96);
        }

        .dsh-session-progress-button.disabled {
          opacity: 0.42;
          color: var(--dsw-alias-label-tertiary, #71717a);
          filter: grayscale(0.8);
        }

        .dsh-session-progress-button.disabled:hover {
          opacity: 0.78;
          filter: grayscale(0.3);
          background: var(--dsw-alias-interactive-bg-hover, rgba(255, 255, 255, 0.08));
        }

        .dsh-session-progress-button.disabled .dsh-progress-pill {
          color: var(--dsw-alias-label-tertiary, #71717a);
        }

        .dsh-session-progress-button.icon-only {
          padding: 0;
          width: 28px;
          justify-content: center;
        }

        .dsh-session-progress-button.icon-only .dsh-progress-pill {
          display: none;
        }

        /* SVG Circular Progress Ring */
        .dsh-progress-ring {
          flex: none;
          display: block;
        }

        .dsh-progress-ring-track {
          fill: none;
          stroke: var(--dsw-alias-border-l4, rgba(255, 255, 255, 0.15));
          stroke-width: 2;
        }

        .dsh-progress-ring-fill {
          fill: none;
          stroke: #60a5fa;
          stroke-width: 2;
          stroke-linecap: round;
          transform-origin: 7px 7px;
          transform: rotate(-90deg);
          transition: stroke-dashoffset 0.35s ease, stroke 0.35s ease;
        }

        .dsh-progress-ring-fill.done {
          stroke: #4ade80;
        }

        .dsh-progress-pill {
          font-size: 12px;
          font-weight: 600;
          color: #60a5fa;
          line-height: 1;
          transition: all 0.3s ease;
        }

        .dsh-progress-pill.done {
          color: #4ade80;
        }

        /* Floating Hover Tooltip / Popover for Progress Button */
        .dsh-progress-tooltip {
          position: absolute;
          bottom: calc(100% + 8px);
          right: 0;
          background: rgba(24, 24, 28, 0.96);
          backdrop-filter: blur(14px);
          border: 1px solid var(--dsw-alias-border-l2, rgba(255, 255, 255, 0.16));
          border-radius: 8px;
          padding: 9px 12px;
          width: 240px;
          max-width: 320px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.65);
          pointer-events: auto; /* Allow mouse interaction inside popover */
          opacity: 0;
          visibility: hidden;
          transform: translateY(4px);
          transition: opacity 0.18s cubic-bezier(0.16, 1, 0.3, 1),
                      transform 0.18s cubic-bezier(0.16, 1, 0.3, 1),
                      visibility 0.18s;
          z-index: 1001;
          text-align: left;
          cursor: default;
        }

        /* Invisible bridge area connecting button and popover so mouse moving into popover is not lost */
        .dsh-progress-tooltip::before {
          content: '';
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          height: 14px;
          background: transparent;
        }

        .dsh-progress-tooltip::after {
          content: '';
          position: absolute;
          bottom: -5px;
          right: 18px;
          width: 8px;
          height: 8px;
          background: rgba(24, 24, 28, 0.96);
          border-right: 1px solid var(--dsw-alias-border-l2, rgba(255, 255, 255, 0.16));
          border-bottom: 1px solid var(--dsw-alias-border-l2, rgba(255, 255, 255, 0.16));
          transform: rotate(45deg);
        }

        .dsh-session-progress-button:hover .dsh-progress-tooltip,
        .dsh-progress-tooltip:hover {
          opacity: 1;
          visibility: visible;
          transform: translateY(0);
        }

        .dsh-progress-tooltip-header {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 4px;
        }

        .dsh-progress-tooltip-badge {
          font-size: 10px;
          font-weight: 700;
          padding: 1px 5px;
          border-radius: 4px;
          background: rgba(59, 130, 246, 0.2);
          color: #60a5fa;
          line-height: 1.2;
        }

        .dsh-progress-tooltip-badge.done {
          background: rgba(34, 197, 94, 0.2);
          color: #4ade80;
        }

        .dsh-progress-tooltip-badge.disabled {
          background: rgba(113, 113, 122, 0.25);
          color: #a1a1aa;
        }

        .dsh-progress-tooltip-title {
          font-size: 11px;
          font-weight: 600;
          color: var(--dsw-alias-label-primary, #ffffff);
          letter-spacing: 0.2px;
        }

        .dsh-progress-tooltip-body {
          font-size: 11.5px;
          line-height: 1.45;
          color: var(--dsw-alias-label-secondary, #d4d4d8);
          word-break: break-word;
        }

        .dsh-progress-tooltip-hint {
          font-size: 10.5px;
          color: var(--dsw-alias-label-tertiary, #71717a);
          cursor: pointer;
          transition: color 0.15s ease;
        }

        .dsh-progress-tooltip-hint:hover {
          color: #60a5fa;
        }

        /* Tooltip Toggle Switch Row */
        .dsh-tooltip-toggle-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          padding-top: 8px;
          margin-top: 8px;
          border-top: 1px solid var(--dsw-alias-border-l1, rgba(255, 255, 255, 0.12));
        }

        .dsh-tooltip-toggle-label {
          font-size: 11px;
          font-weight: 500;
          color: var(--dsw-alias-label-secondary, #a1a1aa);
          display: flex;
          align-items: center;
          gap: 5px;
          user-select: none;
        }

        .dsh-toggle-switch {
          position: relative;
          width: 32px;
          height: 18px;
          background: rgba(255, 255, 255, 0.16);
          border-radius: 999px;
          cursor: pointer;
          transition: background 0.2s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.2s ease;
          flex: none;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .dsh-toggle-switch:hover {
          background: rgba(255, 255, 255, 0.24);
        }

        .dsh-toggle-switch.active {
          background: #3b82f6;
          border-color: #2563eb;
        }

        .dsh-toggle-switch.active:hover {
          background: #60a5fa;
        }

        .dsh-toggle-switch::after {
          content: '';
          position: absolute;
          top: 2px;
          left: 2px;
          width: 12px;
          height: 12px;
          background: #ffffff;
          border-radius: 50%;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
          transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .dsh-toggle-switch.active::after {
          transform: translateX(14px);
        }

        /* ============================================================
           Right Sidebar tab (native slot: sidebar.right.pane.tab)
           Panel fills the dock surface: header / scrolling body / footer.
           ============================================================ */
        .dsh-sp-panel {
          /* Mirror the shipped tab bodies (see the Files tab root): the dock wraps
             bodies in a box whose height is definite but which is NOT always a flex
             container, so flex alone lets the panel grow to its content height and
             the header/footer scroll away with the body. height:100% pins the panel
             to the pane, and flex:auto still fills a flex parent. */
          flex: auto;
          height: 100%;
          box-sizing: border-box;
          min-width: 0;
          min-height: 0;
          display: flex;
          flex-direction: column;
          font-family: var(--dsw-font-family, system-ui, sans-serif);
          color: var(--dsw-alias-label-primary, #f4f4f5);
          background: transparent;
          overflow: hidden;
        }

        /* --- Tab chip title (sidebar.right.pane.tab.title) --- */
        .dsh-sp-title {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          min-width: 0;
        }

        .dsh-sp-title-text {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        /* --- Panel header --- */
        .dsh-sp-head {
          flex: none;
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 12px 14px;
          border-bottom: 1px solid var(--dsw-alias-border-l1, rgba(255, 255, 255, 0.1));
          background: var(--dsw-alias-bg-floating, #18181b);
        }

        .dsh-sp-detail {
          font-size: 12px;
          color: var(--dsw-alias-label-secondary, #a1a1aa);
        }

        .dsh-progress-track {
          width: 100%;
          height: 6px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 3px;
          overflow: hidden;
        }

        .dsh-progress-fill {
          height: 100%;
          width: 0%;
          background: linear-gradient(90deg, #3b82f6, #10b981);
          border-radius: 3px;
          transition: width 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .dsh-progress-fill.done {
          background: #22c55e;
        }

        .dsh-sp-activity {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          color: #93c5fd;
          min-width: 0;
        }

        .dsh-sp-activity-icon {
          font-size: 12px;
          color: #fbbf24;
          flex-shrink: 0;
        }

        .dsh-sp-activity-text {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        /* --- Panel buttons --- */
        .dsh-sp-btn {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid var(--dsw-alias-border-l4, rgba(255, 255, 255, 0.15));
          color: var(--dsw-alias-label-secondary, #a1a1aa);
          border-radius: 6px;
          padding: 4px 8px;
          font-size: 12px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          transition: all 0.15s ease;
          user-select: none;
          line-height: 1.2;
          flex: none;
        }

        .dsh-sp-btn:hover {
          color: var(--dsw-alias-label-primary, #ffffff);
          border-color: var(--dsw-alias-border-l2, rgba(255, 255, 255, 0.3));
          background: var(--dsw-alias-interactive-bg-hover, rgba(255, 255, 255, 0.1));
        }

        .dsh-sp-btn:active {
          transform: scale(0.96);
        }

        .dsh-sp-btn.primary {
          background: #3b82f6;
          color: #ffffff;
          border-color: #2563eb;
          padding: 6px 14px;
          font-size: 12px;
        }

        .dsh-sp-btn.primary:hover {
          background: #60a5fa;
          color: #ffffff;
        }

        /* --- Panel body (scroll container) --- */
        /* The scrolling half. Deliberately NOT a flex container: a lone flex child
           inside a scrolling column gets squashed by flex-shrink instead of
           overflowing, which leaves nothing to scroll. The shipped Files tab body
           is a plain block scroller for the same reason. */
        .dsh-sp-body {
          flex: auto;
          min-height: 0;
          overflow-y: auto;
          overflow-x: hidden;
          box-sizing: border-box;
        }

        .dsh-sp-body::-webkit-scrollbar {
          width: 6px;
        }

        .dsh-sp-body::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.15);
          border-radius: 3px;
        }

        .dsh-sp-md {
          padding: 14px 16px;
          font-size: 13px;
          line-height: 1.6;
          color: var(--dsw-alias-label-primary, #f4f4f5);
          min-width: 0;
        }

        /* Empty / disabled states */
        .dsh-sp-empty {
          /* min-height (not flex) so the block scroller above still centres the
             state vertically without becoming a flex container. */
          min-height: 100%;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 36px 22px;
          color: var(--dsw-alias-label-tertiary, #71717a);
        }

        .dsh-sp-empty-icon {
          font-size: 34px;
          margin-bottom: 12px;
          opacity: 0.5;
        }

        .dsh-sp-empty-title {
          font-weight: 600;
          color: var(--dsw-alias-label-primary, #e4e4e7);
          margin-bottom: 6px;
        }

        .dsh-sp-empty-text {
          font-size: 12px;
          max-width: 280px;
          margin-bottom: 14px;
        }

        /* --- Panel footer --- */
        .dsh-sp-foot {
          flex: none;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          padding: 7px 12px;
          border-top: 1px solid var(--dsw-alias-border-l1, rgba(255, 255, 255, 0.1));
          background: rgba(0, 0, 0, 0.25);
          font-size: 11px;
          color: var(--dsw-alias-label-tertiary, #71717a);
        }

        .dsh-sp-path {
          display: flex;
          align-items: center;
          gap: 6px;
          min-width: 0;
          flex: 1;
          overflow: hidden;
          cursor: pointer;
        }

        .dsh-sp-path-text {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .dsh-sp-path:hover .dsh-sp-path-text {
          color: var(--dsw-alias-label-secondary, #d4d4d8);
          text-decoration: underline;
        }

        .dsh-sp-foot-actions {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-shrink: 0;
        }

        .dsh-sp-updated {
          flex-shrink: 0;
          white-space: nowrap;
        }

        .dsh-sp-foot .dsh-sp-btn {
          padding: 3px 8px;
          font-size: 11px;
          height: 22px;
        }

        /* --- Markdown rendered elements --- */
        .dsh-md-h1 {
          font-size: 15px;
          font-weight: 700;
          margin: 4px 0 12px 0;
          color: #ffffff;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          padding-bottom: 6px;
          overflow-wrap: break-word;
          word-break: break-word;
          max-width: 100%;
          box-sizing: border-box;
        }

        .dsh-md-h2 {
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.6px;
          margin: 16px 0 8px 0;
          color: #93c5fd;
          display: flex;
          align-items: center;
          gap: 7px;
          overflow-wrap: break-word;
          word-break: break-word;
          max-width: 100%;
          box-sizing: border-box;
        }

        .dsh-md-h2::before {
          content: '';
          display: inline-block;
          width: 3px;
          height: 12px;
          background: #3b82f6;
          border-radius: 2px;
          flex-shrink: 0;
        }

        .dsh-md-h3 {
          font-size: 13px;
          font-weight: 600;
          margin: 12px 0 6px 0;
          color: var(--dsw-alias-label-primary, #f4f4f5);
          overflow-wrap: break-word;
          word-break: break-word;
          max-width: 100%;
          box-sizing: border-box;
        }

        .dsh-md-p {
          margin: 6px 0 10px 0;
          color: var(--dsw-alias-label-secondary, #d4d4d8);
          overflow-wrap: break-word;
          word-break: break-word;
          max-width: 100%;
          box-sizing: border-box;
        }

        .dsh-md-blockquote {
          margin: 8px 0;
          padding: 6px 12px;
          border-left: 3px solid #3b82f6;
          background: rgba(59, 130, 246, 0.08);
          border-radius: 0 4px 4px 0;
          color: var(--dsw-alias-label-secondary, #d4d4d8);
          overflow-wrap: break-word;
          word-break: break-word;
          max-width: 100%;
          box-sizing: border-box;
        }

        .dsh-task-item {
          display: flex;
          align-items: flex-start;
          gap: 9px;
          margin: 4px 0;
          font-size: 13px;
          padding: 6px 10px;
          border-radius: 6px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          transition: all 0.15s ease;
          min-width: 0;
          max-width: 100%;
          box-sizing: border-box;
        }

        .dsh-task-item:hover {
          background: rgba(255, 255, 255, 0.04);
        }

        .dsh-task-checkbox {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 16px;
          height: 16px;
          border-radius: 4px;
          flex-shrink: 0;
          font-size: 10px;
          font-weight: 700;
          border: 1.5px solid rgba(255, 255, 255, 0.25);
          user-select: none;
          margin-top: 2px;
        }

        .dsh-task-item.done {
          background: rgba(34, 197, 94, 0.03);
          border-color: rgba(34, 197, 94, 0.12);
        }

        .dsh-task-item.done .dsh-task-checkbox {
          background: #22c55e;
          border-color: #22c55e;
          color: #ffffff;
        }

        .dsh-task-item.done .dsh-task-label {
          color: var(--dsw-alias-label-tertiary, #71717a);
          text-decoration: line-through;
        }

        .dsh-task-item.in-progress {
          background: rgba(59, 130, 246, 0.08);
          border-color: rgba(59, 130, 246, 0.25);
        }

        .dsh-task-item.in-progress .dsh-task-checkbox {
          background: #3b82f6;
          border-color: #3b82f6;
          color: #ffffff;
        }

        .dsh-task-item.in-progress .dsh-task-label {
          color: #93c5fd;
          font-weight: 500;
        }

        .dsh-task-item.pending .dsh-task-checkbox {
          background: rgba(255, 255, 255, 0.04);
          border-color: rgba(255, 255, 255, 0.2);
        }

        .dsh-task-item.pending .dsh-task-label {
          color: var(--dsw-alias-label-primary, #f4f4f5);
        }

        .dsh-task-label {
          flex: 1;
          min-width: 0;
          overflow-wrap: break-word;
          word-break: break-word;
        }

        .dsh-md-code {
          background: rgba(255, 255, 255, 0.08);
          padding: 2px 6px;
          border-radius: 4px;
          font-family: var(--dsw-font-markdown-code-block, monospace);
          font-size: 12px;
          color: #fcd34d;
          overflow-wrap: anywhere;
          word-break: break-word;
        }

        .dsh-md-pre {
          background: rgba(0, 0, 0, 0.35);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 6px;
          padding: 10px;
          overflow-x: auto;
          font-family: var(--dsw-font-markdown-code-block, monospace);
          font-size: 12px;
          color: #e4e4e7;
          margin: 8px 0;
          max-width: 100%;
          box-sizing: border-box;
        }

        .dsh-md-pre::-webkit-scrollbar {
          height: 5px;
        }

        .dsh-md-pre::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 3px;
        }

        .dsh-md-ul {
          margin: 6px 0 10px 16px;
          padding: 0;
          max-width: 100%;
          box-sizing: border-box;
        }

        .dsh-md-li {
          margin: 4px 0;
          color: var(--dsw-alias-label-secondary, #d4d4d8);
          overflow-wrap: break-word;
          word-break: break-word;
        }

        /* Markdown Tables */
        .dsh-md-table-wrap {
          width: 100%;
          max-width: 100%;
          overflow-x: auto;
          box-sizing: border-box;
          margin: 12px 0;
          border-radius: 6px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(0, 0, 0, 0.2);
        }

        .dsh-md-table-wrap::-webkit-scrollbar {
          height: 5px;
        }

        .dsh-md-table-wrap::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 3px;
        }

        .dsh-md-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
          line-height: 1.5;
          color: var(--dsw-alias-label-secondary, #d4d4d8);
          text-align: left;
        }

        .dsh-md-table th {
          background: rgba(255, 255, 255, 0.06);
          color: var(--dsw-alias-label-primary, #ffffff);
          font-weight: 600;
          padding: 8px 12px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.12);
          white-space: nowrap;
        }

        .dsh-md-table td {
          padding: 7px 12px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          vertical-align: top;
        }

        .dsh-md-table tbody tr:last-child td {
          border-bottom: none;
        }

        .dsh-md-table tbody tr:hover {
          background: rgba(255, 255, 255, 0.03);
        }

        .dsh-md-table code {
          font-size: 11px;
        }
      `;
      document.head.appendChild(style);
    }

    // Shared runtime state
    let cordisCtx = null;
    let activeSessionId = null;
    let latestPercent = 0;
    let latestData = null;
    let pollingTimer = null;
    const subscribers = new Set();
    const sessionEnabledMap = new Map();

    function isSessionEnabled(sessionId) {
      const sId = sessionId ? String(sessionId) : 'default';
      if (sessionEnabledMap.has(sId)) {
        return sessionEnabledMap.get(sId);
      }
      // A session without its own entry inherits the default scope (what the switch sets on a
      // brand-new session screen is exactly this value).
      if (sId !== 'default' && sessionEnabledMap.has('default')) {
        return sessionEnabledMap.get('default');
      }
      return true;
    }

    async function toggleSessionProgress(sessionId, explicitTarget) {
      if (!sessionId) sessionId = resolveCurrentSessionId() || 'default';
      const sId = String(sessionId);
      const current = isSessionEnabled(sId);
      const target = typeof explicitTarget === 'boolean' ? explicitTarget : !current;
      sessionEnabledMap.set(sId, target);

      // Instant UI update
      const hasFile = Boolean(latestData && latestData.found && latestData.hasFile);
      updateHeaderButtonUI(latestPercent, hasFile, target);
      notifySubscribers();

      try {
        const res = await fetch('/api/session-progress/toggle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: sId, enabled: target })
        });
        if (res.ok) {
          const resData = await res.json();
          if (typeof resData.enabled === 'boolean') {
            sessionEnabledMap.set(sId, resData.enabled);
            updateHeaderButtonUI(latestPercent, hasFile, resData.enabled);
          }
        }
      } catch (e) {
        console.warn('[dsh-session-progress] Failed to toggle session progress:', e);
      }
      notifySubscribers();
    }

    function notifySubscribers() {
      subscribers.forEach((cb) => {
        try { cb(latestPercent, latestData); } catch (e) {}
      });
    }

    /**
     * Resolve the current Session ID from Cordis, URL, or DOM
     */
    function resolveCurrentSessionId() {
      // 1. From Cordis services
      if (cordisCtx) {
        try {
          const current = cordisCtx.sessions?.list?.getSnapshot?.()?.current;
          if (current) return current;
        } catch (e) {}
        try {
          const s = cordisCtx.uiSession?.adapter?.current?.getSnapshot?.()?.key ||
                    cordisCtx.uiSession?.adapter?.current?.getSnapshot?.()?.sessionId;
          if (s) return s;
        } catch (e) {}
        try {
          const s = cordisCtx.uiWorkspace?.sessions?.list?.getSnapshot?.()?.current;
          if (s) return s;
        } catch (e) {}
      }

      // 2. URL search param or hash
      try {
        const hashMatch = window.location.hash.match(/session[=\/]([a-zA-Z0-9_-]+)/);
        if (hashMatch && hashMatch[1]) return hashMatch[1];
        const searchMatch = window.location.search.match(/sessionId=([a-zA-Z0-9_-]+)/);
        if (searchMatch && searchMatch[1]) return searchMatch[1];
      } catch (e) {}

      // 3. DOM inspection for active session card or workspace
      try {
        const activeCard = document.querySelector('[data-session-id][data-active="true"], [data-session-id].active, [data-session][data-active="true"], [data-session].active, [class*="session"][class*="active"], [class*="active"][data-id]');
        if (activeCard) {
          const id = activeCard.getAttribute('data-session-id') || activeCard.getAttribute('data-session') || activeCard.getAttribute('data-id');
          if (id) return id;
        }
      } catch (e) {}

      return activeSessionId || null;
    }

    /**
     * The active session key, or null on a brand-new session screen (nothing selected yet).
     */
    function currentSessionKey() {
      const sid = resolveCurrentSessionId() || activeSessionId;
      return sid && sid !== 'default' ? String(sid) : null;
    }

    /**
     * Whether the agent has already written a progress file for the active session.
     */
    function hasProgressFile() {
      return Boolean(latestData && latestData.found && latestData.hasFile);
    }

    /**
     * The progress control is ALWAYS mounted (beside the model selector) — including on a brand-new
     * session screen, because its popover carries the switch that turns progress tracking on or off
     * for coming sessions.
     */
    function shouldShowProgressTrigger() {
      return true;
    }

    /**
     * Fetch session progress content from backend. With no session id (a brand-new session screen)
     * it queries the `default` scope instead, which is where the enable/disable switch lives.
     */
    async function fetchProgress(sessionId) {
      if (sessionId === undefined) {
        sessionId = resolveCurrentSessionId();
      }
      const scope = sessionId && sessionId !== 'default' ? String(sessionId) : 'default';
      const isDefaultScope = scope === 'default';

      try {
        const res = await fetch(`/api/session-progress/content?sessionId=${encodeURIComponent(scope)}`);
        if (res.ok) {
          const data = await res.json();
          // Guard against out-of-order responses if user switched sessions
          const currentSid = resolveCurrentSessionId();
          const currentScope = currentSid && currentSid !== 'default' ? String(currentSid) : 'default';
          if (currentScope !== scope) {
            return null;
          }

          const isEnabled = data?.enabled !== undefined ? Boolean(data.enabled) : isSessionEnabled(scope);
          sessionEnabledMap.set(scope, isEnabled);

          const hasFile = Boolean(data && data.found && data.hasFile);
          if (isDefaultScope) {
            // No file can belong to the default scope: keep the state empty, only the switch matters.
            latestData = null;
            latestPercent = 0;
            activeSessionId = null;
          } else {
            latestData = hasFile ? { ...data, enabled: isEnabled } : (isEnabled ? null : { enabled: false });
            latestPercent = (hasFile && typeof data.percent === 'number') ? data.percent : 0;
            activeSessionId = scope;
          }

          notifySubscribers();
          updateHeaderButtonUI(latestPercent, hasFile, isEnabled);
          return data;
        }
      } catch (err) {
        console.warn('[dsh-session-progress] Failed to fetch progress:', err);
      }
      return null;
    }

    /**
     * Open file on host OS
     */
    async function openProgressFile(sessionId) {
      if (!latestData || !latestData.filePath) return;
      try {
        await fetch('/api/session-progress/open', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: latestData.sessionId || sessionId || activeSessionId,
            filePath: latestData.filePath
          })
        });
      } catch (e) {
        console.error('[dsh-session-progress] Failed to open file:', e);
      }
    }

    function isTableDelimiter(str) {
      if (!str) return false;
      const trimmed = str.trim();
      return /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?$/.test(trimmed);
    }

    function splitTableRow(rowStr) {
      let trimmed = rowStr.trim();
      if (trimmed.startsWith('|')) trimmed = trimmed.slice(1);
      if (trimmed.endsWith('|')) trimmed = trimmed.slice(0, -1);
      const cells = [];
      let current = '';
      let inCode = false;
      for (let i = 0; i < trimmed.length; i++) {
        const char = trimmed[i];
        if (char === '`') {
          inCode = !inCode;
          current += char;
        } else if (char === '\\' && i + 1 < trimmed.length && trimmed[i + 1] === '|') {
          current += '|';
          i++;
        } else if (char === '|' && !inCode) {
          cells.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      cells.push(current.trim());
      return cells;
    }

    function parseAlignments(delimStr) {
      const cells = splitTableRow(delimStr);
      return cells.map(cell => {
        const t = cell.trim();
        const left = t.startsWith(':');
        const right = t.endsWith(':');
        if (left && right) return 'center';
        if (right) return 'right';
        return 'left';
      });
    }

    /**
     * Parse lightweight Markdown into HTML (stripping YAML frontmatter from body)
     */
    function renderMarkdownToHtml(markdown) {
      if (!markdown || !markdown.trim()) {
        return `
          <div class="dsh-sp-empty">
            <div class="dsh-sp-empty-icon">📋</div>
            <div class="dsh-sp-empty-title">No progress reported yet</div>
            <div class="dsh-sp-empty-text">The AI agent populates this panel automatically as it works through the task.</div>
          </div>
        `;
      }

      // Strip YAML frontmatter from visible body text
      let bodyText = markdown;
      const fmMatch = markdown.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
      if (fmMatch) {
        bodyText = markdown.slice(fmMatch[0].length);
      }

      const lines = bodyText.split(/\r?\n/);
      let html = '';
      let inList = false;
      let inCodeBlock = false;
      let codeBlockContent = '';

      for (let i = 0; i < lines.length; i++) {
        let line = lines[i];

        // Code block handling
        if (line.trim().startsWith('```')) {
          if (inCodeBlock) {
            html += `<pre class="dsh-md-pre"><code>${escapeHtml(codeBlockContent.trimEnd())}</code></pre>`;
            inCodeBlock = false;
            codeBlockContent = '';
          } else {
            if (inList) { html += '</ul>'; inList = false; }
            inCodeBlock = true;
            codeBlockContent = '';
          }
          continue;
        }
        if (inCodeBlock) {
          codeBlockContent += line + '\n';
          continue;
        }

        // Headings
        if (line.startsWith('# ')) {
          if (inList) { html += '</ul>'; inList = false; }
          const h1Text = line.slice(2).trim();
          // Skip redundant title if it repeats "Session Progress" or "Tiến độ phiên làm việc"
          if (/^(session\s+progress|tiến\s*độ\s*(phiên\s*làm\s*việc|công\s*việc)?)/i.test(h1Text)) {
            continue;
          }
          html += `<h1 class="dsh-md-h1">${inlineFormat(h1Text)}</h1>`;
          continue;
        }
        if (line.startsWith('## ')) {
          if (inList) { html += '</ul>'; inList = false; }
          const h2Text = line.slice(3).trim().replace(/^[📌📍]\s*/, '');
          html += `<h2 class="dsh-md-h2">${inlineFormat(h2Text)}</h2>`;
          continue;
        }
        if (line.startsWith('### ')) {
          if (inList) { html += '</ul>'; inList = false; }
          html += `<h3 class="dsh-md-h3">${inlineFormat(line.slice(4).trim())}</h3>`;
          continue;
        }

        // Blockquote
        if (line.startsWith('> ')) {
          if (inList) { html += '</ul>'; inList = false; }
          html += `<blockquote class="dsh-md-blockquote">${inlineFormat(line.slice(2))}</blockquote>`;
          continue;
        }

        // Checklists
        const chkDone = line.match(/^[\s*>-]*\[[xX]\]\s*(.+)$/);
        if (chkDone) {
          if (inList) { html += '</ul>'; inList = false; }
          html += `
            <div class="dsh-task-item done">
              <span class="dsh-task-checkbox">✓</span>
              <span class="dsh-task-label">${inlineFormat(chkDone[1])}</span>
            </div>
          `;
          continue;
        }

        const chkInProg = line.match(/^[\s*>-]*\[[\-\/~]\]\s*(.+)$/);
        if (chkInProg) {
          if (inList) { html += '</ul>'; inList = false; }
          html += `
            <div class="dsh-task-item in-progress">
              <span class="dsh-task-checkbox">▶</span>
              <span class="dsh-task-label">${inlineFormat(chkInProg[1])}</span>
            </div>
          `;
          continue;
        }

        const chkPending = line.match(/^[\s*>-]*\[\s\]\s*(.+)$/);
        if (chkPending) {
          if (inList) { html += '</ul>'; inList = false; }
          html += `
            <div class="dsh-task-item pending">
              <span class="dsh-task-checkbox"></span>
              <span class="dsh-task-label">${inlineFormat(chkPending[1])}</span>
            </div>
          `;
          continue;
        }

        // Markdown Table
        if (line.includes('|') && i + 1 < lines.length && isTableDelimiter(lines[i + 1])) {
          if (inList) { html += '</ul>'; inList = false; }
          const headers = splitTableRow(line);
          const aligns = parseAlignments(lines[i + 1]);
          i += 2;
          const rows = [];
          while (i < lines.length) {
            const rowLine = lines[i];
            const trimmed = rowLine.trim();
            if (!trimmed) {
              // Tolerate accidental blank line within table rows
              let nextIdx = i + 1;
              while (nextIdx < lines.length && !lines[nextIdx].trim()) nextIdx++;
              if (nextIdx < lines.length && lines[nextIdx].trim().startsWith('|')) {
                i++;
                continue;
              } else {
                break;
              }
            }
            if (!trimmed.includes('|')) break;
            if (trimmed.startsWith('#') || trimmed.startsWith('- [') || trimmed.startsWith('```')) break;
            rows.push(splitTableRow(rowLine));
            i++;
          }
          i--;

          html += '<div class="dsh-md-table-wrap"><table class="dsh-md-table"><thead><tr>';
          for (let c = 0; c < headers.length; c++) {
            const align = aligns[c] || 'left';
            html += `<th style="text-align:${align};">${inlineFormat(headers[c])}</th>`;
          }
          html += '</tr></thead><tbody>';
          for (const row of rows) {
            html += '<tr>';
            for (let c = 0; c < headers.length; c++) {
              const align = aligns[c] || 'left';
              const cellVal = row[c] !== undefined ? row[c] : '';
              html += `<td style="text-align:${align};">${inlineFormat(cellVal)}</td>`;
            }
            html += '</tr>';
          }
          html += '</tbody></table></div>';
          continue;
        }

        // Standard lists
        const ulMatch = line.match(/^[\s]*[-*+]\s+(.+)$/);
        if (ulMatch) {
          if (!inList) { html += '<ul class="dsh-md-ul">'; inList = true; }
          html += `<li class="dsh-md-li">${inlineFormat(ulMatch[1])}</li>`;
          continue;
        } else if (inList) {
          html += '</ul>';
          inList = false;
        }

        // Horizontal rule
        if (/^[\s]*[-*_]{3,}[\s]*$/.test(line)) {
          html += '<hr style="border:none; border-top:1px solid rgba(255,255,255,0.1); margin:12px 0;" />';
          continue;
        }

        // Paragraph
        if (line.trim().length > 0) {
          html += `<p class="dsh-md-p">${inlineFormat(line)}</p>`;
        }
      }

      if (inList) html += '</ul>';
      if (inCodeBlock) html += `<pre class="dsh-md-pre"><code>${escapeHtml(codeBlockContent)}</code></pre>`;

      return html;
    }

    function inlineFormat(text) {
      if (!text) return '';
      let res = escapeHtml(text);
      // Code `...`
      res = res.replace(/`([^`]+)`/g, '<code class="dsh-md-code">$1</code>');
      // Bold **...**
      res = res.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      // Italic *...*
      res = res.replace(/\*([^*]+)\*/g, '<em>$1</em>');
      // Links [text](url)
      res = res.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color:#60a5fa;text-decoration:underline;">$1</a>');
      return res;
    }

    function escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    // ============================================================================
    // Native right Sidebar integration
    // ============================================================================

    /**
     * Reveal the progress panel: open (or focus) our tab in the right Sidebar.
     *
     * The controller needs a mounted seat to be bound to a session, which happens
     * while the frame renders the right column. It is there from boot, but a very
     * early click can land before that binding settles, so a failed open is retried
     * a few times instead of surfacing as a dead control.
     */
    function openProgressPanel() {
      const sidebarRight = cordisCtx && cordisCtx.sidebarRight;
      if (!sidebarRight) {
        console.warn('[dsh-session-progress] Right sidebar service is unavailable; cannot open the progress panel.');
        return;
      }
      const attempt = (left) => {
        try {
          sidebarRight.openTab(TAB_KIND);
        } catch (err) {
          if (left > 0) {
            setTimeout(() => attempt(left - 1), 250);
          } else {
            console.warn('[dsh-session-progress] Could not open the right sidebar tab:', err);
          }
        }
      };
      attempt(4);
    }

    /**
     * Subscribe one React component to the polling data layer, fetching for the
     * session the panel belongs to.
     */
    function useProgressState(sessionId) {
      const [revision, setRevision] = React.useState(0);
      React.useEffect(() => {
        const cb = () => setRevision((r) => r + 1);
        subscribers.add(cb);
        return () => { subscribers.delete(cb); };
      }, []);
      React.useEffect(() => {
        if (sessionId) fetchProgress(sessionId);
      }, [sessionId]);

      const sid = sessionId || resolveCurrentSessionId();
      const data = latestData;
      const disabled = Boolean(data && data.enabled === false);
      const enabled = !disabled && isSessionEnabled(sid);
      const hasFile = Boolean(data && data.found && data.hasFile);
      const percent = hasFile && typeof latestPercent === 'number'
        ? Math.max(0, Math.min(100, latestPercent))
        : 0;
      return { sessionId: sid, data, percent, enabled, hasFile, revision };
    }

    function ProgressRing(props) {
      const percent = props.percent || 0;
      const isDone = percent >= 100;
      const offset = RING_CIRCUMFERENCE * (1 - percent / 100);
      return React.createElement('svg', {
        className: 'dsh-progress-ring',
        viewBox: '0 0 14 14',
        width: '14',
        height: '14',
        'aria-hidden': 'true'
      },
        React.createElement('circle', { className: 'dsh-progress-ring-track', cx: '7', cy: '7', r: '5.5' }),
        React.createElement('circle', {
          className: `dsh-progress-ring-fill${isDone ? ' done' : ''}`,
          cx: '7',
          cy: '7',
          r: '5.5',
          strokeDasharray: String(RING_CIRCUMFERENCE),
          strokeDashoffset: String(offset)
        })
      );
    }

    /**
     * The tab chip: the progress ring plus the tab name.
     *
     * The percentage deliberately stays out of the chip. The dock caps a chip's
     * width and clips whatever overflows, and it is not a flex box we can ask to
     * shrink first, so a trailing number gets cut mid-digits ("100%" rendered as
     * "10"). The ring carries the same reading — filled proportionally, green at
     * 100% — and the exact number is in the panel header one click away.
     */
    function ProgressTabTitle(props) {
      const state = useProgressState(props.sessionId);
      return React.createElement('span', { className: 'dsh-sp-title' },
        React.createElement(ProgressRing, { percent: state.hasFile ? state.percent : 0 }),
        React.createElement('span', { className: 'dsh-sp-title-text' }, TAB_TITLE)
      );
    }

    /** The tab body: the session progress panel itself. */
    function ProgressTabBody(props) {
      const state = useProgressState(props.sessionId);
      const [copied, setCopied] = React.useState(false);
      const bodyRef = React.useRef(null);
      const scrollRef = React.useRef(0);

      const data = state.data;
      const content = data && typeof data.content === 'string' ? data.content : '';
      const html = React.useMemo(() => renderMarkdownToHtml(content), [content]);

      // Keep the reader's place across polls: the rendered HTML is stable while the
      // Markdown is unchanged (React skips an identical string), so a changed document
      // is the only case that re-writes the body.
      const onScroll = (event) => {
        scrollRef.current = event.currentTarget.scrollTop;
      };
      React.useLayoutEffect(() => {
        const el = bodyRef.current;
        if (el && el.scrollTop !== scrollRef.current) el.scrollTop = scrollRef.current;
      }, [html]);

      const onCopy = () => {
        if (!content) return;
        Promise.resolve(navigator.clipboard.writeText(content)).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }).catch(() => {});
      };

      const tasksTotal = (data && data.tasksTotal) || 0;
      const tasksDone = (data && data.tasksDone) || 0;
      const activity = data && data.currentActivity;

      const fileName = (data && data.fileName) || '(No file active)';
      const updated = data && data.lastModified
        ? `Updated: ${new Date(data.lastModified).toLocaleTimeString()}`
        : 'Updated: --';

      let bodyChild;
      if (!state.enabled) {
        bodyChild = React.createElement('div', { className: 'dsh-sp-empty' },
          React.createElement('div', { className: 'dsh-sp-empty-icon' }, '⏸️'),
          React.createElement('div', { className: 'dsh-sp-empty-title' }, 'Session Progress is Disabled'),
          React.createElement('div', { className: 'dsh-sp-empty-text' },
            'Automatic progress tracking is paused for this session to conserve prompt tokens.'),
          React.createElement('button', {
            type: 'button',
            className: 'dsh-sp-btn primary',
            onClick: () => toggleSessionProgress(state.sessionId, true)
          }, '⚡ Re-enable Progress')
        );
      } else if (!state.hasFile) {
        bodyChild = React.createElement('div', {
          className: 'dsh-sp-empty',
          dangerouslySetInnerHTML: { __html: renderMarkdownToHtml('') }
        });
      } else {
        bodyChild = React.createElement('div', {
          className: 'dsh-sp-md',
          dangerouslySetInnerHTML: { __html: html }
        });
      }

      return React.createElement('div', { className: 'dsh-sp-panel', 'data-dsh-sp-panel': true },
        React.createElement('div', { className: 'dsh-sp-head' },
          React.createElement('div', { className: 'dsh-sp-detail' },
            state.enabled
              ? (tasksTotal > 0 ? `${tasksDone}/${tasksTotal} tasks completed` : 'Checklist not specified')
              : 'Tracking is paused'),
          React.createElement('div', { className: 'dsh-progress-track' },
            React.createElement('div', {
              className: `dsh-progress-fill${state.enabled && state.percent === 100 ? ' done' : ''}`,
              style: { width: state.enabled ? `${state.percent}%` : '0%' }
            })
          ),
          activity && state.enabled
            ? React.createElement('div', { className: 'dsh-sp-activity' },
                React.createElement('span', { className: 'dsh-sp-activity-icon' }, '⚡'),
                React.createElement('span', { className: 'dsh-sp-activity-text', title: activity }, activity)
              )
            : null
        ),
        React.createElement('div', {
          className: 'dsh-sp-body',
          ref: bodyRef,
          onScroll: onScroll
        }, bodyChild),
        React.createElement('div', { className: 'dsh-sp-foot' },
          React.createElement('div', {
            className: 'dsh-sp-path',
            title: data && data.filePath ? `Click to copy path: ${data.filePath}` : 'No file active',
            onClick: () => {
              if (data && data.filePath) {
                Promise.resolve(navigator.clipboard.writeText(data.filePath)).catch(() => {});
              }
            }
          },
            React.createElement('span', { style: { flexShrink: 0 } }, '📁'),
            React.createElement('span', { className: 'dsh-sp-path-text' }, fileName)
          ),
          React.createElement('div', { className: 'dsh-sp-foot-actions' },
            React.createElement('span', { className: 'dsh-sp-updated' }, updated),
            React.createElement('button', {
              type: 'button',
              className: 'dsh-sp-btn',
              title: 'Copy progress Markdown',
              disabled: !content,
              onClick: onCopy
            }, copied ? '✓ Copied' : 'Copy'),
            React.createElement('button', {
              type: 'button',
              className: 'dsh-sp-btn',
              title: 'Open progress file in the default editor',
              disabled: !(data && data.filePath),
              onClick: () => openProgressFile(state.sessionId)
            }, '↗ Open')
          )
        )
      );
    }

    // ============================================================================
    // Composer trailing toolbar trigger (DOM-mounted control)
    // ============================================================================

    function updateHeaderButtonUI(pct, hasFile, isEnabled) {
      const currentSid = resolveCurrentSessionId() || 'default';
      if (isEnabled === undefined) {
        isEnabled = isSessionEnabled(currentSid);
      }

      // Purge any button on the titlebar or header
      document.querySelectorAll('header .dsh-session-progress-button, [class*="utilities"] .dsh-session-progress-button')
        .forEach(el => el.remove());

      let btn = document.querySelector('.dsh-session-progress-button');
      if (!btn) {
        btn = createProgressButton();
      }

      // Mount into composer trailing toolbar (beside ContextMeter and Model selector).
      // Chỉ chọn ứng viên thật sự là toolbar của composer (chứa ContextMeter hoặc model
      // selector); nếu không có thì giữ nguyên hành vi cũ (phần tử đầu tiên khớp).
      const trailingCandidates = Array.from(document.querySelectorAll('[class*="trailing"]'));
      const trailing = trailingCandidates.find(el =>
        el.querySelector('[class*="ContextMeter"], button[aria-haspopup="dialog"]')
      ) || trailingCandidates[0] || null;
      if (trailing) {
        const contextMeter = trailing.querySelector('[class*="ContextMeter"], [class*="track"]')?.closest('span')
                          || trailing.querySelector('button[aria-haspopup="dialog"]')
                          || trailing.querySelector('[class*="primary"]');
        if (btn.parentNode !== trailing) {
          if (contextMeter && contextMeter.parentNode === trailing) {
            trailing.insertBefore(btn, contextMeter);
          } else {
            trailing.appendChild(btn);
          }
        }
      } else if (!btn.parentNode) {
        document.body.appendChild(btn);
      }

      if (!shouldShowProgressTrigger()) {
        btn.style.display = 'none';
        return;
      }

      btn.style.display = 'inline-flex';
      btn.removeAttribute('title'); // Prevent native OS tooltip overlapping the custom UI

      const ringFill = btn.querySelector('.dsh-progress-ring-fill');
      const circumference = RING_CIRCUMFERENCE;
      const pill = btn.querySelector('.dsh-progress-pill');
      let tooltip = btn.querySelector('#dsh-progress-btn-tooltip');
      if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.className = 'dsh-progress-tooltip';
        tooltip.id = 'dsh-progress-btn-tooltip';
        btn.appendChild(tooltip);
      }

      const activity = latestData?.currentActivity;
      // On a brand-new session screen nothing is tracked yet, so the popover explains that its
      // switch applies to the sessions about to be created.
      const isNewSessionScreen = !currentSessionKey();

      if (!isEnabled) {
        btn.classList.remove('icon-only');
        btn.classList.add('disabled');
        if (ringFill) {
          ringFill.setAttribute('stroke-dashoffset', String(circumference));
          ringFill.classList.remove('done');
        }
        if (pill) {
          pill.style.display = '';
          pill.textContent = 'OFF';
          pill.classList.remove('done');
        }
        tooltip.innerHTML = `
          <div class="dsh-progress-tooltip-header">
            <span class="dsh-progress-tooltip-badge disabled">OFF</span>
            <span class="dsh-progress-tooltip-title">Session Progress</span>
          </div>
          <div class="dsh-progress-tooltip-body" style="color:var(--dsw-alias-label-tertiary, #71717a); font-size:11px;">
            ${isNewSessionScreen
              ? 'Progress tracking is OFF for new sessions (conserves tokens).'
              : 'Progress tracking is disabled for this session (conserves tokens).'}
          </div>
          <div class="dsh-tooltip-toggle-row">
            <span class="dsh-tooltip-toggle-label">
              <span>⚡ Session Progress</span>
            </span>
            <div class="dsh-toggle-switch" id="dsh-tooltip-toggle-switch" title="${isNewSessionScreen ? 'Enable progress tracking for new sessions' : 'Enable progress tracking for this session'}"></div>
          </div>
        `;
        btn.setAttribute('aria-label', `Session Progress: Disabled (OFF)${isNewSessionScreen ? ' for new sessions' : ''}`);
      } else {
        btn.classList.remove('disabled');
        const numPct = typeof pct === 'number' ? Math.min(100, Math.max(0, pct)) : 0;
        const offset = circumference * (1 - numPct / 100);
        const isDone = numPct === 100;

        if (ringFill) {
          ringFill.setAttribute('stroke-dashoffset', String(offset));
          if (isDone) ringFill.classList.add('done');
          else ringFill.classList.remove('done');
        }

        if (hasFile) {
          btn.classList.remove('icon-only');
          if (pill) {
            pill.style.display = '';
            pill.textContent = `${numPct}%`;
            if (isDone) pill.classList.add('done');
            else pill.classList.remove('done');
          }
        } else {
          // When there is no progress file yet, completely hide "0%" text on button
          btn.classList.add('icon-only');
          if (pill) {
            pill.style.display = 'none';
            pill.textContent = '';
            pill.classList.remove('done');
          }
        }

        if (hasFile && activity) {
          tooltip.innerHTML = `
            <div class="dsh-progress-tooltip-header">
              <span class="dsh-progress-tooltip-badge ${isDone ? 'done' : ''}">${numPct}%</span>
              <span class="dsh-progress-tooltip-title">Current Activity</span>
            </div>
            <div class="dsh-progress-tooltip-body">${escapeHtml(activity)}</div>
            <div class="dsh-progress-tooltip-hint">Click to open the progress panel</div>
            <div class="dsh-tooltip-toggle-row">
              <span class="dsh-tooltip-toggle-label">
                <span>⚡ Session Progress</span>
              </span>
              <div class="dsh-toggle-switch active" id="dsh-tooltip-toggle-switch" title="Disable progress tracking for this session"></div>
            </div>
          `;
          btn.setAttribute('aria-label', `[${numPct}%] ${activity}`);
        } else if (hasFile) {
          tooltip.innerHTML = `
            <div class="dsh-progress-tooltip-header">
              <span class="dsh-progress-tooltip-badge ${isDone ? 'done' : ''}">${numPct}%</span>
              <span class="dsh-progress-tooltip-title">Session Progress</span>
            </div>
            <div class="dsh-progress-tooltip-hint">Click to open the progress panel</div>
            <div class="dsh-tooltip-toggle-row">
              <span class="dsh-tooltip-toggle-label">
                <span>⚡ Session Progress</span>
              </span>
              <div class="dsh-toggle-switch active" id="dsh-tooltip-toggle-switch" title="Disable progress tracking for this session"></div>
            </div>
          `;
          btn.setAttribute('aria-label', `Session Progress: ${numPct}%`);
        } else {
          // Ready / new session without a progress file yet (0% badge stays hidden)
          tooltip.innerHTML = `
            <div class="dsh-progress-tooltip-header">
              <span class="dsh-progress-tooltip-title">${isNewSessionScreen ? 'New Session' : 'Ready to Track'}</span>
            </div>
            <div class="dsh-progress-tooltip-body" style="color:var(--dsw-alias-label-secondary, #a1a1aa); font-size:11px;">
              ${isNewSessionScreen
                ? 'Progress tracking is ON for new sessions. The switch below turns it off.'
                : 'Agent will automatically track progress upon starting tasks.'}
            </div>
            <div class="dsh-tooltip-toggle-row">
              <span class="dsh-tooltip-toggle-label">
                <span>⚡ Session Progress</span>
              </span>
              <div class="dsh-toggle-switch active" id="dsh-tooltip-toggle-switch" title="${isNewSessionScreen ? 'Disable progress tracking for new sessions' : 'Disable progress tracking for this session'}"></div>
            </div>
          `;
          btn.setAttribute('aria-label', isNewSessionScreen ? 'Session Progress: ON for new sessions' : 'Session Progress: Ready');
        }
      }

      // Stop clicks/mouse events inside tooltip from bubbling to btn (which would open the panel)
      tooltip.onclick = (e) => {
        // If clicking specifically on the "open the panel" hint, reveal the right sidebar tab
        if (e.target.closest('.dsh-progress-tooltip-hint')) {
          e.stopPropagation();
          openProgressPanel();
          return;
        }
        e.stopPropagation();
      };
      tooltip.onmousedown = (e) => e.stopPropagation();
      tooltip.onpointerdown = (e) => e.stopPropagation();

      // Bind toggle row click (clicking the row or the switch toggles session progress)
      const toggleRow = tooltip.querySelector('.dsh-tooltip-toggle-row');
      if (toggleRow) {
        toggleRow.style.cursor = 'pointer';
        toggleRow.onclick = (e) => {
          e.stopPropagation();
          e.preventDefault();
          toggleSessionProgress(resolveCurrentSessionId());
        };
      }
    }

    function startPolling(intervalMs = 3000) {
      if (pollingTimer) clearInterval(pollingTimer);
      pollingTimer = setInterval(() => {
        const currentSid = resolveCurrentSessionId();
        if (currentSid !== activeSessionId) {
          activeSessionId = currentSid;
        }
        fetchProgress(activeSessionId);
      }, intervalMs);
    }

    function createProgressButton() {
      ensureStyles();
      const btn = document.createElement('button');
      btn.type = 'button';
      const hasFile = Boolean(latestData && latestData.found && latestData.hasFile);
      btn.className = `dsh-session-progress-button ${hasFile ? '' : 'icon-only'}`;
      btn.style.display = shouldShowProgressTrigger() ? 'inline-flex' : 'none';
      btn.setAttribute('aria-label', `Session Progress: ${hasFile ? latestPercent + '%' : 'Ready'}`);

      const offset = RING_CIRCUMFERENCE * (1 - Math.min(100, Math.max(0, latestPercent)) / 100);
      const isDone = hasFile && latestPercent === 100;

      btn.innerHTML = `
        <svg class="dsh-progress-ring" viewBox="0 0 14 14" width="14" height="14" aria-hidden="true">
          <circle class="dsh-progress-ring-track" cx="7" cy="7" r="5.5"></circle>
          <circle class="dsh-progress-ring-fill ${isDone ? 'done' : ''}" cx="7" cy="7" r="5.5" stroke-dasharray="${RING_CIRCUMFERENCE}" stroke-dashoffset="${offset}"></circle>
        </svg>
        <span class="dsh-progress-pill ${isDone ? 'done' : ''}" style="${hasFile ? '' : 'display:none;'}">${hasFile ? latestPercent + '%' : ''}</span>
        <div class="dsh-progress-tooltip" id="dsh-progress-btn-tooltip"></div>
      `;
      btn.addEventListener('click', (e) => {
        // If the click originated inside the tooltip/popover, do NOT open the panel
        if (e.target.closest('#dsh-progress-btn-tooltip, .dsh-progress-tooltip')) {
          e.stopPropagation();
          return;
        }
        e.stopPropagation();
        openProgressPanel();
      });
      return btn;
    }

    let isUpdatingProgressDOM = false;
    let progressDebounceTimer = null;

    function isProgressPluginNode(node) {
      if (!node || node.nodeType !== 1) return false;
      const cls = node.className;
      if (typeof cls === 'string' && (cls.includes('dsh-session-progress') || cls.includes('dsh-progress') || cls.includes('dsh-sp-'))) return true;
      if (node.classList && (
        node.classList.contains('dsh-session-progress-button') ||
        node.classList.contains('dsh-progress-tooltip')
      )) return true;
      return false;
    }

    function ensureProgressButton() {
      if (isUpdatingProgressDOM) return;
      isUpdatingProgressDOM = true;
      try {
        // Remove any legacy titlebar buttons
        document.querySelectorAll('header .dsh-session-progress-button, [class*="utilities"] .dsh-session-progress-button')
          .forEach(el => el.remove());

        const hasFile = Boolean(latestData && latestData.found && latestData.hasFile);
        const isEnabled = isSessionEnabled(resolveCurrentSessionId());
        updateHeaderButtonUI(latestPercent, hasFile, isEnabled);
      } finally {
        Promise.resolve().then(() => {
          isUpdatingProgressDOM = false;
        });
      }
    }

    function scheduleProgressButton() {
      if (progressDebounceTimer) return;
      progressDebounceTimer = setTimeout(() => {
        progressDebounceTimer = null;
        ensureProgressButton();
      }, 300);
    }

    // Exported plugin: services, then the slot registrations that make the panel a
    // native right-Sidebar tab, then the composer trigger and its refresh loop.
    exports.inject = ['slots', 'sessions', 'sidebarRightTabs', 'sidebarRight'];
    exports.apply = function(ctx) {
      console.log('[dsh-session-progress] client plugin loaded (native right sidebar tab).');
      cordisCtx = ctx;
      ensureStyles();

      // 1. The tab type: its id is the entry key the two keyed seats dispatch on, its
      //    kind is what `openTab` opens, and its title is the chip fallback text.
      ctx.effect(() => ctx.sidebarRightTabs.register({
        id: TAB_ID,
        kind: TAB_KIND,
        priority: 'extension',
        title: () => TAB_TITLE
      }), 'dsh-session-progress: right sidebar tab type');

      // 2. The tab body and its live chip title, both keyed by our tab id.
      ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
        name: 'sidebar.right.pane.tab',
        key: TAB_ID
      }, ProgressTabBody)), 'dsh-session-progress: right sidebar tab body');

      ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab.title', () => ctx.slots.register({
        name: 'sidebar.right.pane.tab.title',
        key: TAB_ID
      }, ProgressTabTitle)), 'dsh-session-progress: right sidebar tab title');

      // Subscribe to sessions service changes if available
      try {
        if (ctx.sessions?.list?.subscribe) {
          ctx.sessions.list.subscribe(() => {
            const currentId = ctx.sessions?.list?.getSnapshot?.()?.current || null;
            if (currentId !== activeSessionId) {
              activeSessionId = currentId;
              if (!currentId) {
                latestData = null;
                latestPercent = 0;
                notifySubscribers();
                updateHeaderButtonUI(0, false, isSessionEnabled(currentId));
              } else {
                fetchProgress(currentId);
              }
            }
          });
        }
      } catch (e) {}

      // Initial progress fetch
      fetchProgress(resolveCurrentSessionId());
      startPolling(3000);

      // Observer with multi-layer shield to prevent infinite mutation loops
      ensureProgressButton();
      const observer = new MutationObserver((mutations) => {
        if (isUpdatingProgressDOM) return;

        let relevant = false;
        for (const m of mutations) {
          const target = m.target;
          if (target && target.nodeType === 1) {
            if (
              isProgressPluginNode(target) ||
              target.closest?.('.dsh-session-progress-button')
            ) {
              continue;
            }
          }
          if (m.type === 'childList') {
            const allAddedAreSelf = Array.from(m.addedNodes).every(n => isProgressPluginNode(n));
            const allRemovedAreSelf = Array.from(m.removedNodes).every(n => isProgressPluginNode(n));
            if ((m.addedNodes.length > 0 || m.removedNodes.length > 0) &&
                (m.addedNodes.length === 0 || allAddedAreSelf) &&
                (m.removedNodes.length === 0 || allRemovedAreSelf)) {
              continue;
            }
          }
          relevant = true;
          break;
        }
        if (relevant) {
          scheduleProgressButton();
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    };

    return module.exports;
  }
});
