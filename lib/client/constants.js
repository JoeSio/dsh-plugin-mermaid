export const PLUGIN_ID = "dsh-plugin-mermaid";
export const MERMAID_VERSION = "11";
export const MERMAID_CDN = `https://cdn.jsdelivr.net/npm/mermaid@${MERMAID_VERSION}/dist/mermaid.esm.min.mjs`;
export const RENDER_DEBOUNCE_MS = 500;
export const ZOOM_MIN = 0.25;
export const ZOOM_MAX = 4;
export const ZOOM_STEP = 0.25;
export const FIT_PADDING_PX = 32;

export const MERMAID_START =
  /^(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram|journey|gantt|pie|mindmap|timeline|gitGraph|C4Context|C4Container|C4Component|C4Dynamic|C4Deployment|quadrantChart|requirementDiagram|sankey(?:-beta)?|xychart(?:-beta)?|block(?:-beta)?|packet(?:-beta)?|architecture(?:-beta)?|kanban|radar)\b/i;

export const CSS = `
      .md-code-block[data-dsh-mermaid] .dsh-mermaid-preview {
        padding: 12px;
        background: var(--dsw-alias-surface-l1, transparent);
        overflow: auto;
      }
      .md-code-block[data-dsh-mermaid] .dsh-mermaid-stage {
        display: flex;
        justify-content: center;
        min-height: 2em;
        cursor: zoom-in;
      }
      .md-code-block[data-dsh-mermaid] .dsh-mermaid-stage svg {
        max-width: 100%;
        height: auto;
      }
      .md-code-block[data-dsh-mermaid] .dsh-mermaid-error {
        margin-top: 8px;
        padding: 8px 10px;
        border-radius: 6px;
        background: rgba(220, 50, 50, 0.08);
        border: 1px solid rgba(220, 50, 50, 0.3);
        color: #c93b3b;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 12px;
        white-space: pre-wrap;
      }
      .md-code-block[data-dsh-mermaid][data-dsh-mermaid-state="rendering"] .dsh-mermaid-stage::before {
        content: "渲染中…";
        opacity: 0.5;
        font-size: 12px;
      }
      .md-code-block[data-dsh-mermaid] button.dsh-mermaid-btn {
        appearance: none;
        background: transparent;
        border: 0;
        color: var(--dsw-alias-label-secondary, currentColor);
        font: inherit;
        font-size: 12px;
        line-height: 1;
        padding: 2px 6px;
        margin-right: 6px;
        border-radius: 4px;
        cursor: pointer;
      }
      .md-code-block[data-dsh-mermaid] button.dsh-mermaid-btn:hover {
        color: var(--dsw-alias-label-primary, currentColor);
        background: var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,0.15));
      }
      .md-code-block[data-dsh-mermaid] button.dsh-mermaid-btn[hidden] {
        display: none;
      }

      .dsh-mermaid-lightbox {
        position: fixed;
        inset: 0;
        z-index: 1000;
      }
      .dsh-mermaid-lb-frame {
        position: absolute;
        inset: var(--dsh-frame-chrome-top, 0px) 0 0;
        display: flex;
        flex-direction: column;
        min-height: 0;
      }
      .dsh-mermaid-lb-mask {
        position: absolute;
        inset: 0;
        background: var(--dsw-alias-bg-mask-1, rgba(0, 0, 0, 0.55));
        backdrop-filter: var(--dsw-mask-blur, blur(8px));
      }
      .dsh-mermaid-lb-chrome {
        position: relative;
        z-index: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        flex-shrink: 0;
        padding: 16px 20px 8px;
        pointer-events: none;
      }
      .dsh-mermaid-lb-chrome > * {
        pointer-events: auto;
      }
      .dsh-mermaid-lb-btn {
        appearance: none;
        display: inline-grid;
        place-items: center;
        min-width: 36px;
        height: 36px;
        padding: 0 12px;
        border: 0.5px solid var(--dsw-alias-border-l2-darkmode-thin, rgba(127,127,127,0.35));
        border-radius: 999px;
        background: var(--dsw-specific-input-major, var(--dsw-alias-surface-l1, #fff));
        color: var(--dsw-alias-label-primary, currentColor);
        font: inherit;
        font-size: 13px;
        line-height: 1;
        cursor: pointer;
        box-shadow: var(--dsw-elevation-prominent, 0 8px 24px rgba(0,0,0,0.18));
      }
      .dsh-mermaid-lb-btn:hover {
        background: var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,0.12));
      }
      .dsh-mermaid-lb-btn:focus-visible {
        outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary, #3b82f6));
        outline-offset: 3px;
      }
      .dsh-mermaid-lb-zoom-label {
        min-width: 3.5em;
        text-align: center;
        font-size: 13px;
        font-variant-numeric: tabular-nums;
        color: var(--dsw-alias-label-primary, #fff);
        text-shadow: 0 1px 2px rgba(0,0,0,0.45);
        pointer-events: none;
      }
      .dsh-mermaid-lb-viewport {
        position: relative;
        z-index: 1;
        flex: 1;
        min-height: 0;
        overflow: auto;
        padding: 16px 24px 24px;
        cursor: grab;
        overscroll-behavior: contain;
      }
      .dsh-mermaid-lb-viewport.is-panning {
        cursor: grabbing;
      }
      .dsh-mermaid-lb-stage {
        position: relative;
        margin: 0 auto;
        width: max-content;
        min-width: 2em;
        min-height: 2em;
      }
      .dsh-mermaid-lb-stage[data-error] {
        max-width: min(640px, 90vw);
        padding: 12px 14px;
        border-radius: 8px;
        background: rgba(220, 50, 50, 0.12);
        border: 1px solid rgba(220, 50, 50, 0.35);
        color: #ffb4b4;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 12px;
        white-space: pre-wrap;
      }
      .dsh-mermaid-lb-stage svg {
        display: block;
        height: auto;
        background: var(--dsw-specific-input-major, var(--dsw-alias-surface-l1, #fff));
        border-radius: var(--dsw-radius-lg, 12px);
        box-shadow: var(--dsw-elevation-prominent, 0 12px 40px rgba(0,0,0,0.28));
      }
    `;
