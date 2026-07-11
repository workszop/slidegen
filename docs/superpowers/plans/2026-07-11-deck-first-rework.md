# Deck-First Rework (edu + quantica) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** edu.html and quantica.html open straight into a live example deck with a left control sidebar, 4 brand-locked style presets, and a markdown editor panel to the right of the rendered slide.

**Architecture:** `app.js`'s three-view state machine (`input|edit|present`) becomes `workspace|present` + an `editorOpen` flag; the injected template is rewritten to sidebar/stage/editor. Per-app `APP_BRAND` gains `presets`, `presetKey`, `exampleMd`. Presets apply three CSS variables (`--slide-bg/--slide-fg/--slide-accent`) that the brand CSS consumes with today's look as defaults. `shared.js` and `index.html` (styler) are untouched.

**Tech Stack:** Vanilla JS classic scripts (no build), CSS grid + container queries, native `<dialog>` AI chip (already shipped), `node --test` for the pure suite (unchanged).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-11-deck-first-rework-design.md`. No changes to `shared.js`, `index.html`, `pptx-export.js`, or `tests/`.
- All UI copy bilingual PL (default) / EN via the existing `T` dict + `t()` + `data-i18n`.
- Preset CSS variables are exactly: `--slide-bg`, `--slide-fg`, `--slide-accent` (set on `document.documentElement`); brand CSS must default them to today's colors so Task 1 renders identically before Task 2 lands.
- localStorage keys: preset choice `eduapp_preset_edu` / `eduapp_preset_quantica` (via `BRAND.presetKey`); nothing else new. Existing keys untouched.
- Preset palettes use ONLY these values — edu: `#FBF7F0`, `#211E1A`, `#FFFFFF`, `#E8920C`, `#0E8C7F`; quantica: `#FFFFFF`, `#111111`, `#FF4D9A`, `#C41E54`, `#FFE6F1`, `#8A004C`, `#F5F6F8`, `#3A3A42`.
- URL params: `?lang`, `?slide`, `#present` keep working; `?demo` is removed (deck-first makes it redundant).
- Keyboard: present-mode keys unchanged; in workspace ←/→ navigate slides when focus is not in an input/textarea/select; Ctrl+Enter (in editor) presents.
- After every task: `node --check app.js`, `node --test tests/pure.test.mjs` (must stay 10/10), headless screenshot of both apps with no `Uncaught` console errors. Serve via `python3 -m http.server 8765 --directory /home/andrzey/git-claude/slidegen`; browser binary is `chromium`, `google-chrome`, or `google-chrome-stable` (whichever exists); screenshots under `/tmp/claude-1000/`.
- Commit after every task. Do not push without the user's go-ahead.

---

### Task 1: Workspace restructure (app.js + CSS in both HTML files)

**Files:**
- Modify: `app.js` (template ~lines 178–321, state ~324–341, DOM refs ~343–377, render fns ~386–453, renderInput ~504–515, generateSlides ~541–599, listeners ~601–671, init ~673–700)
- Modify: `edu.html` (CSS: replace input/edit-view styles with workspace styles)
- Modify: `quantica.html` (same, with quantica tokens)

**Interfaces:**
- Consumes: existing shared.js API (unchanged).
- Produces (later tasks rely on these exact names):
  - `state = { view: "workspace"|"present", editorOpen: bool, deckIsExample: bool, source, md, slides, current, generating, slideLang }`
  - Element IDs: `wsStage`, `wsPrev`, `wsNext`, `wsCounter`, `editorPanel`, `editToggleBtn`, `presetGrid` (empty container; filled in Task 2), plus surviving IDs `aiChip`, `generateBtn`, `editor`, `dropzone`, `fileInput`, `fileChip`, `browseBtn`, `pasteArea`, `slideLangPl/En`, `countHint`, `genStatus(Text)`, `errorPanel/Title/Detail/Dismiss`, `downloadBtn`, `pptxBtn`, `presentBtn`.
  - Functions: `renderStage()`, `setEditorOpen(open)`, `setMd(md, current)` (existing, now also calls `renderStage` and syncs the editor), `setDeck(md, {example}) ` sets `state.deckIsExample`.
  - i18n keys added: `sideDoc`, `sideGen`, `sideStyle`, `sideActions`, `edit`, `pasteHere`; removed: `eyebrow`, `lead`, `dropTypes`, `orPaste`, `presentDirect`, `helpTitle`, `helpIntro`, `helpOutro`, `hintGenerate`, `editorLabel`, `previewLabel`.
  - `renderTexts()` additionally handles `data-i18n-placeholder`.

