import { ZOOM_MAX, ZOOM_MIN, ZOOM_STEP } from "./constants.js";

export function currentTheme() {
  if (document.body && document.body.hasAttribute("data-ds-dark-theme")) {
    return "dark";
  }
  return "default";
}

export function hashString(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export function clampZoom(n) {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(n / ZOOM_STEP) * ZOOM_STEP));
}
