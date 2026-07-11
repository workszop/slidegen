# Per-slide On-demand Illustration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the "illustrate every slide" checkbox with a deck-footer button that generates an illustration for the currently-viewed slide only, sending the whole deck as context and that slide as the subject.

**Architecture:** The pure prompt-builder moves into `shared.js` (unit-tested via the existing `pure.test.mjs` harness). The UI/controller changes are all in `app.js`: panel markup, deck-footer button, a new `illustrateSlide(index)` controller, and `renderIllustrateControls()` for button state. `edu.html`/`quantica.html` are untouched — every new control is gated on `BRAND.experimentalImages`, which is `true` only in `experimental.html`.

**Tech Stack:** Vanilla ES (classic scripts), `node:test` for the pure-helper unit test, `generateOpenAIImage`/`OPENAI_IMAGE_MODELS` from `shared.js`, `marked`+`DOMPurify` for rendering.

## Global Constraints

- New controls appear ONLY when `BRAND.experimentalImages` is truthy (experimental.html only). `edu.html`/`quantica.html` must be visually unchanged.
- The title slide (index 0 AND `isTitleSlide(md)`) is never illustratable — its `.slide--title` layout conflicts with the two-column `.slide-layout`.
- Every user-facing string goes through the `T` i18n table in both `pl` and `en`; render via `data-i18n` / `data-i18n-placeholder`, never hardcoded.
- Pure, testable string logic belongs in the `shared.js` `/* pure-helpers:start */ … /* pure-helpers:end */` block and must be added to the `new Function(...)` export list in `tests/pure.test.mjs`.
- OpenAI image key is read via `loadAiSettings().keys.openai?.trim()`; missing key → `showError(t("errNoKeyTitle"), t("errNoOpenAIKey"))`.
- Image size/quality/streaming params stay as `buildOpenAIImageRequest` already sets them — do not change `shared.js` image transport.

---

### Task 1: Deck-context prompt builder (pure, TDD)

Move `buildSlideImagePrompt` out of `app.js` into the `shared.js` pure-helpers block, rewritten to accept the whole deck as read-only context, and cover it with a unit test.

**Files:**
- Modify: `shared.js` — add function inside pure-helpers (before `buildOpenAIImageRequest`, ~line 227); the test harness reads this block.
- Modify: `tests/pure.test.mjs` — add `buildSlideImagePrompt` to the exported names (~line 20) and add tests.
- Delete later: the old `buildSlideImagePrompt` in `app.js:555-565` is removed in Task 3 (its only caller changes there).

**Interfaces:**
- Produces: `buildSlideImagePrompt({ slideMd, direction, deckSegments })` → `string`.
  - `slideMd` (string): the target slide's markdown.
  - `direction` (string, may be empty/undefined): extra per-slide image direction.
  - `deckSegments` (string[]): every slide's markdown, used as read-only context.

- [ ] **Step 1: Add the failing tests**

In `tests/pure.test.mjs`, first add `buildSlideImagePrompt` to the return object of the `new Function(...)` block (the list that currently ends `...buildOpenAIImageRequest,`). Add it on that line:

```js
  buildOpenAIImageRequest, buildSlideImagePrompt,
```

Then append these tests at the end of the file:

```js
// ── buildSlideImagePrompt (deck context + target slide) ──
test("buildSlideImagePrompt embeds every deck segment as context", () => {
  const p = H.buildSlideImagePrompt({
    slideMd: "## Target\n- point",
    direction: "",
    deckSegments: ["# Title", "## Target\n- point", "## Other"],
  });
  assert.match(p, /do NOT illustrate these/i);
  assert.match(p, /# Title/);
  assert.match(p, /## Other/);
  // the target slide appears under the "illustrate THIS slide" instruction
  assert.match(p, /illustrate the central idea of THIS slide[\s\S]*## Target/i);
  // no leftover user-direction heading when direction is empty
  assert.doesNotMatch(p, /Additional direction from the user/);
});

test("buildSlideImagePrompt appends user direction when provided", () => {
  const p = H.buildSlideImagePrompt({
    slideMd: "## Target",
    direction: "  flat vector, warm palette  ",
    deckSegments: ["## Target"],
  });
  assert.match(p, /Additional direction from the user:\nflat vector, warm palette/);
});

test("buildSlideImagePrompt forbids text and layout artefacts", () => {
  const p = H.buildSlideImagePrompt({ slideMd: "x", direction: "", deckSegments: ["x"] });
  assert.match(p, /Do not include text, letters, numbers, logos/);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/pure.test.mjs`
