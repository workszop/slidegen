# Model chip simplification + quantica chrome restyle

**Date:** 2026-07-11
**Scope:** `shared.js` (model chip, all three apps), `quantica.html` (CSS only)

## Goal

1. The AI model chip shows only `⚙ <model-id>` — no provider label, no `·`
   separator. The settings dialog is unchanged.
2. The quantica app chrome adopts styler's compact, refined look — scale,
   shapes, quiet ghost buttons, layered tinted surfaces — while keeping
   quantica's identity: pink accent, Poppins + Geist Mono, logo, tag.

## Non-goals

- No change to slide presets, present mode, deck/slide typography, or PPTX
  export (the theme probe reads slide styles, which don't change).
- No change to edu.html or styler beyond the shared chip rendering.
- No markup changes in quantica.html — CSS token/component values only.

## Design

### 1. Model chip (`shared.js` → `renderChip`)

`chip.append("⚙ " + info.label + " · ")` becomes `chip.append("⚙ ")`; the
ellipsized `.ai-chip-model` span with the model id stays. Applies to all
three apps via the shared component.

### 2. Quantica chrome restyle (`quantica.html`)

Token remap plus component-rule adjustments; structure and class names stay.

**Tokens:**
- `--bg-1: #FBF8FA` (faint rose paper), `--bg-2: #F4EDF1` (washes, editor
  panel). `--bg-3` (magenta tint) unchanged.
- `--border-1: #EBE0E7`, `--border-2: #D9C9D3` (rose-grays).
- New `--focus-ring: 0 0 0 3px rgba(196,30,84,.38)`.

**Base:** body `font-size: 15px; line-height: 1.55` (was 18px/1.65).
`:focus-visible` uses the box-shadow ring (styler pattern) instead of
outline. `kbd` at 12px on `--bg-2`.

**Buttons:** `border-radius: var(--radius-pill)`, `padding: 8px 16px`,
`font-size: 13px; font-weight: 600`, centered content. Primary: pink bg,
white text, hover `--deep-berry`, no glow shadow; disabled `--silver`.
Ghost: `color: var(--fg-2)`, `border: 1px solid var(--border-2)`,
hover `background: var(--bg-2); color: var(--fg-1)` — pink is reserved for
primary actions and active states.

**Chrome bar:** padding `var(--space-2) var(--space-5)` (8px 24px),
background `rgba(251,248,250,.85)` (translucent rose paper), keep the
blur, logo, and pink DOC→SLIDES tag.

**Components:**
- Preset cards: `border: 2px solid var(--border-1)`, `border-radius: 14px`,
  `padding: var(--space-3)`, `background: var(--white)`, hover
  `translateY(-2px)` / active `translateY(2px)` (styler), active border
  pink. Name: 13px bold sans (was mono caption). Dots 14px.
- Inputs (`textarea`, `.mono-input`, `#pasteArea`): 13px mono,
  `padding: 7px 10px`, `border-radius: var(--radius-md)`.
- File chip: `background: var(--magenta-tint); color: var(--deep-berry)`
  (was violet mist).
- Error panel, gen-status: inherit new body scale; no structural change.
- Editor panel background: `--bg-2` (now the rose wash) — rule already
  var-driven, no edit needed.

## Error handling

None — pure presentation changes.

## Testing

- `node --test tests/pure.test.mjs` still passes (no pure helper changes).
- Browser: chip shows `⚙ <model>` in all three apps; quantica side-by-side
  with styler shows matching scale/shapes with pink identity; slide
  presets, present mode, editor resize/16:9 behavior unchanged.
