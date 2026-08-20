/* ============================================================
   eduapp — shared logic (brand-agnostic)

   Requires shared.js (helpers, constants, AI provider + PPTX services)
   to be loaded first. A brand HTML file provides ONLY the style layer:
     1. <style> with the brand's :root tokens + component CSS
        (see README "Style contract" for the required class list;
        every style MUST define --font-mono and the .slide code /
        .slide pre mono rules for presenting code)
     2. Deferred <script> tags: marked + DOMPurify CDN, shared.js, app.js
     3. window.APP_BRAND = {
          logo:         "data:image/png;base64,…",  // chrome + slide corner
          wordmark:     "edulab" | null,            // text next to logo (null = logo only)
          tag:          "doc2slide",                 // app name in the chrome bar
          presentBrand: "edulab",                   // brand name for PPTX metadata
          title:        { pl: "doc2slide", en: "doc2slide" }, // browser title (optional)
        }
   ============================================================ */

(function () {
  "use strict";

  // ─── Example deck ───────────────────────────────
  // The guide every workspace opens with. It lives here, next to the only
  // code that reads it, rather than in a file the shells have to load: a
  // separate file is cached separately, and one stale half rendered an
  // empty workspace with no error at all.
  const EXAMPLE_DECK = {
    pl: `# doc2slide
Zamień dokument w gotową prezentację: tekst i ilustracje przygotuje AI, a Ty poprawisz je w edytorze.
---
## Jak to działa
- Wgraj dokument w panelu **Dokument** albo wklej tekst
- Kliknij **Generuj slajdy**, a AI zamieni materiał w prezentację
- Sprawdź wynik, popraw treść i uruchom **Prezentuj**

> Ten przewodnik przejrzysz przyciskami pod slajdem albo klawiszami ← i →.
---
## Dodaj materiał
- Obsługiwane formaty to **.txt**, **.md** i **.pdf**; limit pliku PDF wynosi 19 MB
- Tekst możesz też wkleić bezpośrednio pod polem wyboru pliku
- Plik .md z separatorami \`---\` otworzy się od razu jako gotowa prezentacja, bez udziału AI
---
## Wybierz model AI
- Kliknij nazwę modelu w sekcji **Generowanie**
- Tekst przygotuje Gemini, OpenAI albo Claude, każdy na Twoim własnym kluczu API
- Klucz zostaje w pamięci tej przeglądarki i trafia wyłącznie do wybranego dostawcy

> Podczas generowania treść dokumentu jest wysyłana bezpośrednio do dostawcy AI.
---
## Generuj slajdy
- Kliknij **Generuj slajdy**; edytor otworzy się sam i pokaże strumień odpowiedzi
- Generowanie możesz przerwać w dowolnym momencie
- Gotowe slajdy rozdziela osobna linia \`---\`
---
## Sprawdź i popraw
- Przejrzyj slajdy i upewnij się, że nie brakuje ważnych informacji
- Kliknij **Edytuj**, aby otworzyć tekst prezentacji po prawej stronie
- Zmiany widać na bieżąco; skracaj akapity, jeden slajd to jedna myśl
- Zweryfikuj fakty wygenerowane przez AI, zanim je udostępnisz
---
## Prezentuj i zapisz
- **Prezentuj** uruchamia tryb pełnoekranowy
- **Pobierz html** zapisuje samodzielną prezentację do otwarcia w przeglądarce
- **Pobierz .pptx** tworzy edytowalną prezentację PowerPoint

| Klawisz | Działanie |
|---------|-----------|
| → | następny slajd |
| ← | poprzedni slajd |
| Esc | powrót do edycji |
---
## Opcje generowania
- Strzałka przy nagłówku **Generowanie** rozwija dodatkowe ustawienia
- **Auto** zachowuje język dokumentu; możesz wymusić polski albo angielski
- W polu **Dodatkowe instrukcje dla AI** opiszesz ton, odbiorców lub zakres prezentacji
- Instrukcje uzupełniają zasady doc2slide, ale nie zastępują formatu slajdów
---
## Styl i czcionka
- Cztery style zmieniają kolory całej prezentacji jednym kliknięciem
- Strzałka przy nagłówku **Styl** rozwija wybór czcionki
- Do wyboru są cztery kroje albo dowolna czcionka Google wpisana z nazwy
- Wybrany styl i czcionka trafiają także do pliku PowerPoint
---
## Ilustracje AI
- Model obrazu wybierzesz w ustawieniach modelu AI; ilustracje wymagają klucza OpenAI
- Przejdź do slajdu treści i kliknij **Ilustruj ten slajd** pod podglądem
- Każdą ilustrację generujesz osobno; możesz ją usunąć albo powtórzyć
- Generowanie obrazów zwiększa czas i koszt wywołań API
- Własne obrazy dodasz przyciskiem **Dodaj obraz** – wgrane pliki wybierasz z biblioteki i wstawiasz na slajd
---
## Gotowe
Wgraj własny dokument w panelu po lewej stronie.`,

    en: `# doc2slide
Turn a document into a finished deck: AI writes the slides and the illustrations, you refine them in the editor.
---
## How it works
- Drop a document in the **Document** panel, or paste text
- Click **Generate slides** and the AI turns the material into a deck
- Review the result, edit the text, then hit **Present**

> Browse this guide with the buttons under the slide, or with ← and →.
---
## Load your material
- Supported formats are **.txt**, **.md**, and **.pdf**; PDFs go up to 19 MB
- You can also paste text straight into the box below the file control
- A .md file split by \`---\` opens as a finished deck, with no AI involved
---
## Pick an AI model
- Click the model name in the **Generate** section
- Gemini, OpenAI, or Claude writes the slides, each on your own API key
- The key stays in this browser and goes only to the provider you picked

> During generation the document is sent straight to that provider.
---
## Generate the slides
- Click **Generate slides**; the editor opens itself and streams the answer
- You can cancel generation at any point
- Finished slides are separated by a \`---\` line
---
## Review and edit
- Read the deck through and check that nothing important is missing
- **Edit** opens the presentation text to the right of the slide
- Changes render live; keep paragraphs short, one slide is one idea
- Verify AI-generated facts before you share the deck
---
## Present and save
- **Present** switches to full-screen mode
- **Download HTML** saves a standalone presentation that opens in a browser
- **Download .pptx** creates an editable PowerPoint file

| Key | Action |
|-----|--------|
| → | next slide |
| ← | previous slide |
| Esc | back to editing |
---
## Generation options
- The chevron on the **Generate** heading unfolds the extra settings
- **Auto** keeps the document's language; you can force Polish or English
- **Additional AI instructions** is where you describe tone, audience, or scope
- Your instructions extend the built-in doc2slide rules, they do not replace them
---
## Style and font
- Four styles recolour the whole deck with one click
- The chevron on the **Style** heading unfolds the font picker
- Choose one of four faces, or type the name of any Google font
- The chosen style and font carry into the PowerPoint export
---
## AI illustrations
- Pick the image model in the AI model dialog; illustrations need an OpenAI key
- Open a content slide and click **Illustrate this slide** below the preview
- Each illustration is generated on its own and can be removed or repeated
- Image generation adds API cost and takes longer
- Add your own pictures with **Add image** – uploaded files sit in a library and can be placed on any slide
---
## Ready when you are
Drop your own document in the panel on the left.`,
  };

  // ─── Brand config ───────────────────────────────
  const BRAND = Object.assign({
    logo: "",
    logoDark: null,           // optional dark-preset mark (see app-style.js)
    wordmark: null,
    tag: "doc2slide",
    presentBrand: "",
    presets: [],
    presetKey: "eduapp_preset",
    editorWKey: "eduapp.editorW",
    // One guide deck for every flavour; a brand may still override it.
    exampleMd: EXAMPLE_DECK,
    illustrations: false,
    pptx: {
      headingFont: "Raleway",
      bodyFont: "Raleway",
      monoFont: "DM Mono",
      company: "",
    },
    title: null,
  }, window.APP_BRAND);

  // ─── Constants (LS_* etc. come from shared.js) ───
  // Long-edge cap for uploaded slide images — matches the size class of
  // generated illustrations and keeps HTML/PPTX exports lean.
  const UPLOAD_MAX_EDGE = 1600;

  // ─── Translations (T + t) ───────────────────────
  const T = {
    pl: {
      appTitle: "doc2slide",
      hintNext: "dalej", hintPrev: "wstecz", hintEsc: "edycja",
      dropHere: "Wgraj plik",
      browse: "Wybierz plik",
      pasteHere: "…albo wklej tekst tutaj",
      generate: "Generuj slajdy",
      cancelGeneration: "Anuluj generowanie",
      cancelIllustration: "Anuluj ilustrację",
      fileLoaded: "wgrano",
      detected: "wykryto",
      errFileType: "Obsługiwane formaty: .txt, .md, .pdf",
      errTooBig: "Plik jest za duży (limit: PDF 19 MB, tekst 2 MB). Skróć dokument lub podziel go na części.",
      errNoKeyTitle: "Brak klucza API",
      errNoKeyBody: "Wklej klucz API dostawcy {provider} w ustawieniach modelu (kliknij wskaźnik modelu). Wygenerujesz go na {url}.",
      errApiTitle: "Błąd API",
      errEmpty: "Model zwrócił pustą odpowiedź. Spróbuj ponownie lub zmień model.",
      errBlocked: "Model odmówił odpowiedzi na ten dokument. Spróbuj innego materiału lub modelu.",
      genTruncated: "Model osiągnął limit długości – deck może być niekompletny.",
      genSending: "Wysyłam dokument…",
      genWaiting: "Generuję slajdy…",
      downloadHtml: "Pobierz html",
      downloadPptx: "Pobierz .pptx",
      errHtmlTitle: "Eksport HTML nie powiódł się",
      errPptxTitle: "Eksport PPTX nie powiódł się",
      present: "Prezentuj",
      sideDoc: "Dokument",
      sideGen: "Generowanie",
      sideStyle: "Styl",
      sideActions: "Akcje",
      customFont: "Inna czcionka Google",
      customFontPh: "np. Merriweather",
      logoLabel: "Logo na slajdach",
      uploadLogo: "Wgraj logo",
      removeLogo: "Usuń logo",
      edit: "Edytuj",
      additionalPrompt: "Dodatkowe instrukcje dla AI",
      additionalPromptPh: "np. użyj konkretnych przykładów i krótkich nagłówków",
      illustrationNote: "Wskazówki do ilustracji",
      illustrationNotePh: "np. płaska ilustracja, ciepłe barwy",
      imageNote: "Ilustruj wybrany slajd przyciskiem pod podglądem. Wymaga klucza OpenAI i zwiększa koszt.",
      illustrateSlide: "Ilustruj ten slajd",
      regenerateSlide: "Generuj ilustrację ponownie",
      removeIllustration: "Usuń ilustrację",
      genImageOne: "Ilustruję slajd {n}…",
      errNoOpenAIKey: "Aby generować ilustracje, zapisz klucz OpenAI w ustawieniach modelu.",
      errImageTitle: "Nie udało się wygenerować ilustracji",
      imageAlt: "Ilustracja slajdu",
      addImage: "Dodaj obraz",
      imageLibraryTitle: "Twoje obrazy",
      imageLibraryEmpty: "Brak wgranych obrazów – wgraj pliki i kliknij miniaturę, aby dodać obraz do bieżącego slajdu.",
      uploadImages: "Wgraj obrazy",
      imagePickAria: "Wstaw obraz: {name}",
      removeFromLibrary: "Usuń z biblioteki",
      imageDialogClose: "Zamknij",
      errImageReadTitle: "Nie udało się wczytać obrazu",
      titleSlideNoImage: "Niedostępne na slajdzie tytułowym – przejdź do slajdu treści",
      errExampleDeck: "Nie udało się wczytać przewodnika. Odśwież stronę z pominięciem pamięci podręcznej (Ctrl+Shift+R).",
      errNetwork: "Nie udało się połączyć z {host}. Sprawdź połączenie, blokowanie przez rozszerzenia lub zaporę sieciową i spróbuj ponownie.",
      resetApp: "Wróć do prezentacji startowej",
      confirmReset: "Powrót do domyślnych ustawień, wprowadzone zmiany zostaną skasowane",
    },
    en: {
      appTitle: "doc2slide",
      hintNext: "next", hintPrev: "back", hintEsc: "edit",
      dropHere: "Upload a file",
      browse: "Choose file",
      pasteHere: "…or paste text here",
      generate: "Generate slides",
      cancelGeneration: "Cancel generation",
      cancelIllustration: "Cancel illustration",
      fileLoaded: "loaded",
      detected: "detected",
      errFileType: "Supported formats: .txt, .md, .pdf",
      errTooBig: "File too large (limits: PDF 19 MB, text 2 MB). Trim the document or split it.",
      errNoKeyTitle: "Missing API key",
      errNoKeyBody: "Paste your {provider} API key in the model settings (click the model chip). Generate one at {url}.",
      errApiTitle: "API error",
      errEmpty: "The model returned an empty response. Try again or switch models.",
      errBlocked: "The model declined to answer for this document. Try different material or another model.",
      genTruncated: "The model hit its length limit – the deck may be incomplete.",
      genSending: "Sending the document…",
      genWaiting: "Generating slides…",
      downloadHtml: "Download HTML",
      downloadPptx: "Download .pptx",
      errHtmlTitle: "HTML export failed",
      errPptxTitle: "PPTX export failed",
      present: "Present",
      sideDoc: "Document",
      sideGen: "Generate",
      sideStyle: "Style",
      sideActions: "Actions",
      customFont: "Another Google font",
      customFontPh: "e.g. Merriweather",
      logoLabel: "Logo on slides",
      uploadLogo: "Upload logo",
      removeLogo: "Remove logo",
      edit: "Edit",
      additionalPrompt: "Additional AI instructions",
      additionalPromptPh: "e.g. use concrete examples and short headings",
      illustrationNote: "Illustration direction",
      illustrationNotePh: "e.g. flat illustration, warm palette",
      imageNote: "Illustrate a chosen slide with the button under the preview. Requires an OpenAI key and adds cost.",
      illustrateSlide: "Illustrate this slide",
      regenerateSlide: "Regenerate illustration",
      removeIllustration: "Remove illustration",
      genImageOne: "Illustrating slide {n}…",
      errNoOpenAIKey: "Save an OpenAI key in the model settings to generate illustrations.",
      errImageTitle: "Could not generate the illustration",
      imageAlt: "Slide illustration",
      addImage: "Add image",
      imageLibraryTitle: "Your images",
      imageLibraryEmpty: "No uploaded images yet – upload files and click a thumbnail to place it on the current slide.",
      uploadImages: "Upload images",
      imagePickAria: "Place image: {name}",
      removeFromLibrary: "Remove from library",
      imageDialogClose: "Close",
      errImageReadTitle: "Could not read the image",
      titleSlideNoImage: "Not available on the title slide – open a content slide",
      errExampleDeck: "The guide deck could not be loaded. Reload the page bypassing the cache (Ctrl+Shift+R).",
      errNetwork: "Could not connect to {host}. Check your connection, browser extensions, or network firewall and try again.",
      resetApp: "Back to the intro deck",
      confirmReset: "Back to default settings, your changes will be discarded",
    },
  };
  // localStorage throws in Chrome with cookies blocked and in a cross-site
  // iframe. This runs before the UI is built, so an unguarded read would abort
  // the whole IIFE and leave a blank page.
  function readStored(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  }
  function writeStored(key, value) {
    try { localStorage.setItem(key, value); } catch { /* storage unavailable */ }
  }
  function removeStored(key) {
    try { localStorage.removeItem(key); } catch { /* storage unavailable */ }
  }
  // LS_LANG is shared with sibling apps, so it can hold anything; fall back
  // rather than throwing on T[undefined].
  let uiLang = ["pl", "en"].includes(readStored(LS_LANG)) ? readStored(LS_LANG) : "pl";
  function t(key) { return (T[uiLang] ?? T.pl)[key] ?? key; }
  // An empty example deck renders a blank workspace and nothing else — no
  // error, no hint. That is exactly how a half-stale deploy used to look, so
  // say it out loud instead of showing an empty stage.
  function exampleDeck(lang) {
    const md = BRAND.exampleMd?.[lang] || BRAND.exampleMd?.pl || "";
    if (!md.trim()) {
      console.error("doc2slide: the example deck is empty — a stale or overridden APP_BRAND.exampleMd?");
      return `# ${t("appTitle")}\n${t("errExampleDeck")}`;
    }
    return md;
  }
  function browserTitle() {
    if (typeof BRAND.title === "string") return BRAND.title;
    return BRAND.title?.[uiLang] ?? BRAND.title?.pl ?? t("appTitle");
  }
  function setUiLang(lang) {
    uiLang = lang;
    writeStored(LS_LANG, lang);
    document.documentElement.lang = lang;
    document.title = browserTitle();
    renderTexts();
    if (state.deckIsExample) setDeck(exampleDeck(lang), { example: true });
    aiSelector.refresh();
  }

  // ─── Markup (shared structure; brand styles it via CSS) ──
  const wordmarkHtml = BRAND.wordmark ? `<div class="wordmark"></div>` : "";
  const tagHtml = BRAND.tag ? `<div class="tag"></div>` : "";
  const illustrationControlsHtml = BRAND.illustrations ? `
        <label class="illustration-label" for="additionalPrompt" data-i18n="additionalPrompt"></label>
        <textarea id="additionalPrompt" rows="3" data-i18n-placeholder="additionalPromptPh"></textarea>
        <div class="image-options" id="imageOptions">
          <label class="illustration-label" for="illustrationNote" data-i18n="illustrationNote"></label>
          <input id="illustrationNote" class="mono-input" type="text" data-i18n-placeholder="illustrationNotePh" />
          <p class="illustration-note" data-i18n="imageNote"></p>
        </div>` : "";
  const illustrateControlsHtml = BRAND.illustrations ? `
        <button class="btn btn-ghost btn-sm hidden" id="illustrateBtn">✦ <span id="illustrateBtnLabel"></span></button>
        <button class="btn btn-ghost btn-sm hidden" id="addImageBtn" data-i18n="addImage"></button>
        <button class="btn btn-ghost btn-sm hidden" id="removeIllustrationBtn" data-i18n="removeIllustration"></button>` : "";
  // Session-only library of uploaded slide images; placing one reuses the
  // generated-illustration slot, layout, and exports.
  const imageDialogHtml = BRAND.illustrations ? `
<dialog class="image-dialog" id="imageDialog">
  <h2 data-i18n="imageLibraryTitle"></h2>
  <p class="image-lib-empty" id="imageLibraryEmpty" data-i18n="imageLibraryEmpty"></p>
  <div class="image-lib-grid" id="imageLibraryGrid"></div>
  <input type="file" id="imageUploadInput" class="visually-hidden" accept="image/*" multiple />
  <div class="image-dialog-actions">
    <button class="btn btn-ghost btn-sm" id="imageUploadBtn" data-i18n="uploadImages"></button>
    <span class="spacer"></span>
    <button class="btn btn-ghost btn-sm" id="imageDialogClose" data-i18n="imageDialogClose"></button>
  </div>
</dialog>` : "";
  document.body.insertAdjacentHTML("afterbegin", `
<header class="chrome">
  <button type="button" class="brand-home" id="brandHomeBtn">
    <img class="chrome-mark brand-logo" alt="" aria-hidden="true">
    ${wordmarkHtml}
  </button>
  ${tagHtml}
  <div class="spacer"></div>
  <div class="lang-toggle" role="group" aria-label="Język interfejsu / UI language">
    <button id="langPl" aria-pressed="true">PL</button>
    <button id="langEn" aria-pressed="false">EN</button>
  </div>
</header>

<main id="app" aria-live="polite">
  <div class="workbench" id="view-workspace">
    <aside class="panel">
      <section class="side-section">
        <h2 class="side-title">
          <button type="button" class="side-fold-toggle" data-fold="styleFold"
                  aria-expanded="false" aria-controls="styleFold"><span data-i18n="sideStyle"></span></button>
        </h2>
        <div class="preset-grid" id="presetGrid" role="group"></div>
        <div class="side-fold-body hidden" id="styleFold">
          <div class="font-grid" id="fontGrid" role="group"></div>
          <label class="side-fold-label" for="customFont" data-i18n="customFont"></label>
          <input id="customFont" class="mono-input" type="text" autocomplete="off"
                 spellcheck="false" data-i18n-placeholder="customFontPh" />
          <div class="logo-controls">
            <span class="side-fold-label" data-i18n="logoLabel"></span>
            <input type="file" id="logoInput" class="visually-hidden"
                   accept="image/png,image/jpeg,image/svg+xml,image/webp" />
            <div class="side-row">
              <button class="btn btn-ghost btn-sm" id="logoBtn" data-i18n="uploadLogo"></button>
              <button class="btn btn-ghost btn-sm" id="logoClear" data-i18n="removeLogo"></button>
            </div>
          </div>
        </div>
      </section>

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
        <h2 class="side-title">
          <button type="button" class="side-fold-toggle" data-fold="genFold"
                  aria-expanded="false" aria-controls="genFold"><span data-i18n="sideGen"></span></button>
        </h2>
        <button id="aiChip"></button>
        <div class="side-fold-body hidden" id="genFold">
          <div class="side-row">
            <div class="lang-toggle" role="group" aria-label="PL/EN/Auto">
              <button id="slideLangPl" aria-pressed="false">PL</button>
              <button id="slideLangEn" aria-pressed="false">EN</button>
              <button id="slideLangAuto" aria-pressed="true">Auto</button>
            </div>
          </div>
          ${illustrationControlsHtml}
        </div>
        <button class="btn btn-primary btn-block" id="generateBtn" disabled data-i18n="generate"></button>
        <div class="gen-status hidden" id="genStatus" role="status">
          <div class="gen-bar" aria-hidden="true"><div></div></div>
          <span id="genStatusText"></span>
        </div>
      </section>

      <section class="side-section side-actions">
        <h2 class="side-title" data-i18n="sideActions"></h2>
        <button class="btn btn-ghost btn-block" id="editToggleBtn" aria-pressed="false" data-i18n="edit"></button>
        <button class="btn btn-primary btn-block" id="presentBtn" data-i18n="present"></button>
        <button class="btn btn-ghost btn-block" id="downloadBtn" data-i18n="downloadHtml"></button>
        <button class="btn btn-ghost btn-block" id="pptxBtn" data-i18n="downloadPptx"></button>
      </section>
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
        <div class="slide-frame"><div class="slide" id="wsStage"></div></div>
      </div>
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
    </section>

    <aside class="editor-panel hidden" id="editorPanel">
      <div class="editor-head"><button class="editor-close" id="editorCloseBtn" aria-label="close">✕</button></div>
      <textarea id="editor" spellcheck="false"></textarea>
    </aside>
  </div>

  <section id="view-present" class="hidden">
    <div class="present-bar" id="presentBar" aria-hidden="true"></div>
    <img class="slide-logo brand-logo" alt="" aria-hidden="true">
    <div class="stage"><div class="slide" id="stage"></div></div>
    <div class="present-footer">
      <div class="hints" style="margin:0">
        <span><kbd>→</kbd> <span data-i18n="hintNext"></span></span>
        <span><kbd>←</kbd> <span data-i18n="hintPrev"></span></span>
        <span><kbd>Esc</kbd> <span data-i18n="hintEsc"></span></span>
      </div>
      <div class="present-counter" id="presentCounter"></div>
    </div>
  </section>
</main>
${imageDialogHtml}`);

  // ─── State ──────────────────────────────────────
  const state = {
    view: "workspace",      // workspace | present
    editorOpen: false,
    deckIsExample: true,
    source: null,           // {name, kind, text?|base64?, multi?} — see readSourceFile
    md: "",
    slides: [],
    slideSegments: [],
    deckModel: { slides: [], warnings: [], stats: {} },
    images: [],
    uploads: [],            // session-only image library: [{name, dataUrl}]
    current: 0,
    generating: false,
    generationController: null,
    slideLang: "auto",
    illustrating: null,     // index of the slide currently being illustrated, or null
    illustrationController: null,
  };
  function setView(v) { state.view = v; render(); }
  function setDeck(md, { example = false } = {}) {
    state.deckIsExample = example;
    setMd(md);
  }

  // Single entry point for markdown changes — keeps slides in sync.
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

  // ─── DOM refs ───────────────────────────────────
  const viewEls = {
    workspace: document.getElementById("view-workspace"),
    present: document.getElementById("view-present"),
  };
  const workspaceEl = viewEls.workspace;
  const brandHomeBtn = document.getElementById("brandHomeBtn");
  const langPlBtn = document.getElementById("langPl");
  const langEnBtn = document.getElementById("langEn");
  const stageEl = document.getElementById("stage");
  const presentBarEl = document.getElementById("presentBar");
  const presentCounterEl = document.getElementById("presentCounter");
  const dropzoneEl = document.getElementById("dropzone");
  const fileInputEl = document.getElementById("fileInput");
  const fileChipEl = document.getElementById("fileChip");
  const browseBtn = document.getElementById("browseBtn");
  const pasteAreaEl = document.getElementById("pasteArea");
  const aiChipEl = document.getElementById("aiChip");
  const slideLangPlBtn = document.getElementById("slideLangPl");
  const slideLangEnBtn = document.getElementById("slideLangEn");
  const slideLangAutoBtn = document.getElementById("slideLangAuto");
  const generateBtn = document.getElementById("generateBtn");
  const genStatusEl = document.getElementById("genStatus");
  const genStatusTextEl = document.getElementById("genStatusText");
  const errorPanelEl = document.getElementById("errorPanel");
  const errorTitleEl = document.getElementById("errorTitle");
  const errorDetailEl = document.getElementById("errorDetail");
  const errorDismissBtn = document.getElementById("errorDismiss");
  const editorEl = document.getElementById("editor");
  const pptxBtn = document.getElementById("pptxBtn");
  const downloadBtn = document.getElementById("downloadBtn");
  const presentBtn = document.getElementById("presentBtn");
  const wsStageEl = document.getElementById("wsStage");
  const wsPrevBtn = document.getElementById("wsPrev");
  const wsNextBtn = document.getElementById("wsNext");
  const wsCounterEl = document.getElementById("wsCounter");
  const deckBarEl = document.getElementById("deckBar");
  const editorPanelEl = document.getElementById("editorPanel");
  const editToggleBtn = document.getElementById("editToggleBtn");
  const editorCloseBtn = document.getElementById("editorCloseBtn");
  const presetGridEl = document.getElementById("presetGrid");
  const fontGridEl = document.getElementById("fontGrid");
  const customFontEl = document.getElementById("customFont");
  const additionalPromptEl = document.getElementById("additionalPrompt");
  const illustrationNoteEl = document.getElementById("illustrationNote");
  const illustrateBtn = document.getElementById("illustrateBtn");
  const illustrateBtnLabel = document.getElementById("illustrateBtnLabel");
  const removeIllustrationBtn = document.getElementById("removeIllustrationBtn");
  const addImageBtn = document.getElementById("addImageBtn");
  const imageDialogEl = document.getElementById("imageDialog");
  const imageLibraryEmptyEl = document.getElementById("imageLibraryEmpty");
  const imageLibraryGridEl = document.getElementById("imageLibraryGrid");
  const imageUploadInputEl = document.getElementById("imageUploadInput");
  const imageUploadBtnEl = document.getElementById("imageUploadBtn");
  const imageDialogCloseEl = document.getElementById("imageDialogClose");

  mountPanelResizer({ panel: editorPanelEl, storageKey: BRAND.editorWKey });

  // ─── Style + export controllers (app-style.js / app-export.js) ──
  // Both are factories that receive the shared context; the split keeps this
  // file to deck state, rendering, streaming, and event wiring.
  const logoInputEl = document.getElementById("logoInput");
  const logoBtnEl = document.getElementById("logoBtn");
  const logoClearEl = document.getElementById("logoClear");
  const style = createStyleController({
    BRAND, state, t, uiLang: () => uiLang, readStored, writeStored, removeStored,
    presetGridEl, fontGridEl, customFontEl,
    logoInputEl, logoBtnEl, logoClearEl,
    onLogoChange: () => { if (state.view === "present") renderPresent(); else renderStage(); },
  });
  const exporter = createExportController({
    BRAND, state, t, uiLang: () => uiLang, style,
    deckTitle, splitSlides, stripOuterFence, illustratedSlideHtml, ensurePptxDeps, showError, downloadBtn, pptxBtn,
  });
  const applyPreset = style.applyPreset;
  const applyFont = style.applyFont;
  const resetFont = style.resetFont;
  const preloadPickerFonts = style.preloadPickerFonts;

  // ─── Helpers (DOM-adjacent) ─────────────────────
  // Parsed slide HTML is memoized per segment string: during streaming and
  // editing only the changed segment pays the marked+DOMPurify cost.
  const slideHtmlCache = new Map();
  const SLIDE_CACHE_LIMIT = 500;
  function slideHtml(segment) {
    if (slideHtmlCache.has(segment)) {
      const cached = slideHtmlCache.get(segment);
      slideHtmlCache.delete(segment);
      slideHtmlCache.set(segment, cached);
      return cached;
    }
    const html = DOMPurify.sanitize(marked.parse(segment));
    slideHtmlCache.set(segment, html);
    if (slideHtmlCache.size > SLIDE_CACHE_LIMIT) {
      slideHtmlCache.delete(slideHtmlCache.keys().next().value);
    }
    return html;
  }
  function renderSlides() {
    const previousSegments = state.slideSegments;
    const previousImages = state.images;
    state.slideSegments = splitSlides(stripOuterFence(state.md));
    state.deckModel = DeckModel.create(state.slideSegments, { marked });
    state.slides = state.slideSegments.map(slideHtml);
    state.images = reconcileSlideImages(previousSegments, previousImages, state.slideSegments);
    state.current = Math.min(state.current, Math.max(0, state.slides.length - 1));
  }

  // ─── Render functions ───────────────────────────
  // Text-only refresh (language toggle) — no slide re-parse, no preview rebuild.
  function renderTexts() {
    brandHomeBtn.title = t("resetApp");
    brandHomeBtn.setAttribute("aria-label", t("resetApp"));
    langPlBtn.setAttribute("aria-pressed", String(uiLang === "pl"));
    langEnBtn.setAttribute("aria-pressed", String(uiLang === "en"));
    document.querySelectorAll("[data-i18n]").forEach(el => {
      el.textContent = t(el.dataset.i18n);
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
      el.placeholder = t(el.dataset.i18nPlaceholder);
    });
    document.querySelectorAll(".preset .name").forEach((el, i) => {
      el.textContent = BRAND.presets[i].name[uiLang] ?? BRAND.presets[i].name.pl;
    });
    if (state.view === "workspace") { renderSidebar(); renderIllustrateControls(); }
  }

  function render() {
    for (const [name, el] of Object.entries(viewEls)) {
      el.classList.toggle("hidden", state.view !== name);
    }
    document.body.classList.toggle("presenting", state.view === "present");
    renderTexts();
    if (state.view === "present") renderPresent();
    if (state.view === "workspace") renderStage();
  }

  // One slide renderer shared by the workspace and present views. The two
  // chrome wrappers differ only in their frame (counter, progress bar,
  // eyebrow), not in how a slide is drawn — splitting them duplicated the
  // slide-class/dataset/image wiring and let the two views drift apart.
  function renderSlideInto(el, { eyebrow = "" } = {}) {
    const i = state.current;
    const semanticSlide = state.deckModel.slides[i];
    const isTitle = semanticSlide?.type === "title";
    const image = state.images[i];
    el.className = "slide" + (isTitle ? " slide--title" : "") + (image ? " slide--illustrated" : "");
    el.dataset.slideType = semanticSlide?.type ?? "content";
    el.dataset.warningCount = String(semanticSlide?.warnings?.length ?? 0);
    el.innerHTML = (eyebrow ? `<div class="slide-eyebrow"></div>` : "")
      + (image ? illustratedSlideHtml(state.slides[i], '<img class="slide-generated-image" alt="">') : state.slides[i]);
    if (eyebrow) el.querySelector(".slide-eyebrow").textContent = eyebrow;
    if (image) {
      const img = el.querySelector(".slide-generated-image");
      img.src = image;
      img.alt = t("imageAlt");
    }
  }

  function renderStage() {
    const n = state.slides.length;
    wsCounterEl.textContent = n ? `${state.current + 1} / ${n}` : "";
    wsPrevBtn.disabled = state.current <= 0;
    wsNextBtn.disabled = state.current >= n - 1;
    deckBarEl.style.width = n ? `${((state.current + 1) / n) * 100}%` : "0%";
    if (!n) { wsStageEl.innerHTML = ""; return; }
    renderSlideInto(wsStageEl);
    renderIllustrateControls();
  }

  function renderIllustrateControls() {
    if (!illustrateBtn) return;               // brands without illustrations
    const n = state.slides.length;
    const i = state.current;
    const isTitle = state.deckModel.slides[i]?.type === "title";
    const busy = state.illustrating != null;
    const hasImage = Boolean(state.images[i]);
    illustrateBtn.classList.toggle("hidden", n === 0);
    illustrateBtn.disabled = (!busy && isTitle) || n === 0;
    illustrateBtnLabel.textContent = busy
      ? t("cancelIllustration")
      : hasImage ? t("regenerateSlide") : t("illustrateSlide");
    removeIllustrationBtn.classList.toggle("hidden", !hasImage || busy);
    addImageBtn.classList.toggle("hidden", n === 0);
    addImageBtn.disabled = isTitle || busy || n === 0;
    // A disabled ghost button is easy to read as broken; say why it is off.
    const titleHint = isTitle ? t("titleSlideNoImage") : "";
    illustrateBtn.title = busy ? "" : titleHint;
    addImageBtn.title = titleHint;
  }

  function renderPresent() {
    const n = state.slides.length;
    if (!n) return;
    const i = state.current;
    const isTitle = state.deckModel.slides[i]?.type === "title";
    const title = deckTitle(state.md);
    // The title slide carries no eyebrow: the brand already shows in the
    // corner logo, and an empty div would still claim its bottom margin.
    const eyebrow = isTitle ? "" : [`${i + 1} / ${n}`, title].filter(Boolean).join(" · ");
    renderSlideInto(stageEl, { eyebrow });
    presentBarEl.style.width = `${((i + 1) / n) * 100}%`;
    presentCounterEl.textContent = `${i + 1} / ${n}`;
  }

  function showSlide(i) {
    state.current = Math.max(0, Math.min(i, state.slides.length - 1));
    renderPresent();
  }


  function renderSidebar() {
    const src = state.source;
    fileChipEl.classList.toggle("hidden", !src);
    if (src) {
      const langInfo = src.kind === "text" ? ` · ${t("detected")}: ${detectLang(src.text).toUpperCase()}` : "";
      fileChipEl.textContent = `✓ ${t("fileLoaded")}: ${src.name}${langInfo}`;
    }
    generateBtn.disabled = !src && !state.generating;
    generateBtn.textContent = state.generating ? t("cancelGeneration") : t("generate");
    generateBtn.setAttribute("aria-busy", String(state.generating));
    slideLangPlBtn.setAttribute("aria-pressed", String(state.slideLang === "pl"));
    slideLangEnBtn.setAttribute("aria-pressed", String(state.slideLang === "en"));
    slideLangAutoBtn.setAttribute("aria-pressed", String(state.slideLang === "auto"));
  }

  function showError(title, detail) {
    errorTitleEl.textContent = title;
    errorDetailEl.textContent = detail;
    errorPanelEl.classList.remove("hidden");
  }

  function apiErrorDetail(err) {
    if (err?.code === "blocked") return t("errBlocked");
    return err?.code === "network_error"
      ? t("errNetwork").replace("{host}", err.host || "API")
      : String(err?.message ?? err);
  }

  // ─── File loading ───────────────────────────────
  function setSource(source) {
    state.source = source;
    state.images = [];
    if (source?.kind === "text") {
      source.multi = splitSlides(source.text).length > 1; // computed once, read by renderSidebar
    }
    errorPanelEl.classList.add("hidden");
    render();
    if (source?.kind === "text" && source.multi) setDeck(source.text, { example: false });
  }

  function loadFile(file) {
    if (!file) return;
    readSourceFile(file)
      .then(setSource)
      .catch(err => showError(err.message === "size" ? t("errTooBig") : t("errFileType"), file.name));
  }

  // ─── Reset (chrome logo) ────────────────────────
  // Returns the workspace to its first-visit state: the guide deck, no loaded
  // document, brand visuals. Language, API settings, and panel widths stay.
  // Anything the reset would throw away: the user's own deck, a loaded or
  // pasted document (even before slides are generated), generated
  // illustrations, uploaded images, or styling changed from the brand
  // defaults.
  function resetWouldDiscard() {
    return !state.deckIsExample
      || state.source != null
      || pasteAreaEl.value.trim() !== ""
      || state.images.some(Boolean)
      || state.uploads.length > 0
      || !style.isDefault();
  }

  function resetToDefault() {
    if (resetWouldDiscard() && !confirm(t("confirmReset"))) return;
    state.generationController?.abort(new DOMException("Generation cancelled", "AbortError"));
    state.illustrationController?.abort(new DOMException("Illustration cancelled", "AbortError"));
    pasteAreaEl.value = "";
    style.resetToDefaults();
    setEditorOpen(false);
    state.uploads = [];
    state.current = 0;
    setSource(null);
    setDeck(exampleDeck(uiLang), { example: true });
  }

  // ─── Illustration (single slide, on demand) ─────
  async function illustrateSlide(index) {
    if (state.illustrating != null) {
      state.illustrationController?.abort(new DOMException("Illustration cancelled", "AbortError"));
      return;
    }
    if (state.generating) return;
    if (index < 0 || index >= state.slideSegments.length) return;
    if (state.deckModel.slides[index]?.type === "title") return;
    const aiSettings = loadAiSettings();
    const openaiKey = aiSettings.keys.openai?.trim();
    if (!openaiKey) return showError(t("errNoKeyTitle"), t("errNoOpenAIKey"));

    const previousImage = state.images[index];
    state.illustrating = index;
    state.illustrationController = new AbortController();
    errorPanelEl.classList.add("hidden");
    genStatusEl.classList.remove("hidden");
    genStatusTextEl.textContent = t("genImageOne").replace("{n}", index + 1);
    renderIllustrateControls();
    try {
      const image = await generateOpenAIImage({
        key: openaiKey,
        model: aiSettings.imageModel,
        signal: state.illustrationController.signal,
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
      state.images[index] = previousImage;
      if (state.view === "present") renderPresent();
      else renderStage();
      if (err?.name !== "AbortError") showError(t("errImageTitle"), apiErrorDetail(err));
    } finally {
      state.illustrating = null;
      state.illustrationController = null;
      genStatusEl.classList.add("hidden");
      renderIllustrateControls();
    }
  }

  // ─── Uploaded images (session library + placement) ─────
  // Uploads land in state.uploads; placing one writes state.images[current],
  // so layout, reconciliation, removal, and both exports behave exactly like
  // a generated illustration.
  function renderImageLibrary() {
    if (!imageDialogEl) return;              // brands without illustrations
    imageLibraryEmptyEl.classList.toggle("hidden", state.uploads.length > 0);
    imageLibraryGridEl.innerHTML = "";
    for (const upload of state.uploads) {
      const item = document.createElement("div");
      item.className = "image-lib-item";
      const pick = document.createElement("button");
      pick.type = "button";
      pick.className = "image-lib-pick";
      pick.title = upload.name;
      pick.setAttribute("aria-label", t("imagePickAria").replace("{name}", upload.name));
      const thumb = document.createElement("img");
      thumb.src = upload.dataUrl;
      thumb.alt = "";
      pick.appendChild(thumb);
      pick.addEventListener("click", () => placeUpload(upload));
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "image-lib-remove";
      remove.textContent = "✕";
      remove.title = t("removeFromLibrary");
      remove.setAttribute("aria-label", t("removeFromLibrary"));
      remove.addEventListener("click", () => {
        state.uploads = state.uploads.filter(u => u !== upload);
        renderImageLibrary();
      });
      item.append(pick, remove);
      imageLibraryGridEl.appendChild(item);
    }
  }

  function placeUpload(upload) {
    if (state.deckModel.slides[state.current]?.type === "title") return;
    state.images[state.current] = upload.dataUrl;
    imageDialogEl.close();
    if (state.view === "present") renderPresent(); else renderStage();
  }

  // Decode, downscale to the generated-image size class, and re-encode one
  // uploaded file as a data URL (JPEG unless transparency would be lost).
  async function readUploadImage(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error("Image decode failed"));
        img.src = url;
      });
      const size = fitWithin(img.naturalWidth, img.naturalHeight, UPLOAD_MAX_EDGE);
      if (!size) throw new Error("Image decode failed");
      const canvas = document.createElement("canvas");
      canvas.width = size.width;
      canvas.height = size.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, size.width, size.height);
      const { mime, quality } = uploadEncoding(canvasHasAlpha(ctx, size, file.type));
      return canvas.toDataURL(mime, quality);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  // JPEG sources cannot carry alpha, so only other formats pay for the scan.
  function canvasHasAlpha(ctx, { width, height }, sourceType) {
    if (sourceType === "image/jpeg") return false;
    const data = ctx.getImageData(0, 0, width, height).data;
    for (let i = 3; i < data.length; i += 4) if (data[i] < 255) return true;
    return false;
  }

  async function addUploadFiles(files) {
    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        showError(t("errImageReadTitle"), file.name);
        continue;
      }
      try {
        const dataUrl = await readUploadImage(file);
        state.uploads.push({ name: file.name, dataUrl });
      } catch {
        showError(t("errImageReadTitle"), file.name);
      }
    }
    renderImageLibrary();
  }

  // Streaming: markdown flows into the editor and preview as it arrives
  // (transport lives in shared.js; this function is only the UI reaction).
  async function generateSlides() {
    if (state.generating) {
      state.generationController?.abort(new DOMException("Generation cancelled", "AbortError"));
      return;
    }
    const ai = loadAiSettings();
    const key = ai.keys[ai.provider]?.trim();
    if (!key) {
      const info = PROVIDER_INFO[ai.provider];
      return showError(t("errNoKeyTitle"),
        t("errNoKeyBody").replace("{provider}", info.label).replace("{url}", info.keyUrl.replace("https://", "")));
    }
    if (!state.source || state.illustrating != null) return;

    state.generating = true;
    state.generationController = new AbortController();
    errorPanelEl.classList.add("hidden");
    genStatusEl.classList.remove("hidden");
    genStatusTextEl.textContent = t("genSending");
    renderSidebar();
    state.images = [];
    let started = false, lastRender = 0, truncated = false;
    try {
      const acc = await streamSlides({
        provider: ai.provider,
        model: ai.model,
        key,
        source: state.source,
        prompt: buildPrompt({
          lang: state.slideLang,
          additionalPrompt: additionalPromptEl?.value ?? "",
        }),
        signal: state.generationController.signal,
        onNotice(notice) {
          if (notice.code === "truncated") truncated = true;
        },
        onChunk(text) {
          if (!started) {
            started = true;
            genStatusTextEl.textContent = t("genWaiting");
            setEditorOpen(true);
            setDeck("", { example: false });
          }
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
        },
      });
      if (!acc.trim()) throw new Error(t("errEmpty"));
      setDeck(stripOuterFence(acc.trim()), { example: false });
      // The deck is real but cut short; keep it and say so rather than
      // reporting a clean success.
      if (truncated) showError(t("errApiTitle"), t("genTruncated"));
    } catch (err) {
      if (err?.name !== "AbortError") showError(t("errApiTitle"), apiErrorDetail(err));
    } finally {
      state.generating = false;
      state.generationController = null;
      genStatusEl.classList.add("hidden");
      renderSidebar();
    }
  }

  // ─── Event listeners ────────────────────────────
  brandHomeBtn.addEventListener("click", resetToDefault);
  langPlBtn.addEventListener("click", () => setUiLang("pl"));
  langEnBtn.addEventListener("click", () => setUiLang("en"));

  // input view
  browseBtn.addEventListener("click", () => fileInputEl.click());
  dropzoneEl.addEventListener("click", e => { if (e.target === dropzoneEl || e.target.closest(".dz-label")) fileInputEl.click(); });
  dropzoneEl.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInputEl.click(); } });
  fileInputEl.addEventListener("change", () => loadFile(fileInputEl.files[0]));
  ["dragover", "dragenter"].forEach(ev => dropzoneEl.addEventListener(ev, e => { e.preventDefault(); dropzoneEl.classList.add("dragover"); }));
  ["dragleave", "drop"].forEach(ev => dropzoneEl.addEventListener(ev, e => { e.preventDefault(); dropzoneEl.classList.remove("dragover"); }));
  dropzoneEl.addEventListener("drop", e => loadFile(e.dataTransfer.files[0]));

  let pasteTimer;
  pasteAreaEl.addEventListener("input", () => {
    clearTimeout(pasteTimer);
    pasteTimer = setTimeout(() => {
      const text = pasteAreaEl.value.trim();
      setSource(text ? { name: uiLang === "pl" ? "(wklejony tekst)" : "(pasted text)", kind: "text", text } : null);
    }, 250);
  });

  slideLangPlBtn.addEventListener("click", () => { state.slideLang = "pl"; renderSidebar(); });
  slideLangEnBtn.addEventListener("click", () => { state.slideLang = "en"; renderSidebar(); });
  slideLangAutoBtn.addEventListener("click", () => { state.slideLang = "auto"; renderSidebar(); });
  errorDismissBtn.addEventListener("click", () => errorPanelEl.classList.add("hidden"));

  generateBtn.addEventListener("click", () => generateSlides());

  // editor panel
  let previewTimer;
  editorEl.addEventListener("input", () => {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(() => {
      state.deckIsExample = false; // manual edits make the deck the user's own
      setMd(editorEl.value, state.current);
    }, 300);
  });
  editorEl.addEventListener("keydown", e => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      setMd(editorEl.value, state.current);
      setView("present");
    }
  });
  downloadBtn.addEventListener("click", () => exporter.downloadHtml());
  pptxBtn.addEventListener("click", () => exporter.downloadPptx());
  presentBtn.addEventListener("click", () => setView("present"));
  editToggleBtn.addEventListener("click", () => setEditorOpen(!state.editorOpen));
  editorCloseBtn.addEventListener("click", () => setEditorOpen(false));

  // workspace stage nav
  wsPrevBtn.addEventListener("click", () => {
    state.current = Math.max(0, state.current - 1);
    renderStage();
  });
  illustrateBtn?.addEventListener("click", () => illustrateSlide(state.current));
  removeIllustrationBtn?.addEventListener("click", () => {
    state.images[state.current] = undefined;
    renderStage();
  });
  addImageBtn?.addEventListener("click", () => {
    renderImageLibrary();
    imageDialogEl.showModal();
  });
  imageUploadBtnEl?.addEventListener("click", () => imageUploadInputEl.click());
  imageUploadInputEl?.addEventListener("change", () => {
    const files = [...imageUploadInputEl.files];
    imageUploadInputEl.value = "";
    addUploadFiles(files);
  });
  imageDialogCloseEl?.addEventListener("click", () => imageDialogEl.close());

  wsNextBtn.addEventListener("click", () => {
    state.current = Math.min(state.slides.length - 1, state.current + 1);
    renderStage();
  });

  document.addEventListener("keydown", e => {
    if (state.view === "present" && e.key === "Escape") { setView("workspace"); return; }
    if (e.key === "Escape" && state.view === "workspace" && state.editorOpen && !document.querySelector("dialog[open]")) { e.preventDefault(); setEditorOpen(false); return; }
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (state.view === "present") {
      if (["ArrowRight", " ", "PageDown"].includes(e.key)) { e.preventDefault(); showSlide(state.current + 1); }
      else if (["ArrowLeft", "PageUp"].includes(e.key)) { e.preventDefault(); showSlide(state.current - 1); }
      else if (e.key === "Home") { e.preventDefault(); showSlide(0); }
      else if (e.key === "End") { e.preventDefault(); showSlide(state.slides.length - 1); }
      else if (/^[1-9]$/.test(e.key)) showSlide(Number(e.key) - 1);
    } else if (state.view === "workspace" && !/^BUTTON$/.test(e.target.tagName)) {
      if (e.key === "ArrowRight") { e.preventDefault(); state.current = Math.min(state.slides.length - 1, state.current + 1); renderStage(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); state.current = Math.max(0, state.current - 1); renderStage(); }
    }
  });

  // ─── Init ───────────────────────────────────────
  document.querySelectorAll(".brand-logo").forEach(el => { el.src = BRAND.logo; });
  if (BRAND.wordmark) document.querySelector(".wordmark").textContent = BRAND.wordmark;
  if (BRAND.tag) document.querySelector(".chrome .tag").textContent = BRAND.tag;
  const aiSelector = mountAiSelector({
    chip: aiChipEl,
    getLang: () => uiLang,
    images: BRAND.illustrations,
  });
  // Presets, fonts, and logo all live in the style controller; init wires
  // the controls, applies the stored preset/font, and restores the logo.
  style.init();
  document.querySelectorAll(".side-fold-toggle").forEach(toggle => {
    const body = document.getElementById(toggle.dataset.fold);
    toggle.addEventListener("click", () => {
      const open = body.classList.toggle("hidden") === false;
      toggle.setAttribute("aria-expanded", String(open));
      if (open && toggle.dataset.fold === "styleFold") preloadPickerFonts();
    });
  });
  // Applying on every keystroke asked Google for every prefix of the name
  // ("M", "Me", "Mer", …), leaving a dozen dead stylesheet links in the page
  // and in every exported deck. Wait for the typing to settle instead.
  let customFontTimer = 0;
  customFontEl.addEventListener("input", () => {
    clearTimeout(customFontTimer);
    customFontTimer = setTimeout(() => {
      const value = customFontEl.value.trim();
      if (value) applyFont(value);
      else resetFont();
    }, 500);
  });
  {
    const params = new URLSearchParams(location.search);
    if (["pl", "en"].includes(params.get("lang"))) { uiLang = params.get("lang"); writeStored(LS_LANG, uiLang); }
    setDeck(exampleDeck(uiLang), { example: true });
    // Number("abc") is NaN and survives the clamp (Math.min(NaN, n) is NaN),
    // which renders the literal string "undefined" as the slide body.
    const slideParam = Number.parseInt(params.get("slide"), 10);
    if (Number.isFinite(slideParam)) setMd(state.md, Math.max(0, slideParam - 1));
    if (location.hash === "#present" && state.slides.length) state.view = "present";
  }
  document.documentElement.lang = uiLang; // after ?lang so the param wins
  document.title = browserTitle();
  render();
})();