Expected: FAIL — `buildSlideImagePrompt is not defined` (or `H.buildSlideImagePrompt is not a function`).

- [ ] **Step 3: Add the implementation in shared.js**

In `shared.js`, immediately before `function buildOpenAIImageRequest(...)` (inside the pure-helpers block), add:

```js
// Build the OpenAI image prompt for ONE slide. The full deck is passed as
// read-only context so the illustration fits the presentation; only the
// target slide is illustrated.
function buildSlideImagePrompt({ slideMd, direction, deckSegments }) {
  const deck = (deckSegments ?? []).map(s => s.trim()).filter(Boolean).join("\n\n---\n\n");
  let prompt =
    "Create one landscape editorial illustration for a presentation slide. " +
    "Use a warm, modern workshop aesthetic with simple composition and generous negative space. " +
    "Do not include text, letters, numbers, logos, watermarks, UI, frames, or slide layouts.\n\n" +
    "Here is the full presentation for context only — do NOT illustrate these slides, " +
    "they are provided so the illustration fits the deck:\n\n" +
    deck +
    "\n\nNow illustrate the central idea of THIS slide only:\n\n" +
    (slideMd ?? "").trim();
  if (direction?.trim()) {
    prompt += "\n\nAdditional direction from the user:\n" + direction.trim();
  }
  return prompt;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/pure.test.mjs`
Expected: PASS — all tests, including the three new ones, green.

- [ ] **Step 5: Commit**

```bash
git add shared.js tests/pure.test.mjs
git commit -m "feat: deck-context slide image prompt builder"
```

---

### Task 2: Panel controls + i18n

Remove the "generate illustrations" checkbox, make the image-options block always-visible, add the per-slide "Illustration direction" input, and update the i18n table. After this task the panel is correct even though the button (Task 3) does not exist yet.

**Files:**
- Modify: `app.js` — i18n table (`T.pl` ~line 69-75, `T.en` ~line 108-114); `experimentalControlsHtml` (~line 132-143); the `imageOptionsEl` toggle listener (~line 708-710); DOM ref block (~line 332-334).

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: DOM ids `#illustrationNote` (text input), `#imageModel` (select, kept). i18n keys `illustrationNote`, `illustrationNotePh`, `illustrateSlide`, `regenerateSlide`, `removeIllustration`, `genImageOne` available for Task 3.

- [ ] **Step 1: Update the PL i18n block**

In `app.js`, replace the experimental keys in `T.pl` (currently lines 69-75):

```js
      generateImages: "Generuj ilustracje z OpenAI",
      imageModel: "Model obrazu",
      imageNote: "Jedna ilustracja do każdego slajdu treści. Wymaga klucza OpenAI i zwiększa koszt generowania.",
      genImages: "Generuję ilustracje: {current}/{total}",
      errNoOpenAIKey: "Aby generować ilustracje, zapisz klucz OpenAI w ustawieniach modelu.",
      errImageTitle: "Nie wszystkie ilustracje zostały wygenerowane",
      imageAlt: "Ilustracja wygenerowana przez AI",
```

with:

```js
      imageModel: "Model obrazu",
      illustrationNote: "Wskazówki do ilustracji",
      illustrationNotePh: "np. płaska ilustracja, ciepłe barwy",
      imageNote: "Ilustruj wybrany slajd przyciskiem pod podglądem. Wymaga klucza OpenAI i zwiększa koszt.",
      illustrateSlide: "Ilustruj ten slajd",
      regenerateSlide: "Generuj ilustrację ponownie",
      removeIllustration: "Usuń ilustrację",
      genImageOne: "Ilustruję slajd {n}…",
      errNoOpenAIKey: "Aby generować ilustracje, zapisz klucz OpenAI w ustawieniach modelu.",
      errImageTitle: "Nie udało się wygenerować ilustracji",
      imageAlt: "Ilustracja wygenerowana przez AI",
```

- [ ] **Step 2: Update the EN i18n block**

In `app.js`, replace the experimental keys in `T.en` (currently lines 108-114):

```js
      generateImages: "Generate illustrations with OpenAI",
      imageModel: "Image model",
      imageNote: "One illustration per content slide. Requires an OpenAI key and increases generation cost.",
      genImages: "Generating illustrations: {current}/{total}",
      errNoOpenAIKey: "Save an OpenAI key in the model settings to generate illustrations.",
      errImageTitle: "Some illustrations could not be generated",
      imageAlt: "AI-generated illustration",
```

with:

```js
      imageModel: "Image model",
      illustrationNote: "Illustration direction",
      illustrationNotePh: "e.g. flat illustration, warm palette",
      imageNote: "Illustrate a chosen slide with the button under the preview. Requires an OpenAI key and adds cost.",
      illustrateSlide: "Illustrate this slide",
      regenerateSlide: "Regenerate illustration",
      removeIllustration: "Remove illustration",
      genImageOne: "Illustrating slide {n}…",
      errNoOpenAIKey: "Save an OpenAI key in the model settings to generate illustrations.",
      errImageTitle: "Could not generate the illustration",
      imageAlt: "AI-generated illustration",
```

- [ ] **Step 3: Rewrite `experimentalControlsHtml`**

In `app.js`, replace the whole `experimentalControlsHtml` definition (currently lines 132-143):

```js
  const experimentalControlsHtml = BRAND.experimentalImages ? `
        <label class="experimental-label" for="additionalPrompt" data-i18n="additionalPrompt"></label>
        <textarea id="additionalPrompt" rows="3" data-i18n-placeholder="additionalPromptPh"></textarea>
        <label class="experimental-toggle">
          <input id="generateImages" type="checkbox" />
          <span data-i18n="generateImages"></span>
        </label>
        <div class="image-options hidden" id="imageOptions">
          <label class="experimental-label" for="imageModel" data-i18n="imageModel"></label>
          <select id="imageModel" class="mono-input"></select>
          <p class="experimental-note" data-i18n="imageNote"></p>
        </div>` : "";
```

with:

```js
  const experimentalControlsHtml = BRAND.experimentalImages ? `
        <label class="experimental-label" for="additionalPrompt" data-i18n="additionalPrompt"></label>
        <textarea id="additionalPrompt" rows="3" data-i18n-placeholder="additionalPromptPh"></textarea>
        <div class="image-options" id="imageOptions">
          <label class="experimental-label" for="imageModel" data-i18n="imageModel"></label>
          <select id="imageModel" class="mono-input"></select>
          <label class="experimental-label" for="illustrationNote" data-i18n="illustrationNote"></label>
          <input id="illustrationNote" class="mono-input" type="text" data-i18n-placeholder="illustrationNotePh" />
          <p class="experimental-note" data-i18n="imageNote"></p>
        </div>` : "";
```

- [ ] **Step 4: Update DOM refs and remove the toggle listener**

In `app.js`, in the DOM ref block (currently lines 332-334), replace:

```js
  const generateImagesEl = document.getElementById("generateImages");
  const imageOptionsEl = document.getElementById("imageOptions");
  const imageModelEl = document.getElementById("imageModel");
```

with:

```js
  const imageModelEl = document.getElementById("imageModel");
  const illustrationNoteEl = document.getElementById("illustrationNote");
```

