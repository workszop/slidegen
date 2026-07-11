# Resizable Editor Panel + Fixed-Aspect Slide Scaling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the markdown editor panel's width drag-resizable (persisted per app), render the slide preview as a fixed 16:9 scaled canvas while the editor is open, and shrink the editor's ✕ close button to a compact icon button — across all three apps (styler `index.html`, edu + quantica via `app.js`).

**Architecture:** A shared JS helper `mountPanelResizer` in `shared.js` creates a drag handle on the panel's left edge and writes a `--editor-w` CSS variable (persisted to localStorage). The 16:9 scaling is pure CSS: the deck becomes a size container, a `.slide-frame` wrapper (inert `display: contents` normally) becomes a 16:9 frame under an `.editing` class, and the slide's font-size switches from viewport units to container-query units of that frame. Each app carries its own copy of the CSS rules (existing pattern: shared JS, per-app CSS).

**Tech Stack:** Vanilla JS (classic scripts, no build step, no new dependencies), CSS container queries (`container-type: size`, `cqw`/`cqh` — evergreen browsers 2023+, consistent with existing `color-mix` usage), `node --test` for pure helpers.

**Spec:** `docs/superpowers/specs/2026-07-11-resizable-editor-design.md`

## Global Constraints

- No change to full-bleed (editor-closed) slide geometry or typography.
- No change to present mode or PPTX export.
- No resizing on the mobile breakpoint (≤768px), where the editor is a fixed overlay; stored width is ignored there.
- localStorage keys are exactly: `styler.editorW`, `edu.editorW`, `quantica.editorW`.
- Resizer clamp: `min = 280`, `maxFraction = 0.6` (of `window.innerWidth`).
- 16:9 matches `pptx-export.js` `LAYOUT_16x9` — frame is `aspect-ratio: 16 / 9`, width `min(100cqw, 177.78cqh)`.
- Pure helpers live between the `/* pure-helpers:start */` and `/* pure-helpers:end */` markers in `shared.js` and are tested by `tests/pure.test.mjs`.
- All work happens on the existing `editor-resize` branch.

---

### Task 1: `clampPanelWidth` pure helper

**Files:**
- Modify: `shared.js` (inside the pure-helpers section, after `firstFont` ~line 93)
- Test: `tests/pure.test.mjs`

**Interfaces:**
- Produces: `clampPanelWidth(x, min, maxFraction, viewportW)` → number clamped to `[min, max(min, maxFraction × viewportW)]`, or `null` when `x` is not a finite number (caller keeps the default width). Task 2 calls it.

- [ ] **Step 1: Write the failing tests**

In `tests/pure.test.mjs`, add `clampPanelWidth` to the object returned by the `new Function` block (line 8–13), so it reads:

```js
const H = new Function(`${section}; return {
  stripOuterFence, splitSlides, detectLang, buildPrompt, deckTitle, isTitleSlide, firstFont,
  clampPanelWidth,
  PROVIDER_INFO, normalizeAiSettings,
  buildGeminiRequest, buildOpenAIRequest, buildClaudeRequest,
  geminiChunk, openaiChunk, claudeChunk,
};`)();
```

Then append at the end of the file:

```js
// ── clampPanelWidth ──
test("clampPanelWidth clamps to [min, maxFraction × viewport]", () => {
  assert.equal(H.clampPanelWidth(400, 280, 0.6, 1200), 400);  // in range
  assert.equal(H.clampPanelWidth(100, 280, 0.6, 1200), 280);  // below min
  assert.equal(H.clampPanelWidth(900, 280, 0.6, 1200), 720);  // above max (0.6 × 1200)
});

test("clampPanelWidth returns null for garbage input", () => {
  assert.equal(H.clampPanelWidth(NaN, 280, 0.6, 1200), null);       // parseFloat(null)
  assert.equal(H.clampPanelWidth(Infinity, 280, 0.6, 1200), null);
  assert.equal(H.clampPanelWidth(undefined, 280, 0.6, 1200), null);
});

test("clampPanelWidth keeps min when viewport shrinks below it", () => {
  assert.equal(H.clampPanelWidth(500, 280, 0.6, 400), 280);   // max(280, 240) = 280
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/pure.test.mjs`
Expected: FAIL — `clampPanelWidth is not defined`