- [ ] **Step 1: Replace the `view-input` + `view-edit` template sections in app.js**

Keep the `<header class="chrome">`, `genStatus` markup (moved), `errorPanel` markup (moved), and the whole `view-present` section verbatim. Replace everything between `<main id="app" class="shell" aria-live="polite">` and `<section id="view-present"` with:

```html
  <div class="workspace" id="view-workspace">
    <aside class="sidebar">
      <section class="side-section">
        <h2 class="side-title" data-i18n="sideDoc"></h2>
        <div class="dropzone dropzone--compact" id="dropzone" role="button" tabindex="0">
          <span class="dz-label" data-i18n="dropHere"></span>
          <button class="btn btn-ghost btn-sm" id="browseBtn" data-i18n="browse"></button>
          <input type="file" id="fileInput" class="visually-hidden" accept=".txt,.md,.markdown,.pdf" />
        </div>
        <textarea id="pasteArea" rows="2" data-i18n-placeholder="pasteHere" spellcheck="false"></textarea>
        <div class="file-chip hidden" id="fileChip"></div>
      </section>

      <section class="side-section">
        <h2 class="side-title" data-i18n="sideGen"></h2>
        <button id="aiChip"></button>
        <div class="side-row">
          <div class="lang-toggle" role="group" aria-label="PL/EN">
            <button id="slideLangPl" aria-pressed="true">PL</button>
            <button id="slideLangEn" aria-pressed="false">EN</button>
          </div>
          <select id="countHint" class="mono-input">
            <option value="auto" data-i18n="countAuto"></option>
            <option value="10">~10</option>
            <option value="20">~20</option>
          </select>
        </div>
        <button class="btn btn-primary btn-block" id="generateBtn" disabled data-i18n="generate"></button>
        <div class="gen-status hidden" id="genStatus" role="status">
          <div class="gen-bar" aria-hidden="true"><div></div></div>
          <span id="genStatusText"></span>
        </div>
      </section>

      <section class="side-section">
        <h2 class="side-title" data-i18n="sideStyle"></h2>
        <div class="preset-grid" id="presetGrid" role="group"></div>
      </section>

      <section class="side-section side-actions">
        <h2 class="side-title" data-i18n="sideActions"></h2>
        <button class="btn btn-ghost btn-block" id="editToggleBtn" aria-pressed="false" data-i18n="edit"></button>
        <button class="btn btn-primary btn-block" id="presentBtn" data-i18n="present"></button>
        <button class="btn btn-ghost btn-block" id="downloadBtn" data-i18n="downloadMd"></button>
        <button class="btn btn-ghost btn-block" id="pptxBtn" data-i18n="downloadPptx"></button>
      </section>
    </aside>

    <section class="stage-col">
      <div class="error-panel hidden" id="errorPanel" role="status">
        <strong id="errorTitle"></strong>
        <span id="errorDetail"></span>
        <button class="btn btn-ghost" id="errorDismiss">OK</button>
      </div>
      <div class="ws-stage-wrap"><div class="slide" id="wsStage"></div></div>
      <div class="ws-nav">
        <button class="btn btn-ghost" id="wsPrev" aria-label="prev">←</button>
        <span class="ws-counter" id="wsCounter"></span>
        <button class="btn btn-ghost" id="wsNext" aria-label="next">→</button>
      </div>
    </section>

    <aside class="editor-panel hidden" id="editorPanel">
      <textarea id="editor" spellcheck="false"></textarea>
    </aside>
  </div>
```

