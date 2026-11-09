import { CSS, PLUGIN_ID } from "./constants.js";

export function injectStyles() {
  if (document.getElementById("dsh-plugin-mermaid-styles")) return;
  const style = document.createElement("style");
  style.id = "dsh-plugin-mermaid-styles";
  style.setAttribute("data-plugin", PLUGIN_ID);
  style.textContent = CSS;
  document.head.appendChild(style);
}
