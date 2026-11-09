import {
  MERMAID_CDN,
  SVG_CACHE_MAX,
  WORKER_MSG,
  WORKER_READY_TIMEOUT_MS,
  WORKER_RENDER_TIMEOUT_MS,
} from "./constants.js";
import { currentTheme, hashString } from "./utils.js";

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

export async function paintStage(stage, source, opts) {
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
