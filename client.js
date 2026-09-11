window.__ModuleLoader__.load({
  id: 'dsh-session-progress',
  factory: (require) => {
    const module = { exports: {} };
    const exports = module.exports;

    console.log('[dsh-session-progress] client factory loaded!');

    const React = require('react');

    const STYLE_ID = 'dsh-session-progress-style';
    function ensureStyles() {
      if (document.getElementById(STYLE_ID)) return;
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = `
        :root {
          --dsh-drawer-top: 40px;
        }

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
          display: none; /* Only visible when a valid progress file exists */
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

        body.dsh-drawer-open .dsh-session-progress-button {
          background: var(--dsw-alias-interactive-bg-hover, rgba(255, 255, 255, 0.12));
          color: var(--dsw-alias-label-primary, #ffffff);
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

        /* Floating Hover Tooltip for Progress Button */
        .dsh-progress-tooltip {
          position: absolute;
          bottom: calc(100% + 8px);
          right: 0;
          background: rgba(24, 24, 28, 0.96);
          backdrop-filter: blur(12px);
          border: 1px solid var(--dsw-alias-border-l2, rgba(255, 255, 255, 0.16));
          border-radius: 8px;
          padding: 8px 11px;
          width: max-content;
          max-width: 320px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.65);
          pointer-events: none;
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

        .dsh-session-progress-button:hover .dsh-progress-tooltip {
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
        }

        /* --- Slide-over Drawer & Backdrop --- */
        .dsh-drawer-backdrop {
          position: fixed;
          top: var(--dsh-drawer-top, 40px);
          left: 0;
          right: 0;
          bottom: 0;
          height: calc(100vh - var(--dsh-drawer-top, 40px));
          background: rgba(0, 0, 0, 0.45);
          backdrop-filter: blur(2px);
          z-index: 9998;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .dsh-drawer-backdrop.open {
          opacity: 1;
          pointer-events: auto;
        }

        .dsh-drawer-panel {
          position: fixed;
          top: var(--dsh-drawer-top, 40px);
          right: 0;
          bottom: 0;
          height: calc(100vh - var(--dsh-drawer-top, 40px));
          width: 440px;
          max-width: calc(100vw - 40px);
          background: var(--dsw-alias-bg-floating, #18181b);
          border-left: 1px solid var(--dsw-alias-border-l1, rgba(255, 255, 255, 0.12));
          box-shadow: -8px 0 28px rgba(0, 0, 0, 0.5);
          z-index: 9999;
          display: flex;
          flex-direction: column;
          transform: translateX(100%);
          transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1);
          color: var(--dsw-alias-label-primary, #f4f4f5);
          font-family: var(--dsw-font-family, system-ui, sans-serif);
        }

        .dsh-drawer-panel.open {
          transform: translateX(0);
        }

        /* Drawer Header */
        .dsh-drawer-header {
          padding: 14px 18px;
          border-bottom: 1px solid var(--dsw-alias-border-l1, rgba(255, 255, 255, 0.1));
          background: var(--dsw-alias-bg-floating, #18181b);
          flex-shrink: 0;
        }

        .dsh-drawer-title-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
          gap: 10px;
          min-width: 0;
        }

        .dsh-drawer-title-wrap {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
          flex: 1;
          overflow: hidden;
        }

        .dsh-drawer-title {
          font-size: 15px;
          font-weight: 600;
          color: var(--dsw-alias-label-primary, #ffffff);
          margin: 0;
          white-space: nowrap;
          flex-shrink: 0;
        }

        .dsh-drawer-status-badge {
          font-size: 10px;
          font-weight: 600;
          padding: 2px 7px;
          border-radius: 10px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          background: rgba(59, 130, 246, 0.15);
          color: #60a5fa;
          border: 1px solid rgba(59, 130, 246, 0.3);
          white-space: nowrap;
          flex-shrink: 0;
        }

        .dsh-drawer-status-badge.completed {
          background: rgba(34, 197, 94, 0.15);
          color: #4ade80;
          border-color: rgba(34, 197, 94, 0.3);
        }

        .dsh-drawer-status-badge.blocked,
        .dsh-drawer-status-badge.paused {
          background: rgba(234, 179, 8, 0.15);
          color: #facc15;
          border-color: rgba(234, 179, 8, 0.3);
        }

        .dsh-drawer-actions {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-shrink: 0;
        }

        .dsh-drawer-btn {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid var(--dsw-alias-border-l4, rgba(255, 255, 255, 0.15));
          color: var(--dsw-alias-label-secondary, #a1a1aa);
          border-radius: 6px;
          padding: 4px 8px;
          font-size: 12px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          transition: all 0.15s ease;
          user-select: none;
          line-height: 1.2;
        }

        .dsh-drawer-btn:hover {
          color: var(--dsw-alias-label-primary, #ffffff);
          border-color: var(--dsw-alias-border-l2, rgba(255, 255, 255, 0.3));
          background: var(--dsw-alias-interactive-bg-hover, rgba(255, 255, 255, 0.1));
        }

        .dsh-drawer-btn:active {
          transform: scale(0.96);
        }

        .dsh-drawer-btn.close-btn {
          padding: 4px 8px;
          font-size: 13px;
          line-height: 1;
          color: var(--dsw-alias-label-tertiary, #71717a);
        }

        .dsh-drawer-btn.close-btn:hover {
          color: #f87171;
          border-color: rgba(248, 113, 113, 0.4);
          background: rgba(248, 113, 113, 0.12);
        }


        /* Progress Bar Section */
        .dsh-drawer-progress-box {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--dsw-alias-border-l1, rgba(255, 255, 255, 0.08));
          border-radius: 8px;
          padding: 10px 12px;
        }

        .dsh-drawer-progress-label-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 12px;
          margin-bottom: 6px;
        }

        .dsh-drawer-progress-pct {
          font-weight: 700;
          color: #60a5fa;
        }

        .dsh-drawer-progress-pct.done {
          color: #4ade80;
        }

        .dsh-drawer-progress-detail {
          color: var(--dsw-alias-label-tertiary, #71717a);
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

        .dsh-drawer-activity-row {
          margin-top: 8px;
          padding-top: 8px;
          border-top: 1px dashed rgba(255, 255, 255, 0.1);
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          color: #93c5fd;
        }

        .dsh-drawer-activity-icon {
          font-size: 12px;
          color: #fbbf24;
          flex-shrink: 0;
        }

        .dsh-drawer-activity-text {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        /* Drawer Body / Content */
        /* Drawer Body / Content */
        .dsh-drawer-body {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
          box-sizing: border-box;
          padding: 16px 20px;
          font-size: 13px;
          line-height: 1.6;
          color: var(--dsw-alias-label-primary, #f4f4f5);
        }

        .dsh-drawer-body::-webkit-scrollbar {
          width: 6px;
        }

        .dsh-drawer-body::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.15);
          border-radius: 3px;
        }

        /* Markdown rendered elements */
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

        /* Drawer Footer */
        .dsh-drawer-footer {
          padding: 8px 14px;
          border-top: 1px solid var(--dsw-alias-border-l1, rgba(255, 255, 255, 0.1));
          background: rgba(0, 0, 0, 0.25);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          font-size: 11px;
          color: var(--dsw-alias-label-tertiary, #71717a);
          flex-shrink: 0;
        }

        .dsh-drawer-path-box {
          display: flex;
          align-items: center;
          gap: 6px;
          min-width: 0;
          flex: 1;
          overflow: hidden;
          cursor: pointer;
        }

        .dsh-drawer-path-text {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .dsh-drawer-path-box:hover .dsh-drawer-path-text {
          color: var(--dsw-alias-label-secondary, #d4d4d8);
          text-decoration: underline;
        }

        .dsh-drawer-footer-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }

        .dsh-drawer-updated-box {
          flex-shrink: 0;
          white-space: nowrap;
          color: var(--dsw-alias-label-tertiary, #71717a);
          font-size: 11px;
        }

        .dsh-drawer-footer-btn {
          padding: 3px 8px;
          font-size: 11px;
          height: 22px;
          line-height: 1;
        }

        /* Empty state */
        .dsh-drawer-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: var(--dsw-alias-label-tertiary, #71717a);
          text-align: center;
          padding: 40px 20px;
        }

        .dsh-drawer-empty-icon {
          font-size: 36px;
          margin-bottom: 12px;
          opacity: 0.5;
        }
      `;
      document.head.appendChild(style);
    }

    // Shared runtime state
    let cordisCtx = null;
    let activeSessionId = null;
    let latestPercent = 0;
    let latestData = null;
    let isDrawerOpen = false;
    let pollingTimer = null;
    let lastRenderedContent = null;
    let lastRenderedSessionId = null;
    let isMouseDownOnDrawer = false;
    const subscribers = new Set();

    function notifySubscribers() {
      subscribers.forEach((cb) => {
        try { cb(latestPercent, latestData, isDrawerOpen); } catch (e) {}
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
     * Fetch session progress content from backend
     */
    async function fetchProgress(sessionId) {
      if (sessionId === undefined) {
        sessionId = resolveCurrentSessionId();
      }
      if (!sessionId) {
        latestData = null;
        latestPercent = 0;
        activeSessionId = null;
        notifySubscribers();
        updateDrawerUI(null);
        updateHeaderButtonUI(0, false);
        return null;
      }

      try {
        const res = await fetch(`/api/session-progress/content?sessionId=${encodeURIComponent(sessionId)}`);
        if (res.ok) {
          const data = await res.json();
          // Guard against out-of-order responses if user switched sessions
          const currentSid = resolveCurrentSessionId();
          if (currentSid && currentSid !== sessionId) {
            return null;
          }

          const hasFile = Boolean(data && data.found && data.hasFile);
          latestData = hasFile ? data : null;
          latestPercent = (hasFile && typeof data.percent === 'number') ? data.percent : 0;
          activeSessionId = sessionId;

          notifySubscribers();
          if (hasFile) {
            updateDrawerUI(data);
          } else {
            updateDrawerUI(null);
          }
          updateHeaderButtonUI(latestPercent, hasFile);
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
    async function openProgressFile() {
      if (!latestData || !latestData.filePath) return;
      try {
        await fetch('/api/session-progress/open', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: latestData.sessionId || activeSessionId,
            filePath: latestData.filePath
          })
        });
      } catch (e) {
        console.error('[dsh-session-progress] Failed to open file:', e);
      }
    }

    /**
     * Copy raw Markdown to clipboard
     */
    function copyMarkdown(btnEl) {
      if (!latestData || !latestData.content) return;
      navigator.clipboard.writeText(latestData.content).then(() => {
        if (btnEl) {
          const orig = btnEl.innerHTML;
          btnEl.innerHTML = '✓ Copied!';
          setTimeout(() => { btnEl.innerHTML = orig; }, 1500);
        }
      }).catch(() => {});
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
          <div class="dsh-drawer-empty">
            <div class="dsh-drawer-empty-icon">📋</div>
            <div>No session progress has been reported yet.</div>
            <div style="font-size: 11px; margin-top: 6px;">The AI Agent will automatically populate this file as it progresses.</div>
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

    // --- DOM Elements for Slide-over Drawer ---
    let drawerBackdrop = null;
    let drawerPanel = null;

    /**
     * Compute header height to position drawer cleanly below Electron window controls
     */
    function updateTopOffset() {
      let top = 40;
      try {
        const sessionLogBtn = findSessionLogButton();
        if (sessionLogBtn) {
          const r = sessionLogBtn.getBoundingClientRect();
          if (r.bottom > 20 && r.bottom < 100) {
            top = Math.round(r.bottom);
          }
        } else {
          const topBar = document.querySelector('header, [class*="headerBar"], [class*="titlebar"], [class*="headerNav"], [class*="topbar"]');
          if (topBar) {
            const r = topBar.getBoundingClientRect();
            if (r.bottom > 20 && r.bottom < 100) {
              top = Math.round(r.bottom);
            }
          }
        }
      } catch (e) {}

      document.documentElement.style.setProperty('--dsh-drawer-top', `${top}px`);
      if (drawerPanel) {
        drawerPanel.style.top = `${top}px`;
        drawerPanel.style.height = `calc(100vh - ${top}px)`;
      }
      if (drawerBackdrop) {
        drawerBackdrop.style.top = `${top}px`;
        drawerBackdrop.style.height = `calc(100vh - ${top}px)`;
      }
      return top;
    }

    function ensureDrawerElements() {
      if (drawerPanel && drawerBackdrop) return;

      ensureStyles();
      updateTopOffset();

      drawerBackdrop = document.createElement('div');
      drawerBackdrop.className = 'dsh-drawer-backdrop';
      drawerBackdrop.addEventListener('click', () => closeDrawer());

      drawerPanel = document.createElement('div');
      drawerPanel.className = 'dsh-drawer-panel';
      drawerPanel.innerHTML = `
        <div class="dsh-drawer-header">
          <div class="dsh-drawer-title-row">
            <div class="dsh-drawer-title-wrap">
              <span style="font-size: 16px;">📋</span>
              <h3 class="dsh-drawer-title">Session Progress</h3>
              <span class="dsh-drawer-status-badge in_progress" id="dsh-drawer-status-badge">IN PROGRESS</span>
            </div>
            <div class="dsh-drawer-actions">
              <button type="button" class="dsh-drawer-btn" id="dsh-refresh-btn" title="Refresh">
                <span>⟳</span>
              </button>
              <button type="button" class="dsh-drawer-btn close-btn" id="dsh-close-drawer-btn" title="Close (Esc)">
                ✕
              </button>
            </div>
          </div>
          <div class="dsh-drawer-progress-box">
            <div class="dsh-drawer-progress-label-row">
              <span class="dsh-drawer-progress-pct" id="dsh-drawer-pct-text">0% Completed</span>
              <span class="dsh-drawer-progress-detail" id="dsh-drawer-detail-text">0/0 tasks</span>
            </div>
            <div class="dsh-progress-track">
              <div class="dsh-progress-fill" id="dsh-drawer-progress-fill"></div>
            </div>
            <div class="dsh-drawer-activity-row" id="dsh-drawer-activity-row" style="display:none;">
              <span class="dsh-drawer-activity-icon">⚡</span>
              <span class="dsh-drawer-activity-text" id="dsh-drawer-activity-text"></span>
            </div>
          </div>
        </div>
        <div class="dsh-drawer-body" id="dsh-drawer-body-content">
          <div class="dsh-drawer-empty">
            <div class="dsh-drawer-empty-icon">⏳</div>
            <div>Loading session progress...</div>
          </div>
        </div>
        <div class="dsh-drawer-footer">
          <div class="dsh-drawer-path-box" id="dsh-drawer-file-path" title="Click to copy full path">
            <span style="flex-shrink:0;">📁</span>
            <span class="dsh-drawer-path-text" id="dsh-drawer-file-name">(No file active)</span>
          </div>
          <div class="dsh-drawer-footer-actions">
            <div class="dsh-drawer-updated-box" id="dsh-drawer-last-updated">Updated: --</div>
            <button type="button" class="dsh-drawer-btn dsh-drawer-footer-btn" id="dsh-open-file-btn" title="Open file in default editor">
              <span>↗ Open</span>
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(drawerBackdrop);
      document.body.appendChild(drawerPanel);

      // Bind Drawer events
      drawerPanel.querySelector('#dsh-open-file-btn').addEventListener('click', openProgressFile);
      drawerPanel.querySelector('#dsh-refresh-btn').addEventListener('click', () => {
        lastRenderedContent = null;
        fetchProgress(activeSessionId);
      });
      drawerPanel.querySelector('#dsh-close-drawer-btn').addEventListener('click', () => closeDrawer());

      // Track mouse dragging / selection on drawer body
      const bodyEl = drawerPanel.querySelector('#dsh-drawer-body-content');
      if (bodyEl) {
        bodyEl.addEventListener('mousedown', () => {
          isMouseDownOnDrawer = true;
        });
      }
      window.addEventListener('mouseup', () => {
        isMouseDownOnDrawer = false;
      });

      const pathBox = drawerPanel.querySelector('#dsh-drawer-file-path');
      pathBox.addEventListener('click', () => {
        if (latestData?.filePath) {
          navigator.clipboard.writeText(latestData.filePath);
          const nameSpan = drawerPanel.querySelector('#dsh-drawer-file-name');
          if (nameSpan) {
            const orig = nameSpan.textContent;
            nameSpan.textContent = '✓ Path copied!';
            setTimeout(() => { nameSpan.textContent = orig; }, 1200);
          }
        }
      });

      // Escape key listener
      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isDrawerOpen) {
          closeDrawer();
        }
      });

      window.addEventListener('resize', () => {
        if (isDrawerOpen) updateTopOffset();
      });
    }

    function openDrawer(sessionId) {
      ensureDrawerElements();
      updateTopOffset();
      if (sessionId && sessionId !== activeSessionId) {
        activeSessionId = sessionId;
        lastRenderedContent = null;
      }
      isDrawerOpen = true;
      document.body.classList.add('dsh-drawer-open');
      drawerBackdrop.classList.add('open');
      drawerPanel.classList.add('open');
      fetchProgress(activeSessionId);
      startPolling(1500);
    }

    function closeDrawer() {
      if (!drawerPanel) return;
      isDrawerOpen = false;
      document.body.classList.remove('dsh-drawer-open');
      drawerBackdrop.classList.remove('open');
      drawerPanel.classList.remove('open');
      startPolling(3000);
    }

    function toggleDrawer(sessionId) {
      if (isDrawerOpen) {
        closeDrawer();
      } else {
        openDrawer(sessionId);
      }
    }

    function updateDrawerUI(data) {
      if (!drawerPanel) return;

      const pctTextEl = drawerPanel.querySelector('#dsh-drawer-pct-text');
      const detailTextEl = drawerPanel.querySelector('#dsh-drawer-detail-text');
      const fillEl = drawerPanel.querySelector('#dsh-drawer-progress-fill');
      const bodyEl = drawerPanel.querySelector('#dsh-drawer-body-content');
      const pathEl = drawerPanel.querySelector('#dsh-drawer-file-path');
      const nameEl = drawerPanel.querySelector('#dsh-drawer-file-name');
      const updatedEl = drawerPanel.querySelector('#dsh-drawer-last-updated');
      const statusBadge = drawerPanel.querySelector('#dsh-drawer-status-badge');
      const actRow = drawerPanel.querySelector('#dsh-drawer-activity-row');
      const actText = drawerPanel.querySelector('#dsh-drawer-activity-text');

      if (!data) {
        if (statusBadge) {
          statusBadge.className = 'dsh-drawer-status-badge starting';
          statusBadge.textContent = 'STARTING';
        }
        if (pctTextEl) {
          pctTextEl.textContent = '0% Completed';
          pctTextEl.classList.remove('done');
        }
        if (detailTextEl) {
          detailTextEl.textContent = '0/0 tasks completed';
        }
        if (fillEl) {
          fillEl.style.width = '0%';
          fillEl.classList.remove('done');
        }
        if (actRow) actRow.style.display = 'none';
        if (bodyEl) {
          bodyEl.innerHTML = renderMarkdownToHtml('');
          lastRenderedContent = null;
        }
        if (nameEl) {
          nameEl.textContent = '(No file active)';
        } else if (pathEl) {
          pathEl.innerHTML = '<span style="flex-shrink:0;">📁</span><span class="dsh-drawer-path-text">(No file active)</span>';
        }
        if (updatedEl) updatedEl.textContent = 'Updated: --';
        return;
      }

      const pct = typeof data?.percent === 'number' ? data.percent : 0;
      if (statusBadge) {
        const st = (data?.status || (pct === 100 ? 'completed' : 'in_progress')).toLowerCase();
        statusBadge.className = `dsh-drawer-status-badge ${st}`;
        statusBadge.textContent = st.replace(/_/g, ' ');
      }

      if (pctTextEl) {
        pctTextEl.textContent = `${pct}% Completed`;
        if (pct === 100) pctTextEl.classList.add('done');
        else pctTextEl.classList.remove('done');
      }

      if (detailTextEl) {
        const total = data?.tasksTotal || 0;
        const done = data?.tasksDone || 0;
        if (total > 0) {
          detailTextEl.textContent = `${done}/${total} tasks completed`;
        } else {
          detailTextEl.textContent = 'Checklist not specified';
        }
      }

      if (fillEl) {
        fillEl.style.width = `${pct}%`;
        if (pct === 100) fillEl.classList.add('done');
        else fillEl.classList.remove('done');
      }

      if (actRow && actText) {
        if (data?.currentActivity) {
          actText.textContent = data.currentActivity;
          actRow.style.display = 'flex';
        } else {
          actRow.style.display = 'none';
        }
      }

      if (bodyEl) {
        const newContent = data?.content || '';
        const currentSid = data?.sessionId || activeSessionId;

        if (currentSid && currentSid !== lastRenderedSessionId) {
          lastRenderedContent = null;
          lastRenderedSessionId = currentSid;
        }

        // Check if user has an active text selection inside bodyEl or is dragging mouse
        const selection = window.getSelection();
        const hasActiveSelection = Boolean(
          isMouseDownOnDrawer ||
          (selection && !selection.isCollapsed && selection.rangeCount > 0 &&
            (bodyEl.contains(selection.anchorNode) || bodyEl.contains(selection.focusNode)))
        );

        if (newContent !== lastRenderedContent) {
          // If user is actively selecting or highlighting text, postpone re-rendering to prevent clearing selection
          if (!hasActiveSelection) {
            const prevScrollTop = bodyEl.scrollTop;
            bodyEl.innerHTML = renderMarkdownToHtml(newContent);
            bodyEl.scrollTop = prevScrollTop;
            lastRenderedContent = newContent;
          }
        }
      }

      if (pathEl) {
        const rawName = data?.fileName || '(No file active)';
        let shortName = rawName;
        if (rawName.length > 32) {
          shortName = rawName.slice(0, 15) + '...' + rawName.slice(-10);
        }
        if (nameEl) {
          nameEl.textContent = shortName;
        } else {
          pathEl.innerHTML = `<span style="flex-shrink:0;">📁</span><span class="dsh-drawer-path-text">${escapeHtml(shortName)}</span>`;
        }
        pathEl.title = data?.filePath ? `Click to copy path: ${data.filePath}` : 'No file active';
      }

      if (updatedEl && data?.lastModified) {
        const d = new Date(data.lastModified);
        updatedEl.textContent = `Updated: ${d.toLocaleTimeString()}`;
      }
    }

    function updateHeaderButtonUI(pct, hasFile) {
      // Purge any button on titlebar, header, or inside drawer
      document.querySelectorAll('header .dsh-session-progress-button, [class*="utilities"] .dsh-session-progress-button, .dsh-drawer-panel .dsh-session-progress-button, .dsh-drawer-header .dsh-session-progress-button')
        .forEach(el => el.remove());

      let btn = document.querySelector('.dsh-session-progress-button');
      if (!hasFile) {
        if (btn) btn.style.display = 'none';
        return;
      }

      if (!btn) {
        btn = createProgressButton();
      }

      // Mount into composer trailing toolbar (beside ContextMeter and Model selector)
      const trailing = document.querySelector('[class*="trailing"]');
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

      btn.style.display = 'inline-flex';
      btn.removeAttribute('title'); // Prevent native OS tooltip overlapping the custom UI

      const ringFill = btn.querySelector('.dsh-progress-ring-fill');
      const circumference = 34.56;
      const offset = circumference * (1 - Math.min(100, Math.max(0, pct)) / 100);
      if (ringFill) {
        ringFill.setAttribute('stroke-dashoffset', String(offset));
        if (pct === 100) ringFill.classList.add('done');
        else ringFill.classList.remove('done');
      }

      const pill = btn.querySelector('.dsh-progress-pill');
      if (pill) {
        pill.textContent = `${pct}%`;
        if (pct === 100) pill.classList.add('done');
        else pill.classList.remove('done');
      }

      const activity = latestData?.currentActivity;
      let tooltip = btn.querySelector('#dsh-progress-btn-tooltip');
      if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.className = 'dsh-progress-tooltip';
        tooltip.id = 'dsh-progress-btn-tooltip';
        btn.appendChild(tooltip);
      }

      if (activity) {
        tooltip.innerHTML = `
          <div class="dsh-progress-tooltip-header">
            <span class="dsh-progress-tooltip-badge ${pct === 100 ? 'done' : ''}">${pct}%</span>
            <span class="dsh-progress-tooltip-title">Current Activity</span>
          </div>
          <div class="dsh-progress-tooltip-body">${escapeHtml(activity)}</div>
        `;
        btn.setAttribute('aria-label', `[${pct}%] ${activity}`);
      } else {
        tooltip.innerHTML = `
          <div class="dsh-progress-tooltip-header">
            <span class="dsh-progress-tooltip-badge ${pct === 100 ? 'done' : ''}">${pct}%</span>
            <span class="dsh-progress-tooltip-title">Session Progress</span>
          </div>
          <div class="dsh-progress-tooltip-hint">Click to view details</div>
        `;
        btn.setAttribute('aria-label', `Session Progress: ${pct}%`);
      }
    }

    function startPolling(intervalMs = 3000) {
      if (pollingTimer) clearInterval(pollingTimer);
      pollingTimer = setInterval(() => {
        const currentSid = resolveCurrentSessionId();
        if (currentSid !== activeSessionId) {
          activeSessionId = currentSid;
          lastRenderedContent = null;
          lastRenderedSessionId = currentSid;
        }
        fetchProgress(activeSessionId);
      }, intervalMs);
    }

    // --- Native Slot Handler: Do NOT render on Title Bar ---
    function SessionProgressHeaderAction() {
      // User requested moving progress button to composer toolbar
      return null;
    }

    function createProgressButton() {
      ensureStyles();
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'dsh-session-progress-button';
      btn.setAttribute('aria-label', `Session Progress: ${latestPercent}%`);

      const circumference = 34.56;
      const offset = circumference * (1 - Math.min(100, Math.max(0, latestPercent)) / 100);
      const isDone = latestPercent === 100;

      btn.innerHTML = `
        <svg class="dsh-progress-ring" viewBox="0 0 14 14" width="14" height="14" aria-hidden="true">
          <circle class="dsh-progress-ring-track" cx="7" cy="7" r="5.5"></circle>
          <circle class="dsh-progress-ring-fill ${isDone ? 'done' : ''}" cx="7" cy="7" r="5.5" stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"></circle>
        </svg>
        <span class="dsh-progress-pill ${isDone ? 'done' : ''}">${latestPercent}%</span>
        <div class="dsh-progress-tooltip" id="dsh-progress-btn-tooltip"></div>
      `;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleDrawer(resolveCurrentSessionId());
      });
      return btn;
    }

    let isUpdatingProgressDOM = false;
    let progressDebounceTimer = null;

    function isProgressPluginNode(node) {
      if (!node || node.nodeType !== 1) return false;
      const cls = node.className;
      if (typeof cls === 'string' && (cls.includes('dsh-session-progress') || cls.includes('dsh-drawer') || cls.includes('dsh-progress'))) return true;
      if (node.classList && (
        node.classList.contains('dsh-session-progress-button') ||
        node.classList.contains('dsh-drawer-overlay') ||
        node.classList.contains('dsh-drawer-panel') ||
        node.classList.contains('dsh-progress-tooltip')
      )) return true;
      return false;
    }

    function ensureFallbackButton() {
      if (isUpdatingProgressDOM) return;
      isUpdatingProgressDOM = true;
      try {
        // Remove any legacy titlebar buttons
        document.querySelectorAll('header .dsh-session-progress-button, [class*="utilities"] .dsh-session-progress-button, .dsh-drawer-panel .dsh-session-progress-button, .dsh-drawer-header .dsh-session-progress-button')
          .forEach(el => el.remove());

        const hasFile = Boolean(latestData && latestData.found && latestData.hasFile);
        updateHeaderButtonUI(latestPercent, hasFile);
      } finally {
        Promise.resolve().then(() => {
          isUpdatingProgressDOM = false;
        });
      }
    }

    function scheduleFallbackButton() {
      if (progressDebounceTimer) return;
      progressDebounceTimer = setTimeout(() => {
        progressDebounceTimer = null;
        ensureFallbackButton();
      }, 300);
    }

    // Export module apply & inject
    exports.inject = ['slots', 'sessions'];
    exports.apply = function(ctx) {
      console.log('[dsh-session-progress] client plugin loaded with bottom-right floating pill...');
      cordisCtx = ctx;
      ensureStyles();
      ensureDrawerElements();

      // Subscribe to sessions service changes if available
      try {
        if (ctx.sessions?.list?.subscribe) {
          ctx.sessions.list.subscribe(() => {
            const currentId = ctx.sessions?.list?.getSnapshot?.()?.current || null;
            if (currentId !== activeSessionId) {
              activeSessionId = currentId;
              lastRenderedContent = null;
              lastRenderedSessionId = currentId;
              if (!currentId) {
                latestData = null;
                latestPercent = 0;
                notifySubscribers();
                updateDrawerUI(null);
                updateHeaderButtonUI(0, false);
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
      ensureFallbackButton();
      const observer = new MutationObserver((mutations) => {
        if (isUpdatingProgressDOM) return;

        let relevant = false;
        for (const m of mutations) {
          const target = m.target;
          if (target && target.nodeType === 1) {
            if (
              isProgressPluginNode(target) ||
              target.closest?.('.dsh-session-progress-button') ||
              target.closest?.('.dsh-drawer-overlay') ||
              target.closest?.('.dsh-drawer-panel')
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
          scheduleFallbackButton();
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
