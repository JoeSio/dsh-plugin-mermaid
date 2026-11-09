import { RENDER_DEBOUNCE_MS } from "./constants.js";
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
    if (isLightboxOpenFor(wrapper)) closeLightbox();
  }
}

const pending = new WeakMap();
export function scheduleRender(wrapper, opts) {
  const existing = pending.get(wrapper);
  if (existing) clearTimeout(existing);
  const t = setTimeout(() => {
    pending.delete(wrapper);
    renderOne(wrapper);
  }, opts?.force ? 0 : RENDER_DEBOUNCE_MS);
  pending.set(wrapper, t);
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
    scheduleRender(wrapper);
  });
}

export function observeTheme() {
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
