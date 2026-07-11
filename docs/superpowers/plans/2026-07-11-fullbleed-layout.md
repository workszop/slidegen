# Full-Bleed Workbench Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** All three apps fill the viewport styler-style (flush panel, deck occupying all remaining space, footer nav), and Edit opens a full-height right-hand markdown panel in all three (the styler's bottom drawer moves right).

**Architecture:** edu/quantica adopt the styler's proven CSS recipe: `body` becomes a fixed-viewport flex column, `main#app` becomes a `.workbench` flex row (panel | stage-wrap | editor-panel); the bordered 16:10 stage card is replaced by a `.deck` that fills the stage with viewport-scaled slide typography, an accent progress bar, and the brand logo. The preset variables and derived legibility tokens are untouched — only containers change. The styler only relocates its editor drawer. No state-machine changes.

**Tech Stack:** Vanilla JS classic scripts (no build), CSS flex, `node --test` pure suite (unchanged).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-11-fullbleed-layout-design.md`. No changes to `shared.js`, `pptx-export.js`, `tests/`.
- Styler recipe values, verbatim: panel `width: 280px`; deck `flex: 1; display: grid; place-items: start center; padding: 14vh 3vw 3vh; overflow: hidden`; slide `width: min(1500px, 92%); max-height: 100%; overflow: auto; font-size: clamp(14px, 1.35vw + 0.8vh, 40px)`; deck-bar `height: 4px` accent with `transition: width 450ms cubic-bezier(.2,.6,.2,1)`; deck-logo `top: calc(4px + 2.2vh); right: 2.5vw; height: clamp(30px, 3.4vh + 1.5vw, 76px)`; breakpoint `max-width: 768px` (stacked panel, deck `min-height: 55vh`).
- Editor panel (all three apps): right column `width: min(440px, 34vw)`, full workbench height, `border-left`.
- Preset CSS vars (`--slide-bg/--slide-fg/--slide-accent`) and the derived `--slide-fg-muted`/`--slide-surface` tokens keep working unchanged; the deck background is `var(--slide-bg, <brand default>)` and the deck-bar is `var(--slide-accent, <brand accent>)`.
- Present mode unchanged in all three apps. Keyboard behavior unchanged.
- After every task: `node --check app.js` (when touched), `node --test tests/pure.test.mjs` (10/10), headless screenshots at 1500×950 with zero `Uncaught` console errors. Serve `python3 -m http.server 8765 --directory /home/andrzey/git-claude/slidegen`; browser: `chromium`/`google-chrome`/`google-chrome-stable`; screenshots under `/tmp/claude-1000/`.
- Commit after every task. Do not push without the user's go-ahead.

---

### Task 1: edu/quantica workbench layout

**Files:**
- Modify: `app.js` (template: workspace block; `renderStage`; DOM refs)
- Modify: `edu.html` (CSS: shell/workspace/stage-card rules → workbench/deck/footer/editor rules)
- Modify: `quantica.html` (same with quantica tokens)

**Interfaces:**
- Consumes: existing state machine (`view: workspace|present`, `editorOpen`), `renderStage()`, `setEditorOpen()`, preset vars.
- Produces: new element IDs `deckBar` (progress bar in the workspace deck); markup classes `workbench`, `panel`, `stage-wrap`, `deck`, `deck-bar`, `deck-logo`, `deck-footer`, `editor-panel` (Task 3 asserts on these). `wsStage`, `wsPrev`, `wsNext`, `wsCounter`, `editorPanel`, `editToggleBtn` keep their IDs.

- [ ] **Step 1: Restructure the injected template in app.js**

Replace the current `<div class="workspace" id="view-workspace">…</div>` block with (sidebar section contents — Document, Generate incl. `genStatus`, Style, Actions — move over verbatim):

```html
  <div class="workbench" id="view-workspace">
    <aside class="panel">
      <!-- the four existing side-section blocks, unchanged -->
    </aside>

    <section class="stage-wrap">
      <div class="error-panel hidden" id="errorPanel" role="status">
        <strong id="errorTitle"></strong>
        <span id="errorDetail"></span>
        <button class="btn btn-ghost" id="errorDismiss">OK</button>
      </div>
      <div class="deck">
        <div class="deck-bar" id="deckBar" aria-hidden="true"></div>
        <img class="deck-logo brand-logo" alt="" aria-hidden="true">
        <div class="slide" id="wsStage"></div>
      </div>
      <footer class="deck-footer">
        <div class="nav-btns">
          <button class="btn btn-ghost" id="wsPrev" aria-label="prev">←</button>
          <button class="btn btn-ghost" id="wsNext" aria-label="next">→</button>
        </div>
        <span class="deck-counter" id="wsCounter"></span>
        <div class="spacer"></div>
        <div class="hints">
          <span><kbd>→</kbd> <span data-i18n="hintNext"></span></span>
          <span><kbd>←</kbd> <span data-i18n="hintPrev"></span></span>
        </div>
      </footer>
    </section>

    <aside class="editor-panel hidden" id="editorPanel">
      <textarea id="editor" spellcheck="false"></textarea>
    </aside>
  </div>
