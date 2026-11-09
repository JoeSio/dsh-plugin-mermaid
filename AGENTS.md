# dsh-plugin-mermaid

Web/desktop client plugin: renders ` ```mermaid ` fences in DSH chat.

## Layout

- `lib/client.js` — browser half (`window.__ModuleLoader__` factory). No build step.
- `lib/index.js` — host half (no-op Cordis face).
- `package.json` `dsh.client.platform` is `"web"` (desktop uses the same web client-modules path).

## Install / reload

Desktop profile on this machine: `~/.dsh/profiles/desktop`. After editing `lib/client.js`, copy into that profile’s `node_modules/dsh-plugin-mermaid/lib/` (or `dsh plugin --profile desktop add <path>`) and **restart DeepSeek Harness** — client-hmr is off by default.

## Lint

`npm run lint` (oxlint). Source comments are banned (`ban-comments/ban-comments`); keep only tool directives such as `webpackIgnore`. Prefer clearer names or tests instead of prose comments.
