import {
  LARGE_MERMAID_CHARS,
  RENDER_DEBOUNCE_MS,
  VIEWPORT_ROOT_MARGIN,
} from "./constants.js";
import {
  findActionArea,
  findCodeEl,
  findSourceHost,
  isMermaidBlock,
  langLabelText,
} from "./detect.js";
import {
  closeLightbox,
  isLightboxOpenFor,
  isMermaidUiControl,
  openLightbox,
  syncLightbox,
} from "./lightbox.js";
import { paintStage } from "./mermaid.js";
import { currentTheme, hashString } from "./utils.js";

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

export function buildViews(wrapper, codeEl) {
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

export function queueRender(wrapper, opts) {
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

export function scan(root) {
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

export function observeTheme() {
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

export function observeDom() {
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