```

Also change the `<main id="app" class="shell" …>` wrapper class from `shell` to nothing (`<main id="app" aria-live="polite">`) — the workbench child carries the layout. `view-present` stays verbatim. Note the `deck-logo` img carries `brand-logo`, so the existing init (`querySelectorAll(".brand-logo")`) sets its src with no code change.

- [ ] **Step 2: Update app.js code**

- Add DOM ref: `const deckBarEl = document.getElementById("deckBar");`
- Delete refs to removed wrappers if any (`workspaceEl` still resolves — `view-workspace` id kept on the workbench div; `setEditorOpen`'s `workspaceEl.classList.toggle("editing", open)` may stay (harmless) or be kept for CSS hooks — keep it, the responsive CSS uses it).
- In `renderStage()`, after the counter update add:

```js
    deckBarEl.style.width = n ? `${((state.current + 1) / n) * 100}%` : "0%";
```

- No other logic changes (generation auto-open, debounce, keyboard, present mode all stay).

- [ ] **Step 3: Replace layout CSS in edu.html**

Delete: `.workspace`/`.workspace.editing` grid rules, `.sidebar`, `.stage-col`, `.ws-stage-wrap` (incl. the `width:auto` cascade fix), `.ws-nav`, `.ws-counter`, old `.editor-panel` rules, both old media queries (1100px/800px), and any `.shell` sizing rules (`max-width`, centering, padding) — grep `.shell` first; keep `body.presenting` rules that reference existing selectors, updating `.shell` → `.workbench` where needed. Add:

```css
/* ─── Full-bleed workbench (styler recipe) ─── */
html, body { height: 100%; }
body { display: flex; flex-direction: column; overflow: hidden; }
main#app { flex: 1; display: flex; min-height: 0; }
.workbench { flex: 1; display: flex; min-height: 0; }
.panel {
  width: 280px; flex: none; overflow-y: auto;
  padding: var(--sp-5); border-right: 1px solid var(--line);
  display: flex; flex-direction: column; gap: var(--sp-5);
  background: var(--paper);
}
.panel .side-section { background: none; border: 0; border-radius: 0; padding: 0; display: flex; flex-direction: column; gap: var(--sp-3); }
.side-title {
  margin: 0; font-family: var(--font-mono); font-weight: 500; font-size: 11px;
  letter-spacing: .14em; text-transform: uppercase; color: var(--marigold-ink);
}
.stage-wrap { flex: 1; display: flex; flex-direction: column; min-width: 0; position: relative; }
.stage-wrap .error-panel { position: absolute; top: var(--sp-3); left: 50%; transform: translateX(-50%); z-index: 20; }
.deck {
  flex: 1; display: grid; place-items: start center; padding: 14vh 3vw 3vh; overflow: hidden;
  position: relative; background: var(--slide-bg, var(--paper));
}
.deck-bar {
  position: absolute; top: 0; left: 0; height: 4px; width: 0%;
  background: var(--slide-accent, var(--marigold));
  transition: width 450ms cubic-bezier(.2,.6,.2,1); z-index: 5;
}
.deck-logo {
  position: absolute; top: calc(4px + 2.2vh); right: 2.5vw; z-index: 4;
  height: clamp(30px, 3.4vh + 1.5vw, 76px); width: auto; opacity: .92;
}
.deck .slide {
  width: min(1500px, 92%); max-height: 100%; overflow: auto;
  font-size: clamp(14px, 1.35vw + 0.8vh, 40px);
}
.deck .slide--title { align-self: center; text-align: center; }
.deck-footer {
  flex: none; display: flex; align-items: center; gap: var(--sp-4);
  padding: var(--sp-2) var(--sp-5); border-top: 1px solid var(--line);
  color: var(--ink-3); font-size: 12px; background: var(--paper);
}
.deck-footer .nav-btns { display: flex; gap: var(--sp-2); }
.deck-footer .spacer { flex: 1; }
.deck-counter { font-family: var(--font-mono); }
.deck-footer .hints { display: flex; gap: var(--sp-4); margin: 0; }
.editor-panel {
  flex: none; width: min(440px, 34vw); border-left: 1px solid var(--line);
  background: var(--paper-2); padding: var(--sp-3); display: flex; min-height: 0;
}
.editor-panel textarea {
  flex: 1; resize: none; font-family: var(--font-mono); font-size: 13px; line-height: 1.55;
  color: var(--ink); background: var(--surface); border: 1px solid var(--line-2);
  border-radius: var(--r-sm); padding: var(--sp-3); min-width: 0;
}
body.presenting .workbench { display: none; }
@media (max-width: 768px) {
  body { overflow: auto; }
  .workbench { flex-direction: column; }
  .panel { width: 100%; border-right: 0; border-bottom: 1px solid var(--line); }
  .deck { min-height: 55vh; }
  .deck-footer .hints { display: none; }
  .editor-panel { position: fixed; right: 0; top: 0; bottom: 0; width: min(440px, 92vw); z-index: 30; box-shadow: -8px 0 24px rgba(33,30,26,.2); }
}
```

Keep every `.slide`-content rule (colors, preset hooks, `--slide-fg-muted`/`--slide-surface`, code/pre/table/blockquote) untouched. The old generic `.slide { width: min(1600px, 90vw); … }` present-mode sizing rule stays (view-present uses it); `.deck .slide` overrides it inside the workspace.

- [ ] **Step 4: Same CSS work in quantica.html**

Identical block with quantica tokens: panel bg `var(--bg-1)`, borders `var(--border-1)`, side-title color `var(--fg-brand)` (or the file's existing muted-heading token), footer text `var(--fg-3)`, deck default bg per its slide CSS, deck-bar fallback `var(--quantica-pink)`, editor bg `var(--bg-2)`, editor textarea colors per its tokens.

- [ ] **Step 5: Verify**

```bash
node --check app.js && node --test tests/pure.test.mjs
```
Screenshots (1500×950) of both apps: deck fills viewport edge-to-edge (no page margins, no bordered card), progress bar visible at deck top, logo top-right, footer bar with nav + counter; then with editor open (evaluate `#editToggleBtn` click): right panel appears, deck reflows and still fills remaining space; body must not scroll (assert `document.body.scrollHeight <= window.innerHeight + 1`). Present mode still fullscreen (`#present` + screenshot). 700×900 screenshot: stacked layout. Zero `Uncaught` console errors.

