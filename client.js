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

        /* No press-down transform here on purpose: the trigger is a status readout, and a
           scale on :active made the ring visibly jump on every click. */

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

        /* --- Structured panel (schema v2: goal + weighted checklist tree) --- */
        .dsh-sp-goal {
          font-size: 15px;
          font-weight: 700;
          line-height: 1.35;
          margin: 0 0 4px;
          color: var(--dsw-alias-label-primary, #f4f4f5);
          overflow-wrap: break-word;
        }

        .dsh-sp-sub {
          font-size: 11px;
          line-height: 1.5;
          color: var(--dsw-alias-label-tertiary, #71717a);
          margin: 0 0 16px;
        }

        /* Sections keep the old Markdown panel's heading voice — blue accent bar, blue uppercase
           label, tinted rule — so Overview / Checklist / Current Activity read as headings instead
           of dim captions. */
        .dsh-sp-section {
          margin: 0 0 18px;
        }

        .dsh-sp-section:last-child {
          margin-bottom: 4px;
        }

        .dsh-sp-section-title {
          display: flex;
          align-items: center;
          gap: 7px;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.6px;
          text-transform: uppercase;
          color: #93c5fd;
          margin: 0 0 8px;
          padding-bottom: 5px;
          border-bottom: 1px solid rgba(59, 130, 246, 0.25);
          overflow-wrap: break-word;
        }

        .dsh-sp-section-title::before {
          content: '';
          display: inline-block;
          width: 3px;
          height: 12px;
          background: #3b82f6;
          border-radius: 2px;
          flex-shrink: 0;
        }

        /* Section metadata (e.g. "% = share of the job") trails the label as a soft badge. */
        .dsh-sp-hint {
          margin-left: auto;
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0;
          text-transform: none;
          color: rgba(147, 197, 253, 0.85);
          background: rgba(59, 130, 246, 0.12);
          border: 1px solid rgba(59, 130, 246, 0.22);
          border-radius: 999px;
          padding: 1px 7px;
          white-space: nowrap;
        }

        .dsh-sp-section-body {
          font-size: 13px;
          line-height: 1.6;
        }

        .dsh-sp-section-body > *:first-child { margin-top: 0; }
        .dsh-sp-section-body > *:last-child { margin-bottom: 0; }

        /* The computed share of the job, one badge per checklist item. */
        .dsh-sp-share {
          flex: none;
          align-self: center;
          font-size: 10px;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
          padding: 2px 6px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: var(--dsw-alias-label-secondary, #a1a1aa);
          white-space: nowrap;
        }

        .dsh-sp-node.done > .dsh-task-item .dsh-sp-share {
          background: rgba(34, 197, 94, 0.14);
          border-color: rgba(34, 197, 94, 0.3);
          color: #86efac;
        }

        .dsh-sp-node.in-progress > .dsh-task-item .dsh-sp-share {
          background: rgba(59, 130, 246, 0.18);
          border-color: rgba(59, 130, 246, 0.35);
          color: #93c5fd;
        }

        .dsh-sp-groupcount {
          font-size: 10px;
          font-weight: 600;
          font-variant-numeric: tabular-nums;
          color: var(--dsw-alias-label-tertiary, #71717a);
          margin-left: 6px;
        }

        /* A group's own completion, so a phase reads at a glance. */
        .dsh-sp-groupbar {
          height: 2px;
          margin: 0 0 3px 25px;
          border-radius: 2px;
          background: rgba(255, 255, 255, 0.07);
          overflow: hidden;
        }

        .dsh-sp-groupbar-fill {
          height: 100%;
          border-radius: 2px;
          background: linear-gradient(90deg, #3b82f6, #22c55e);
          transition: width 0.35s ease;
        }

        .dsh-sp-warn {
          font-size: 11px;
          line-height: 1.5;
          color: #fca5a5;
          background: rgba(248, 113, 113, 0.08);
          border: 1px solid rgba(248, 113, 113, 0.25);
          border-radius: 6px;
          padding: 6px 9px;
          margin: 0 0 12px;
          overflow-wrap: break-word;
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
     * Resolve the current Session ID from Cordis, URL, or DOM.
     *
     * 0.1.7 (Desktop v0.10.0) replaced the session list's `current` scalar with a
     * controller-owned `{ ids, byId, phase, projectionsBySession }` snapshot and gates
     * service access on the declared `inject` list, so `uiSession` is declared in
     * `exports.inject` and asked first — it is exactly what the shipped right-sidebar panel
     * reads. The older shapes stay as fallbacks so 0.1.6 and earlier keep working.
     */
    function resolveCurrentSessionId() {
      // 1. From Cordis services
      if (cordisCtx) {
        // 0.1.7: the Session the main view retains is the app's own notion of "current".
        try {
          const s = cordisCtx.uiSession?.adapter?.current?.getSnapshot?.()?.key;
          if (s) return s;
        } catch (e) {}
        // <= 0.1.6: a `current` scalar on the session list snapshot.
        try {
          const current = cordisCtx.sessions?.list?.getSnapshot?.()?.current;
          if (current) return current;
        } catch (e) {}
        // 0.1.7 without the uiSession service: rebuild its own rule from the list snapshot —
        // the first row the main view retains. Read-only, so a brand-new session screen (no
        // row retained yet) stays unresolved instead of naming a random session.
        try {
          const id = retainedSessionId(cordisCtx, cordisCtx.sessions?.list?.getSnapshot?.());
          if (id) return id;
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

      // 3. DOM inspection: the shipped right Sidebar marks its owner with the session it
      //    draws, which is the id we need whenever the panel is actually on screen.
      try {
        const rightbarOwner = document.querySelector('[data-sidebar-right-session]');
        const rightbarId = rightbarOwner && (rightbarOwner.getAttribute('data-sidebar-right-session') || rightbarOwner.dataset?.sidebarRightSession);
        if (rightbarId) return rightbarId;
      } catch (e) {}
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
     * The first session row the main view retains — the rule `uiSession` itself uses to pick
     * the current session when no binding is held yet.
     */
    function retainedSessionId(ctx, list) {
      const rows = list && list.byId;
      if (!rows) return null;
      const ids = Array.isArray(list.ids) && list.ids.length > 0 ? list.ids : Object.keys(rows);
      for (const id of ids) {
        if (!rows[id]) continue;
        let retained = rows[id].retainedBy?.mainView;
        if (retained === undefined) {
          try {
            retained = ctx.sessions?.retainInfo?.(id)?.getSnapshot?.()?.retainedBy?.mainView;
          } catch (e) {}
        }
        if ((retained ?? 0) > 0) return id;
      }
      return null;
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
     * Whether the composer trigger is worth showing at all.
     *
     * Hidden on the new-conversation screen: before a session exists there is no progress to
     * report. The only thing the control carried there was the ON/OFF switch for sessions about
     * to be created, which is why it used to stay mounted — `defaultEnabled` in
     * `~/.dsh-session-progress-settings.json` still covers that case.
     */
    function shouldShowProgressTrigger() {
      return currentSessionKey() !== null;
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
          // Guard against out-of-order responses if the user switched sessions. Only a
          // *resolved, different* session may invalidate the response: an unknown current
          // session (a brand-new screen, or a panel that carries its own session id as a
          // slot-scope prop) must not throw away the data it just fetched.
          const currentSid = resolveCurrentSessionId();
          const currentScope = currentSid && currentSid !== 'default' ? String(currentSid) : null;
          if (currentScope !== null && currentScope !== scope) {
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
     * The empty state, and the entry point for rendering a Markdown fragment.
     *
     * The panel itself is rendered from the structured document by
     * {@link renderProgressPanelHtml}; this Markdown path is what the free-text fields
     * (Overview, Current Activity, Next Steps, Notes) go through.
     */
    function renderMarkdownToHtml(markdown) {
      if (!markdown || !String(markdown).trim()) {
        return `
          <div class="dsh-sp-empty">
            <div class="dsh-sp-empty-icon">📋</div>
            <div class="dsh-sp-empty-title">No progress reported yet</div>
            <div class="dsh-sp-empty-text">The AI agent populates this panel automatically as it works through the task.</div>
          </div>
        `;
      }
      return markdownBodyToHtml(markdown);
    }

    /**
     * Parse lightweight Markdown into HTML (stripping YAML frontmatter from body)
     */
    function markdownBodyToHtml(markdown) {
      if (!markdown || !String(markdown).trim()) return '';

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
    // Structured progress panel (schema v2)
    // ============================================================================
    //
    // The server already computed everything derived — each row arrives with its
    // `depth`, its `state`, its subtree `percent` and its `weightPercent` (the share of
    // the whole job its weight works out to). The panel only lays that out, so the
    // numbers on screen can never disagree with the numbers in the document.

    /** Depth-first flatten, so row N on screen is row N for a `#N` matcher. */
    function flattenChecklist(nodes, out) {
      const acc = out || [];
      for (const node of nodes || []) {
        acc.push(node);
        flattenChecklist(node.children, acc);
      }
      return acc;
    }

    /** `20%` / `12.5%`, never `NaN%`. */
    function formatShare(value) {
      const num = Number(value);
      if (!Number.isFinite(num)) return '';
      return `${Number.isInteger(num) ? num : num.toFixed(1)}%`;
    }

    function clampPercent(value) {
      const num = Number(value);
      if (!Number.isFinite(num)) return 0;
      return Math.max(0, Math.min(100, num));
    }

    /** The weighted checklist tree: one row per item, indented by depth. */
    function renderChecklistHtml(nodes) {
      const rows = flattenChecklist(nodes, []);
      if (rows.length === 0) {
        return '<div class="dsh-sp-sub">No checklist yet — the agent adds one with <code class="dsh-md-code">session_progress_write</code>.</div>';
      }

      let html = '';
      for (const node of rows) {
        const stateClass = node.state === 'done' ? 'done' : node.state === 'running' ? 'in-progress' : 'pending';
        const mark = node.state === 'done' ? '✓' : node.state === 'running' ? '▶' : '';
        const indent = Math.max(0, (Number(node.depth) || 1) - 1) * 14;
        const count = node.isGroup
          ? `<span class="dsh-sp-groupcount">${node.done}/${node.leaves}</span>`
          : '';
        const share = formatShare(node.weightPercent);

        html += `<div class="dsh-sp-node ${stateClass}" style="margin-left:${indent}px">`;
        html += `<div class="dsh-task-item ${stateClass}">`;
        html += `<span class="dsh-task-checkbox">${mark}</span>`;
        html += `<span class="dsh-task-label">${inlineFormat(node.text)}${count}</span>`;
        if (share) {
          html += `<span class="dsh-sp-share" title="Share of the whole job, computed from this item's declared weight">${share}</span>`;
        }
        html += '</div>';
        if (node.isGroup) {
          html +=
            `<div class="dsh-sp-groupbar"><div class="dsh-sp-groupbar-fill" style="width:${clampPercent(node.percent)}%"></div></div>`;
        }
        html += '</div>';
      }
      return html;
    }

    /** One labelled section; empty bodies are dropped rather than shown as "(empty)". */
    function renderSection(label, bodyHtml, hint) {
      if (!bodyHtml || !String(bodyHtml).trim()) return '';
      const badge = hint ? `<span class="dsh-sp-hint">${escapeHtml(hint)}</span>` : '';
      return (
        `<div class="dsh-sp-section">` +
        `<div class="dsh-sp-section-title">${escapeHtml(label)}${badge}</div>` +
        `<div class="dsh-sp-section-body">${bodyHtml}</div>` +
        '</div>'
      );
    }

    /**
     * The whole panel body, built from the JSON document the API returned.
     * @param {object} data - the `/content` payload.
     * @returns {string} HTML.
     */
    function renderProgressPanelHtml(data) {
      if (!data || !data.found || !data.hasFile) return renderMarkdownToHtml('');

      const total = Number(data.tasksTotal) || 0;
      const done = Number(data.tasksDone) || 0;
      const percent = clampPercent(data.percent);
      const summaryBits = [
        total > 0 ? `${done}/${total} items done` : 'no checklist yet',
        `${percent}% weighted`,
        data.groups ? `${data.groups} group${data.groups > 1 ? 's' : ''}` : null,
        data.corrupted ? 'invalid document' : null,
        data.migrated ? 'migrated from Markdown' : null
      ].filter(Boolean);

      const parts = [];
      if (data.title) parts.push(`<div class="dsh-sp-goal">${inlineFormat(data.title)}</div>`);
      parts.push(`<div class="dsh-sp-sub">${escapeHtml(summaryBits.join(' · '))}</div>`);

      if (data.corrupted && Array.isArray(data.warnings) && data.warnings.length > 0) {
        parts.push(`<div class="dsh-sp-warn">${escapeHtml(data.warnings.join(' '))}</div>`);
      }

      parts.push(renderSection('Overview', markdownBodyToHtml(data.overview)));
      parts.push(renderSection('Checklist', renderChecklistHtml(data.checklist), '% = share of the job'));
      parts.push(renderSection('Current Activity', markdownBodyToHtml(data.currentActivity)));
      parts.push(renderSection('Next Steps', markdownBodyToHtml(data.nextSteps)));
      parts.push(renderSection('Key Findings / Notes', markdownBodyToHtml(data.notes)));

      return parts.filter(Boolean).join('');
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
      const html = React.useMemo(() => renderProgressPanelHtml(data), [content]);

      // Keep the reader's place across polls: the rendered HTML is stable while the
      // document is unchanged (React skips an identical string), so a changed document
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
              ? (tasksTotal > 0
                  ? `${tasksDone}/${tasksTotal} items done · ${state.percent}% weighted`
                  : `Checklist not specified (${state.percent}%)`)
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
              title: 'Copy the progress JSON document',
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

    /** The composer dock slot's key, exactly as its DOM anchor spells it. */
    const COMPOSER_DOCK_SLOT = 'conversation.composer.dock';

    /**
     * The row that hosts the `conversation.composer.dock` slot.
     *
     * A slot outlet renders as `<div data-slot="…" style="display:contents">`, so the anchor is
     * invisible to layout and the row the eye reads as "under the composer card" is the anchor's
     * PARENT. Mounting there makes the trigger a flex item of that row — beside the dock slot's own
     * entries and ContextMeter — without nesting it inside somebody else's slot.
     * @param {Document} [doc] - injectable for tests.
     * @returns {Element|null} null while the composer is not on screen.
     */
    function findComposerDockHost(doc) {
      const target = doc || document;
      const selector = `[data-slot="${COMPOSER_DOCK_SLOT}"]`;
      const anchors = Array.from(target.querySelectorAll?.(selector) || []);
      if (anchors.length === 0 && target.querySelector) {
        const single = target.querySelector(selector);
        if (single) anchors.push(single);
      }
      if (anchors.length === 0) return null;

      // A split view renders one composer per pane; prefer a row that is actually laid out, and
      // fall back to the first so a pane still spinning up is never left without a trigger.
      const laidOut = anchors.find((anchor) => {
        const host = anchor.parentElement;
        if (!host) return false;
        if (typeof host.getClientRects !== 'function') return true;
        return host.getClientRects().length > 0;
      });
      return (laidOut ?? anchors[0])?.parentElement ?? null;
    }

    /**
     * Place the trigger. The dock row wins; the trailing toolbar (beside ContextMeter and the model
     * selector) is the fallback for a harness without the dock slot. A MutationObserver remounts
     * this on every composer re-render, so the button must never be lost when a lookup fails.
     * @param {HTMLElement} btn - the trigger element.
     * @param {Document} [doc] - injectable for tests.
     * @returns {Element|null} the element the button ends up in.
     */
    function mountProgressButton(btn, doc) {
      const target = doc || document;

      const dockHost = findComposerDockHost(target);
      if (dockHost) {
        if (btn.parentNode !== dockHost) dockHost.appendChild(btn);
        return dockHost;
      }

      // Fallback: the trailing toolbar, preferring the candidate that really is the composer's
      // (it carries ContextMeter or the model selector).
      const trailingCandidates = Array.from(target.querySelectorAll?.('[class*="trailing"]') || []);
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
        return trailing;
      }

      if (!btn.parentNode && target.body) target.body.appendChild(btn);
      return btn.parentNode ?? null;
    }

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

      // Mount into the composer dock row (the row under the composer card that hosts the
      // `conversation.composer.dock` slot), falling back to the trailing toolbar.
      mountProgressButton(btn);

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
          // Ready session without a progress file yet (0% badge stays hidden)
          tooltip.innerHTML = `
            <div class="dsh-progress-tooltip-header">
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
          btn.setAttribute('aria-label', 'Session Progress: Ready');
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
        if (activeSessionId) {
          fetchProgress(activeSessionId);
          return;
        }
        // No resolvable current session: the trigger is hidden, and the `default` scope is only
        // polled to keep the panel's view of it fresh — never to wipe a panel that carries its own
        // session id.
        if (!latestData || !latestData.found) fetchProgress('default');
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
    // `uiSession` is the service that names the current session on 0.1.7+; Cordis only hands
    // a service over to a plugin that declares it, so it must be listed here.
    exports.inject = ['slots', 'sessions', 'uiSession', 'sidebarRightTabs', 'sidebarRight'];
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
            // Resolve through the same chain the panel uses: 0.1.7 dropped the list
            // snapshot's `current` scalar, so reading it directly would freeze the trigger.
            const currentId = resolveCurrentSessionId();
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
