import {
  FIT_PADDING_PX,
  LARGE_MERMAID_CHARS,
  PLUGIN_ID,
  ZOOM_MIN,
  ZOOM_STEP,
} from "./constants.js";
import { readSource } from "./detect.js";
import { paintStage } from "./mermaid.js";
import { clampZoom } from "./utils.js";

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

export function closeLightbox() {
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

export function isMermaidUiControl(target) {
  return Boolean(target.closest?.("a, button, input, [role='button']"));
}

export function isLightboxOpenFor(wrapper) {
  return Boolean(activeLightbox?.wrapper === wrapper);
}

export function openLightbox(wrapper, opener) {
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

export function syncLightbox(wrapper) {
  if (activeLightbox?.wrapper === wrapper) void repaintOpenLightbox(wrapper);
}
