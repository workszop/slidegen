# Per-slide on-demand illustration — design

**Date:** 2026-07-11
**App:** `experimental.html` (shared logic in `app.js`, image transport in `shared.js`)
**Status:** approved

## Problem

The experimental variant currently illustrates slides through a checkbox
("Generate illustrations with OpenAI"). When ticked, finishing text generation
kicks off `generateIllustrations()`, which generates **one image for every
content slide** in bulk. The user has no control over *which* slides get an
illustration, cannot redo a single one, and pays for images they may not want.

## Goal

Replace the automatic, all-slides behaviour with a **manual, per-slide button**.
The user navigates to a slide in the workspace stage, clicks a button in the
deck footer, and an illustration is generated for **that slide only**. The image
model receives the **whole deck as read-only context** and the **target slide as
the subject** to illustrate.

## Decisions (from brainstorming)

- **Slide picking:** the currently-viewed slide on the workspace stage
  (`state.current`). No separate picker.
- **Old checkbox:** removed entirely. The button is the only way to make
  illustrations.
- **Button placement:** the deck footer, next to the ← / → nav.
- **Model & direction:** keep the image-model `<select>` in the panel and add a
  dedicated per-slide "Illustration direction" input, separate from the existing
  text-generation "Additional AI instructions" textarea.

## Scope

Only `experimental.html` shows these controls (gated on `BRAND.experimentalImages`,
which is `true` only there). `edu.html` and `quantica.html` set it `false` and
are unaffected. All logic changes live in `app.js`; `shared.js`
(`generateOpenAIImage`, `OPENAI_IMAGE_MODELS`) and `pptx-export.js` are reused
unchanged.

## UI changes (`app.js`)

### Panel — `experimentalControlsHtml`

Before:

```
label additionalPrompt
textarea #additionalPrompt
label.experimental-toggle > input#generateImages  (checkbox)
div.image-options.hidden #imageOptions
  label imageModel + select#imageModel
  p.experimental-note imageNote
```

After:

```
label additionalPrompt                 ← unchanged (text-gen instructions only)
textarea #additionalPrompt             ← unchanged
div.image-options #imageOptions        ← now always visible, no toggle
  label imageModel + select#imageModel ← kept
  label illustrationNote + input#illustrationNote  ← NEW, image-only direction
  p.experimental-note imageNote        ← copy updated (see i18n)
```

- Remove the `generateImages` checkbox and the `imageOptions` show/hide toggle
  listener (`generateImagesEl?.addEventListener("change", …)`).
- `#illustrationNote` is a single-line `.mono-input` text field.

### Deck footer — new controls

Injected into the `.deck-footer` markup **only when `BRAND.experimentalImages`**
(build an `illustrateControlsHtml` string the same way `experimentalControlsHtml`
is built, insert it before the `.hints` block):

```
button.btn.btn-ghost.btn-sm #illustrateBtn        →  "✦ Illustrate this slide"
button.btn.btn-ghost.btn-sm.hidden #removeIllustrationBtn  →  "Remove"
```

State-driven rendering (new `renderIllustrateControls()`, called from
`renderStage()`):

| Current slide condition            | `#illustrateBtn`                          | `#removeIllustrationBtn` |
|------------------------------------|-------------------------------------------|--------------------------|
| no slides                          | hidden                                    | hidden                   |
| title slide (index 0 & isTitle)    | disabled, label "Illustrate this slide"   | hidden                   |
| content slide, no image            | enabled, label "Illustrate this slide"    | hidden                   |
| content slide, has image           | enabled, label "Regenerate illustration"  | visible                  |
| a generation is in flight (any)    | disabled, label "Illustrating…"           | hidden                   |

The title slide stays non-illustratable: its centered `.slide--title` layout
conflicts with the two-column `.slide-layout` used for illustrated slides. This
matches today's `generateIllustrations` which skipped slide 0.

## Behaviour

### New state

- `state.illustrating` — the slide index currently generating, or `null`.
  Used to disable the button and drive the "Illustrating…" label.

### New function: `illustrateSlide(index)`

Replaces the bulk `generateIllustrations()` worker.

1. Guard: return if `state.illustrating != null`, if `index` is out of range,
   or if it's the title slide.
2. Read OpenAI key via `loadAiSettings().keys.openai?.trim()`. If missing →
   `showError(t("errNoKeyTitle"), t("errNoOpenAIKey"))` and return.
