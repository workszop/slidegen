# Model Chip Simplification + Quantica Chrome Restyle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show only `⚙ <model-id>` in the AI model chip (all apps), and restyle quantica's app chrome to styler's compact look while keeping quantica's pink accent and Poppins/Geist Mono fonts.

**Architecture:** One-line change in the shared `renderChip`; the quantica work is a pure CSS token remap + component-rule adjustment inside `quantica.html`'s style block — no markup, no JS, no slide/present rules touched.

**Tech Stack:** Vanilla JS + CSS. No build step, no new dependencies.

**Spec:** `docs/superpowers/specs/2026-07-11-quantica-restyle-design.md`

## Global Constraints

- No change to slide presets, present mode, deck/slide typography, or PPTX export.
- No markup changes in `quantica.html` — CSS only.
- Keep quantica pink (`--quantica-pink #C41E54`) as the accent; keep Poppins + Geist Mono.
- Work on branch `quantica-restyle` (stacked on `editor-resize` / PR #3).

---

### Task 1: Model chip shows only the model name

**Files:**
- Modify: `shared.js` (renderChip, ~line 362)

**Interfaces:**
- Consumes/produces: nothing new — `renderChip` is internal to `mountAiSelector`.

- [ ] **Step 1: Edit renderChip**

In `shared.js`, change:

```js
    chip.append("⚙ " + info.label + " · ");
```

to:

```js
    chip.append("⚙ ");
```

- [ ] **Step 2: Regression tests**

Run: `node --test tests/pure.test.mjs`
Expected: PASS (14 tests — chip rendering is not pure-tested)

- [ ] **Step 3: Verify in browser**

Serve (`python3 -m http.server 8080`) and confirm in all three apps the chip reads `⚙ <model-id>` with no provider label; opening the dialog still shows the provider row.

- [ ] **Step 4: Commit**

```bash
git add shared.js
git commit -m "feat: model chip shows only the model name"
```

---

### Task 2: Quantica chrome restyle

**Files:**
- Modify: `quantica.html` (style block only, lines ~22–221)

**Interfaces:**
- Consumes/produces: none — CSS values only; all class names and structure stay.

- [ ] **Step 1: Remap tokens**

In `:root` change the surface/border values and add a focus ring token:

```css
  --bg-1:             #FBF8FA;
  --bg-2:             #F4EDF1;
```
(`--bg-3`, `--bg-inverse*` unchanged)

```css
  --border-1:         #EBE0E7;
  --border-2:         #D9C9D3;
```
(`--border-brand`, `--border-focus` unchanged)

After the `--inner-hairline` line add:

```css
  --focus-ring:       0 0 0 3px rgba(196, 30, 84, .38);
```

- [ ] **Step 2: Base scale + focus**

```css
body {
  margin: 0; min-height: 100vh;
  background: var(--bg-1); color: var(--fg-1);
  font-family: var(--font-sans); font-size: 15px; line-height: 1.55;
  text-rendering: optimizeLegibility; -webkit-font-smoothing: antialiased;
}
```

```css
:focus-visible { outline: none; box-shadow: var(--focus-ring); border-radius: var(--radius-xs); }
```

`kbd` font-size stays `var(--fs-caption)` (12px) — no change needed.

- [ ] **Step 3: Buttons**

Replace the `.btn` block (`.btn`, `.btn-primary`, `.btn-ghost` rules):

```css
.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: var(--space-2);
  border: 0; border-radius: var(--radius-pill); padding: 8px 16px;
  font-weight: 600; font-size: 13px;
  transition: background var(--dur-2) var(--ease-standard), color var(--dur-2) var(--ease-standard), border-color var(--dur-2) var(--ease-standard), transform var(--dur-1) var(--ease-standard);
}
.btn:active { transform: scale(.97); }
.btn-primary { background: var(--quantica-pink); color: var(--fg-on-pink); }
.btn-primary:hover { background: var(--deep-berry); }
.btn-primary:disabled { background: var(--silver); color: var(--white); cursor: not-allowed; }
.btn-ghost { background: transparent; color: var(--fg-2); border: 1px solid var(--border-2); }
.btn-ghost:hover { background: var(--bg-2); color: var(--fg-1); }
```

- [ ] **Step 4: Chrome bar**

```css
.chrome {
  position: sticky; top: 0; z-index: 20;
  display: flex; align-items: center; gap: var(--space-3);
  padding: var(--space-2) var(--space-5);
  background: rgba(251,248,250,.85); backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--border-1);
}
```

- [ ] **Step 5: Components**

Preset cards:

```css
.preset {
  border: 2px solid var(--border-1); border-radius: 14px; background: var(--white);
  padding: var(--space-3); cursor: pointer; text-align: left;
  transition: border-color var(--dur-2) var(--ease-standard), transform var(--dur-1) var(--ease-standard);
}
.preset:hover { transform: translateY(-2px); }
.preset:active { transform: translateY(2px); }
.preset[aria-pressed="true"] { border-color: var(--quantica-pink); }
.preset .dots { display: flex; gap: 4px; margin-bottom: 6px; }
.preset .dots span { width: 14px; height: 14px; border-radius: 50%; border: 1px solid rgba(0,0,0,.12); display: inline-block; }
.preset .name { font-weight: 700; font-size: 13px; }
```

Inputs:

```css
textarea, .mono-input {
  font-family: var(--font-mono); font-size: 13px; color: var(--fg-1);
  background: var(--white); border: 1px solid var(--border-2);
  border-radius: var(--radius-md); padding: 7px 10px; width: 100%;
}
```

File chip:

```css
.file-chip {
  font-family: var(--font-mono); font-size: var(--fs-caption);
  background: var(--magenta-tint); color: var(--deep-berry);
  padding: 4px 14px; border-radius: var(--radius-pill); margin-top: var(--space-2);
}
```

`#pasteArea`: change `background: var(--bg-1)` to `background: var(--white)` (inputs sit white on the rose paper). The editor-panel textarea rule already uses `--bg-1` — change it to `var(--white)` likewise for contrast against the `--bg-2` panel.

- [ ] **Step 6: Regression + browser verification**

Run: `node --test tests/pure.test.mjs` → PASS.

Browser, quantica vs styler side-by-side: compact 15px chrome; pill buttons with quiet gray ghosts and pink primaries; rose-paper surfaces with white cards/inputs; preset cards lift on hover; slide presets, present mode, editor resize + 16:9 editing all unchanged.

- [ ] **Step 7: Commit**

```bash
git add quantica.html
git commit -m "style: quantica chrome adopts styler's compact look, keeps pink identity"
```