Then delete the now-dangling toggle listener (currently lines 708-710):

```js
  generateImagesEl?.addEventListener("change", () => {
    imageOptionsEl.classList.toggle("hidden", !generateImagesEl.checked);
  });
```

(Delete those three lines entirely. `generateSlides()` still references `generateImagesEl`/`wantsImages` at this point — that is removed in Task 3; do not run the app between tasks expecting a clean console.)

- [ ] **Step 5: Manually verify the panel renders**

Run: `python3 -m http.server 8000` (from repo root), open `http://localhost:8000/experimental.html`.
Expected: In the **Generowanie/Generate** section — the "Additional AI instructions" textarea, then an always-visible block with **Image model** select, an **Illustration direction** text input, and the updated note. No checkbox. Toggle PL/EN — the two new labels/placeholder switch language.
Also open `edu.html` and `quantica.html`: no image controls appear (unchanged).

Note: the browser console will show a `ReferenceError` for `generateImagesEl` when you click Generate — expected until Task 3. Do not click Generate yet.

- [ ] **Step 6: Commit**

```bash
git add app.js
git commit -m "feat: per-slide image panel controls and i18n"
```

---

### Task 3: Deck-footer button, illustrateSlide controller, remove bulk flow

Add the footer button + remove button, the `illustrateSlide(index)` controller, `renderIllustrateControls()`, wire events, switch the prompt call to the new builder, and delete the bulk `generateIllustrations()` + the `wantsImages` branch in `generateSlides()`. After this task the feature works end-to-end.

**Files:**
- Modify: `app.js` — deck-footer markup (~line 218-229); state (~line 254-266); DOM refs (add near line 322-325); delete `buildSlideImagePrompt` (555-565) and `generateIllustrations` (567-606); edit `generateSlides` (610-680); add controller + render fn; wire listeners near the workspace nav (737-744) and call site in `renderStage` (411-429).

**Interfaces:**
- Consumes: `buildSlideImagePrompt({ slideMd, direction, deckSegments })` (Task 1, from `shared.js`); DOM ids `#imageModel`, `#illustrationNote` and i18n keys `illustrateSlide`/`regenerateSlide`/`removeIllustration`/`genImageOne` (Task 2).
- Consumes existing: `generateOpenAIImage`, `loadAiSettings`, `isTitleSlide`, `apiErrorDetail`, `showError`, `renderStage`, `renderPresent`, `state.images`, `state.slideSegments`, `genStatusEl`, `genStatusTextEl`.
- Produces: `#illustrateBtn`, `#removeIllustrationBtn` in the deck footer; `illustrateSlide(index)`, `renderIllustrateControls()`; `state.illustrating`.

- [ ] **Step 1: Add the footer button markup**

In `app.js`, in the `.deck-footer` (currently lines 218-229), replace:

```js
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
```

with (note the new `illustrateControlsHtml` interpolation before `.hints`):

```js
      <footer class="deck-footer">
        <div class="nav-btns">
          <button class="btn btn-ghost" id="wsPrev" aria-label="prev">←</button>
          <button class="btn btn-ghost" id="wsNext" aria-label="next">→</button>
        </div>
        <span class="deck-counter" id="wsCounter"></span>
        <div class="spacer"></div>
        ${illustrateControlsHtml}
        <div class="hints">
          <span><kbd>→</kbd> <span data-i18n="hintNext"></span></span>
          <span><kbd>←</kbd> <span data-i18n="hintPrev"></span></span>
        </div>
      </footer>
```

Then define `illustrateControlsHtml` right after `experimentalControlsHtml` (Task 2, ~line 143):

```js
  const illustrateControlsHtml = BRAND.experimentalImages ? `
        <button class="btn btn-ghost btn-sm hidden" id="illustrateBtn">✦ <span id="illustrateBtnLabel"></span></button>
        <button class="btn btn-ghost btn-sm hidden" id="removeIllustrationBtn" data-i18n="removeIllustration"></button>` : "";
```

