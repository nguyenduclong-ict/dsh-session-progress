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
        /* --- Header Action Button --- */
        .dsh-session-progress-button {
          border: 0.5px solid var(--dsw-alias-border-l4, rgba(255, 255, 255, 0.15));
          min-width: 110px;
          height: 32px;
          color: var(--dsw-alias-label-primary, #f4f4f5);
          font-family: var(--dsw-font-family, system-ui, sans-serif);
          cursor: pointer;
          background: transparent;
          border-radius: 18px;
          justify-content: center;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          font-size: 13px;
          font-weight: 400;
          line-height: 20px;
          display: inline-flex;
          user-select: none;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          margin-right: 6px;
        }

        .dsh-session-progress-button:hover {
          background: var(--dsw-alias-interactive-bg-hover, rgba(255, 255, 255, 0.08));
          border-color: var(--dsw-alias-border-l2, rgba(255, 255, 255, 0.3));
        }

        .dsh-session-progress-button:active {
          transform: scale(0.97);
        }

        .dsh-progress-icon {
          font-size: 13px;
          line-height: 1;
        }

        .dsh-progress-text {
          font-weight: 500;
        }

        .dsh-progress-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 1px 7px;
          border-radius: 10px;
          font-size: 11px;
          font-weight: 600;
          background: rgba(59, 130, 246, 0.2);
          color: #60a5fa;
          border: 1px solid rgba(59, 130, 246, 0.3);
          transition: all 0.3s ease;
        }

        .dsh-progress-pill.done {
          background: rgba(34, 197, 94, 0.2);
          color: #4ade80;
          border-color: rgba(34, 197, 94, 0.35);
        }

        /* --- Slide-over Drawer & Backdrop --- */
        .dsh-drawer-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
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
          top: 0;
          right: 0;
          bottom: 0;
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
          padding: 16px 20px;
          border-bottom: 1px solid var(--dsw-alias-border-l1, rgba(255, 255, 255, 0.1));
          background: var(--dsw-alias-bg-floating, #18181b);
          flex-shrink: 0;
        }

        .dsh-drawer-title-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        }

        .dsh-drawer-title-wrap {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .dsh-drawer-title {
          font-size: 16px;
          font-weight: 600;
          color: var(--dsw-alias-label-primary, #ffffff);
          margin: 0;
        }

        .dsh-drawer-actions {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .dsh-drawer-btn {
          background: transparent;
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
        }

        .dsh-drawer-btn:hover {
          color: var(--dsw-alias-label-primary, #ffffff);
          border-color: var(--dsw-alias-border-l2, rgba(255, 255, 255, 0.3));
          background: var(--dsw-alias-interactive-bg-hover, rgba(255, 255, 255, 0.08));
        }

        .dsh-drawer-btn.close-btn {
          padding: 4px 7px;
          font-size: 14px;
          line-height: 1;
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

        /* Drawer Body / Content */
        .dsh-drawer-body {
          flex: 1;
          overflow-y: auto;
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
          font-size: 16px;
          font-weight: 700;
          margin: 4px 0 12px 0;
          color: #ffffff;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          padding-bottom: 6px;
        }

        .dsh-md-h2 {
          font-size: 14px;
          font-weight: 600;
          margin: 16px 0 8px 0;
          color: #93c5fd;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .dsh-md-h3 {
          font-size: 13px;
          font-weight: 600;
          margin: 12px 0 6px 0;
          color: var(--dsw-alias-label-primary, #f4f4f5);
        }

        .dsh-md-p {
          margin: 6px 0 10px 0;
          color: var(--dsw-alias-label-secondary, #d4d4d8);
        }

        .dsh-md-blockquote {
          margin: 8px 0;
          padding: 6px 12px;
          border-left: 3px solid #3b82f6;
          background: rgba(59, 130, 246, 0.08);
          border-radius: 0 4px 4px 0;
          color: var(--dsw-alias-label-secondary, #d4d4d8);
        }

        .dsh-task-item {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          margin: 5px 0;
          font-size: 13px;
        }

        .dsh-task-checkbox {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 16px;
          height: 16px;
          border-radius: 4px;
          margin-top: 3px;
          flex-shrink: 0;
          font-size: 10px;
          border: 1px solid rgba(255, 255, 255, 0.2);
          user-select: none;
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
          background: transparent;
          border-color: rgba(255, 255, 255, 0.25);
        }

        .dsh-task-item.pending .dsh-task-label {
          color: var(--dsw-alias-label-primary, #f4f4f5);
        }

        .dsh-md-code {
          background: rgba(255, 255, 255, 0.08);
          padding: 2px 6px;
          border-radius: 4px;
          font-family: var(--dsw-font-markdown-code-block, monospace);
          font-size: 12px;
          color: #fcd34d;
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
        }

        .dsh-md-ul {
          margin: 6px 0 10px 16px;
          padding: 0;
        }

        .dsh-md-li {
          margin: 4px 0;
          color: var(--dsw-alias-label-secondary, #d4d4d8);
        }

        /* Drawer Footer */
        .dsh-drawer-footer {
          padding: 10px 20px;
          border-top: 1px solid var(--dsw-alias-border-l1, rgba(255, 255, 255, 0.1));
          background: rgba(0, 0, 0, 0.15);
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 11px;
          color: var(--dsw-alias-label-tertiary, #71717a);
          flex-shrink: 0;
        }

        .dsh-drawer-path-box {
          display: flex;
          align-items: center;
          gap: 6px;
          max-width: 280px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          cursor: pointer;
        }

        .dsh-drawer-path-box:hover {
          color: var(--dsw-alias-label-secondary, #d4d4d8);
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
    let activeSessionId = null;
    let latestPercent = 0;
    let latestData = null;
    let isDrawerOpen = false;
    let pollingTimer = null;
    const subscribers = new Set();

    function notifySubscribers() {
      subscribers.forEach((cb) => {
        try { cb(latestPercent, latestData, isDrawerOpen); } catch (e) {}
      });
    }

    /**
     * Resolve the current Session ID from URL or DOM
     */
    function resolveCurrentSessionId() {
      // 1. URL search param or hash
      try {
        const hashMatch = window.location.hash.match(/session[=\/]([a-zA-Z0-9_-]+)/);
        if (hashMatch && hashMatch[1]) return hashMatch[1];
        const searchMatch = window.location.search.match(/sessionId=([a-zA-Z0-9_-]+)/);
        if (searchMatch && searchMatch[1]) return searchMatch[1];
      } catch (e) {}

      // 2. DOM inspection for active session card or workspace
      try {
        const activeCard = document.querySelector('[data-session-id][data-active="true"], [data-session-id].active');
        if (activeCard) {
          const id = activeCard.getAttribute('data-session-id');
          if (id) return id;
        }
      } catch (e) {}

      return activeSessionId || 'default';
    }

    /**
     * Fetch session progress content from backend
     */
    async function fetchProgress(sessionId) {
      if (!sessionId) sessionId = resolveCurrentSessionId();
      try {
        const res = await fetch(`/api/session-progress/content?sessionId=${encodeURIComponent(sessionId)}`);
        if (res.ok) {
          const data = await res.json();
          latestData = data;
          latestPercent = typeof data.percent === 'number' ? data.percent : 0;
          notifySubscribers();
          updateDrawerUI(data);
          updateHeaderButtonUI(latestPercent);
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

    /**
     * Parse lightweight Markdown into HTML
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

      const lines = markdown.split('\n');
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
          html += `<h1 class="dsh-md-h1">${inlineFormat(line.slice(2))}</h1>`;
          continue;
        }
        if (line.startsWith('## ')) {
          if (inList) { html += '</ul>'; inList = false; }
          html += `<h2 class="dsh-md-h2">📌 ${inlineFormat(line.slice(3))}</h2>`;
          continue;
        }
        if (line.startsWith('### ')) {
          if (inList) { html += '</ul>'; inList = false; }
          html += `<h3 class="dsh-md-h3">${inlineFormat(line.slice(4))}</h3>`;
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

    function ensureDrawerElements() {
      if (drawerPanel && drawerBackdrop) return;

      ensureStyles();

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
            </div>
            <div class="dsh-drawer-actions">
              <button type="button" class="dsh-drawer-btn" id="dsh-open-file-btn" title="Open in default editor">
                <span>↗ Open</span>
              </button>
              <button type="button" class="dsh-drawer-btn" id="dsh-copy-md-btn" title="Copy Markdown">
                <span>📋 Copy</span>
              </button>
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
            <span>📁 (No file active)</span>
          </div>
          <div id="dsh-drawer-last-updated">Updated: --</div>
        </div>
      `;

      document.body.appendChild(drawerBackdrop);
      document.body.appendChild(drawerPanel);

      // Bind Drawer events
      drawerPanel.querySelector('#dsh-open-file-btn').addEventListener('click', openProgressFile);
      drawerPanel.querySelector('#dsh-copy-md-btn').addEventListener('click', function() {
        copyMarkdown(this);
      });
      drawerPanel.querySelector('#dsh-refresh-btn').addEventListener('click', () => {
        fetchProgress(activeSessionId);
      });
      drawerPanel.querySelector('#dsh-close-drawer-btn').addEventListener('click', () => closeDrawer());

      const pathBox = drawerPanel.querySelector('#dsh-drawer-file-path');
      pathBox.addEventListener('click', () => {
        if (latestData?.filePath) {
          navigator.clipboard.writeText(latestData.filePath);
          const orig = pathBox.innerHTML;
          pathBox.innerHTML = '<span>✓ Path copied!</span>';
          setTimeout(() => { pathBox.innerHTML = orig; }, 1200);
        }
      });

      // Escape key listener
      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isDrawerOpen) {
          closeDrawer();
        }
      });
    }

    function openDrawer(sessionId) {
      ensureDrawerElements();
      if (sessionId) activeSessionId = sessionId;
      isDrawerOpen = true;
      drawerBackdrop.classList.add('open');
      drawerPanel.classList.add('open');
      fetchProgress(activeSessionId);
      startPolling(1500);
    }

    function closeDrawer() {
      if (!drawerPanel) return;
      isDrawerOpen = false;
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
      const pct = typeof data?.percent === 'number' ? data.percent : 0;
      const pctTextEl = drawerPanel.querySelector('#dsh-drawer-pct-text');
      const detailTextEl = drawerPanel.querySelector('#dsh-drawer-detail-text');
      const fillEl = drawerPanel.querySelector('#dsh-drawer-progress-fill');
      const bodyEl = drawerPanel.querySelector('#dsh-drawer-body-content');
      const pathEl = drawerPanel.querySelector('#dsh-drawer-file-path');
      const updatedEl = drawerPanel.querySelector('#dsh-drawer-last-updated');

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

      if (bodyEl) {
        bodyEl.innerHTML = renderMarkdownToHtml(data?.content || '');
      }

      if (pathEl) {
        pathEl.innerHTML = `<span>📁 ${escapeHtml(data?.fileName || 'No file active')}</span>`;
        pathEl.title = data?.filePath ? `Click to copy: ${data.filePath}` : 'No file';
      }

      if (updatedEl && data?.lastModified) {
        const d = new Date(data.lastModified);
        updatedEl.textContent = `Updated: ${d.toLocaleTimeString()}`;
      }
    }

    function updateHeaderButtonUI(pct) {
      const btns = document.querySelectorAll('.dsh-session-progress-button, .dsh-task-progress-button');
      btns.forEach((btn) => {
        const pill = btn.querySelector('.dsh-progress-pill');
        if (pill) {
          pill.textContent = `${pct}%`;
          if (pct === 100) pill.classList.add('done');
          else pill.classList.remove('done');
        }
      });
    }

    function startPolling(intervalMs = 3000) {
      if (pollingTimer) clearInterval(pollingTimer);
      pollingTimer = setInterval(() => {
        const currentSid = resolveCurrentSessionId();
        if (currentSid) activeSessionId = currentSid;
        fetchProgress(activeSessionId);
      }, intervalMs);
    }

    // --- React Header Button Component for Slot ---
    function SessionProgressHeaderAction(props) {
      const sessionId = props.sessionId || resolveCurrentSessionId();
      const [percent, setPercent] = React.useState(latestPercent);

      React.useEffect(() => {
        activeSessionId = sessionId;
        const sub = (newPct) => {
          setPercent(newPct);
        };
        subscribers.add(sub);
        fetchProgress(sessionId);
        return () => { subscribers.delete(sub); };
      }, [sessionId]);

      return React.createElement(
        'button',
        {
          type: 'button',
          className: 'dsh-session-progress-button',
          title: 'View live session progress',
          onClick: () => toggleDrawer(sessionId)
        },
        React.createElement('span', { className: 'dsh-progress-icon' }, '📋'),
        React.createElement('span', { className: 'dsh-progress-text' }, 'Progress'),
        React.createElement(
          'span',
          { className: `dsh-progress-pill ${percent === 100 ? 'done' : ''}` },
          `${percent}%`
        )
      );
    }

    // --- Fallback DOM Injector ---
    function ensureFallbackButton() {
      const existing = document.querySelector('.dsh-session-progress-button, .dsh-task-progress-button');
      if (existing) return;

      const sessionLogBtn = document.querySelector('button.jGdBjq_sessionLogButton, button[class*="sessionLogButton"], button[aria-label*="Session log"], button:has(svg)');
      let targetHeader = null;
      let refNode = null;

      if (sessionLogBtn && sessionLogBtn.parentElement) {
        targetHeader = sessionLogBtn.parentElement;
        refNode = sessionLogBtn;
      } else {
        const headerContainers = document.querySelectorAll('header, [class*="header"], [class*="utilities"]');
        for (const c of headerContainers) {
          if (c.textContent.includes('Session log') || c.querySelector('button')) {
            targetHeader = c;
            break;
          }
        }
      }

      if (targetHeader) {
        ensureStyles();
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'dsh-session-progress-button';
        btn.title = 'View live session progress';
        btn.innerHTML = `
          <span class="dsh-progress-icon">📋</span>
          <span class="dsh-progress-text">Progress</span>
          <span class="dsh-progress-pill ${latestPercent === 100 ? 'done' : ''}">${latestPercent}%</span>
        `;
        btn.addEventListener('click', () => {
          toggleDrawer(resolveCurrentSessionId());
        });

        if (refNode) {
          targetHeader.insertBefore(btn, refNode);
        } else {
          targetHeader.appendChild(btn);
        }
        console.log('[dsh-session-progress] Injected fallback header button into DOM');
      }
    }

    // Export module apply & inject
    exports.inject = ['slots'];
    exports.apply = function(ctx) {
      console.log('[dsh-session-progress] client plugin applying slots and observers...');
      ensureStyles();
      ensureDrawerElements();

      // Register into native DSH Header slot
      try {
        ctx.slots.inject('conversation.session.header.utilities', () => {
          return ctx.slots.register(
            {
              name: 'conversation.session.header.utilities',
              id: 'dsh-session-progress-button',
              priority: 0,
              order: -10 // Render before session-log-download (order 0)
            },
            SessionProgressHeaderAction
          );
        });
        console.log('[dsh-session-progress] registered into slot conversation.session.header.utilities');
      } catch (err) {
        console.warn('[dsh-session-progress] Failed to register slot, relying on DOM observer:', err);
      }

      // Initial progress fetch
      fetchProgress(resolveCurrentSessionId());
      startPolling(3000);

      // DOM fallback observer
      ensureFallbackButton();
      const observer = new MutationObserver(() => {
        ensureFallbackButton();
      });
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    };

    return module.exports;
  }
});