3. Set `state.illustrating = index`, update controls + status text
   (`t("genImageOne").replace("{n}", index + 1)`), hide any error panel.
4. `await generateOpenAIImage({ key, model: imageModelEl.value, prompt, onPartial })`
   where `onPartial(partial)` writes `state.images[index] = partial` and
   re-renders the affected view (`renderStage()` in workspace, `renderPresent()`
   if presenting — mirror the current bulk logic).
5. On success store the final image in `state.images[index]`.
6. On failure → `showError(t("errImageTitle"), apiErrorDetail(err))`.
7. `finally`: `state.illustrating = null`, refresh controls/status.

### Prompt: `buildSlideImagePrompt(slideMd, direction, deckContext)`

Extend the existing builder to include the full deck as context:

```
Create one landscape editorial illustration for a presentation slide.
Use a warm, modern workshop aesthetic with simple composition and generous negative space.
Do not include text, letters, numbers, logos, watermarks, UI, frames, or slide layouts.

Here is the full presentation for context only — do NOT illustrate these slides,
they are provided so the illustration fits the deck:

<all state.slideSegments joined with "\n\n---\n\n">

Now illustrate the central idea of THIS slide only:

<target slideMd>
```

Append the per-slide `direction` (from `#illustrationNote`) if non-empty, under
an "Additional direction from the user:" heading (as today).

### Wiring

- `#illustrateBtn` click → `illustrateSlide(state.current)`.
- `#removeIllustrationBtn` click → `state.images[state.current] = undefined;`
  then `renderStage()`.
- `renderStage()` calls `renderIllustrateControls()` at the end.

## Removed

- `generateIllustrations()` bulk worker.
- The `wantsImages` branch in `generateSlides()` (text generation no longer
  triggers any image work) and its related `wantsImages`/`openaiKey` checks.
- `generateImagesEl`, `imageOptionsEl` refs and the toggle listener.
- Now-unused i18n keys `generateImages`, `genImages`.

`pptx-export.js` still receives `state.images` in `downloadPptx` (line ~488), so
whatever the user generated exports normally.

## i18n (PL / EN)

Add:

| key                | PL                                   | EN                              |
|--------------------|--------------------------------------|---------------------------------|
| `illustrateSlide`  | Ilustruj ten slajd                   | Illustrate this slide           |
| `regenerateSlide`  | Generuj ilustrację ponownie          | Regenerate illustration         |
| `removeIllustration` | Usuń ilustrację                    | Remove illustration             |
| `illustrationNote` | Wskazówki do ilustracji              | Illustration direction          |
| `illustrationNotePh` | np. płaska ilustracja, ciepłe barwy | e.g. flat illustration, warm palette |
| `genImageOne`      | Ilustruję slajd {n}…                 | Illustrating slide {n}…         |

Repurpose `imageNote` copy (no longer "one per content slide"):

- PL: „Ilustruj wybrany slajd przyciskiem pod podglądem. Wymaga klucza OpenAI i zwiększa koszt."
- EN: "Illustrate a chosen slide with the button under the preview. Requires an OpenAI key and adds cost."

Reuse existing `errImageTitle`, `errNoOpenAIKey`, `imageAlt`, `imageModel`.
Drop `generateImages`, `genImages`.

## Edge cases

- **Editing shifts slides:** `renderSlides()` already truncates `state.images`
  to slide count. Indices can drift if the user reorders slides after
  illustrating — same pre-existing caveat as the bulk flow; not addressed here.
- **Regenerate:** simply calls `illustrateSlide` again, overwriting the entry;
  `onPartial` streams the new image over the old one.
- **Present mode:** the footer button lives in the workspace only; presenting
  shows whatever images exist. If a generation is streaming while the user
  switches to present, `onPartial` already re-renders the present view.

## Testing

Manual (no automated harness for this UI):

1. Load a multi-slide deck, save an OpenAI key. Navigate to slide 2, click
   "Illustrate this slide" → image streams in, layout switches to two-column.
2. Button now reads "Regenerate illustration"; "Remove" appears. Click Remove →
   image gone, single-column layout returns.
3. Navigate to the title slide → button disabled.
4. Click illustrate with no OpenAI key saved → `errNoOpenAIKey` shown.
5. Export `.pptx` after illustrating one slide → that image is embedded.
6. Confirm `edu.html` / `quantica.html` show no illustrate button or image
   controls (BRAND.experimentalImages false).