- [ ] **Step 2: Add state + DOM refs**

In `app.js`, add to the `state` object (after `generating: false,`, ~line 264):

```js
    illustrating: null,     // index of the slide currently being illustrated, or null
```

Add DOM refs after `wsCounterEl` (~line 325):

```js
  const illustrateBtn = document.getElementById("illustrateBtn");
  const illustrateBtnLabel = document.getElementById("illustrateBtnLabel");
  const removeIllustrationBtn = document.getElementById("removeIllustrationBtn");
```

- [ ] **Step 3: Add `renderIllustrateControls()` and call it from `renderStage`**

In `app.js`, add this function just after `renderStage` (after line 429):

```js
  function renderIllustrateControls() {
    if (!illustrateBtn) return;               // non-experimental brands
    const n = state.slides.length;
    const i = state.current;
    const isTitle = i === 0 && isTitleSlide(state.md);
    const busy = state.illustrating != null;
    const hasImage = Boolean(state.images[i]);
    illustrateBtn.classList.toggle("hidden", n === 0);
    illustrateBtn.disabled = busy || isTitle || n === 0;
    illustrateBtnLabel.textContent = busy
      ? t("genImageOne").replace("{n}", state.illustrating + 1)
      : hasImage ? t("regenerateSlide") : t("illustrateSlide");
    removeIllustrationBtn.classList.toggle("hidden", !hasImage || busy);
  }
```

Then, at the end of `renderStage` (after the `if (image) { … }` block that ends line 428), add:

```js
    renderIllustrateControls();
```

- [ ] **Step 4: Replace `buildSlideImagePrompt` + `generateIllustrations` with `illustrateSlide`**

In `app.js`, delete both the old `buildSlideImagePrompt` (lines 555-565) and the whole `generateIllustrations` function (lines 567-606), and put this `illustrateSlide` controller in their place:

```js
  // ─── Illustration (single slide, on demand) ─────
  async function illustrateSlide(index) {
    if (state.illustrating != null) return;
    if (index < 0 || index >= state.slideSegments.length) return;
    if (index === 0 && isTitleSlide(state.slideSegments[index])) return;
    const openaiKey = loadAiSettings().keys.openai?.trim();
    if (!openaiKey) return showError(t("errNoKeyTitle"), t("errNoOpenAIKey"));

    state.illustrating = index;
    errorPanelEl.classList.add("hidden");
    genStatusEl.classList.remove("hidden");
    genStatusTextEl.textContent = t("genImageOne").replace("{n}", index + 1);
    renderIllustrateControls();
    try {
      const image = await generateOpenAIImage({
        key: openaiKey,
        model: imageModelEl.value,
        prompt: buildSlideImagePrompt({
          slideMd: state.slideSegments[index],
          direction: illustrationNoteEl?.value ?? "",
          deckSegments: state.slideSegments,
        }),
        onPartial(partialImage) {
          state.images[index] = partialImage;
          if (state.view === "present") renderPresent();
          else renderStage();
        },
      });
      state.images[index] = image;
      if (state.view === "present") renderPresent();
      else renderStage();
    } catch (err) {
      showError(t("errImageTitle"), apiErrorDetail(err));
    } finally {
      state.illustrating = null;
      genStatusEl.classList.add("hidden");
      renderIllustrateControls();
    }
  }
```

- [ ] **Step 5: Remove the bulk-image branch from `generateSlides`**

In `app.js`, in `generateSlides` (lines 610-680): delete the `wantsImages`/`openaiKey` setup and its guard near the top:

```js
    const wantsImages = Boolean(BRAND.experimentalImages && generateImagesEl?.checked);
    const openaiKey = ai.keys.openai?.trim();
```
```js
    if (wantsImages && !openaiKey) {
      return showError(t("errNoKeyTitle"), t("errNoOpenAIKey"));
    }
```