- [ ] **Step 2: Update state, DOM refs, and view plumbing**

```js
  const state = {
    view: "workspace",      // workspace | present
    editorOpen: false,
    deckIsExample: true,
    source: null,
    md: "",
    slides: [],
    current: 0,
    generating: false,
    slideLang: "pl",
  };
  function setView(v) { state.view = v; render(); }
  function setDeck(md, { example = false } = {}) {
    state.deckIsExample = example;
    setMd(md);
  }
  function setMd(md, current = state.current) {
    state.md = md;
    state.current = current;
    renderSlides();
    renderStage();
    if (state.editorOpen && editorEl.value !== md) editorEl.value = md;
  }
  function setEditorOpen(open) {
    state.editorOpen = open;
    editorPanelEl.classList.toggle("hidden", !open);
    workspaceEl.classList.toggle("editing", open);
    editToggleBtn.setAttribute("aria-pressed", String(open));
    if (open) editorEl.value = state.md;
  }
```

`viewEls` becomes `{ workspace: document.getElementById("view-workspace"), present: document.getElementById("view-present") }`. Add refs: `workspaceEl` (same node as `viewEls.workspace`), `wsStageEl`, `wsPrevBtn`, `wsNextBtn`, `wsCounterEl`, `editorPanelEl`, `editToggleBtn`. Delete refs for removed nodes: `presentDirectBtn`, `previewEl`, `backBtn`, `regenBtn` (regeneration = Generate button, always visible). `render()` keeps its shape (toggle views, `presenting` class, `renderTexts()`, `renderPresent()` when presenting); `renderEdit`/`renderPreview` are deleted; `renderInput()` is renamed `renderSidebar()` (same body minus the `presentDirectBtn` line).

```js
  function renderStage() {
    const n = state.slides.length;
    wsCounterEl.textContent = n ? `${state.current + 1} / ${n}` : "";
    wsPrevBtn.disabled = state.current <= 0;
    wsNextBtn.disabled = state.current >= n - 1;
    if (!n) { wsStageEl.innerHTML = ""; return; }
    const isTitle = state.current === 0 && isTitleSlide(state.md);
    wsStageEl.className = "slide" + (isTitle ? " slide--title" : "");
    wsStageEl.innerHTML = state.slides[state.current];
  }
```

In `renderTexts()` add placeholder handling and swap the `renderInput` call:

```js
    document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
      el.placeholder = t(el.dataset.i18nPlaceholder);
    });
    if (state.view === "workspace") renderSidebar();
```

- [ ] **Step 3: Rewire behavior**

- **Sources:** keep `readSourceFile`/`loadFile`/paste debounce verbatim, but in `setSource`, after the existing logic add: a text source whose `multi` flag is true loads straight into the deck — `if (source?.kind === "text" && source.multi) setDeck(source.text, { example: false });`.
- **Generation** (`generateSlides`): keep the Task-4-era body (loadAiSettings/streamSlides) with these UI changes — on first chunk: `setEditorOpen(true); setDeck("", { example: false });` then the existing throttled block becomes:

```js
          const now = Date.now();
          if (now - lastRender > 400) {
            lastRender = now;
            editorEl.value = text;
            editorEl.scrollTop = editorEl.scrollHeight;
            state.md = text;
            renderSlides();
            state.current = Math.max(0, state.slides.length - 1); // follow the newest slide
            renderStage();
          }
```

