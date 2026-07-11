# Quantica Edulab Chrome Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace quantica.html's style layer with edu.html's edulab layer, keeping quantica's slide styling (Poppins/Geist Mono/pink) and hexagon logo.

**Architecture:** Single-file CSS swap. The new `<style>` block = edu.html's style layer verbatim, with (a) an adapted header comment, (b) quantica slide-identity tokens appended to `:root`, (c) edu's slide-typography rules replaced by quantica's (remapped to edulab token names), (d) pink `--slide-accent` fallbacks on deck/present bars. Fonts link gains Poppins + Geist Mono. Markup and `APP_BRAND` untouched.

**Tech Stack:** CSS only; splice performed with a small Python script for reliability.

**Spec:** `docs/superpowers/specs/2026-07-11-quantica-edulab-chrome-design.md`

## Global Constraints

- `quantica.html` only; no markup or `APP_BRAND` changes.
- Slides keep quantica identity; interface carries no pink.
- Work on branch `quantica-edulab` (off `main`).

---

### Task 1: Swap the style layer

**Files:**
- Modify: `quantica.html` (`<link>` fonts line 9; entire `<style>` block lines 15–381)

**Interfaces:** none — CSS only.

- [ ] **Step 1: Update the fonts link**

Line 9 becomes:

```html
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Raleway:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&family=Poppins:wght@400;500;600;700&family=Geist+Mono:wght@400;500;600&display=swap">
```

- [ ] **Step 2: Compose the new style block**

Write the new block to the scratchpad (`newstyle.css`) assembled as:

1. Header comment:

```css
/* ============================================================
   Quantica Lab app — edulab chrome (Editorial Color, Raleway),
   quantica slides (Poppins, pink). Logic lives in app.js;
   this file is design only. Style contract: see README.
   ============================================================ */
```

2. edu.html `:root` (lines 23–100) verbatim, plus, before the closing brace:

```css
  /* ---- Quantica slide identity (generated slides keep the quantica look) ---- */
  --quantica-pink:   #C41E54;
  --deep-berry:      #8A004C;
  --magenta-tint:    #FFE6F1;
  --violet-primary:  #7030A0;
  --font-slide:      'Poppins', 'Inter', system-ui, sans-serif;
  --font-slide-mono: 'Geist Mono', ui-monospace, 'SF Mono', Menlo, monospace;
```

3. edu.html Base / chrome / components / input helpers / workspace sections (lines 102–217) verbatim.

4. Present-view shell from edu.html (body.presenting, `#view-present`, `.present-bar`, `.slide-logo`, `.stage`) with pink accent fallback on the bar:

```css
body.presenting .chrome { display: none; }

#view-present { position: fixed; inset: 0; background: var(--slide-bg, var(--paper)); display: flex; flex-direction: column; }
.present-bar {
  position: absolute; top: 0; left: 0; height: 4px; width: 0%;
  background: var(--slide-accent, var(--quantica-pink)); transition: width 450ms cubic-bezier(.2,.6,.2,1); z-index: 5;
}
.slide-logo {
  position: absolute; top: calc(4px + 2.5vh); right: 3vw; z-index: 4;
  height: clamp(36px, 4vh + 1.8vw, 88px); width: auto; opacity: .9;
}
.stage { flex: 1; display: grid; place-items: start center; padding: 14vh 4vw 3vh; overflow: hidden; }
```

5. Quantica slide typography (remapped to edulab tokens + slide fonts):

