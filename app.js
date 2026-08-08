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

  // ─── Brand config ───────────────────────────────
  const BRAND = Object.assign({
    logo: "",
    wordmark: null,
    tag: "doc2slide",
    presentBrand: "",
    presets: [],
    presetKey: "eduapp_preset",
    editorWKey: "eduapp.editorW",
    // One guide deck for every flavour; a brand may still override it.
    exampleMd: window.EXAMPLE_DECK ?? { pl: "", en: "" },
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
      errPptxTitle: "Eksport PPTX nie powiódł się",
      present: "Prezentuj",
      sideDoc: "Dokument",
      sideGen: "Generowanie",
      sideStyle: "Styl",
      sideActions: "Akcje",
      customFont: "Inna czcionka Google",
      customFontPh: "np. Merriweather",
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
      imageAlt: "Ilustracja wygenerowana przez AI",
      errNetwork: "Nie udało się połączyć z {host}. Sprawdź połączenie, blokowanie przez rozszerzenia lub zaporę sieciową i spróbuj ponownie.",
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
      errPptxTitle: "PPTX export failed",
      present: "Present",
      sideDoc: "Document",
      sideGen: "Generate",
      sideStyle: "Style",
      sideActions: "Actions",
      customFont: "Another Google font",
      customFontPh: "e.g. Merriweather",
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
      imageAlt: "AI-generated illustration",
      errNetwork: "Could not connect to {host}. Check your connection, browser extensions, or network firewall and try again.",
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
  // LS_LANG is shared with sibling apps, so it can hold anything; fall back
  // rather than throwing on T[undefined].
  let uiLang = ["pl", "en"].includes(readStored(LS_LANG)) ? readStored(LS_LANG) : "pl";
  function t(key) { return (T[uiLang] ?? T.pl)[key] ?? key; }
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
    if (state.deckIsExample) setDeck(BRAND.exampleMd[lang] ?? BRAND.exampleMd.pl, { example: true });
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
        <button class="btn btn-ghost btn-sm hidden" id="removeIllustrationBtn" data-i18n="removeIllustration"></button>` : "";
  document.body.insertAdjacentHTML("afterbegin", `
<header class="chrome">
  <img class="chrome-mark brand-logo" alt="" aria-hidden="true">
  ${wordmarkHtml}
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
</main>`);

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

  mountPanelResizer({ panel: editorPanelEl, storageKey: BRAND.editorWKey });

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
    writeStored(BRAND.presetKey, p.id);
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

  // ─── Deck font ──────────────────────────────────
  // The picker drives slide-scoped tokens only, so the app chrome keeps the
  // brand font no matter what the user selects for the deck.
  const DECK_FONTS = [
    { name: "Raleway", stack: "system-ui, sans-serif" },
    { name: "Lato", stack: "system-ui, sans-serif" },
    { name: "Poppins", stack: "system-ui, sans-serif" },
    { name: "PT Serif", stack: "Georgia, serif" },
  ];
  const FONT_KEY = `${BRAND.presetKey}_font`;
  const DEFAULT_FONT = BRAND.pptx.headingFont || DECK_FONTS[0].name;
  // Google's CSS API takes the family verbatim, so anything outside this
  // shape is a typo (or an injection attempt) rather than a font.
  const FONT_NAME = /^[A-Za-z0-9][A-Za-z0-9 ]{0,48}$/;
  let activeFont = DEFAULT_FONT;

  function loadGoogleFont(name) {
    const family = name.trim().replace(/\s+/g, "+");
    const href = `https://fonts.googleapis.com/css2?family=${family}:wght@400;500;600;700;800&display=swap`;
    if (document.querySelector(`link[href="${href}"]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }

  function markFont(name) {
    activeFont = name;
    const known = DECK_FONTS.find(f => f.name.toLowerCase() === name.toLowerCase());
    document.querySelectorAll(".font-chip").forEach(b =>
      b.setAttribute("aria-pressed", String(b.dataset.font.toLowerCase() === name.toLowerCase())));
    if (customFontEl && customFontEl !== document.activeElement) {
      customFontEl.value = known ? "" : name;
    }
  }

  function applyFont(name, { store = true } = {}) {
    const clean = String(name ?? "").trim();
    if (!FONT_NAME.test(clean)) return false;
    const known = DECK_FONTS.find(f => f.name.toLowerCase() === clean.toLowerCase());
    // Unquoted multi-word families are valid CSS and keep the value inside the
    // character set collectExportPresetCss is willing to inline.
    const stack = `${clean}, ${known?.stack ?? "system-ui, sans-serif"}`;
    loadGoogleFont(clean);
    const rs = document.documentElement.style;
    rs.setProperty("--slide-heading-font", stack);
    rs.setProperty("--slide-body-font", stack);
    if (store) writeStored(FONT_KEY, clean);
    markFont(clean);
    return true;
  }

  // Clearing the picker hands typography back to the brand's own stylesheet,
  // which is not the same as picking the brand's default family: Quantica
  // pairs Poppins headings with a different body face, and only the CSS
  // knows that pairing.
  function resetFont() {
    const rs = document.documentElement.style;
    rs.removeProperty("--slide-heading-font");
    rs.removeProperty("--slide-body-font");
    writeStored(FONT_KEY, "");
    markFont(DEFAULT_FONT);
  }

  function renderFonts() {
    fontGridEl.innerHTML = "";
    for (const font of DECK_FONTS) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "font-chip";
      b.dataset.font = font.name;
      b.textContent = font.name;
      b.style.fontFamily = `${font.name}, ${font.stack}`;
      b.addEventListener("click", () => applyFont(font.name));
      fontGridEl.appendChild(b);
    }
  }

  // Each chip is supposed to be set in the face it offers, which only works
  // once that face is on the page. Deferred to the first time the group is
  // opened so a workspace nobody restyles never pays for the downloads.
  let fontsPreloaded = false;
  function preloadPickerFonts() {
    if (fontsPreloaded) return;
    fontsPreloaded = true;
    DECK_FONTS.forEach(font => loadGoogleFont(font.name));
  }

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

  function renderStage() {
    const n = state.slides.length;
    wsCounterEl.textContent = n ? `${state.current + 1} / ${n}` : "";
    wsPrevBtn.disabled = state.current <= 0;
    wsNextBtn.disabled = state.current >= n - 1;
    deckBarEl.style.width = n ? `${((state.current + 1) / n) * 100}%` : "0%";
    if (!n) { wsStageEl.innerHTML = ""; return; }
    const semanticSlide = state.deckModel.slides[state.current];
    const isTitle = semanticSlide?.type === "title";
    const image = state.images[state.current];
    wsStageEl.className = "slide" + (isTitle ? " slide--title" : "") + (image ? " slide--illustrated" : "");
    wsStageEl.dataset.slideType = semanticSlide?.type ?? "content";
    wsStageEl.dataset.warningCount = String(semanticSlide?.warnings?.length ?? 0);
    wsStageEl.innerHTML = image
      ? `<div class="slide-layout"><div class="slide-copy">${state.slides[state.current]}</div><img class="slide-generated-image" alt=""></div>`
      : state.slides[state.current];
    if (image) {
      const img = wsStageEl.querySelector(".slide-generated-image");
      img.src = image;
      img.alt = t("imageAlt");
    }
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
  }

  function renderPresent() {
    const n = state.slides.length;
    if (!n) return;
    const i = state.current;
    const semanticSlide = state.deckModel.slides[i];
    const isTitle = semanticSlide?.type === "title";
    const title = deckTitle(state.md);
    // The title slide carries no eyebrow: the brand already shows in the
    // corner logo, and an empty div would still claim its bottom margin.
    const eyebrow = isTitle ? "" : [`${i + 1} / ${n}`, title].filter(Boolean).join(" · ");
    const image = state.images[i];
    stageEl.className = "slide" + (isTitle ? " slide--title" : "") + (image ? " slide--illustrated" : "");
    stageEl.dataset.slideType = semanticSlide?.type ?? "content";
    stageEl.dataset.warningCount = String(semanticSlide?.warnings?.length ?? 0);
    stageEl.innerHTML = (eyebrow ? `<div class="slide-eyebrow"></div>` : "") + (image
      ? `<div class="slide-layout"><div class="slide-copy">${state.slides[i]}</div><img class="slide-generated-image" alt=""></div>`
      : state.slides[i]);
    if (eyebrow) stageEl.querySelector(".slide-eyebrow").textContent = eyebrow;
    if (image) {
      const img = stageEl.querySelector(".slide-generated-image");
      img.src = image;
      img.alt = t("imageAlt");
    }
    presentBarEl.style.width = `${((i + 1) / n) * 100}%`;
    presentCounterEl.textContent = `${i + 1} / ${n}`;
  }

  function showSlide(i) {
    state.current = Math.max(0, Math.min(i, state.slides.length - 1));
    renderPresent();
  }

  // ─── PPTX export (deps lazy-loaded via shared.js) ───
  // Keep export colors in canonical hex form. Reading computed CSS is brittle:
  // modern browsers may serialize derived colors as `color(srgb ...)`, and
  // those values are not suitable PowerPoint theme inputs.
  function readDeckTheme() {
    const preset = BRAND.presets[activePreset] ?? BRAND.presets[0];
    return {
      bg: preset?.bg ?? "#FFFFFF",
      fg: preset?.fg ?? "#111111",
      accent: preset?.accent ?? "#4472C4",
      headingFont: activeFont,
      bodyFont: activeFont,
      monoFont: BRAND.pptx.monoFont,
    };
  }

  async function downloadPptx() {
    try {
      pptxBtn.disabled = true;
      await ensurePptxDeps();
      await exportDeckToPptx({
        slidesMd: splitSlides(stripOuterFence(state.md)),
        deck: state.deckModel,
        images: state.images,
        theme: readDeckTheme(),
        logo: BRAND.logo || null,
        // No brandName: the title slide uses the TITLE_PLAIN master so the
        // deck carries no brand eyebrow. Document metadata still gets the
        // brand through `company`.
        company: BRAND.pptx.company || BRAND.presentBrand,
        language: uiLang,
        fileName: (deckTitle(state.md) || "slides") + ".pptx",
      });
    } catch (err) {
      showError(t("errPptxTitle"), String(err.message ?? err));
    } finally {
      pptxBtn.disabled = false;
    }
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[char]);
  }

  // The active preset lives as inline custom properties on <html>, which
  // collectExportCss cannot reach: it only walks stylesheet rules. Without
  // this the export falls back to the default preset on every var().
  function collectExportPresetCss() {
    const inline = document.documentElement.style;
    const declarations = ["--slide-bg", "--slide-fg", "--slide-accent",
      "--slide-heading-font", "--slide-body-font"]
      .map(name => [name, inline.getPropertyValue(name).trim()])
      .filter(([, value]) => value && /^[#\w(),.%\s-]+$/.test(value))
      .map(([name, value]) => `${name}: ${value};`);
    return declarations.length ? `:root { ${declarations.join(" ")} }` : "";
  }

  // Workbench-only selectors. A standalone deck contains none of these
  // elements, so shipping their rules inside every exported presentation is
  // pure weight — including the AI key dialog and the panel resizer that
  // shared.js injects at runtime. Everything else is kept, so a rule the deck
  // does need can never be dropped by accident.
  const EXPORT_CHROME_SELECTOR = new RegExp([
    "\\.(workbench|chrome|panel|panel-resizer|has-panel-resizer|editor-|dropzone|preset",
    "|btn|side-|side_|file-chip|error-panel|gen-|lang-toggle|mono-input|stage-wrap",
    "|font-grid|font-chip",
    "|deck|hints|spacer|wordmark|nav-btns|dz-label|ai-|visually-hidden)",
    "|#pasteArea|#editor\\b|#view-input",
  ].join(""));

  function exportRuleText(rule) {
    if (rule.cssRules && /^@(media|supports|layer)/i.test(rule.cssText)) {
      const inner = [...rule.cssRules].map(exportRuleText).filter(Boolean).join("\n");
      if (!inner) return "";
      return `${rule.cssText.slice(0, rule.cssText.indexOf("{") + 1)}\n${inner}\n}`;
    }
    if (typeof rule.selectorText !== "string") return rule.cssText; // @font-face, @keyframes
    const selectors = rule.selectorText.split(",").map(part => part.trim())
      .filter(part => part && !EXPORT_CHROME_SELECTOR.test(part));
    if (!selectors.length) return "";
    return `${selectors.join(", ")} { ${rule.style.cssText} }`;
  }

  function collectExportCss() {
    return [...document.styleSheets].map(sheet => {
      try {
        return [...sheet.cssRules].map(exportRuleText).filter(Boolean).join("\n");
      } catch {
        // Cross-origin font stylesheets cannot be inspected. Their <link>
        // elements are preserved separately below.
        return "";
      }
    }).filter(Boolean).join("\n");
  }

  function downloadHtml() {
    const title = deckTitle(state.md) || "slides";
    const styleText = [collectExportCss(), collectExportPresetCss()].filter(Boolean).join("\n");
    const fontLinks = [...document.querySelectorAll('link[rel="stylesheet"]')]
      .filter(link => /^https:\/\/fonts\.googleapis\.com\//.test(link.href))
      .map(link => `<link rel="stylesheet" href="${escapeHtml(link.href)}">`).join("\n");
    const hasTitle = state.deckModel.slides[0]?.type === "title";
    const slides = state.slides.map((slideHtml, index) => {
      const isTitle = index === 0 && hasTitle;
      const image = state.images[index];
      const eyebrow = isTitle
        ? ""
        : [`${index + 1} / ${state.slides.length}`, title].filter(Boolean).join(" · ");
      const content = image
        ? `<div class="slide-layout"><div class="slide-copy">${slideHtml}</div><img class="slide-generated-image" src="${escapeHtml(image)}" alt="${escapeHtml(t("imageAlt"))}"></div>`
        : slideHtml;
      const eyebrowHtml = eyebrow ? `<div class="slide-eyebrow">${escapeHtml(eyebrow)}</div>` : "";
      return `<section class="slide${isTitle ? " slide--title" : ""}${image ? " slide--illustrated" : ""}${index ? " hidden" : ""}" data-export-slide>
        ${eyebrowHtml}${content}</section>`;
    }).join("\n");
    const logo = BRAND.logo
      ? `<img class="slide-logo" src="${escapeHtml(BRAND.logo)}" alt="" aria-hidden="true">`
      : "";
    const html = `<!DOCTYPE html>
<html lang="${escapeHtml(uiLang)}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
${fontLinks}
<style>${styleText}
.export-nav { display: flex; align-items: center; gap: 8px; }
.export-nav button { border: 1px solid var(--line-2, currentColor); border-radius: 999px; padding: 4px 14px; background: transparent; color: inherit; font: inherit; cursor: pointer; }
</style>
</head>
<body class="presenting">
<main id="app">
  <section id="view-present">
    <div class="present-bar" id="presentBar" aria-hidden="true"></div>
    ${logo}
    <div class="stage">${slides}</div>
    <div class="present-footer">
      <div class="export-nav">
        <button id="prevBtn" type="button" aria-label="${uiLang === "pl" ? "Poprzedni slajd" : "Previous slide"}">←</button>
        <button id="nextBtn" type="button" aria-label="${uiLang === "pl" ? "Następny slajd" : "Next slide"}">→</button>
      </div>
      <div class="present-counter" id="presentCounter"></div>
    </div>
  </section>
</main>
<script>
(() => {
  const slides = [...document.querySelectorAll("[data-export-slide]")];
  const bar = document.getElementById("presentBar");
  const counter = document.getElementById("presentCounter");
  let current = 0;
  function show(index) {
    current = Math.max(0, Math.min(index, slides.length - 1));
    slides.forEach((slide, i) => slide.classList.toggle("hidden", i !== current));
    bar.style.width = slides.length ? ((current + 1) / slides.length * 100) + "%" : "0%";
    counter.textContent = slides.length ? (current + 1) + " / " + slides.length : "";
  }
  document.getElementById("prevBtn").addEventListener("click", () => show(current - 1));
  document.getElementById("nextBtn").addEventListener("click", () => show(current + 1));
  document.addEventListener("keydown", event => {
    if (["ArrowRight", " ", "PageDown"].includes(event.key)) { event.preventDefault(); show(current + 1); }
    else if (["ArrowLeft", "PageUp"].includes(event.key)) { event.preventDefault(); show(current - 1); }
    else if (event.key === "Home") { event.preventDefault(); show(0); }
    else if (event.key === "End") { event.preventDefault(); show(slides.length - 1); }
  });
  show(0);
})();
<\/script>
</body>
</html>`;
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = title + ".html";
    a.click();
    URL.revokeObjectURL(a.href);
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
  downloadBtn.addEventListener("click", downloadHtml);
  pptxBtn.addEventListener("click", downloadPptx);
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
  renderPresets();
  {
    const savedPreset = BRAND.presets.findIndex(p => p.id === readStored(BRAND.presetKey));
    applyPreset(savedPreset >= 0 ? savedPreset : 0);
  }
  document.querySelectorAll(".side-fold-toggle").forEach(toggle => {
    const body = document.getElementById(toggle.dataset.fold);
    toggle.addEventListener("click", () => {
      const open = body.classList.toggle("hidden") === false;
      toggle.setAttribute("aria-expanded", String(open));
      if (open && toggle.dataset.fold === "styleFold") preloadPickerFonts();
    });
  });
  renderFonts();
  // A stored value can be anything; applyFont rejects it. With no stored
  // choice the tokens stay unset so each brand keeps the typography its own
  // stylesheet defines.
  if (!applyFont(readStored(FONT_KEY), { store: false })) markFont(DEFAULT_FONT);
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
    setDeck(BRAND.exampleMd[uiLang] ?? BRAND.exampleMd.pl, { example: true });
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