and on success `setDeck(stripOuterFence(acc.trim()), { example: false });` (drop the old `setView("edit")` calls — there is no edit view).
- **Editor:** keep the 300 ms debounce listener, calling `setMd(editorEl.value)`; keep Ctrl+Enter → `setView("present")`.
- **Nav:** `wsPrevBtn`/`wsNextBtn` → `state.current ∓ 1` clamped + `renderStage()`. Workspace keydown (when `state.view === "workspace"` and target isn't INPUT/TEXTAREA/SELECT/BUTTON): ArrowRight/ArrowLeft navigate the stage. Present-mode keys stay verbatim, except Escape → `setView("workspace")`.
- **Buttons:** `editToggleBtn` → `setEditorOpen(!state.editorOpen)`; `presentBtn` → `setView("present")` (with `state.current` preserved); `downloadBtn`/`pptxBtn` keep their handlers. Delete `backBtn`/`regenBtn`/`presentDirectBtn` listeners and the input-view Enter-to-generate shortcut.
- **Init:** keep BRAND/logo/i18n init; keep `mountAiSelector`; load the example deck: `setDeck(SAMPLE_MD, { example: true });` remove the `?demo` branch; keep `?lang`, `?slide`, `#present` handling (`#present` now requires `state.slides.length` as before).
- **i18n dict:** add `sideDoc: "Dokument"/"Document"`, `sideGen: "Generowanie"/"Generate"`, `sideStyle: "Styl"/"Style"`, `sideActions: "Akcje"/"Actions"`, `edit: "Edytuj"/"Edit"`, `pasteHere: "…albo wklej tekst tutaj"/"…or paste text here"`; delete the keys listed in Interfaces.

- [ ] **Step 4: Replace the view CSS in edu.html**

Delete these rule groups: `.page-head`, `.input-grid`, `.settings*`, `.edit-toolbar`, `.edit-grid`, `.mini*`, `.help*`, `#preview`, old `.dropzone` sizing (keep the class, restyle), `.hints` (keep for present footer if referenced). Add (edulab tokens):

```css
/* ── Workspace ─────────────────────────────── */
.workspace { display: grid; grid-template-columns: 272px minmax(0, 1fr); gap: var(--sp-5); align-items: start; }
.workspace.editing { grid-template-columns: 272px minmax(0, 1fr) 340px; }
.sidebar { display: flex; flex-direction: column; gap: var(--sp-5); }
.side-section { background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-md); padding: var(--sp-4); display: flex; flex-direction: column; gap: var(--sp-3); }
.side-title { margin: 0; font-family: var(--font-mono); font-weight: 500; font-size: var(--overline); text-transform: uppercase; letter-spacing: .08em; color: var(--ink-3); }
.side-row { display: flex; gap: var(--sp-2); align-items: center; justify-content: space-between; }
.dropzone--compact { padding: var(--sp-3); text-align: center; border: 2px dashed var(--line-2); border-radius: var(--r-sm); display: flex; flex-direction: column; gap: var(--sp-2); align-items: center; cursor: pointer; }
.dropzone--compact.dragover { border-color: var(--marigold); background: var(--marigold-soft); }
.dropzone--compact .dz-label { font-family: var(--font-display); font-weight: 700; font-size: var(--body-sm); }
#pasteArea { width: 100%; box-sizing: border-box; resize: vertical; font-family: var(--font-mono); font-size: var(--caption); border: 1px solid var(--line); border-radius: var(--r-sm); padding: var(--sp-2); background: var(--paper); color: var(--ink); }
.btn-sm { padding: 2px 10px; font-size: var(--overline); }
.stage-col { display: flex; flex-direction: column; gap: var(--sp-3); min-width: 0; }
.ws-stage-wrap { container-type: inline-size; aspect-ratio: 16 / 10; background: var(--slide-bg, var(--paper)); border: 1px solid var(--line); border-radius: var(--r-md); overflow: hidden; position: relative; box-shadow: 0 2px 12px rgba(33,30,26,.06); }
.ws-stage-wrap .slide { position: absolute; inset: 0; padding: 6cqw 7cqw; font-size: clamp(10px, 2.4cqw, 34px); overflow: hidden; }
.ws-nav { display: flex; align-items: center; justify-content: center; gap: var(--sp-4); }
.ws-counter { font-family: var(--font-mono); font-size: var(--caption); color: var(--ink-3); min-width: 5em; text-align: center; }
.editor-panel { display: flex; min-width: 0; }
.editor-panel textarea { flex: 1; min-height: 60vh; resize: none; font-family: var(--font-mono); font-size: var(--caption); line-height: 1.6; border: 1px solid var(--line); border-radius: var(--r-md); padding: var(--sp-3); background: var(--surface); color: var(--ink); }
@media (max-width: 1100px) { .workspace.editing { grid-template-columns: 272px minmax(0, 1fr); } .workspace.editing .editor-panel { position: fixed; right: var(--sp-3); top: 70px; bottom: var(--sp-3); width: min(420px, 90vw); z-index: 30; box-shadow: -8px 0 24px rgba(33,30,26,.15); } }
@media (max-width: 800px) { .workspace, .workspace.editing { grid-template-columns: 1fr; } .sidebar { flex-direction: row; flex-wrap: wrap; } .side-section { flex: 1 1 240px; } }
/* ── Preset hooks (defaults = today's look; Task 2 sets the vars) ── */
#view-present { background: var(--slide-bg, var(--paper)); }
.slide { color: var(--slide-fg, var(--ink)); }
.slide h1, .slide h2 { color: var(--slide-fg, var(--ink)); }
.slide .slide-eyebrow, .slide strong { color: var(--slide-accent, var(--marigold)); }
.present-bar { background: var(--slide-accent, var(--marigold)); }
```

Adjust the last block to the file's actual slide-accent rules: every existing `.slide`-scoped rule that hard-codes `var(--marigold)` (eyebrow, strong, hr, blockquote border, etc.) switches to `var(--slide-accent, var(--marigold))`; every `.slide`-scoped `var(--ink)` text color → `var(--slide-fg, var(--ink))`; `#view-present`/`.stage` backgrounds → `var(--slide-bg, var(--paper))`. Do NOT touch chrome/sidebar rules.

- [ ] **Step 5: Same CSS work in quantica.html**

Identical structure, quantica tokens: surfaces `--bg-1`, page bg `--bg-2`, borders `--border-1`, muted text `--fg-3`, accent `--quantica-pink`, mono/display fonts as the file already defines. Preset hooks: `--slide-bg` defaults to the file's current slide background, `--slide-fg` to its slide text color, `--slide-accent` to `var(--quantica-pink)` — apply the same rule-by-rule substitution as Step 4.

- [ ] **Step 6: Verify**

```bash
node --check app.js && node --test tests/pure.test.mjs
python3 -m http.server 8765 --directory /home/andrzey/git-claude/slidegen & sleep 1
for p in edu quantica; do chromium --headless=new --disable-gpu --screenshot=/tmp/claude-1000/ws-$p.png --window-size=1500,950 "http://localhost:8765/$p.html"; done
kill %1
```

Read both screenshots: sidebar with 4 sections, example deck's title slide rendered in the stage, counter "1 / 8"-style, no editor panel, no console `Uncaught`. Also verify `?slide=3` shows slide 3 and `#present` enters present mode (DOM check via a quick CDP/JS evaluation or screenshot).

- [ ] **Step 7: Commit**

```bash
git add app.js edu.html quantica.html
git commit -m "Rework edu/quantica to deck-first workspace: sidebar, live stage, right-hand editor"
```

---

### Task 2: Brand presets

**Files:**
- Modify: `edu.html` (APP_BRAND + preset-tile CSS)
- Modify: `quantica.html` (APP_BRAND + preset-tile CSS)
- Modify: `app.js` (BRAND defaults, preset render/apply/persist)

**Interfaces:**
- Consumes: `presetGrid` container, `renderStage()`, CSS vars `--slide-bg/--slide-fg/--slide-accent` (Task 1).
- Produces: `BRAND.presets` (array of `{id, name:{pl,en}, bg, fg, accent}`), `BRAND.presetKey` (string), `applyPreset(index)`, `renderPresets()`.

- [ ] **Step 1: Add preset data to both APP_BRAND objects**

edu.html:

```js
  presetKey: "eduapp_preset_edu",
  presets: [
    { id: "papier",   name: { pl: "Papier",   en: "Paper" },    bg: "#FBF7F0", fg: "#211E1A", accent: "#E8920C" },
    { id: "atrament", name: { pl: "Atrament", en: "Ink" },      bg: "#211E1A", fg: "#FBF7F0", accent: "#E8920C" },
    { id: "morski",   name: { pl: "Morski",   en: "Teal" },     bg: "#FBF7F0", fg: "#211E1A", accent: "#0E8C7F" },
    { id: "kontrast", name: { pl: "Kontrast", en: "Contrast" }, bg: "#FFFFFF", fg: "#211E1A", accent: "#211E1A" },
  ],
```

quantica.html:

```js
  presetKey: "eduapp_preset_quantica",
  presets: [
    { id: "jasny",   name: { pl: "Jasny",   en: "Light" },   bg: "#FFFFFF", fg: "#111111", accent: "#C41E54" },
    { id: "ciemny",  name: { pl: "Ciemny",  en: "Dark" },    bg: "#111111", fg: "#FFFFFF", accent: "#FF4D9A" },
    { id: "magenta", name: { pl: "Magenta", en: "Magenta" }, bg: "#FFE6F1", fg: "#111111", accent: "#8A004C" },
    { id: "mono",    name: { pl: "Mono",    en: "Mono" },    bg: "#F5F6F8", fg: "#111111", accent: "#3A3A42" },
  ],
```

- [ ] **Step 2: Implement preset logic in app.js**

Extend the BRAND defaults with `presets: []` and `presetKey: "eduapp_preset"`. After the DOM refs:

```js
  // ─── Style presets ──────────────────────────────
  let activePreset = 0;
  function applyPreset(i) {
    const p = BRAND.presets[i];
    if (!p) return;
    activePreset = i;
    const rs = document.documentElement.style;
    rs.setProperty("--slide-bg", p.bg);
    rs.setProperty("--slide-fg", p.fg);
    rs.setProperty("--slide-accent", p.accent);
    localStorage.setItem(BRAND.presetKey, p.id);
    document.querySelectorAll(".preset").forEach((b, j) =>
      b.setAttribute("aria-pressed", String(j === activePreset)));
  }
  function renderPresets() {
    presetGridEl.innerHTML = "";
    BRAND.presets.forEach((p, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "preset";
      b.innerHTML = `<span class="dots"><span style="background:${p.bg}"></span><span style="background:${p.fg}"></span><span style="background:${p.accent}"></span></span><span class="name"></span>`;
      b.querySelector(".name").textContent = p.name[uiLang] ?? p.name.pl;
      b.addEventListener("click", () => applyPreset(i));
      presetGridEl.appendChild(b);
    });
  }
```

Add `presetGridEl` ref. In init: `renderPresets();` then restore — `const savedPreset = BRAND.presets.findIndex(p => p.id === localStorage.getItem(BRAND.presetKey)); applyPreset(savedPreset >= 0 ? savedPreset : 0);`. In `renderTexts()` add `document.querySelectorAll(".preset .name").forEach((el, i) => { el.textContent = BRAND.presets[i].name[uiLang] ?? BRAND.presets[i].name.pl; });`.

PPTX needs no change: `readDeckTheme()` reads computed styles from a probe inside `#view-present`, which now resolves the preset vars.

- [ ] **Step 3: Preset tile CSS (both HTML files)**

edu.html (quantica mirrors with `--bg-1`/`--border-1`/`--quantica-pink`/its radius+font tokens):

```css
.preset-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-2); }
.preset { border: 2px solid var(--line); border-radius: var(--r-sm); background: var(--paper); padding: var(--sp-2); cursor: pointer; text-align: left; }
.preset:hover { border-color: var(--line-2); }
.preset[aria-pressed="true"] { border-color: var(--marigold); }
.preset .dots { display: flex; gap: 4px; margin-bottom: 4px; }
.preset .dots span { width: 12px; height: 12px; border-radius: 50%; border: 1px solid rgba(0,0,0,.15); display: inline-block; }
.preset .name { font-family: var(--font-mono); font-size: var(--overline); font-weight: 500; }
```

- [ ] **Step 4: Verify**

Syntax + tests as in Task 1. Screenshots: for each app, use a CDP/JS evaluation to click preset 2 (`document.querySelectorAll('.preset')[1].click()`), screenshot (dark slide, chrome unchanged), reload, confirm `localStorage.getItem(<presetKey>)` persisted and the tile is re-selected. Confirm the two apps persist independently (different keys).

- [ ] **Step 5: Commit**

```bash
git add app.js edu.html quantica.html
git commit -m "Add 4 brand-locked style presets per app with persistence and PPTX passthrough"
```

---

### Task 3: Per-app example decks (PL/EN)

**Files:**
- Modify: `edu.html`, `quantica.html` (APP_BRAND `exampleMd`)
- Modify: `app.js` (use `BRAND.exampleMd`, delete `SAMPLE_MD`, swap on language change)

**Interfaces:**
- Consumes: `setDeck(md, {example})`, `state.deckIsExample`, `setUiLang` (Task 1).
- Produces: `BRAND.exampleMd = { pl: "…", en: "…" }`.

- [ ] **Step 1: Add `exampleMd` to edu.html's APP_BRAND**

```js
  exampleMd: {
    pl: `# Dokument → slajdy
Warsztatowe narzędzie edulab: z dowolnego dokumentu robi prezentację.
---
## Co tu się dzieje?
- Wrzucasz dokument (.txt, .md, .pdf) - **AI** układa z niego slajdy
- Wszystko dzieje się w przeglądarce - bez serwera i instalacji
- Ta prezentacja to przykład: obejrzyj ją strzałkami ← →
---
## Wczytaj materiał
- Upuść plik w panelu **Dokument** (do 19 MB) albo wklej tekst
- PDF trafia do AI w całości - z tabelami i układem stron
- Gotowy plik .md ze slajdami? Wczyta się od razu, bez AI
---
## Wybierz model AI
- Kliknij wskaźnik modelu w sekcji **Generowanie**
- Do wyboru: Gemini, OpenAI lub Claude - z Twoim kluczem API
> Klucz zostaje w przeglądarce i jest wysyłany wyłącznie do wybranego dostawcy.
---
## Dobierz styl
- Cztery style w sekcji **Styl** - jedno kliknięcie zmienia całą talię
- Kolory pozostają w palecie edulab, także w eksporcie .pptx
---
## Edytuj treść
- Przycisk **Edytuj** otwiera edytor markdown po prawej stronie slajdu
- Zmiany widać na żywo; slajdy oddziela linia \`---\`
- Podczas generowania edytor otwiera się sam i pokazuje strumień AI
---
## Prezentuj
| Klawisz | Działanie |
|---------|-----------|
| → / spacja | następny slajd |
| ← | poprzedni slajd |
| 1-9 | skok do slajdu |
| Esc | powrót do edycji |
---
## Eksportuj i działaj
- **Pobierz .md** - wczytasz ponownie bez klucza API
- **Pobierz .pptx** - edytowalny PowerPoint w wybranym stylu
- Miłego prezentowania!`,
    en: `# Document → slides
An edulab workshop tool: turns any document into a presentation.
---
## What is this?
- Drop a document (.txt, .md, .pdf) - **AI** turns it into slides
- Everything runs in your browser - no server, no install
- This deck is the example: browse it with ← →
---
## Load your material
- Drop a file in the **Document** panel (up to 19 MB) or paste text
- PDFs go to the AI whole - tables and layout included
- Got a ready .md deck? It loads instantly, no AI needed
---
## Pick an AI model
- Click the model chip in the **Generate** section
- Choose Gemini, OpenAI, or Claude - with your own API key
> The key stays in your browser and is sent only to the provider you picked.
---
## Choose a style
- Four styles in the **Style** section - one click restyles the whole deck
- Colors stay within the edulab palette, also in the .pptx export
---
## Edit the content
- The **Edit** button opens a markdown editor to the right of the slide
- Changes render live; slides are separated by a \`---\` line
- During generation the editor opens itself and shows the AI stream
---
## Present
| Key | Action |
|-----|--------|
| → / space | next slide |
| ← | previous slide |
| 1-9 | jump to slide |
| Esc | back to editing |
---
## Export and go
- **Download .md** - reload it anytime without an API key
- **Download .pptx** - editable PowerPoint in the chosen style
- Happy presenting!`,
  },
