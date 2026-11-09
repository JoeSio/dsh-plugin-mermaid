import { MERMAID_START } from "./constants.js";

export function langLabelText(wrapper) {
  const el =
    wrapper.querySelector('[data-code-block-banner] [class*="language"]') ||
    wrapper.querySelector('[class*="infostring"]');
  return (el?.textContent || "").trim().toLowerCase();
}

export function looksLikeMermaidSource(source) {
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

export function findCodeEl(wrapper) {
  return (
    wrapper.querySelector("code.language-mermaid, code[class*='language-mermaid']") ||
    wrapper.querySelector("[data-code-block-content] pre code") ||
    wrapper.querySelector("pre code")
  );
}

export function isMermaidBlock(wrapper) {
  if (langLabelText(wrapper) === "mermaid") return true;
  if (wrapper.querySelector("code.language-mermaid, code[class*='language-mermaid']")) return true;
  const code = findCodeEl(wrapper);
  if (code && looksLikeMermaidSource(code.textContent || "")) return true;
  return false;
}

export function findSourceHost(wrapper, codeEl) {
  return (
    wrapper.querySelector("[data-code-block-content]") ||
    codeEl.closest("pre") ||
    codeEl.parentElement
  );
}

export function findActionArea(wrapper) {
  return (
    wrapper.querySelector('[data-code-block-banner] [class*="actions"]') ||
    wrapper.querySelector('[class*="banner"] [class*="action"]')
  );
}

export function readSource(wrapper) {
  const codeEl = findCodeEl(wrapper);
  return codeEl ? codeEl.textContent ?? "" : "";
}
