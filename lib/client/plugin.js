import { PLUGIN_ID } from "./constants.js";
import { closeLightbox } from "./lightbox.js";
import { observeDom, observeTheme, scan } from "./render.js";
import { injectStyles } from "./styles.js";

export const name = PLUGIN_ID;
export const inject = [];

export function apply(ctx) {
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
