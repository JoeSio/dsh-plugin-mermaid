import { MERMAID_CDN } from "./constants.js";
import { currentTheme, hashString } from "./utils.js";

let mermaidPromise = null;

export function loadMermaid() {
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

export async function paintStage(stage, source) {
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
