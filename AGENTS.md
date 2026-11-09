# dsh-plugin-mermaid

Web/desktop client plugin: renders ` ```mermaid ` fences in DSH chat.

## Layout

- `lib/client/` — browser half source modules (ESM). Edit these, not the generated bundle.
- `lib/client.js` — generated `window.__ModuleLoader__` factory (`npm run build:client`). Do not edit by hand.
- `lib/index.js` — host half (no-op Cordis face).
- `scripts/build-client.mjs` — concatenates `lib/client/*` into `lib/client.js` (strips import/export).
- `package.json` `dsh.client.platform` is `"web"` (desktop uses the same web client-modules path).

### `lib/client/` modules

| File | Responsibility |
|---|---|
| `constants.js` | IDs, CDN URL, zoom/debounce, Mermaid keyword regex, CSS string |
| `utils.js` | `hashString`, `clampZoom`, `currentTheme` |
| `mermaid.js` | Sandboxed iframe worker + SVG cache + `paintStage` |
| `detect.js` | Code-block DOM helpers and Mermaid detection |
| `lightbox.js` | Fullscreen preview zoom/pan/fit |
| `render.js` | Preview chrome, viewport-gated queue/scan, DOM/theme observers |
| `styles.js` | Style tag injection |
| `plugin.js` | `name` / `inject` / `apply` |
| `entry.js` | Re-exports plugin public surface |

## Install / reload

Desktop profile on this machine: `~/.dsh/profiles/desktop`. After editing `lib/client/*`, run `npm run build:client`, copy `lib/client.js` into that profile’s `node_modules/dsh-plugin-mermaid/lib/` (or `dsh plugin --profile desktop add <path>`), and **restart DeepSeek Harness** — client-hmr is off by default.

## Lint

`npm run lint` (oxlint). Source comments are banned (`ban-comments/ban-comments`); keep only tool directives such as `webpackIgnore`. Prefer clearer names or tests instead of prose comments.
