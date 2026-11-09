window.__ModuleLoader__.load({
  id: "dsh-plugin-mermaid",
  factory: (_require) => {
    var module = { exports: {} };
    var exports = module.exports;

    const PLUGIN_ID = "dsh-plugin-mermaid";
    const MERMAID_VERSION = "11";
    const MERMAID_CDN = `https://cdn.jsdelivr.net/npm/mermaid@${MERMAID_VERSION}/dist/mermaid.esm.min.mjs`;
    const RENDER_DEBOUNCE_MS = 500;
    const ZOOM_MIN = 0.25;
    const ZOOM_MAX = 4;
    const ZOOM_STEP = 0.25;
    const FIT_PADDING_PX = 32;

    let mermaidPromise = null;
    function loadMermaid() {
      if (mermaidPromise) return mermaidPromise;
      mermaidPromise = import(/* webpackIgnore: true */ MERMAID_CDN).then((mod) => {
        const mermaid = mod.default ?? mod;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: currentTheme(),
          fontFamily: "getComputedStyle(document.body).fontFamily",
        });
        return mermaid;
      });
      return mermaidPromise;
    }

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

    const MERMAID_START =
      /^(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram|journey|gantt|pie|mindmap|timeline|gitGraph|C4Context|C4Container|C4Component|C4Dynamic|C4Deployment|quadrantChart|requirementDiagram|sankey(?:-beta)?|xychart(?:-beta)?|block(?:-beta)?|packet(?:-beta)?|architecture(?:-beta)?|kanban|radar)\b/i;

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

    function isMermaidBlock(wrapper) {
      if (langLabelText(wrapper) === "mermaid") return true;
      if (wrapper.querySelector("code.language-mermaid, code[class*='language-mermaid']")) return true;
      const code = findCodeEl(wrapper);
      if (code && looksLikeMermaidSource(code.textContent || "")) return true;
      return false;
    }

    function findCodeEl(wrapper) {
      return (
        wrapper.querySelector("code.language-mermaid, code[class*='language-mermaid']") ||
        wrapper.querySelector("[data-code-block-content] pre code") ||
        wrapper.querySelector("pre code")
      );
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

    async function paintStage(stage, source) {
      if (!stage) return;
      const trimmed = (source || "").trim();
      if (!trimmed) {
        stage.innerHTML = "";
        return;
      }
      const mermaid = await loadMermaid();
      if (currentTheme() !== mermaid.mermaidAPI?.getSiteConfig?.().theme) {
        mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: currentTheme() });
      }
      const id = "dsh-mermaid-" + hashString(trimmed) + "-" + Math.random().toString(36).slice(2, 8);
      const { svg, bindFunctions } = await mermaid.render(id, source);
      stage.innerHTML = svg;
      bindFunctions?.(stage);
    }

    let activeLightbox = null;

    function clampZoom(n) {
      return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(n / ZOOM_STEP) * ZOOM_STEP));
    }

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
        await paintStage(stage, readSource(wrapper));
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
        scheduleRender(wrapper, { force: true });
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
        if (wrapper.getAttribute("data-dsh-mermaid-state") === "error") return;
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

    async function renderOne(wrapper) {
      const codeEl = findCodeEl(wrapper);
      if (!codeEl) return;
      const source = codeEl.textContent ?? "";
      if (source.trim() === "") return;

      const hash = hashString(source + "::" + currentTheme());
      if (wrapper.getAttribute("data-dsh-mermaid-hash") === hash) return;

      wrapper.setAttribute("data-dsh-mermaid-state", "rendering");
      try {
        const stage = wrapper.querySelector(".dsh-mermaid-stage");
        await paintStage(stage, source);
        wrapper.setAttribute("data-dsh-mermaid-hash", hash);
        setError(wrapper, "");
        syncLightbox(wrapper);
      } catch (e) {
        setError(wrapper, e?.message ?? String(e));
        if (activeLightbox?.wrapper === wrapper) closeLightbox();
      }
    }

    const pending = new WeakMap();
    function scheduleRender(wrapper, opts) {
      const existing = pending.get(wrapper);
      if (existing) clearTimeout(existing);
      const t = setTimeout(() => {
        pending.delete(wrapper);
        renderOne(wrapper);
      }, opts?.force ? 0 : RENDER_DEBOUNCE_MS);
      pending.set(wrapper, t);
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
        scheduleRender(wrapper);
      });
    }

    function observeTheme() {
      const mo = new MutationObserver((records) => {
        for (const r of records) {
          if (r.type === "attributes" && r.attributeName === "data-ds-dark-theme") {
            document.querySelectorAll('.md-code-block[data-dsh-mermaid="ready"]').forEach((w) => {
              w.removeAttribute("data-dsh-mermaid-hash");
              scheduleRender(w, { force: true });
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

                scheduleRender(host);
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
    function injectStyles() {
      if (document.getElementById("dsh-plugin-mermaid-styles")) return;
      const style = document.createElement("style");
      style.id = "dsh-plugin-mermaid-styles";
      style.setAttribute("data-plugin", PLUGIN_ID);
      style.textContent = CSS;
      document.head.appendChild(style);
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