```

- [ ] **Step 2: Add `exampleMd` to quantica.html's APP_BRAND**

Same deck structure with Quantica product tone — copy the edu decks and change: title intro line to `pl: "Narzędzie Quantica Lab: z dowolnego dokumentu robi prezentację."` / `en: "A Quantica Lab tool: turns any document into a presentation."`; slide 2 first bullet keeps AI mention; the style slide reads `pl: "- Kolory pozostają w palecie Quantica Lab, także w eksporcie .pptx"` / `en: "- Colors stay within the Quantica Lab palette, also in the .pptx export"`. All other slides identical (they describe shared mechanics).

- [ ] **Step 3: Wire into app.js**

- BRAND defaults gain `exampleMd: { pl: "", en: "" }`.
- Delete the `SAMPLE_MD` constant.
- Init: `setDeck(BRAND.exampleMd[uiLang] ?? BRAND.exampleMd.pl, { example: true });`
- In `setUiLang(lang)`, after `renderTexts()`: `if (state.deckIsExample) setDeck(BRAND.exampleMd[lang] ?? BRAND.exampleMd.pl, { example: true });`
- Grep check: `grep -n "SAMPLE_MD\|?demo\|\"demo\"" app.js` → no hits.

- [ ] **Step 4: Verify**

Syntax + tests. Screenshot both apps in PL and `?lang=en` — title slide shows the respective language and app-appropriate intro line. Toggle language via CDP click on `#langEn` and confirm the deck swaps; then simulate a user deck (`document.getElementById('editor')` flow or paste) and confirm language toggle no longer swaps the deck.

