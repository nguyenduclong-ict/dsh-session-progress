window.__ModuleLoader__.load({
  id: 'dsh-session-progress',
  factory: (require) => {
    const module = { exports: {} };
    const exports = module.exports;

    console.log('[dsh-session-progress] client factory loaded!');

    const React = require('react');

    const STYLE_ID = 'dsh-session-progress-style';

    // DSH Native SVG Icons from @deepseek-ai/dsh-client-ui-primitives
    const DSH_ICON_REFRESH = `<svg width="13" height="13" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:block;"><path d="M1.272 6.21348C1.70645 3.08888 4.59169 0.908064 7.71634 1.34239C8.95495 1.51469 10.0438 2.07331 10.8814 2.87755L11.9458 1.81407C12.1347 1.6255 12.4572 1.75911 12.4575 2.02598V5.08751C12.4574 5.25303 12.3233 5.38731 12.1577 5.38731H9.0972C8.82993 5.38731 8.69629 5.06361 8.88528 4.87462L10.0327 3.72618C9.3732 3.09994 8.52006 2.66569 7.5513 2.53087C5.08313 2.18779 2.80376 3.91044 2.46048 6.37852C2.11747 8.84665 3.84009 11.1261 6.30814 11.4693C8.77612 11.8121 11.0557 10.0896 11.399 7.62169L11.9937 7.70372L12.5874 7.78673C12.153 10.9112 9.26756 13.0919 6.1431 12.6578C3.01854 12.2234 0.837738 9.33809 1.272 6.21348Z" fill="currentColor"/></svg>`;

    const DSH_ICON_CLOSE = `<svg width="13" height="13" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:block;"><path d="M14.1168 13.197L13.197 14.1167L1.8833 2.80303L2.80309 1.88324L14.1168 13.197Z" fill="currentColor"/><path d="M13.197 1.88326L14.1168 2.80305L2.80309 14.1168L1.8833 13.197L13.197 1.88326Z" fill="currentColor"/></svg>`;

    function ensureStyles() {
      if (document.getElementById(STYLE_ID)) return;
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = `
        :root {
          --dsh-drawer-top: 40px;
          --dsh-drawer-width: 420px;
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
          width: var(--dsh-drawer-width, 420px);
          max-width: calc(100vw - 40px);
          background: var(--dsw-alias-bg-floating, #18181b);
          border-left: 1px solid var(--dsw-alias-border-l1, rgba(255, 255, 255, 0.12));
          box-shadow: -6px 0 24px rgba(0, 0, 0, 0.45);
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

        /* --- Hybrid Responsive: Desktop Split-View in [data-side="right"] vs Compact Drawer --- */
        @media (min-width: 960px) {
          /* Desktop Split View: Disable dark overlay backdrop so user can interact with session */
          body.dsh-drawer-open .dsh-drawer-backdrop {
            display: none !important;
            opacity: 0 !important;
            pointer-events: none !important;
          }

          /* Reset any whole-frame overrides */
          [class*="frame"],
          body.dsh-drawer-open [class*="frame"] {
            width: 100% !important;
            transition: none !important;
          }

          /* Contract conversation scroll body so it does not collide with [data-side="right"] */
          body.dsh-drawer-open [data-conversation-scroll],
          body.dsh-drawer-open [class*="scrollBody"] {
            margin-right: var(--dsh-drawer-width, 420px) !important;
            transition: margin-right 0.28s cubic-bezier(0.16, 1, 0.3, 1);
          }

          [data-conversation-scroll],
          [class*="scrollBody"] {
            transition: margin-right 0.28s cubic-bezier(0.16, 1, 0.3, 1);
          }

          /* Style [data-side="right"] as the dock container when drawer is open */
          [data-side="right"] {
            transition: width 0.28s cubic-bezier(0.16, 1, 0.3, 1) !important;
          }

          body.dsh-drawer-open [data-side="right"] {
            position: absolute !important;
            top: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            left: auto !important;
            width: var(--dsh-drawer-width, 420px) !important;
            cursor: default !important;
            pointer-events: auto !important;
            z-index: 10 !important;
            display: flex !important;
            flex-direction: column !important;
            background: var(--dsw-alias-bg-floating, #18181b);
            border-left: 1px solid var(--dsw-alias-border-l1, rgba(255, 255, 255, 0.12));
            box-shadow: -6px 0 24px rgba(0, 0, 0, 0.45);
          }

          /* Hide resize handle indicator line of WidthHandle when drawer is open */
          body.dsh-drawer-open [data-side="right"]:after {
            display: none !important;
          }

          /* Panel styling when inside [data-side="right"] */
          [data-side="right"] > .dsh-drawer-panel {
            display: none;
            position: relative !important;
            top: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            left: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            height: 100% !important;
            transform: none !important;
            box-shadow: none !important;
            border-left: none !important;
            background: transparent !important;
          }

          body.dsh-drawer-open [data-side="right"] > .dsh-drawer-panel {
            display: flex !important;
          }
        }

        @media (max-width: 959px) {
          /* Compact View: Keep modal drawer overlay with responsive maximum width */
          .dsh-drawer-panel {
            width: 420px;
            max-width: 90vw;
          }
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

        .dsh-drawer-status-badge.disabled {
          background: rgba(113, 113, 122, 0.18);
          color: #a1a1aa;
          border-color: rgba(113, 113, 122, 0.35);
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

        .dsh-drawer-btn.icon-only-btn {
          width: 26px;
          height: 26px;
          padding: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex: none;
        }

        .dsh-drawer-btn.icon-only-btn svg {
          display: block;
          flex: none;
          pointer-events: none;
        }

        .dsh-drawer-btn.refreshing svg {
          animation: dsh-btn-spin 0.65s linear infinite;
        }

        @keyframes dsh-btn-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .dsh-drawer-btn.close-btn {
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
    const sessionEnabledMap = new Map();

    function isSessionEnabled(sessionId) {
      if (!sessionId) return true;
      const sId = String(sessionId);
      if (sessionEnabledMap.has(sId)) {
        return sessionEnabledMap.get(sId);
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
      if (isDrawerOpen) {
        updateDrawerUI(target ? latestData : (latestData ? { ...latestData, enabled: false } : { enabled: false }));
      }

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
    }

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
        updateHeaderButtonUI(0, false, true);
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

          const isEnabled = data?.enabled !== undefined ? Boolean(data.enabled) : isSessionEnabled(sessionId);
          sessionEnabledMap.set(String(sessionId), isEnabled);

          const hasFile = Boolean(data && data.found && data.hasFile);
          latestData = hasFile ? { ...data, enabled: isEnabled } : (isEnabled ? null : { enabled: false });
          latestPercent = (hasFile && typeof data.percent === 'number') ? data.percent : 0;
          activeSessionId = sessionId;

          notifySubscribers();
          if (hasFile && isEnabled) {
            updateDrawerUI(latestData);
          } else if (!isEnabled) {
            updateDrawerUI({ enabled: false, ...latestData });
          } else {
            updateDrawerUI(null);
          }
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

    function syncDrawerContainer() {
      if (!drawerPanel) return;
      const isDesktop = window.innerWidth >= 960;
      const rightContainer = document.querySelector('[data-side="right"]');

      if (isDesktop && rightContainer) {
        if (drawerPanel.parentElement !== rightContainer) {
          rightContainer.appendChild(drawerPanel);
        }
      } else {
        if (drawerPanel.parentElement !== document.body) {
          document.body.appendChild(drawerPanel);
        }
      }
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
              <button type="button" class="dsh-drawer-btn icon-only-btn" id="dsh-refresh-btn" title="Refresh">
                ${DSH_ICON_REFRESH}
              </button>
              <button type="button" class="dsh-drawer-btn close-btn icon-only-btn" id="dsh-close-drawer-btn" title="Close (Esc)">
                ${DSH_ICON_CLOSE}
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
      syncDrawerContainer();
      if (!drawerPanel.parentElement) {
        document.body.appendChild(drawerPanel);
      }

      // Stop pointer events propagation to prevent WidthHandle [data-side="right"] from capturing resize drag
      const stopDrag = (e) => e.stopPropagation();
      drawerPanel.addEventListener('pointerdown', stopDrag);
      drawerPanel.addEventListener('pointermove', stopDrag);
      drawerPanel.addEventListener('pointerup', stopDrag);
      drawerPanel.addEventListener('mousedown', stopDrag);
      drawerPanel.addEventListener('mouseup', stopDrag);

      // Bind Drawer events
      drawerPanel.querySelector('#dsh-open-file-btn').addEventListener('click', openProgressFile);
      const refreshBtn = drawerPanel.querySelector('#dsh-refresh-btn');
      refreshBtn.addEventListener('click', async () => {
        refreshBtn.classList.add('refreshing');
        lastRenderedContent = null;
        try {
          await fetchProgress(activeSessionId);
        } finally {
          setTimeout(() => refreshBtn.classList.remove('refreshing'), 450);
        }
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
        if (isDrawerOpen) {
          syncDrawerContainer();
          updateTopOffset();
        }
      });
    }

    function openDrawer(sessionId) {
      ensureDrawerElements();
      syncDrawerContainer();
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
      setTimeout(() => {
        try { window.dispatchEvent(new Event('resize')); } catch (e) {}
      }, 300);
    }

    function closeDrawer() {
      if (!drawerPanel) return;
      isDrawerOpen = false;
      document.body.classList.remove('dsh-drawer-open');
      drawerBackdrop.classList.remove('open');
      drawerPanel.classList.remove('open');
      startPolling(3000);
      setTimeout(() => {
        try { window.dispatchEvent(new Event('resize')); } catch (e) {}
      }, 300);
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

      if (data && data.enabled === false) {
        if (statusBadge) {
          statusBadge.className = 'dsh-drawer-status-badge disabled';
          statusBadge.textContent = 'DISABLED';
        }
        if (pctTextEl) {
          pctTextEl.textContent = 'Progress Disabled';
          pctTextEl.classList.remove('done');
        }
        if (detailTextEl) {
          detailTextEl.textContent = 'Tracking is paused';
        }
        if (fillEl) {
          fillEl.style.width = '0%';
          fillEl.classList.remove('done');
        }
        if (actRow) actRow.style.display = 'none';
        if (bodyEl) {
          bodyEl.innerHTML = `
            <div class="dsh-drawer-empty">
              <div class="dsh-drawer-empty-icon">⏸️</div>
              <div style="font-weight:600; margin-bottom:6px; color:#e4e4e7;">Session Progress is Disabled</div>
              <div style="color:#a1a1aa; font-size:12px; margin-bottom:14px; max-width:280px; text-align:center;">Automatic progress tracking is paused for this session to conserve prompt tokens.</div>
              <button type="button" class="dsh-drawer-btn" id="dsh-drawer-enable-btn" style="padding:6px 14px; background:#3b82f6; color:#fff; border-color:#2563eb; cursor:pointer;">
                ⚡ Re-enable Progress
              </button>
            </div>
          `;
          const enableBtn = bodyEl.querySelector('#dsh-drawer-enable-btn');
          if (enableBtn) {
            enableBtn.addEventListener('click', () => toggleSessionProgress(activeSessionId, true));
          }
          lastRenderedContent = null;
        }
        if (nameEl) {
          nameEl.textContent = '(Progress disabled)';
        }
        if (updatedEl) updatedEl.textContent = 'Status: Disabled';
        return;
      }

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

    function updateHeaderButtonUI(pct, hasFile, isEnabled) {
      const currentSid = resolveCurrentSessionId() || 'default';
      if (isEnabled === undefined) {
        isEnabled = isSessionEnabled(currentSid);
      }

      // Purge any button on titlebar, header, or inside drawer
      document.querySelectorAll('header .dsh-session-progress-button, [class*="utilities"] .dsh-session-progress-button, .dsh-drawer-panel .dsh-session-progress-button, .dsh-drawer-header .dsh-session-progress-button')
        .forEach(el => el.remove());

      let btn = document.querySelector('.dsh-session-progress-button');
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
      const pill = btn.querySelector('.dsh-progress-pill');
      let tooltip = btn.querySelector('#dsh-progress-btn-tooltip');
      if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.className = 'dsh-progress-tooltip';
        tooltip.id = 'dsh-progress-btn-tooltip';
        btn.appendChild(tooltip);
      }

      const activity = latestData?.currentActivity;

      if (!isEnabled) {
        btn.classList.add('disabled');
        if (ringFill) {
          ringFill.setAttribute('stroke-dashoffset', String(circumference));
          ringFill.classList.remove('done');
        }
        if (pill) {
          pill.textContent = 'OFF';
          pill.classList.remove('done');
        }
        tooltip.innerHTML = `
          <div class="dsh-progress-tooltip-header">
            <span class="dsh-progress-tooltip-badge disabled">OFF</span>
            <span class="dsh-progress-tooltip-title">Session Progress</span>
          </div>
          <div class="dsh-progress-tooltip-body" style="color:var(--dsw-alias-label-tertiary, #71717a); font-size:11px;">
            Progress tracking is disabled for this session (conserves tokens).
          </div>
          <div class="dsh-tooltip-toggle-row">
            <span class="dsh-tooltip-toggle-label">
              <span>⚡ Session Progress</span>
            </span>
            <div class="dsh-toggle-switch" id="dsh-tooltip-toggle-switch" title="Enable progress tracking for this session"></div>
          </div>
        `;
        btn.setAttribute('aria-label', 'Session Progress: Disabled (OFF)');
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

        if (pill) {
          pill.textContent = `${numPct}%`;
          if (isDone) pill.classList.add('done');
          else pill.classList.remove('done');
        }

        if (hasFile && activity) {
          tooltip.innerHTML = `
            <div class="dsh-progress-tooltip-header">
              <span class="dsh-progress-tooltip-badge ${isDone ? 'done' : ''}">${numPct}%</span>
              <span class="dsh-progress-tooltip-title">Current Activity</span>
            </div>
            <div class="dsh-progress-tooltip-body">${escapeHtml(activity)}</div>
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
            <div class="dsh-progress-tooltip-hint">Click to view details</div>
            <div class="dsh-tooltip-toggle-row">
              <span class="dsh-tooltip-toggle-label">
                <span>⚡ Session Progress</span>
              </span>
              <div class="dsh-toggle-switch active" id="dsh-tooltip-toggle-switch" title="Disable progress tracking for this session"></div>
            </div>
          `;
          btn.setAttribute('aria-label', `Session Progress: ${numPct}%`);
        } else {
          // Ready / New session without progress file yet
          tooltip.innerHTML = `
            <div class="dsh-progress-tooltip-header">
              <span class="dsh-progress-tooltip-badge">0%</span>
              <span class="dsh-progress-tooltip-title">Ready to Track</span>
            </div>
            <div class="dsh-progress-tooltip-body" style="color:var(--dsw-alias-label-secondary, #a1a1aa); font-size:11px;">
              Agent will automatically track progress upon starting tasks.
            </div>
            <div class="dsh-tooltip-toggle-row">
              <span class="dsh-tooltip-toggle-label">
                <span>⚡ Session Progress</span>
              </span>
              <div class="dsh-toggle-switch active" id="dsh-tooltip-toggle-switch" title="Disable progress tracking for this session"></div>
            </div>
          `;
          btn.setAttribute('aria-label', 'Session Progress: Ready (0%)');
        }
      }

      // Bind toggle switch click
      const switchEl = tooltip.querySelector('#dsh-tooltip-toggle-switch');
      if (switchEl) {
        switchEl.addEventListener('click', (e) => {
          e.stopPropagation();
          e.preventDefault();
          toggleSessionProgress(resolveCurrentSessionId());
        });
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
        const isEnabled = isSessionEnabled(resolveCurrentSessionId());
        updateHeaderButtonUI(latestPercent, hasFile, isEnabled);
        if (isDrawerOpen) {
          syncDrawerContainer();
        }
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
