import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const clientDir = join(root, "lib", "client");
const outFile = join(root, "lib", "client.js");

const MODULE_ORDER = [
  "constants.js",
  "utils.js",
  "mermaid.js",
  "detect.js",
  "lightbox.js",
  "styles.js",
  "render.js",
  "plugin.js",
];

function stripModuleSyntax(source) {
  let text = source.replace(/\r\n/g, "\n");

  text = text.replace(/^import\s+[\s\S]*?from\s+["'][^"']+["'];\s*\n/gm, "");
  text = text.replace(/^import\s+["'][^"']+["'];\s*\n/gm, "");
  text = text.replace(/^export\s+\{[^}]*\}\s*from\s+["'][^"']+["'];\s*\n/gm, "");
  text = text.replace(/^export\s+\{[^}]*\};\s*\n/gm, "");

  text = text.replace(/^export\s+(async\s+function\s+)/gm, "$1");
  text = text.replace(/^export\s+(function\s+)/gm, "$1");
  text = text.replace(/^export\s+(const\s+)/gm, "$1");
  text = text.replace(/^export\s+(let\s+)/gm, "$1");
  text = text.replace(/^export\s+(class\s+)/gm, "$1");

  return text.trimEnd() + "\n";
}

function indentBlock(source, spaces) {
  const pad = " ".repeat(spaces);
  return source
    .split("\n")
    .map((line) => (line.length ? pad + line : line))
    .join("\n");
}

const bodies = MODULE_ORDER.map((name) => {
  const raw = readFileSync(join(clientDir, name), "utf8");
  return stripModuleSyntax(raw);
});

const inner = bodies.join("\n");

const bundled = `window.__ModuleLoader__.load({
  id: "dsh-plugin-mermaid",
  factory: (_require) => {
    var module = { exports: {} };
    var exports = module.exports;

${indentBlock(inner, 4)}
    exports.name = name;
    exports.inject = inject;
    exports.apply = apply;
    return module.exports;
  }
});
`;

writeFileSync(outFile, bundled, "utf8");
console.log(`wrote ${outFile}`);
