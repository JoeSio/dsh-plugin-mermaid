# Lessons

- **Symptom:** Mermaid fences show as raw “Code block” with no 源码/图表 buttons on DSH ≥0.2 desktop/web. **Cause:** Chat always passes `toolbarLabels`; `CodeToolbar` prints the localized fallback when `supportsHighlighting(lang)` is false (mermaid has no Shiki grammar), so the old `.infostring === "mermaid"` / `code.language-mermaid` detectors never fire, and the action cluster is `[data-code-block-banner] …actions` not `.banner .action`. **Fix:** Detect via language label, legacy hooks, or first-line Mermaid diagram keywords; inject into `[data-code-block-banner] [class*="actions"]`.