- [ ] **Step 5: Commit**

```bash
git add app.js edu.html quantica.html
git commit -m "Ship per-app bilingual example decks; drop SAMPLE_MD and ?demo"
```

---

### Task 4: Live verification, README, wrap-up

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Full sweep**

```bash
node --test tests/pure.test.mjs && node --check shared.js && node --check app.js && node --check pptx-export.js
```

- [ ] **Step 2: Scripted browser verification (reuse the CDP harness pattern from the model-selector work)**

For edu.html and quantica.html:
1. Example deck on load; arrows + `?slide` + `#present` navigation; Esc exits present back to the workspace.
2. Edit toggle opens/closes the right panel; typing re-renders the stage live.
3. Each of the 4 presets restyles stage + present mode; choice survives reload; the two apps' choices are independent.
4. Generation end-to-end with one real provider key (from the session scratchpad key file, if still present; otherwise verify the 4xx error path with a dummy key): editor auto-opens, slides stream, final deck replaces the example.
5. PPTX download click produces a file (headless: check the download event or `exportDeckToPptx` resolves without error) — theme colors must match the active preset (assert via `readDeckTheme()` evaluation returning the preset's bg).
6. Styler regression: index.html loads with no console errors (it shares shared.js).

- [ ] **Step 3: README**

Update the features list: replace the current edu/quantica description with deck-first behavior — example deck on load, sidebar controls, 4 brand style presets per app, editor panel beside the slide. Keep the styler section as-is.

- [ ] **Step 4: Commit and hand off**

```bash
git add README.md
git commit -m "README: document deck-first workspace and brand presets"
```

Ask the user whether to push to `main` (GitHub Pages deploys from it).