- [ ] **Step 6: Commit**

```bash
git add app.js edu.html quantica.html
git commit -m "edu/quantica: full-bleed workbench layout matching the styler"
```

---

### Task 2: Styler editor drawer → right panel

**Files:**
- Modify: `index.html` only

**Interfaces:**
- Consumes: existing drawer markup/toggle (locate via `grep -n "editor-drawer\|editorDrawer\|drawer" index.html`).
- Produces: styler markup gains `.editor-panel` as a `.workbench` child; drawer toggle logic unchanged.

- [ ] **Step 1: Relocate the markup**

Move the `<div class="editor-drawer">…</div>` element (currently inside `.stage-wrap`, between the deck and the footer) to be the last child of `.workbench` (after `</section>` closing `stage-wrap`), and rename its class to `editor-panel` (update any CSS/JS selectors that reference `editor-drawer` — grep first; the toggle logic keyed on an id or hidden class stays as is).

- [ ] **Step 2: Swap the CSS**

Replace the `.editor-drawer` rules (`height: 36vh; border-top: …`) with:

```css
.editor-panel {
  flex: none; width: min(440px, 34vw); border-left: 1px solid var(--line);
  background: var(--paper-2); padding: var(--sp-3); display: flex; min-height: 0;
}
.editor-panel textarea {
  flex: 1; width: auto; height: auto; resize: none;
  font-family: var(--font-mono); font-size: 13px; line-height: 1.55; color: var(--ink);
  background: var(--surface); border: 1px solid var(--line-2);
  border-radius: var(--r-sm); padding: var(--sp-3); min-width: 0;
}
```

Update `body.presenting … .editor-drawer` → `.editor-panel`, and in the 768px media query add the same fixed-overlay treatment as Task 1's (right overlay, `width: min(440px, 92vw)`).

- [ ] **Step 3: Verify**

Screenshots (1500×950): styler with editor closed (unchanged look) and open (right panel, deck reflows, still full viewport, no body scroll). Editing markdown re-renders the deck live (evaluate a text change). Presets/fonts/colors still work; present mode hides the panel. Zero console errors.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "styler: move markdown editor from bottom drawer to right panel"
```

---

### Task 3: Cross-app verification + README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Full sweep**

```bash
node --test tests/pure.test.mjs && node --check shared.js && node --check app.js && node --check pptx-export.js
```

- [ ] **Step 2: Scripted browser pass over all three apps (CDP harness)**

Per app at 1500×950 and 700×900: viewport fill (no body scroll), editor-right behavior, preset restyle incl. deck-bar accent color (edu/quantica), footer nav + counter, present enter/exit, generation streaming auto-opens the right panel (edu with a real key from the session scratchpad if still present, else dummy-key 4xx path), PPTX export succeeds with active preset theme (edu or quantica, one is enough), styler preset/font panel regression.

- [ ] **Step 3: README**

Update the edu/quantica paragraph: the apps fill the viewport like the styler (panel · deck · optional right editor). Mention all three apps share the same layout with the editor opening to the right of the deck.

- [ ] **Step 4: Commit and hand off**

```bash
git add README.md
git commit -m "README: unified full-bleed layout across all three apps"
```

Ask the user whether to push to `main`.