- [ ] **Step 3: Write the implementation**

In `shared.js`, inside the pure-helpers section, directly after the `firstFont` function (line 91–93), add:

```js
// Clamp a candidate editor-panel width to [min, maxFraction × viewport].
// null for non-finite input (absent/corrupt storage) — caller keeps the default.
function clampPanelWidth(x, min, maxFraction, viewportW) {
  if (!Number.isFinite(x)) return null;
  return Math.min(Math.max(x, min), Math.max(min, maxFraction * viewportW));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/pure.test.mjs`
Expected: PASS — all tests including the 3 new ones

- [ ] **Step 5: Commit**

```bash
git add shared.js tests/pure.test.mjs
git commit -m "feat: clampPanelWidth pure helper for editor resize"
```

---

### Task 2: `mountPanelResizer` helper + mount in all three apps

**Files:**
- Modify: `shared.js` (new section after `mountAiSelector`, before "Lazy PPTX dependencies" ~line 456)
- Modify: `index.html` (`.editor-panel` CSS ~line 263; script: mount call near line 803)
- Modify: `app.js` (BRAND defaults ~line 23; mount call after DOM refs ~line 292)
- Modify: `edu.html` (`.editor-panel` CSS ~line 360; `APP_BRAND` ~line 382)
- Modify: `quantica.html` (`.editor-panel` CSS ~line 363; `APP_BRAND` ~line 385)

**Interfaces:**
- Consumes: `clampPanelWidth(x, min, maxFraction, viewportW)` from Task 1.
- Produces: `mountPanelResizer({ panel, storageKey, min = 280, maxFraction = 0.6 })` — creates the drag handle inside `panel`, applies any stored width as `--editor-w` (px) on the panel's inline style, persists on pointerup, resets on double-click. Panels opt in to `width: var(--editor-w, <default>)` in their own CSS.

- [ ] **Step 1: Add the helper to `shared.js`**

Insert after the `mountAiSelector` function (after line 454), before the "Lazy PPTX dependencies" section:

```js
// ─── Editor panel resizer (drag the left edge) ───
// Injected once; visuals inherit each app's --accent/--border aliases
// (same convention as the AI selector). Hidden on the mobile breakpoint,
// where the panel is a fixed overlay and the stored width is ignored.
const PANEL_RESIZER_CSS = `
.panel-resizer{position:absolute;left:-3px;top:0;bottom:0;width:6px;
  cursor:col-resize;z-index:25;touch-action:none;}
