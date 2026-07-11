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
          tag:          "doc→slides",               // mono chip in the chrome bar
          eyebrow:      { pl: "…", en: "…" },       // input-view page eyebrow
          presentBrand: "edulab",                   // brand name on the title-slide eyebrow
        }
   ============================================================ */

(function () {
  "use strict";

  // ─── Brand config ───────────────────────────────
  const BRAND = Object.assign({
    logo: "",
    wordmark: null,
    tag: "doc→slides",
    eyebrow: { pl: "narzędzie edukacyjne", en: "learning tool" },
    presentBrand: "",
  }, window.APP_BRAND);

  // ─── Constants (LS_* etc. come from shared.js) ───
  const SAMPLE_MD = `# Dokument → slajdy
Jak działa ta aplikacja - przewodnik w ośmiu slajdach.
---
## Co robi ta aplikacja?
- Zamienia dokument (.txt, .md, .pdf) w prezentację HTML
- Treść slajdów pisze **AI**, w formacie markdown
- Slajdy renderuje przeglądarka - bez serwera i instalacji
- Ten pokaz to tryb demo: wszystko działa bez klucza API
---
## Krok 1: klucz API
- Wygeneruj darmowy klucz API u wybranego dostawcy (Gemini, OpenAI lub Claude)
- Wklej go w ustawieniach na ekranie startowym

> Klucz zostaje w Twojej przeglądarce (localStorage) i jest wysyłany wyłącznie do wybranego dostawcy AI - na żaden inny serwer.
---
## Krok 2: dokument
- Upuść plik \`.txt\`, \`.md\` lub \`.pdf\` (do 19 MB) albo wklej tekst
- PDF trafia do AI w całości - z tabelami i układem stron
- Wybierz język slajdów (PL/EN) i orientacyjną liczbę slajdów
- Plik .md z gotowymi slajdami? Przycisk **Prezentuj bez AI**
---
## Krok 3: generowanie i edycja
- Slajdy pojawiają się na żywo, w trakcie generowania
- Po lewej edytor markdown, po prawej podgląd slajdów
- Podgląd odświeża się sam podczas pisania
- Klik w miniaturę otwiera prezentację od tego slajdu
---
## Format slajdów (markdown)

\`\`\`markdown
# Tytuł prezentacji
Jedno zdanie wstępu.
---
## Nagłówek slajdu
- punkty, **pogrubienia**, \`kod\`, tabele, > cytaty
\`\`\`
---
## Sterowanie prezentacją
| Klawisz | Działanie |
|---------|-----------|
| → / spacja | następny slajd |
| ← | poprzedni slajd |
| 1-9 | skok do slajdu |
| Esc | powrót do edycji |
---
## Eksport i podsumowanie
- **Pobierz .md** - wczytasz ponownie bez klucza API
- **Pobierz .pptx** - edytowalny PowerPoint w tym samym stylu
- Całość to statyczne pliki: GitHub Pages, e-mail, pendrive
- Miłego prezentowania`;

  // ─── Translations (T + t) ───────────────────────
  const T = {
    pl: {
      appTitle: "Dokument → slajdy",
      hintNext: "dalej", hintPrev: "wstecz", hintEsc: "edycja",
      dropHere: "Upuść plik tutaj",
      browse: "Wybierz plik",
      pasteHere: "…albo wklej tekst tutaj",
      aiModelLabel: "Model AI",
      slideLangLabel: "Język slajdów",
      countLabel: "Liczba slajdów",
      countAuto: "auto",
      generate: "Generuj slajdy",
      fileLoaded: "wczytano",
      detected: "wykryto",
      errFileType: "Obsługiwane formaty: .txt, .md, .pdf",
      errTooBig: "Plik jest za duży (limit 19 MB). Skróć dokument lub podziel go na części.",
      errNoKeyTitle: "Brak klucza API",
      errNoKeyBody: "Wklej klucz API dostawcy {provider} w ustawieniach modelu (kliknij wskaźnik modelu). Wygenerujesz go na {url}.",
      errApiTitle: "Błąd API",
      errEmpty: "Model zwrócił pustą odpowiedź. Spróbuj ponownie lub zmień model.",
      genSending: "Wysyłam dokument…",
      genWaiting: "Generuję slajdy…",
      back: "← Wróć",
      regenerate: "Generuj ponownie",
      downloadMd: "Pobierz .md",
      downloadPptx: "Pobierz .pptx",
      errPptxTitle: "Eksport PPTX nie powiódł się",
      present: "Prezentuj",
      hintPresent: "prezentuj",
      presentEyebrowWord: "prezentacja",
      sideDoc: "Dokument",
      sideGen: "Generowanie",
      sideStyle: "Styl",
      sideActions: "Akcje",
      edit: "Edytuj",
    },
    en: {
      appTitle: "Document → slides",
      hintNext: "next", hintPrev: "back", hintEsc: "edit",
      dropHere: "Drop a file here",
      browse: "Choose file",
      pasteHere: "…or paste text here",
      aiModelLabel: "AI model",
      slideLangLabel: "Slide language",
      countLabel: "Slide count",
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
      back: "← Back",
      regenerate: "Regenerate",
      downloadMd: "Download .md",
      downloadPptx: "Download .pptx",
      errPptxTitle: "PPTX export failed",
      present: "Present",
      hintPresent: "present",
      presentEyebrowWord: "presentation",
      sideDoc: "Document",
      sideGen: "Generate",
      sideStyle: "Style",
      sideActions: "Actions",
      edit: "Edit",
    },
  };
  let uiLang = localStorage.getItem(LS_LANG) ?? "pl";
  function t(key) { return T[uiLang][key] ?? key; }
  function setUiLang(lang) {
    uiLang = lang;
    localStorage.setItem(LS_LANG, lang);
    document.documentElement.lang = lang;
    document.title = t("appTitle");
    renderTexts();
    aiSelector.refresh();
  }

  // ─── Markup (shared structure; brand styles it via CSS) ──
  const wordmarkHtml = BRAND.wordmark ? `<div class="wordmark"></div>` : "";
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

<main id="app" class="shell" aria-live="polite">
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
    current: 0,
    generating: false,
    slideLang: "pl",
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
  const editorPanelEl = document.getElementById("editorPanel");
  const editToggleBtn = document.getElementById("editToggleBtn");

  // ─── Helpers (DOM-adjacent) ─────────────────────
  // Parsed slide HTML is memoized per segment string: during streaming and
  // editing only the changed segment pays the marked+DOMPurify cost.
  const slideHtmlCache = new Map();
  function renderSlides() {
    if (slideHtmlCache.size > 500) slideHtmlCache.clear();
    state.slides = splitSlides(stripOuterFence(state.md)).map(seg => {
      let html = slideHtmlCache.get(seg);
      if (html === undefined) {
        html = DOMPurify.sanitize(marked.parse(seg));
        slideHtmlCache.set(seg, html);
      }
      return html;
    });
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
    if (state.view === "workspace") renderSidebar();
  }

  function render() {
    for (const [name, el] of Object.entries(viewEls)) {
      el.classList.toggle("hidden", state.view !== name);
    }
    document.body.classList.toggle("presenting", state.view === "present");
    renderTexts();
    if (state.view === "present") renderPresent();
  }

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

  function renderPresent() {
    const n = state.slides.length;
    if (!n) return;
    const i = state.current;
    const isTitle = i === 0 && isTitleSlide(state.md);
    const title = deckTitle(state.md);
    const eyebrow = isTitle
      ? [BRAND.presentBrand, t("presentEyebrowWord")].filter(Boolean).join(" · ")
      : [`${i + 1} / ${n}`, title].filter(Boolean).join(" · ");
    stageEl.className = "slide" + (isTitle ? " slide--title" : "");
    stageEl.innerHTML = `<div class="slide-eyebrow"></div>` + state.slides[i];
    stageEl.querySelector(".slide-eyebrow").textContent = eyebrow;
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

  function downloadMd() {
    const blob = new Blob([state.md], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = (deckTitle(state.md) || "slides") + ".md";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function renderSidebar() {
    const src = state.source;
    fileChipEl.classList.toggle("hidden", !src);
    if (src) {
      const langInfo = src.kind === "text" ? ` · ${t("detected")}: ${state.slideLang.toUpperCase()}` : "";
      fileChipEl.textContent = `✓ ${t("fileLoaded")}: ${src.name}${langInfo}`;
    }
    generateBtn.disabled = !src;
    slideLangPlBtn.setAttribute("aria-pressed", String(state.slideLang === "pl"));
    slideLangEnBtn.setAttribute("aria-pressed", String(state.slideLang === "en"));
  }

  function showError(title, detail) {
    errorTitleEl.textContent = title;
    errorDetailEl.textContent = detail;
    errorPanelEl.classList.remove("hidden");
  }

  // ─── File loading ───────────────────────────────
  function setSource(source) {
    state.source = source;
    if (source?.kind === "text") {
      state.slideLang = detectLang(source.text);
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

  // ─── Generation (provider-agnostic) ─────────────
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
    if (!state.source || state.generating) return;

    state.generating = true;
    errorPanelEl.classList.add("hidden");
    genStatusEl.classList.remove("hidden");
    genStatusTextEl.textContent = t("genSending");
    generateBtn.disabled = true;
    let started = false, lastRender = 0;
    try {
      const acc = await streamSlides({
        provider: ai.provider,
        model: ai.model,
        key,
        source: state.source,
        prompt: buildPrompt({ lang: state.slideLang, countHint: countHintEl.value }),
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
      showError(t("errApiTitle"), String(err.message ?? err));
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
  errorDismissBtn.addEventListener("click", () => errorPanelEl.classList.add("hidden"));

  generateBtn.addEventListener("click", () => generateSlides());

  // editor panel
  let previewTimer;
  editorEl.addEventListener("input", () => {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(() => {
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
  downloadBtn.addEventListener("click", downloadMd);
  pptxBtn.addEventListener("click", downloadPptx);
  presentBtn.addEventListener("click", () => setView("present"));
  editToggleBtn.addEventListener("click", () => setEditorOpen(!state.editorOpen));

  // workspace stage nav
  wsPrevBtn.addEventListener("click", () => {
    state.current = Math.max(0, state.current - 1);
    renderStage();
  });
  wsNextBtn.addEventListener("click", () => {
    state.current = Math.min(state.slides.length - 1, state.current + 1);
    renderStage();
  });

  document.addEventListener("keydown", e => {
    if (state.view === "present" && e.key === "Escape") { setView("workspace"); return; }
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
  setDeck(SAMPLE_MD, { example: true });
  {
    const params = new URLSearchParams(location.search);
    if (["pl", "en"].includes(params.get("lang"))) { uiLang = params.get("lang"); localStorage.setItem(LS_LANG, uiLang); }
    if (params.has("slide")) setMd(state.md, Math.max(0, Number(params.get("slide")) - 1));
    if (location.hash === "#present" && state.slides.length) state.view = "present";
  }
  document.documentElement.lang = uiLang; // after ?lang so the param wins
  document.title = t("appTitle");
  render();
})();
