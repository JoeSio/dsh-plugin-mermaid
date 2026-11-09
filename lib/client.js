window.__ModuleLoader__.load({
  id: "dsh-plugin-mermaid",
  factory: (_require) => {
    var module = { exports: {} };
    var exports = module.exports;

    const PLUGIN_ID = "dsh-plugin-mermaid";
    const MERMAID_VERSION = "11";
    const MERMAID_CDN = `https://cdn.jsdelivr.net/npm/mermaid@${MERMAID_VERSION}/dist/mermaid.esm.min.mjs`;
    const RENDER_DEBOUNCE_MS = 500;
    const VIEWPORT_ROOT_MARGIN = "480px 0px";
    const SVG_CACHE_MAX = 64;
    const WORKER_MSG = "dsh-mermaid-worker";
    const WORKER_READY_TIMEOUT_MS = 20000;
    const WORKER_RENDER_TIMEOUT_MS = 120000;
    const LARGE_MERMAID_CHARS = 4000;
    const ZOOM_MIN = 0.25;
    const ZOOM_MAX = 4;
    const ZOOM_STEP = 0.25;
    const FIT_PADDING_PX = 32;

    const MERMAID_START =
      /^(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram|journey|gantt|pie|mindmap|timeline|gitGraph|C4Context|C4Container|C4Component|C4Dynamic|C4Deployment|quadrantChart|requirementDiagram|sankey(?:-beta)?|xychart(?:-beta)?|block(?:-beta)?|packet(?:-beta)?|architecture(?:-beta)?|kanban|radar)\b/i;

    const CSS = `
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
          .md-code-block[data-dsh-mermaid] .dsh-mermaid-stage svg,
          .md-code-block[data-dsh-mermaid] .dsh-mermaid-stage img {
            max-width: 100%;
            height: auto;
            display: block;
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
          .md-code-block[data-dsh-mermaid] .dsh-mermaid-stage .dsh-mermaid-deferred {
            appearance: none;
            display: block;
            margin: 0 auto;
            padding: 10px 14px;
            border: 1px dashed var(--dsw-alias-border-l2-darkmode-thin, rgba(127,127,127,0.45));
            border-radius: 8px;
            background: transparent;
            color: var(--dsw-alias-label-secondary, currentColor);
            font: inherit;
            font-size: 12px;
            cursor: pointer;
          }
          .md-code-block[data-dsh-mermaid] .dsh-mermaid-stage .dsh-mermaid-deferred:hover {
            color: var(--dsw-alias-label-primary, currentColor);
            background: var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,0.12));
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

    function currentTheme() {
      if (document.body && document.body.hasAttribute("data-ds-dark-theme")) {
        return "dark";
      }
      return "default";
    }

    function hashString(s) {
      let h = 5381;
      for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
      return (h >>> 0).toString(36);
    }

    function clampZoom(n) {
      return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(n / ZOOM_STEP) * ZOOM_STEP));
    }

    const svgCache = new Map();
    const dedupeInflight = new Map();
    const workerPending = new Map();
    let requestSeq = 0;
    let workerReady = null;
    let workerBroken = false;
    let mainMermaidPromise = null;

    function cacheKey(source, theme) {
      return hashString(source + "::" + theme);
    }

    function rememberSvg(key, svg) {
      if (svgCache.has(key)) svgCache.delete(key);
      svgCache.set(key, svg);
      while (svgCache.size > SVG_CACHE_MAX) {
        const oldest = svgCache.keys().next().value;
        svgCache.delete(oldest);
      }
    }

    function workerSrcdoc() {
      return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src https://cdn.jsdelivr.net 'unsafe-inline' 'unsafe-eval'; connect-src https://cdn.jsdelivr.net; style-src 'unsafe-inline'; img-src data: blob:"></head><body><script type="module">
    import mermaid from ${JSON.stringify(MERMAID_CDN)};
    const MSG = ${JSON.stringify(WORKER_MSG)};
    function boot(theme) {
      mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: theme || "default" });
    }
    boot("default");
    parent.postMessage({ type: MSG, kind: "ready" }, "*");
    addEventListener("message", async (ev) => {
      const msg = ev.data;
      if (!msg || msg.type !== MSG || msg.kind !== "render") return;
      try {
        boot(msg.theme || "default");
        const rid = "dsh-m-" + String(msg.id).replace(/\\W/g, "") + "-" + Math.random().toString(36).slice(2, 8);
        const { svg } = await mermaid.render(rid, msg.source);
        parent.postMessage({ type: MSG, kind: "result", id: msg.id, svg }, "*");
      } catch (err) {
        parent.postMessage({ type: MSG, kind: "result", id: msg.id, error: err && err.message ? err.message : String(err) }, "*");
      }
    });
    </script></body></html>`;
    }

    function ensureWorker() {
      if (workerBroken) return Promise.reject(new Error("mermaid worker unavailable"));
      if (workerReady) return workerReady;

      workerReady = new Promise((resolve, reject) => {
        const iframe = document.createElement("iframe");
        iframe.setAttribute("sandbox", "allow-scripts");
        iframe.setAttribute("aria-hidden", "true");
        iframe.setAttribute("tabindex", "-1");
        iframe.title = "dsh mermaid worker";
        iframe.style.cssText =
          "position:fixed;left:0;top:0;width:0;height:0;border:0;opacity:0;pointer-events:none;";

        let settled = false;
        const timer = setTimeout(() => {
          if (settled) return;
          settled = true;
          cleanup();
          workerBroken = true;
          workerReady = null;
          reject(new Error("mermaid worker ready timeout"));
        }, WORKER_READY_TIMEOUT_MS);

        function onMessage(ev) {
          if (ev.source !== iframe.contentWindow) return;
          const msg = ev.data;
          if (!msg || msg.type !== WORKER_MSG) return;
          if (msg.kind === "ready") {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolve(iframe);
            return;
          }
          if (msg.kind === "result") {
            const pending = workerPending.get(msg.id);
            if (!pending) return;
            workerPending.delete(msg.id);
            clearTimeout(pending.timer);
            if (msg.error) pending.reject(new Error(msg.error));
            else pending.resolve(msg.svg);
          }
        }

        function cleanup() {
          window.removeEventListener("message", onMessage);
          iframe.remove();
        }

        window.addEventListener("message", onMessage);
        iframe.addEventListener("error", () => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          cleanup();
          workerBroken = true;
          workerReady = null;
          reject(new Error("mermaid worker failed to load"));
        });

        iframe.srcdoc = workerSrcdoc();
        document.documentElement.appendChild(iframe);
      }).catch((err) => {
        workerBroken = true;
        workerReady = null;
        throw err;
      });

      return workerReady;
    }

    function renderInWorker(source, theme) {
      const id = ++requestSeq;
      return ensureWorker().then(
        (iframe) =>
          new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
              workerPending.delete(id);
              reject(new Error("mermaid worker render timeout"));
            }, WORKER_RENDER_TIMEOUT_MS);
            workerPending.set(id, { resolve, reject, timer });
            iframe.contentWindow.postMessage(
              { type: WORKER_MSG, kind: "render", id, source, theme },
              "*",
            );
          }),
      );
    }

    function loadMermaidMain() {
      if (mainMermaidPromise) return mainMermaidPromise;
      mainMermaidPromise = import(/* webpackIgnore: true */ MERMAID_CDN).then((mod) => {
        const mermaid = mod.default ?? mod;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: currentTheme(),
          fontFamily: "getComputedStyle(document.body).fontFamily",
        });
        return mermaid;
      });
      return mainMermaidPromise;
    }

    async function renderOnMain(source, theme) {
      const mermaid = await loadMermaidMain();
      if (theme !== mermaid.mermaidAPI?.getSiteConfig?.().theme) {
        mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme });
      }
      const id =
        "dsh-mermaid-" + hashString(source) + "-" + Math.random().toString(36).slice(2, 8);
      const { svg, bindFunctions } = await mermaid.render(id, source);
      return { svg, bindFunctions };
    }

    async function renderSvg(source, opts) {
      const trimmed = (source || "").trim();
      const theme = currentTheme();
      const key = cacheKey(trimmed, theme);
      const cached = svgCache.get(key);
      if (cached) return { svg: cached, bindFunctions: null };

      const existing = dedupeInflight.get(key);
      if (existing) return existing;

      const work = (async () => {
        try {
          const svg = await renderInWorker(trimmed, theme);
          rememberSvg(key, svg);
          return { svg, bindFunctions: null };
        } catch (err) {
          if (!opts?.allowMainThread) throw err;
          const result = await renderOnMain(trimmed, theme);
          rememberSvg(key, result.svg);
          return result;
        }
      })();

      dedupeInflight.set(key, work);
      try {
        return await work;
      } finally {
        dedupeInflight.delete(key);
      }
    }

    function revokeStageObjectUrl(stage) {
      const prev = stage.querySelector("img[data-dsh-mermaid-blob]");
      if (!prev?.src?.startsWith("blob:")) return;
      URL.revokeObjectURL(prev.src);
    }

    async function mountSvg(stage, svg, bindFunctions, asImage) {
      revokeStageObjectUrl(stage);
      if (!asImage) {
        stage.innerHTML = svg;
        bindFunctions?.(stage);
        return;
      }
      const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const img = document.createElement("img");
      img.setAttribute("data-dsh-mermaid-blob", "");
      img.alt = "Mermaid";
      img.decoding = "async";
      img.src = url;
      try {
        if (img.decode) await img.decode();
      } catch {}
      stage.replaceChildren(img);
    }

    async function paintStage(stage, source, opts) {
      if (!stage) return;
      const trimmed = (source || "").trim();
      if (!trimmed) {
        revokeStageObjectUrl(stage);
        stage.innerHTML = "";
        return;
      }
      const { svg, bindFunctions } = await renderSvg(source, opts);
      await mountSvg(stage, svg, bindFunctions, opts?.asImage === true);
    }

    function langLabelText(wrapper) {
      const el =
        wrapper.querySelector('[data-code-block-banner] [class*="language"]') ||
        wrapper.querySelector('[class*="infostring"]');
      return (el?.textContent || "").trim().toLowerCase();
    }

    function looksLikeMermaidSource(source) {
      const first = (source || "").trim().split(/\r?\n/, 1)[0]?.trim() || "";

      if (first.startsWith("%%")) {
        const next = (source || "")
          .trim()
          .split(/\r?\n/)
          .map((l) => l.trim())
          .find((l) => l && !l.startsWith("%%"));
        return next ? MERMAID_START.test(next) : false;
      }
      return MERMAID_START.test(first);
    }

    function findCodeEl(wrapper) {
      return (
        wrapper.querySelector("code.language-mermaid, code[class*='language-mermaid']") ||
        wrapper.querySelector("[data-code-block-content] pre code") ||
        wrapper.querySelector("pre code")
      );
    }

    function isMermaidBlock(wrapper) {
      if (langLabelText(wrapper) === "mermaid") return true;
      if (wrapper.querySelector("code.language-mermaid, code[class*='language-mermaid']")) return true;
      const code = findCodeEl(wrapper);
      if (code && looksLikeMermaidSource(code.textContent || "")) return true;
      return false;
    }

    function findSourceHost(wrapper, codeEl) {
      return (
        wrapper.querySelector("[data-code-block-content]") ||
        codeEl.closest("pre") ||
        codeEl.parentElement
      );
    }

    function findActionArea(wrapper) {
      return (
        wrapper.querySelector('[data-code-block-banner] [class*="actions"]') ||
        wrapper.querySelector('[class*="banner"] [class*="action"]')
      );
    }

    function readSource(wrapper) {
      const codeEl = findCodeEl(wrapper);
      return codeEl ? codeEl.textContent ?? "" : "";
    }

    let activeLightbox = null;

    function readSvgIntrinsicSize(stage) {
      const svg = stage.querySelector("svg");
      if (!svg) return null;
      const viewBox = svg.viewBox?.baseVal;
      if (viewBox && viewBox.width > 0 && viewBox.height > 0) {
        return { w: viewBox.width, h: viewBox.height };
      }
      try {
        const bbox = svg.getBBox();
        if (bbox.width > 0 && bbox.height > 0) return { w: bbox.width, h: bbox.height };
      } catch {}
      const w = Number.parseFloat(svg.getAttribute("width") || "") || svg.clientWidth;
      const h = Number.parseFloat(svg.getAttribute("height") || "") || svg.clientHeight;
      if (w > 0 && h > 0) return { w, h };
      return null;
    }

    function viewportOverflows(viewport) {
      return (
        viewport.scrollWidth > viewport.clientWidth + 1 ||
        viewport.scrollHeight > viewport.clientHeight + 1
      );
    }

    function setLightboxZoom(nextScale, { clientX, clientY } = {}) {
      if (!activeLightbox) return;
      const { viewport, stage, zoomPercentLabel } = activeLightbox;
      const scale = clampZoom(nextScale);
      activeLightbox.scale = scale;
      zoomPercentLabel.textContent = Math.round(scale * 100) + "%";

      const intrinsic = activeLightbox.intrinsicSize || readSvgIntrinsicSize(stage);
      activeLightbox.intrinsicSize = intrinsic;
      const svg = stage.querySelector("svg");
      if (!svg || !intrinsic) return;

      const prevW = Math.max(stage.offsetWidth, 1);
      const prevH = Math.max(stage.offsetHeight, 1);
      const viewportRect = viewport.getBoundingClientRect();
      const anchorViewportX =
        clientX == null ? viewport.clientWidth / 2 : clientX - viewportRect.left;
      const anchorViewportY =
        clientY == null ? viewport.clientHeight / 2 : clientY - viewportRect.top;
      const contentRatioX = (viewport.scrollLeft + anchorViewportX) / prevW;
      const contentRatioY = (viewport.scrollTop + anchorViewportY) / prevH;

      const w = intrinsic.w * scale;
      const h = intrinsic.h * scale;
      stage.style.width = w + "px";
      stage.style.height = h + "px";
      svg.style.maxWidth = "none";
      svg.style.width = w + "px";
      svg.style.height = h + "px";

      viewport.scrollLeft = Math.max(0, contentRatioX * w - anchorViewportX);
      viewport.scrollTop = Math.max(0, contentRatioY * h - anchorViewportY);
    }

    function fitLightboxToViewport() {
      if (!activeLightbox) return;
      const { viewport, stage } = activeLightbox;
      const intrinsic = activeLightbox.intrinsicSize || readSvgIntrinsicSize(stage);
      activeLightbox.intrinsicSize = intrinsic;
      if (!intrinsic) {
        setLightboxZoom(1);
        return;
      }
      const availW = Math.max(viewport.clientWidth - FIT_PADDING_PX, 1);
      const availH = Math.max(viewport.clientHeight - FIT_PADDING_PX, 1);
      const fitScale = Math.min(availW / intrinsic.w, availH / intrinsic.h, 1);
      setLightboxZoom(Math.max(ZOOM_MIN, fitScale));
      viewport.scrollLeft = Math.max(0, (stage.offsetWidth - viewport.clientWidth) / 2);
      viewport.scrollTop = Math.max(0, (stage.offsetHeight - viewport.clientHeight) / 2);
    }

    function closeLightbox() {
      if (!activeLightbox) return;
      const { root, restoreFocus, unbindLightboxEvents } = activeLightbox;
      unbindLightboxEvents();
      root.remove();
      activeLightbox = null;
      restoreFocus?.focus?.();
    }

    async function repaintOpenLightbox(wrapper) {
      if (!activeLightbox || activeLightbox.wrapper !== wrapper) return;
      const { stage } = activeLightbox;
      stage.replaceChildren();
      stage.removeAttribute("data-error");
      try {
        const source = readSource(wrapper);
        wrapper.setAttribute("data-dsh-mermaid-consent", "1");
        await paintStage(stage, source, {
          allowMainThread: source.length < LARGE_MERMAID_CHARS,
        });
        activeLightbox.intrinsicSize = readSvgIntrinsicSize(stage);
        fitLightboxToViewport();
      } catch (e) {
        stage.innerHTML = "";
        stage.setAttribute("data-error", "1");
        stage.textContent = "Mermaid 渲染失败：" + (e?.message ?? String(e));
      }
    }

    function isMermaidUiControl(target) {
      return Boolean(target.closest?.("a, button, input, [role='button']"));
    }

    function isLightboxOpenFor(wrapper) {
      return Boolean(activeLightbox?.wrapper === wrapper);
    }

    function openLightbox(wrapper, opener) {
      if (activeLightbox?.wrapper === wrapper) return;
      closeLightbox();

      const restoreFocus =
        opener instanceof HTMLElement
          ? opener
          : document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;

      const root = document.createElement("div");
      root.className = "dsh-mermaid-lightbox";
      root.setAttribute("role", "dialog");
      root.setAttribute("aria-modal", "true");
      root.setAttribute("aria-label", "Mermaid 图表预览");
      root.setAttribute("data-plugin", PLUGIN_ID);

      const frame = document.createElement("div");
      frame.className = "dsh-mermaid-lb-frame";

      const dismissMask = document.createElement("div");
      dismissMask.className = "dsh-mermaid-lb-mask";
      dismissMask.setAttribute("aria-hidden", "true");
      dismissMask.addEventListener("mousedown", (ev) => {
        ev.preventDefault();
        closeLightbox();
      });

      const zoomToolbar = document.createElement("div");
      zoomToolbar.className = "dsh-mermaid-lb-chrome";
      zoomToolbar.setAttribute("role", "toolbar");
      zoomToolbar.setAttribute("aria-label", "缩放控件");

      const createZoomToolbarButton = (text, title, onClick) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "dsh-mermaid-lb-btn";
        button.textContent = text;
        button.title = title;
        button.setAttribute("aria-label", title);
        button.addEventListener("click", (ev) => {
          ev.stopPropagation();
          onClick();
        });
        return button;
      };

      const zoomOutBtn = createZoomToolbarButton("−", "缩小", () => {
        if (activeLightbox) setLightboxZoom(activeLightbox.scale - ZOOM_STEP);
      });
      const zoomPercentLabel = document.createElement("span");
      zoomPercentLabel.className = "dsh-mermaid-lb-zoom-label";
      zoomPercentLabel.textContent = "100%";
      const zoomInBtn = createZoomToolbarButton("+", "放大", () => {
        if (activeLightbox) setLightboxZoom(activeLightbox.scale + ZOOM_STEP);
      });
      const fitBtn = createZoomToolbarButton("适应", "适应窗口", () => fitLightboxToViewport());
      const closeBtn = createZoomToolbarButton("关闭", "关闭预览", () => closeLightbox());

      zoomToolbar.append(zoomOutBtn, zoomPercentLabel, zoomInBtn, fitBtn, closeBtn);

      const viewport = document.createElement("div");
      viewport.className = "dsh-mermaid-lb-viewport";

      const stage = document.createElement("div");
      stage.className = "dsh-mermaid-lb-stage";
      viewport.appendChild(stage);

      frame.append(dismissMask, zoomToolbar, viewport);
      root.appendChild(frame);
      document.body.appendChild(root);

      let dragPan = null;
      const onPointerDown = (ev) => {
        if (ev.button !== 0 || ev.target.closest("button")) return;
        if (!viewportOverflows(viewport)) return;
        dragPan = { id: ev.pointerId, x: ev.clientX, y: ev.clientY };
        viewport.setPointerCapture(ev.pointerId);
        viewport.classList.add("is-panning");
        ev.preventDefault();
      };
      const onPointerMove = (ev) => {
        if (!dragPan || ev.pointerId !== dragPan.id) return;
        viewport.scrollLeft += dragPan.x - ev.clientX;
        viewport.scrollTop += dragPan.y - ev.clientY;
        dragPan.x = ev.clientX;
        dragPan.y = ev.clientY;
      };
      const endDragPan = (ev) => {
        if (!dragPan || (ev && ev.pointerId !== dragPan.id)) return;
        dragPan = null;
        viewport.classList.remove("is-panning");
      };
      viewport.addEventListener("pointerdown", onPointerDown);
      viewport.addEventListener("pointermove", onPointerMove);
      viewport.addEventListener("pointerup", endDragPan);
      viewport.addEventListener("pointercancel", endDragPan);

      const onWheelZoomTowardPointer = (ev) => {
        if (!activeLightbox) return;
        ev.preventDefault();
        const delta = ev.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
        setLightboxZoom(activeLightbox.scale + delta, {
          clientX: ev.clientX,
          clientY: ev.clientY,
        });
      };
      viewport.addEventListener("wheel", onWheelZoomTowardPointer, { passive: false });

      const onLightboxKeyDown = (ev) => {
        if (ev.defaultPrevented) return;
        if (ev.key === "Escape") {
          ev.stopPropagation();
          ev.preventDefault();
          closeLightbox();
          return;
        }
        if (!activeLightbox) return;
        if (ev.key === "=" || ev.key === "+") {
          ev.preventDefault();
          setLightboxZoom(activeLightbox.scale + ZOOM_STEP);
        } else if (ev.key === "-" || ev.key === "_") {
          ev.preventDefault();
          setLightboxZoom(activeLightbox.scale - ZOOM_STEP);
        } else if (ev.key === "0") {
          ev.preventDefault();
          fitLightboxToViewport();
        }
      };
      window.addEventListener("keydown", onLightboxKeyDown, true);

      const unbindLightboxEvents = () => {
        window.removeEventListener("keydown", onLightboxKeyDown, true);
        viewport.removeEventListener("pointerdown", onPointerDown);
        viewport.removeEventListener("pointermove", onPointerMove);
        viewport.removeEventListener("pointerup", endDragPan);
        viewport.removeEventListener("pointercancel", endDragPan);
        viewport.removeEventListener("wheel", onWheelZoomTowardPointer);
      };

      activeLightbox = {
        wrapper,
        root,
        viewport,
        stage,
        zoomPercentLabel,
        scale: 1,
        intrinsicSize: null,
        restoreFocus,
        unbindLightboxEvents,
      };

      closeBtn.focus();
      void repaintOpenLightbox(wrapper);
    }

    function syncLightbox(wrapper) {
      if (activeLightbox?.wrapper === wrapper) void repaintOpenLightbox(wrapper);
    }

    function injectStyles() {
      if (document.getElementById("dsh-plugin-mermaid-styles")) return;
      const style = document.createElement("style");
      style.id = "dsh-plugin-mermaid-styles";
      style.setAttribute("data-plugin", PLUGIN_ID);
      style.textContent = CSS;
      document.head.appendChild(style);
    }

    const activated = new WeakSet();
    const pending = new WeakMap();
    const observed = new WeakSet();
    let viewportObserver = null;

    function clearPending(wrapper) {
      const existing = pending.get(wrapper);
      if (!existing) return;
      clearTimeout(existing);
      pending.delete(wrapper);
    }

    function ensureViewportObserver() {
      if (viewportObserver) return viewportObserver;
      if (typeof IntersectionObserver === "undefined") return null;
      viewportObserver = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            const wrapper = entry.target;
            if (entry.isIntersecting) {
              if (activated.has(wrapper)) {
                queueRender(wrapper);
                continue;
              }
              clearPending(wrapper);
              const t = setTimeout(() => {
                pending.delete(wrapper);
                activated.add(wrapper);
                viewportObserver.unobserve(wrapper);
                observed.delete(wrapper);
                queueRender(wrapper, { immediate: true });
              }, RENDER_DEBOUNCE_MS);
              pending.set(wrapper, t);
              continue;
            }
            if (!activated.has(wrapper)) clearPending(wrapper);
          }
        },
        { root: null, rootMargin: VIEWPORT_ROOT_MARGIN, threshold: 0 },
      );
      return viewportObserver;
    }

    function armWhenVisible(wrapper) {
      if (activated.has(wrapper)) {
        queueRender(wrapper);
        return;
      }
      const observer = ensureViewportObserver();
      if (!observer) {
        activated.add(wrapper);
        queueRender(wrapper);
        return;
      }
      if (observed.has(wrapper)) return;
      observed.add(wrapper);
      observer.observe(wrapper);
    }

    function releaseViewport(wrapper) {
      if (!viewportObserver || !observed.has(wrapper)) return;
      viewportObserver.unobserve(wrapper);
      observed.delete(wrapper);
    }

    function buildViews(wrapper, codeEl) {
      if (wrapper.hasAttribute("data-dsh-mermaid")) return;
      wrapper.setAttribute("data-dsh-mermaid", "ready");
      wrapper.setAttribute("data-dsh-mermaid-view", "chart");
      wrapper.setAttribute("data-dsh-mermaid-state", "idle");

      const actionArea = findActionArea(wrapper);
      const sourceHost = findSourceHost(wrapper, codeEl);

      const mkBtn = (text, title, onClick) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "dsh-mermaid-btn";
        b.textContent = text;
        b.title = title;
        if (onClick) {
          b.addEventListener("click", (ev) => {
            ev.stopPropagation();
            onClick(ev);
          });
        }
        return b;
      };

      const toggleBtn = mkBtn("源码", "切换到 Mermaid 源码", null);
      const expandBtn = mkBtn("放大", "放大查看图表", (ev) => {
        openLightbox(wrapper, ev.currentTarget);
      });
      const rerenderBtn = mkBtn("重渲染", "重新渲染图表", () => {
        wrapper.removeAttribute("data-dsh-mermaid-hash");
        wrapper.setAttribute("data-dsh-mermaid-consent", "1");
        queueRender(wrapper, { force: true });
      });

      const setView = (next) => {
        wrapper.setAttribute("data-dsh-mermaid-view", next);
        if (next === "chart") {
          toggleBtn.textContent = "源码";
          toggleBtn.title = "切换到 Mermaid 源码";
          if (sourceHost) sourceHost.style.display = "none";
          preview.style.display = "";
          expandBtn.hidden = false;
        } else {
          toggleBtn.textContent = "图表";
          toggleBtn.title = "切换到渲染图";
          if (sourceHost) sourceHost.style.display = "";
          preview.style.display = "none";
          expandBtn.hidden = true;
        }
      };

      toggleBtn.addEventListener("click", () => {
        const cur = wrapper.getAttribute("data-dsh-mermaid-view");
        setView(cur === "chart" ? "source" : "chart");
      });

      if (actionArea) {
        actionArea.insertBefore(rerenderBtn, actionArea.firstChild);
        actionArea.insertBefore(expandBtn, rerenderBtn);
        actionArea.insertBefore(toggleBtn, expandBtn);
      }

      const preview = document.createElement("div");
      preview.className = "dsh-mermaid-preview";
      const stage = document.createElement("div");
      stage.className = "dsh-mermaid-stage";
      stage.title = "点击放大查看";
      stage.addEventListener("click", (ev) => {
        if (wrapper.getAttribute("data-dsh-mermaid-view") !== "chart") return;
        const state = wrapper.getAttribute("data-dsh-mermaid-state");
        if (state === "error" || state === "deferred" || state === "rendering") return;
        if (isMermaidUiControl(ev.target)) return;
        openLightbox(wrapper, stage);
      });
      preview.appendChild(stage);
      const err = document.createElement("div");
      err.className = "dsh-mermaid-error";
      err.hidden = true;
      preview.appendChild(err);

      if (sourceHost) {
        sourceHost.setAttribute("data-dsh-mermaid-role", "source");
        sourceHost.parentNode.insertBefore(preview, sourceHost.nextSibling);
        sourceHost.style.display = "none";
      } else {
        wrapper.appendChild(preview);
      }
    }

    function setError(wrapper, message) {
      const err = wrapper.querySelector(".dsh-mermaid-error");
      wrapper.setAttribute("data-dsh-mermaid-state", message ? "error" : "ok");
      if (!err) return;
      if (message) {
        err.hidden = false;
        err.textContent = "Mermaid 渲染失败：" + message;
      } else {
        err.hidden = true;
        err.textContent = "";
      }
    }

    function showDeferredPrompt(wrapper, stage) {
      wrapper.setAttribute("data-dsh-mermaid-state", "deferred");
      setError(wrapper, "");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "dsh-mermaid-deferred";
      btn.textContent = "大图未渲染，点击渲染";
      btn.title = "大型 Mermaid 图按需渲染，避免卡住界面";
      btn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        wrapper.setAttribute("data-dsh-mermaid-consent", "1");
        queueRender(wrapper, { force: true });
      });
      stage.replaceChildren(btn);
    }

    async function renderOne(wrapper, opts) {
      const codeEl = findCodeEl(wrapper);
      if (!codeEl) return;
      const source = codeEl.textContent ?? "";
      if (source.trim() === "") return;

      const hash = hashString(source + "::" + currentTheme());
      if (wrapper.getAttribute("data-dsh-mermaid-hash") === hash) return;

      const stage = wrapper.querySelector(".dsh-mermaid-stage");
      if (!stage) return;

      const large = source.length >= LARGE_MERMAID_CHARS;
      const consented =
        opts?.force === true || wrapper.getAttribute("data-dsh-mermaid-consent") === "1";
      if (large && !consented) {
        showDeferredPrompt(wrapper, stage);
        return;
      }

      wrapper.setAttribute("data-dsh-mermaid-state", "rendering");
      try {
        await paintStage(stage, source, {
          asImage: true,
          allowMainThread: !large,
        });
        wrapper.setAttribute("data-dsh-mermaid-hash", hash);
        setError(wrapper, "");
        syncLightbox(wrapper);
      } catch (e) {
        if (large) {
          showDeferredPrompt(wrapper, stage);
          setError(wrapper, (e?.message ?? String(e)) + "（可再次点击重试）");
        } else {
          setError(wrapper, e?.message ?? String(e));
        }
        if (isLightboxOpenFor(wrapper)) closeLightbox();
      }
    }

    function queueRender(wrapper, opts) {
      if (opts?.force) {
        clearPending(wrapper);
        releaseViewport(wrapper);
        activated.add(wrapper);
      } else if (!activated.has(wrapper)) {
        armWhenVisible(wrapper);
        return;
      }

      clearPending(wrapper);
      const delay = opts?.force || opts?.immediate ? 0 : RENDER_DEBOUNCE_MS;
      const t = setTimeout(() => {
        pending.delete(wrapper);
        renderOne(wrapper, opts);
      }, delay);
      pending.set(wrapper, t);
    }

    function invalidateMermaid(wrapper) {
      wrapper.removeAttribute("data-dsh-mermaid-hash");
      clearPending(wrapper);
      releaseViewport(wrapper);
      activated.delete(wrapper);
      armWhenVisible(wrapper);
    }

    function scan(root) {
      const scope = root instanceof Element ? root : document;
      const blocks = scope.querySelectorAll(".md-code-block");
      blocks.forEach((wrapper) => {
        if (wrapper.hasAttribute("data-dsh-mermaid-skip")) return;
        if (!isMermaidBlock(wrapper)) {
          const label = langLabelText(wrapper);
          const langCode = wrapper.querySelector("code[class*='language-']");
          const explicitOtherLang =
            langCode && !/language-mermaid/i.test(langCode.className || "");
          const explicitOtherLabel =
            label &&
            label !== "mermaid" &&
            /^[a-z0-9+#._-]+$/i.test(label);
          if (explicitOtherLang || explicitOtherLabel) {
            wrapper.setAttribute("data-dsh-mermaid-skip", "");
          }
          return;
        }
        const code = findCodeEl(wrapper);
        if (!code) return;
        if (!wrapper.hasAttribute("data-dsh-mermaid")) {
          buildViews(wrapper, code);
        }
        armWhenVisible(wrapper);
      });
    }

    function observeTheme() {
      const mo = new MutationObserver((records) => {
        for (const r of records) {
          if (r.type === "attributes" && r.attributeName === "data-ds-dark-theme") {
            document.querySelectorAll('.md-code-block[data-dsh-mermaid="ready"]').forEach((w) => {
              invalidateMermaid(w);
            });
            break;
          }
        }
      });
      mo.observe(document.body, { attributes: true, attributeFilter: ["data-ds-dark-theme"] });
    }

    let scanScheduled = false;
    function scheduleScan() {
      if (scanScheduled) return;
      scanScheduled = true;
      queueMicrotask(() => {
        scanScheduled = false;
        scan(document);
      });
    }

    function observeDom() {
      const mo = new MutationObserver((mutations) => {
        let needScan = false;
        for (const m of mutations) {
          if (m.type === "childList" && (m.addedNodes.length || m.removedNodes.length)) {
            needScan = true;
            break;
          }
          if (m.type === "characterData") {
            const host = m.target.parentElement?.closest?.(".md-code-block");
            if (host) {
              if (host.hasAttribute("data-dsh-mermaid")) {
                invalidateMermaid(host);
              } else {
                scheduleScan();
              }
            }
          }
        }
        if (needScan) scheduleScan();
      });
      mo.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    }

    const name = PLUGIN_ID;
    const inject = [];

    function apply(ctx) {
      ctx.logger?.info?.("dsh-plugin-mermaid: client apply");
      injectStyles();

      const start = () => {
        scan(document);
        observeDom();
        observeTheme();
      };
      if (document.body) start();
      else document.addEventListener("DOMContentLoaded", start, { once: true });
      ctx.effect?.(() => () => {
        closeLightbox();
      });
    }

    exports.name = name;
    exports.inject = inject;
    exports.apply = apply;
    return module.exports;
  }
});