.panel-resizer:hover,body.panel-resizing .panel-resizer{
  background:color-mix(in srgb, var(--accent, #888) 35%, transparent);}
body.panel-resizing{cursor:col-resize;user-select:none;}
@media (min-width: 769px){.has-panel-resizer{position:relative;}}
@media (max-width: 768px){.panel-resizer{display:none;}}
`;

function mountPanelResizer({ panel, storageKey, min = 280, maxFraction = 0.6 }) {
  if (!document.getElementById("panelResizerCss")) {
    const style = document.createElement("style");
    style.id = "panelResizerCss";
    style.textContent = PANEL_RESIZER_CSS;
    document.head.appendChild(style);
  }
  panel.classList.add("has-panel-resizer");
  const handle = document.createElement("div");
  handle.className = "panel-resizer";
  panel.appendChild(handle);

  const apply = w => panel.style.setProperty("--editor-w", w + "px");
  const stored = clampPanelWidth(
    parseFloat(localStorage.getItem(storageKey)), min, maxFraction, window.innerWidth);
  if (stored !== null) apply(stored); // re-clamped on mount (window may have shrunk)

  let width = null;
  handle.addEventListener("pointerdown", e => {
    e.preventDefault();
    handle.setPointerCapture(e.pointerId);
    document.body.classList.add("panel-resizing");
  });
  handle.addEventListener("pointermove", e => {
    if (!handle.hasPointerCapture(e.pointerId)) return;
    const w = clampPanelWidth(
      panel.getBoundingClientRect().right - e.clientX, min, maxFraction, window.innerWidth);
    if (w !== null) { width = w; apply(w); }
  });
  const finish = e => {
    if (!handle.hasPointerCapture(e.pointerId)) return;
    handle.releasePointerCapture(e.pointerId);
    document.body.classList.remove("panel-resizing");
    if (width !== null) localStorage.setItem(storageKey, String(Math.round(width)));
    width = null;
  };
  handle.addEventListener("pointerup", finish);
  handle.addEventListener("pointercancel", finish);
  handle.addEventListener("dblclick", () => {
    localStorage.removeItem(storageKey);
    panel.style.removeProperty("--editor-w");
  });
}
```

- [ ] **Step 2: Make the panel width var-driven in all three style blocks**

`index.html` line 263 — change:

```css
.editor-panel {
  flex: none; width: min(440px, 34vw); border-left: 1px solid var(--line);
```

to:

```css
.editor-panel {
  flex: none; width: var(--editor-w, min(440px, 34vw)); border-left: 1px solid var(--line);
```

`edu.html` line 360 — same one-line change (`width: min(440px, 34vw);` → `width: var(--editor-w, min(440px, 34vw));`).

`quantica.html` line 363 — same one-line change.

The ≤768px media query in each file already re-declares `width: min(440px, 92vw)` on `.editor-panel` later in the stylesheet, so the inline `--editor-w` is ignored on mobile without `!important` (the media rule sets the `width` property itself, which never references the var).

- [ ] **Step 3: Mount in styler (`index.html`)**

In the "Markdown editor drawer" section (line 803), after `const editorDrawerEl = $("editorDrawer"), mdEditorEl = $("mdEditor");` add:

```js
mountPanelResizer({ panel: editorDrawerEl, storageKey: "styler.editorW" });
```

- [ ] **Step 4: Mount in edu/quantica (`app.js` + brand configs)**

`app.js` — add the per-app storage key to the BRAND defaults (line 23–31):

```js
  const BRAND = Object.assign({
    logo: "",
    wordmark: null,
    tag: "doc→slides",
    presentBrand: "",
    presets: [],
    presetKey: "eduapp_preset",
    editorWKey: "eduapp.editorW",
    exampleMd: { pl: "", en: "" },
  }, window.APP_BRAND);
```

`app.js` — after the DOM refs block (after line 292, `const presetGridEl = …`), add:

```js
  mountPanelResizer({ panel: editorPanelEl, storageKey: BRAND.editorWKey });
```

`edu.html` — in `window.APP_BRAND` (line 382), after `presetKey: "eduapp_preset_edu",` add:

```js
  editorWKey: "edu.editorW",
```

`quantica.html` — in `window.APP_BRAND` (line 385), after `presetKey: "eduapp_preset_quantica",` add:

```js
  editorWKey: "quantica.editorW",
```

- [ ] **Step 5: Run the pure tests (regression)**

Run: `node --test tests/pure.test.mjs`
Expected: PASS (no pure helper changed in this task)

- [ ] **Step 6: Verify in the browser**

Serve the repo root: `python3 -m http.server 8080` (background), then check in a browser for **each** of `http://localhost:8080/index.html`, `/edu.html`, `/quantica.html`:

1. Open the editor (styler: "Edytuj markdown"; edu/quantica: "Edytuj") — a 6px strip on the panel's left edge shows `col-resize` cursor and an accent wash on hover.
2. Drag left/right — panel width follows the pointer, clamped (never narrower than 280px, never wider than 60% of the window); text does not get selected during the drag.
3. Reload — the width is restored.
4. Double-click the handle — width resets to the default `min(440px, 34vw)`; reload stays default.
5. Narrow the window to ≤768px — the handle is hidden and the editor overlay has its usual `min(440px, 92vw)` width even when a wide value was stored.
6. localStorage keys are `styler.editorW` / `edu.editorW` / `quantica.editorW` respectively.

- [ ] **Step 7: Commit**

```bash
git add shared.js app.js index.html edu.html quantica.html
git commit -m "feat: drag-resizable editor panel with persisted width"
```

---

### Task 3: Fixed 16:9 slide scaling while editing

**Files:**
- Modify: `app.js` (template `.deck` markup ~line 178–182; `setEditorOpen` ~line 245)
- Modify: `index.html` (deck markup ~line 389–393; deck CSS after `.slide--title` rules ~line 260; `setEditorDrawerOpen` ~line 813)
- Modify: `edu.html` (CSS after `.deck .slide--title` ~line 349)
- Modify: `quantica.html` (CSS after `.deck .slide--title` ~line 352)

**Interfaces:**
- Consumes: nothing from earlier tasks (independent CSS/markup work; only shares the branch).
- Produces: the workbench root carries class `editing` while the editor is open; the workspace slide sits inside a `.slide-frame` wrapper. Task 4 does not depend on these names.

- [ ] **Step 1: Wrap the workspace slide in a `.slide-frame` in both templates**

`app.js` line 178–182 — change the deck block inside the template string:

```html
      <div class="deck">
        <div class="deck-bar" id="deckBar" aria-hidden="true"></div>
        <img class="deck-logo brand-logo" alt="" aria-hidden="true">
        <div class="slide-frame"><div class="slide" id="wsStage"></div></div>
      </div>
```

`index.html` line 389–393 — change:

```html
    <div class="deck" id="deck">
      <div class="deck-bar" id="deckBar" aria-hidden="true"></div>
      <img class="deck-logo" id="deckLogo" alt="" aria-hidden="true">
      <div class="slide-frame"><div class="slide" id="stage" aria-live="polite"></div></div>
    </div>
```

(Present mode in edu/quantica is a separate `#view-present` subtree — untouched. In styler, presenting reuses the deck, handled by the `body:not(.presenting)` gate below.)

- [ ] **Step 2: Toggle the `editing` class from the existing open/close functions**

`app.js` — in `setEditorOpen` (line 245), add one line:

```js
  function setEditorOpen(open) {
    state.editorOpen = open;
    editorPanelEl.classList.toggle("hidden", !open);
    workspaceEl.classList.toggle("editing", open);
    editToggleBtn.setAttribute("aria-pressed", String(open));
    if (open) editorEl.value = state.md;
  }
```

(`workspaceEl` is `#view-workspace`, which carries class `workbench`; it is declared at line 257, after this function — safe, the function only runs later.)

`index.html` — in `setEditorDrawerOpen` (line 813), add one line:

```js
function setEditorDrawerOpen(open) {
  editorDrawerEl.classList.toggle("hidden", !open);
  document.querySelector(".workbench").classList.toggle("editing", open);
  if (open) {
    mdEditorEl.value = state.md;
    mdEditorEl.focus();
  }
}
```

- [ ] **Step 3: Add the editing-mode CSS to styler (`index.html`)**

After the `.slide--title p { font-size: 1.3em; }` rule (line 260), add:

```css
/* ─── Editing: deck letterboxes a fixed 16:9 frame that scales to fit ───
   .slide-frame is inert (display: contents) unless the editor is open,
   so editor-closed geometry is untouched. cq units measure the deck's
   content box, so the existing deck padding is respected. Desktop only;
   in present mode the deck reverts to full-bleed. */
.slide-frame { display: contents; }
@media (min-width: 769px) {
  body:not(.presenting) .workbench.editing .deck { container-type: size; }
  body:not(.presenting) .workbench.editing .slide-frame {
    display: grid; place-items: start center;
    width: min(100cqw, 177.78cqh); aspect-ratio: 16 / 9;
    container-type: size;
  }
  body:not(.presenting) .workbench.editing .slide {
    font-size: clamp(14px, 1.35cqw + 0.8cqh, 40px);
  }
}
```

(The slide keeps its `width: min(1500px, 92%)`, `max-height: 100%`, and `overflow: auto` — the percentages now resolve against the frame. `.slide--title { align-self: center; }` centers within the frame the same way it centered within the deck.)

- [ ] **Step 4: Add the same CSS to edu and quantica**

`edu.html` — after `.deck .slide--title { align-self: center; text-align: center; }` (line 349), add:

```css
/* Editing: deck letterboxes a fixed 16:9 frame that scales to fit.
   .slide-frame is inert (display: contents) unless the editor is open. */
.slide-frame { display: contents; }
@media (min-width: 769px) {
  .workbench.editing .deck { container-type: size; }
  .workbench.editing .slide-frame {
    display: grid; place-items: start center;
    width: min(100cqw, 177.78cqh); aspect-ratio: 16 / 9;
    container-type: size;
  }
  .workbench.editing .deck .slide {
    font-size: clamp(14px, 1.35cqw + 0.8cqh, 40px);
  }
}
```

`quantica.html` — after `.deck .slide--title { align-self: center; text-align: center; }` (line 352), add the identical block.

(No `body:not(.presenting)` gate needed here: presenting hides the whole `.workbench` in these apps.)

- [ ] **Step 5: Verify in the browser**

With `python3 -m http.server 8080` still running, for each of the three apps:

1. Editor closed — slide rendering pixel-identical to before (fluid full-bleed; compare against `main` if unsure).
2. Open the editor — the slide snaps to a 16:9 frame, top-anchored, horizontally centered, deck background letterboxing around it.
3. Drag the resize handle — the frame rescales live and stays exactly 16:9 (measure via devtools: frame width / height = 1.777…); type scales proportionally with the frame.
4. Make the deck area very narrow — frame is width-limited (letterbox below); very wide/short — frame is height-limited (letterbox at the sides).
5. Close the editor — full-bleed rendering returns.
6. Present mode — unchanged in all three apps (styler: also try presenting *while* the editor was open; the deck must render full-bleed fluid).
7. ≤768px — editor overlay opens over an unchanged deck (no 16:9 frame, no size containment collapsing the deck).
8. Escape and ✕ still close the editor and restore full-bleed.

- [ ] **Step 6: Commit**

```bash
git add app.js index.html edu.html quantica.html
git commit -m "feat: fixed 16:9 slide scaling while the editor is open"
```

---

### Task 4: Compact editor close button

**Files:**
- Modify: `app.js` (template line 198)
- Modify: `index.html` (markup line 409; CSS near `.editor-head` ~line 266)
- Modify: `edu.html` (CSS near `.editor-head` ~line 363)
- Modify: `quantica.html` (CSS near `.editor-head` ~line 366)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `#editorCloseBtn` uses class `editor-close` (styling only — all JS references are by id and unchanged).

- [ ] **Step 1: Swap the button class in both templates**

`app.js` line 198 — change:

```html
      <div class="editor-head"><button class="btn btn-ghost" id="editorCloseBtn" aria-label="close">✕</button></div>
```

to:

```html
      <div class="editor-head"><button class="editor-close" id="editorCloseBtn" aria-label="close">✕</button></div>
```

`index.html` line 409 — same change:

```html
    <div class="editor-head"><button class="editor-close" id="editorCloseBtn" aria-label="close">✕</button></div>
```

- [ ] **Step 2: Add the `.editor-close` CSS to all three style blocks**

The rule uses the `--border` alias every app already defines (AI-selector convention), so the same text works in all three. Add directly after each `.editor-head` rule (`index.html` ~line 266, `edu.html` ~line 363, `quantica.html` ~line 366):

```css
.editor-close {
  width: 24px; height: 24px; padding: 0; flex: none;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 12px; line-height: 1; border: 0; border-radius: 6px;
  background: transparent; color: inherit; opacity: .65; cursor: pointer;
}
.editor-close:hover { opacity: 1; background: color-mix(in srgb, var(--border) 60%, transparent); }
```

- [ ] **Step 3: Verify in the browser**

For each of the three apps: open the editor — the ✕ is a small 24×24 icon button in the panel's top-right corner (no pill border), with a subtle hover wash; clicking it still closes the editor; `aria-label="close"` still present.

- [ ] **Step 4: Run the full test suite (final regression)**

Run: `node --test tests/pure.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app.js index.html edu.html quantica.html
git commit -m "feat: compact icon close button for the editor panel"
```