```css
/* Fluid deck scaling: one viewport-driven base size on the slide,
   everything inside in em — the whole slide grows/shrinks with the window.
   Slides keep the QUANTICA identity: Poppins, Geist Mono code, pink. */
.slide {
  width: min(1600px, 90vw); max-height: 88vh; overflow: auto;
  font-size: clamp(15px, 1.55vw + 0.9vh, 46px);
  color: var(--slide-fg, var(--ink));
  --slide-fg-muted: color-mix(in srgb, var(--slide-fg, var(--ink)) 72%, var(--slide-bg, var(--paper)));
  --slide-surface: color-mix(in srgb, var(--slide-fg, var(--ink)) 8%, var(--slide-bg, var(--paper)));
}

.slide .slide-eyebrow {
  font-family: var(--font-slide-mono); font-weight: 500; font-size: .55em;
  letter-spacing: .08em; text-transform: uppercase; color: var(--slide-accent, var(--quantica-pink));
  margin-bottom: .9em;
}
.slide h1 {
  font-family: var(--font-slide); font-weight: 700;
  font-size: 3em; line-height: 1.05; letter-spacing: -0.02em;
  margin: 0 0 .35em;
}
.slide h2 {
  font-family: var(--font-slide); font-weight: 700; font-size: 2.1em;
  line-height: 1.1; letter-spacing: -0.01em; margin: 0 0 .6em;
}
.slide h3 { font-family: var(--font-slide); font-weight: 700; font-size: 1.35em; margin: 1em 0 .5em; }
.slide p, .slide li { font-size: 1em; line-height: 1.55; color: var(--slide-fg-muted); }
.slide p { margin: 0 0 .6em; }
.slide li { margin-bottom: .45em; }
.slide li::marker { color: var(--slide-accent, var(--quantica-pink)); }
.slide strong { color: var(--slide-fg, var(--ink)); font-weight: 700; }
.slide em { color: var(--slide-fg, var(--ink)); }
.slide a { color: var(--quantica-pink); }
/* Mono rules for presenting code — REQUIRED in every style */
.slide code {
  font-family: var(--font-slide-mono); font-size: .9em; color: var(--slide-fg, var(--ink));
  background: var(--slide-surface); padding: .1em .4em; border-radius: var(--r-xs);
}
.slide pre {
  font-family: var(--font-slide-mono);
  background: var(--slide-surface); border: 1px solid var(--slide-surface);
  border-radius: var(--r-md); padding: .8em; overflow-x: auto; font-size: .8em;
  line-height: 1.5;
}
.slide pre code { background: none; padding: 0; font-size: 1em; }
.slide blockquote {
  margin: .9em 0; padding: .6em 1em;
  border: 1px solid var(--slide-accent, var(--quantica-pink)); background: var(--magenta-tint);
  border-radius: var(--r-md); color: var(--deep-berry);
}
.slide blockquote p { color: inherit; margin: 0; }
.slide table { border-collapse: collapse; width: 100%; font-size: .92em; }
.slide th {
  font-family: var(--font-slide-mono); font-size: .6em; letter-spacing: .08em;
  text-transform: uppercase; text-align: left; color: var(--ink-3);
  border-bottom: 2px solid var(--line-2); padding: .5em .7em;
}
.slide td { border-bottom: 1px solid var(--line); padding: .55em .7em; color: var(--slide-fg-muted); }

.slide--title { text-align: center; align-self: center; }
.slide--title .slide-eyebrow { color: var(--violet-primary); }
.slide--title h1 { color: var(--slide-accent, var(--quantica-pink)); font-size: 3.6em; }
.slide--title p { font-size: 1.3em; color: var(--slide-fg-muted); }

.present-footer {
  display: flex; align-items: center; justify-content: space-between;
  padding: var(--sp-3) var(--sp-6); color: var(--ink-3); font-size: var(--caption);
}
.present-counter { font-family: var(--font-mono); }
```

6. edu.html media query + full-bleed workbench + editing 16:9 + editor panel + `.editor-close` sections (lines 305–377) verbatim, except the deck rules keep the pink accent fallback:

```css
.deck {
  flex: 1; display: grid; place-items: start center; padding: 14vh 3vw 3vh; overflow: hidden;
  position: relative; background: var(--slide-bg, var(--paper));
}
.deck-bar {
  position: absolute; top: 0; left: 0; height: 4px; width: 0%;
  background: var(--slide-accent, var(--quantica-pink));
  transition: width 450ms cubic-bezier(.2,.6,.2,1); z-index: 5;
}
```

- [ ] **Step 3: Splice into quantica.html**

Python script: replace everything between `<style>` and `</style>` in `quantica.html` with the scratch file's content; also apply the fonts-link change from Step 1 if not already done.

- [ ] **Step 4: Verify**

`node --test tests/pure.test.mjs` → PASS. Serve and check in the browser: chrome matches edu.html side-by-side except the quantica logo and no wordmark; slides identical to before (Poppins headings, pink title, magenta blockquote) in preview and present; presets switch; editor opens with 16:9 frame; resizer drags; ✕ compact; AI dialog and resize handle marigold.

- [ ] **Step 5: Commit**

```bash
git add quantica.html
git commit -m "style: quantica app adopts edulab chrome; slides keep quantica identity"
```