and delete the post-stream block (currently lines 664-672):

```js
      if (wantsImages) {
        genStatusTextEl.textContent = t("genImages").replace("{current}", "0")
          .replace("{total}", Math.max(0, state.slides.length - (isTitleSlide(state.md) ? 1 : 0)));
        await generateIllustrations({
          key: openaiKey,
          model: imageModelEl.value,
          additionalPrompt: additionalPromptEl?.value ?? "",
        });
      }
```

Leave the rest of `generateSlides` (streaming, `setDeck(...)`, the `finally` block) intact. Confirm no remaining references: `grep -n "generateImagesEl\|wantsImages\|generateIllustrations\|genImages\|buildSlideImagePrompt" app.js` should return nothing (the builder now lives in `shared.js`).

- [ ] **Step 6: Wire the button listeners**

In `app.js`, near the workspace nav listeners (after the `wsNextBtn` handler, ~line 744), add:

```js
  illustrateBtn?.addEventListener("click", () => illustrateSlide(state.current));
  removeIllustrationBtn?.addEventListener("click", () => {
    state.images[state.current] = undefined;
    renderStage();
  });
```

- [ ] **Step 7: Regression-check the pure tests**

Run: `node --test tests/pure.test.mjs`
Expected: PASS (Task 1 tests still green; nothing here touches shared.js).

- [ ] **Step 8: Manual end-to-end verification**

Run: `python3 -m http.server 8000`, open `http://localhost:8000/experimental.html`. Save a valid OpenAI key via the model chip. Load a multi-slide deck (the example deck works).

Verify against the spec checklist:
1. Navigate to slide 2+ → footer shows enabled "✦ Illustrate this slide". Click → status shows "Illustrating slide N…", image streams in, layout becomes two-column, button label becomes "Regenerate illustration", "Remove illustration" appears.
2. Click "Remove illustration" → image cleared, single-column layout returns, button back to "Illustrate this slide".
3. Navigate to the title slide (slide 1) → illustrate button disabled.
4. Remove the OpenAI key, click illustrate → `errNoOpenAIKey` error panel.
5. Illustrate a slide, then **Download .pptx** → the generated image is embedded on that slide.
6. Open `edu.html` / `quantica.html` → no illustrate button, no image controls.
7. Toggle PL/EN with an illustrated slide selected → button label and "Remove illustration" switch language (re-render via `renderStage` if needed; note `renderTexts` handles `data-i18n` but `#illustrateBtnLabel` is set imperatively — confirm it updates on nav; if a language toggle alone doesn't refresh it, that's acceptable since it refreshes on the next slide nav).

- [ ] **Step 9: Commit**

```bash
git add app.js
git commit -m "feat: on-demand per-slide illustration button"
```

---

## Self-Review notes

- **Spec coverage:** panel rework + illustration-direction input (Task 2); deck-footer button with Illustrate/Regenerate/Remove states + title-slide disable (Task 3, Steps 1/3); `illustrateSlide` with deck-context prompt + key guard + streaming (Tasks 1 & 3); removal of bulk `generateIllustrations` and `wantsImages` (Task 3 Steps 4-5); i18n add/repurpose/drop (Task 2); pptx unchanged (verified Step 8.5). All spec sections map to a task.
- **i18n language-refresh caveat:** `#illustrateBtnLabel` is set imperatively in `renderIllustrateControls`, not via `data-i18n`, so a bare PL/EN toggle won't relabel it until the next `renderStage`. Called out in Step 8.7 as acceptable; if the reviewer wants it live, add a `renderIllustrateControls()` call inside `renderTexts()` under the `if (state.view === "workspace")` branch.
- **Type consistency:** `buildSlideImagePrompt({ slideMd, direction, deckSegments })` is defined in Task 1 and called with exactly those keys in Task 3 Step 4. `illustrationNoteEl`, `imageModelEl`, `state.illustrating`, `illustrateBtnLabel` names are consistent across tasks.
