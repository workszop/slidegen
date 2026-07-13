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
          presentBrand: "edulab",                   // brand name on the title-slide eyebrow
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
    exampleMd: { pl: "", en: "" },
    experimentalImages: false,
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
      countAuto: "auto",
      generate: "Generuj slajdy",
      fileLoaded: "wgrano",
      detected: "wykryto",
      errFileType: "Obsługiwane formaty: .txt, .md, .pdf",
      errTooBig: "Plik jest za duży (limit 19 MB). Skróć dokument lub podziel go na części.",
      errNoKeyTitle: "Brak klucza API",
      errNoKeyBody: "Wklej klucz API dostawcy {provider} w ustawieniach modelu (kliknij wskaźnik modelu). Wygenerujesz go na {url}.",
      errApiTitle: "Błąd API",
      errEmpty: "Model zwrócił pustą odpowiedź. Spróbuj ponownie lub zmień model.",
      genSending: "Wysyłam dokument…",
      genWaiting: "Generuję slajdy…",
      downloadHtml: "Pobierz html",
      downloadPptx: "Pobierz .pptx",
      errPptxTitle: "Eksport PPTX nie powiódł się",
      present: "Prezentuj",
      presentEyebrowWord: "prezentacja",
      sideDoc: "Dokument",
      sideGen: "Generowanie",
      sideStyle: "Styl",
      sideActions: "Akcje",
      edit: "Edytuj",
      additionalPrompt: "Dodatkowe instrukcje dla AI",
      additionalPromptPh: "np. użyj konkretnych przykładów i krótkich nagłówków",
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
      errNetwork: "Nie udało się połączyć z {host}. Sprawdź połączenie, blokowanie przez rozszerzenia lub zaporę sieciową i spróbuj ponownie.",
    },
    en: {
      appTitle: "doc2slide",
      hintNext: "next", hintPrev: "back", hintEsc: "edit",
      dropHere: "Upload a file",
      browse: "Choose file",
      pasteHere: "…or paste text here",
      countAuto: "auto",
      generate: "Generate slides",
      fileLoaded: "loaded",
      detected: "detected",
      errFileType: "Supported formats: .txt, .md, .pdf",
      errTooBig: "File too large (19 MB limit). Trim the document or split it.",
      errNoKeyTitle: "Missing API key",
      errNoKeyBody: "Paste your {provider} API key in the model settings (click the model chip). Generate one at {url}.",
      errApiTitle: "API error",
      errEmpty: "The model returned an empty response. Try again or switch models.",
      genSending: "Sending the document…",
      genWaiting: "Generating slides…",
      downloadHtml: "Download HTML",
      downloadPptx: "Download .pptx",
      errPptxTitle: "PPTX export failed",
      present: "Present",
      presentEyebrowWord: "presentation",
      sideDoc: "Document",
      sideGen: "Generate",
      sideStyle: "Style",
      sideActions: "Actions",
      edit: "Edit",
      additionalPrompt: "Additional AI instructions",
      additionalPromptPh: "e.g. use concrete examples and short headings",
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
      errNetwork: "Could not connect to {host}. Check your connection, browser extensions, or network firewall and try again.",
    },
  };
  let uiLang = localStorage.getItem(LS_LANG) ?? "pl";
  function t(key) { return T[uiLang][key] ?? key; }
  function browserTitle() {
    if (typeof BRAND.title === "string") return BRAND.title;
    return BRAND.title?.[uiLang] ?? BRAND.title?.pl ?? t("appTitle");
  }
  function setUiLang(lang) {
    uiLang = lang;
    localStorage.setItem(LS_LANG, lang);
    document.documentElement.lang = lang;
    document.title = browserTitle();
    renderTexts();
    if (state.deckIsExample) setDeck(BRAND.exampleMd[lang] ?? BRAND.exampleMd.pl, { example: true });
    aiSelector.refresh();
  }

  // ─── Markup (shared structure; brand styles it via CSS) ──
  const wordmarkHtml = BRAND.wordmark ? `<div class="wordmark"></div>` : "";
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
  const illustrateControlsHtml = BRAND.experimentalImages ? `
        <button class="btn btn-ghost btn-sm hidden" id="illustrateBtn">✦ <span id="illustrateBtnLabel"></span></button>
        <button class="btn btn-ghost btn-sm hidden" id="removeIllustrationBtn" data-i18n="removeIllustration"></button>` : "";
  document.body.insertAdjacentHTML("afterbegin", `
<header class="chrome">
  <img class="chrome-mark brand-logo" alt="" aria-hidden="true">
  ${wordmarkHtml}
  <div class="tag"></div>
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
          <div class="lang-toggle" role="group" aria-label="PL/EN/Auto">
            <button id="slideLangPl" aria-pressed="false">PL</button>
            <button id="slideLangEn" aria-pressed="false">EN</button>
            <button id="slideLangAuto" aria-pressed="true">Auto</button>
          </div>
          <select id="countHint" class="mono-input">
            <option value="auto" data-i18n="countAuto"></option>
            <option value="10">~10</option>
            <option value="20">~20</option>
          </select>
        </div>
        ${experimentalControlsHtml}
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
    images: [],
    current: 0,
    generating: false,
    slideLang: "auto",
    illustrating: null,     // index of the slide currently being illustrated, or null
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
  const countHintEl = document.getElementById("countHint");
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
  const additionalPromptEl = document.getElementById("additionalPrompt");
  const imageModelEl = document.getElementById("imageModel");
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

  // ─── Helpers (DOM-adjacent) ─────────────────────
  // Parsed slide HTML is memoized per segment string: during streaming and
  // editing only the changed segment pays the marked+DOMPurify cost.
  const slideHtmlCache = new Map();
  function renderSlides() {
    if (slideHtmlCache.size > 500) slideHtmlCache.clear();
    const previousSegments = state.slideSegments;
    const previousImages = state.images;
    state.slideSegments = splitSlides(stripOuterFence(state.md));
    state.slides = state.slideSegments.map(seg => {
      let html = slideHtmlCache.get(seg);
      if (html === undefined) {
        html = DOMPurify.sanitize(marked.parse(seg));
        slideHtmlCache.set(seg, html);
      }
      return html;
    });
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
    const isTitle = state.current === 0 && isTitleSlide(state.md);
    const image = state.images[state.current];
    wsStageEl.className = "slide" + (isTitle ? " slide--title" : "") + (image ? " slide--illustrated" : "");
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

  function renderPresent() {
    const n = state.slides.length;
    if (!n) return;
    const i = state.current;
    const isTitle = i === 0 && isTitleSlide(state.md);
    const title = deckTitle(state.md);
    const eyebrow = isTitle
      ? [BRAND.presentBrand, t("presentEyebrowWord")].filter(Boolean).join(" · ")
      : [`${i + 1} / ${n}`, title].filter(Boolean).join(" · ");
    const image = state.images[i];
    stageEl.className = "slide" + (isTitle ? " slide--title" : "") + (image ? " slide--illustrated" : "");
    stageEl.innerHTML = `<div class="slide-eyebrow"></div>` + (image
      ? `<div class="slide-layout"><div class="slide-copy">${state.slides[i]}</div><img class="slide-generated-image" alt=""></div>`
      : state.slides[i]);
    stageEl.querySelector(".slide-eyebrow").textContent = eyebrow;
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
  // The exporter needs the deck's effective look; read it from computed
  // styles via a probe so any brand CSS works without extra config.
  function readDeckTheme() {
    const probe = document.createElement("div");
    probe.className = "slide";
    probe.innerHTML = "<h2>x</h2><p>y</p><code>z</code>";
    viewEls.present.appendChild(probe);
    const cs = el => getComputedStyle(el);
    const theme = {
      bg: cs(viewEls.present).backgroundColor,
      fg: cs(probe.querySelector("h2")).color,
      bodyColor: cs(probe.querySelector("p")).color,
      accent: cs(presentBarEl).backgroundColor,
      headingFont: firstFont(cs(probe.querySelector("h2")).fontFamily),
      bodyFont: firstFont(cs(probe.querySelector("p")).fontFamily),
      monoFont: firstFont(cs(probe.querySelector("code")).fontFamily),
    };
    probe.remove();
    return theme;
  }

  async function downloadPptx() {
    try {
      pptxBtn.disabled = true;
      await ensurePptxDeps();
      await exportDeckToPptx({
        slidesMd: splitSlides(stripOuterFence(state.md)),
        images: state.images,
        theme: readDeckTheme(),
        logo: BRAND.logo || null,
        brandName: BRAND.presentBrand,
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

  function downloadHtml() {
    const title = deckTitle(state.md) || "slides";
    const styleText = [...document.querySelectorAll("style")].map(style => style.textContent).join("\n");
    const fontLinks = [...document.querySelectorAll('link[rel="stylesheet"]')]
      .map(link => `<link rel="stylesheet" href="${escapeHtml(link.href)}">`).join("\n");
    const hasTitle = isTitleSlide(state.md);
    const slides = state.slides.map((slideHtml, index) => {
      const isTitle = index === 0 && hasTitle;
      const image = state.images[index];
      const eyebrow = isTitle
        ? [BRAND.presentBrand, t("presentEyebrowWord")].filter(Boolean).join(" · ")
        : [`${index + 1} / ${state.slides.length}`, title].filter(Boolean).join(" · ");
      const content = image
        ? `<div class="slide-layout"><div class="slide-copy">${slideHtml}</div><img class="slide-generated-image" src="${escapeHtml(image)}" alt="${escapeHtml(t("imageAlt"))}"></div>`
        : slideHtml;
      return `<section class="slide${isTitle ? " slide--title" : ""}${image ? " slide--illustrated" : ""}${index ? " hidden" : ""}" data-export-slide>
        <div class="slide-eyebrow">${escapeHtml(eyebrow)}</div>${content}</section>`;
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
    generateBtn.disabled = !src;
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
    if (state.illustrating != null || state.generating) return;
    if (index < 0 || index >= state.slideSegments.length) return;
    if (index === 0 && isTitleSlide(state.slideSegments[index])) return;
    const openaiKey = loadAiSettings().keys.openai?.trim();
    if (!openaiKey) return showError(t("errNoKeyTitle"), t("errNoOpenAIKey"));

    const previousImage = state.images[index];
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
      state.images[index] = previousImage;
      if (state.view === "present") renderPresent();
      else renderStage();
      showError(t("errImageTitle"), apiErrorDetail(err));
    } finally {
      state.illustrating = null;
      genStatusEl.classList.add("hidden");
      renderIllustrateControls();
    }
  }

  // Streaming: markdown flows into the editor and preview as it arrives
  // (transport lives in shared.js; this function is only the UI reaction).
  async function generateSlides() {
    const ai = loadAiSettings();
    const key = ai.keys[ai.provider]?.trim();
    if (!key) {
      const info = PROVIDER_INFO[ai.provider];
      return showError(t("errNoKeyTitle"),
        t("errNoKeyBody").replace("{provider}", info.label).replace("{url}", info.keyUrl.replace("https://", "")));
    }
    if (!state.source || state.generating || state.illustrating != null) return;

    state.generating = true;
    errorPanelEl.classList.add("hidden");
    genStatusEl.classList.remove("hidden");
    genStatusTextEl.textContent = t("genSending");
    generateBtn.disabled = true;
    state.images = [];
    let started = false, lastRender = 0;
    try {
      const acc = await streamSlides({
        provider: ai.provider,
        model: ai.model,
        key,
        source: state.source,
        prompt: buildPrompt({
          lang: state.slideLang,
          countHint: countHintEl.value,
          additionalPrompt: additionalPromptEl?.value ?? "",
        }),
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
    } catch (err) {
      showError(t("errApiTitle"), apiErrorDetail(err));
    } finally {
      state.generating = false;
      genStatusEl.classList.add("hidden");
      generateBtn.disabled = !state.source;
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
  document.querySelector(".chrome .tag").textContent = BRAND.tag;
  const aiSelector = mountAiSelector({ chip: aiChipEl, getLang: () => uiLang });
  if (imageModelEl) {
    OPENAI_IMAGE_MODELS.forEach(model => {
      const option = document.createElement("option");
      option.value = model;
      option.textContent = model;
      imageModelEl.appendChild(option);
    });
  }
  renderPresets();
  {
    const savedPreset = BRAND.presets.findIndex(p => p.id === localStorage.getItem(BRAND.presetKey));
    applyPreset(savedPreset >= 0 ? savedPreset : 0);
  }
  {
    const params = new URLSearchParams(location.search);
    if (["pl", "en"].includes(params.get("lang"))) { uiLang = params.get("lang"); localStorage.setItem(LS_LANG, uiLang); }
    setDeck(BRAND.exampleMd[uiLang] ?? BRAND.exampleMd.pl, { example: true });
    if (params.has("slide")) setMd(state.md, Math.max(0, Number(params.get("slide")) - 1));
    if (location.hash === "#present" && state.slides.length) state.view = "present";
  }
  document.documentElement.lang = uiLang; // after ?lang so the param wins
  document.title = browserTitle();
  render();
})();
