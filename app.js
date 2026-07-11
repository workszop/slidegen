/* ============================================================
   eduapp — shared logic (brand-agnostic)

   Requires shared.js (helpers, constants, Gemini + PPTX services)
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
- Treść slajdów pisze **Gemini**, w formacie markdown
- Slajdy renderuje przeglądarka - bez serwera i instalacji
- Ten pokaz to tryb demo: wszystko działa bez klucza API
---
## Krok 1: klucz API
- Wygeneruj darmowy klucz na aistudio.google.com/apikey
- Wklej go w ustawieniach na ekranie startowym

> Klucz zostaje w Twojej przeglądarce (localStorage) i jest wysyłany wyłącznie do Google - na żaden inny serwer.
---
## Krok 2: dokument
- Upuść plik \`.txt\`, \`.md\` lub \`.pdf\` (do 19 MB) albo wklej tekst
- PDF trafia do Gemini w całości - z tabelami i układem stron
- Wybierz język slajdów (PL/EN) i orientacyjną liczbę slajdów
- Plik .md z gotowymi slajdami? Przycisk **Prezentuj bez Gemini**
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
      eyebrow: BRAND.eyebrow.pl,
      lead: "Wrzuć tekst, markdown lub PDF - Gemini ułoży z niego slajdy, a przeglądarka wyrenderuje prezentację. Bez instalacji, bez serwera.",
      hintNext: "dalej", hintPrev: "wstecz", hintEsc: "edycja",
      dropHere: "Upuść plik tutaj",
      dropTypes: ".txt · .md · .pdf (do 19 MB)",
      browse: "Wybierz plik",
      orPaste: "…albo wklej tekst",
      aiModelLabel: "Model AI",
      slideLangLabel: "Język slajdów",
      countLabel: "Liczba slajdów",
      countAuto: "auto",
      generate: "Generuj slajdy",
      presentDirect: "Prezentuj bez Gemini",
      hintGenerate: "generuj (gdy plik wczytany)",
      fileLoaded: "wczytano",
      detected: "wykryto",
      errFileType: "Obsługiwane formaty: .txt, .md, .pdf",
      errTooBig: "Plik jest za duży (limit 19 MB). Skróć dokument lub podziel go na części.",
      errNoKeyTitle: "Brak klucza API",
      errNoKeyBody: "Wklej klucz API dostawcy {provider} w ustawieniach modelu (kliknij wskaźnik modelu). Wygenerujesz go na {url}.",
      errApiTitle: "Błąd API Gemini",
      errEmpty: "Model zwrócił pustą odpowiedź. Spróbuj ponownie lub zmień model.",
      genSending: "Wysyłam dokument…",
      genWaiting: "Generuję slajdy…",
      back: "← Wróć",
      regenerate: "Generuj ponownie",
      downloadMd: "Pobierz .md",
      downloadPptx: "Pobierz .pptx",
      errPptxTitle: "Eksport PPTX nie powiódł się",
      present: "Prezentuj",
      editorLabel: "Markdown slajdów",
      previewLabel: "Podgląd slajdów",
      hintPresent: "prezentuj",
      helpTitle: "Format slajdów (markdown)",
      helpIntro: "Gemini generuje slajdy w tym formacie - możesz też napisać własny plik .md i wrzucić go bez klucza API:",
      helpOutro: "Pierwszy slajd (z #) staje się slajdem tytułowym. Kolejne slajdy oddzielaj linią zawierającą wyłącznie trzy myślniki.",
      presentEyebrowWord: "prezentacja",
    },
    en: {
      appTitle: "Document → slides",
      eyebrow: BRAND.eyebrow.en,
      lead: "Drop in text, markdown, or a PDF — Gemini turns it into slides and your browser renders the deck. No install, no server.",
      hintNext: "next", hintPrev: "back", hintEsc: "edit",
      dropHere: "Drop a file here",
      dropTypes: ".txt · .md · .pdf (up to 19 MB)",
      browse: "Choose file",
      orPaste: "…or paste text",
      aiModelLabel: "AI model",
      slideLangLabel: "Slide language",
      countLabel: "Slide count",
      countAuto: "auto",
      generate: "Generate slides",
      presentDirect: "Present without Gemini",
      hintGenerate: "generate (when a file is loaded)",
      fileLoaded: "loaded",
      detected: "detected",
      errFileType: "Supported formats: .txt, .md, .pdf",
      errTooBig: "File too large (19 MB limit). Trim the document or split it.",
      errNoKeyTitle: "Missing API key",
      errNoKeyBody: "Paste your {provider} API key in the model settings (click the model chip). Generate one at {url}.",
      errApiTitle: "Gemini API error",
      errEmpty: "The model returned an empty response. Try again or switch models.",
      genSending: "Sending the document…",
      genWaiting: "Generating slides…",
      back: "← Back",
      regenerate: "Regenerate",
      downloadMd: "Download .md",
      downloadPptx: "Download .pptx",
      errPptxTitle: "PPTX export failed",
      present: "Present",
      editorLabel: "Slide markdown",
      previewLabel: "Slide preview",
      hintPresent: "present",
      helpTitle: "Slide format (markdown)",
      helpIntro: "Gemini generates slides in this format — you can also write your own .md file and load it with no API key:",
      helpOutro: "The first slide (with #) becomes the title slide. Separate further slides with a line containing only three dashes.",
      presentEyebrowWord: "presentation",
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
  <div class="gen-status hidden" id="genStatus" role="status">
    <div class="gen-bar" aria-hidden="true"><div></div></div>
    <span id="genStatusText"></span>
  </div>
  <div class="error-panel hidden" id="errorPanel" role="status">
    <strong id="errorTitle"></strong>
    <span id="errorDetail"></span>
    <button class="btn btn-ghost" id="errorDismiss">OK</button>
  </div>

  <section id="view-input">
    <div class="page-head">
      <div class="eyebrow" data-i18n="eyebrow"></div>
      <h1 data-i18n="appTitle"></h1>
      <p class="lead" data-i18n="lead"></p>
    </div>

    <div class="input-grid">
      <div class="card dropzone" id="dropzone" role="button" tabindex="0">
        <div class="dz-icon" aria-hidden="true">⇣</div>
        <p class="dz-label" data-i18n="dropHere"></p>
        <p class="dz-sub" data-i18n="dropTypes"></p>
        <input type="file" id="fileInput" class="visually-hidden" accept=".txt,.md,.markdown,.pdf" />
        <div class="file-chip hidden" id="fileChip"></div>
        <div class="dz-actions">
          <button class="btn btn-ghost" id="browseBtn" data-i18n="browse"></button>
        </div>
      </div>

      <div class="card">
        <label class="field-label" for="pasteArea" data-i18n="orPaste"></label>
        <textarea id="pasteArea" rows="7" spellcheck="false"></textarea>
      </div>
    </div>

    <div class="card settings" id="settingsCard">
      <div class="field">
        <span class="field-label" data-i18n="aiModelLabel"></span>
        <button id="aiChip"></button>
      </div>
      <div class="settings-row">
        <div class="field">
          <span class="field-label" id="slideLangLabel" data-i18n="slideLangLabel"></span>
          <div class="lang-toggle" role="group" aria-labelledby="slideLangLabel">
            <button id="slideLangPl" aria-pressed="true">PL</button>
            <button id="slideLangEn" aria-pressed="false">EN</button>
          </div>
        </div>
        <div class="field">
          <label class="field-label" for="countHint" data-i18n="countLabel"></label>
          <select id="countHint" class="mono-input">
            <option value="auto" data-i18n="countAuto"></option>
            <option value="10">~10</option>
            <option value="20">~20</option>
          </select>
        </div>
      </div>
    </div>

    <div class="input-actions">
      <button class="btn btn-primary" id="generateBtn" disabled data-i18n="generate"></button>
      <button class="btn btn-ghost hidden" id="presentDirectBtn" data-i18n="presentDirect"></button>
    </div>

    <div class="hints">
      <span><kbd>Enter</kbd> <span data-i18n="hintGenerate"></span></span>
    </div>

    <details class="help">
      <summary data-i18n="helpTitle"></summary>
      <p data-i18n="helpIntro"></p>
      <pre><code># Tytuł prezentacji / Deck title
Jedno zdanie wstępu / one intro line
---
## Nagłówek slajdu / Slide heading
- punkty, **pogrubienia**, \`kod\`, tabele, &gt; cytaty
---
## Kolejny slajd / Next slide…</code></pre>
      <p data-i18n="helpOutro"></p>
    </details>
  </section>

  <section id="view-edit" class="hidden">
    <div class="edit-toolbar">
      <button class="btn btn-ghost" id="backBtn" data-i18n="back"></button>
      <div class="spacer"></div>
      <button class="btn btn-ghost" id="regenBtn" data-i18n="regenerate"></button>
      <button class="btn btn-ghost" id="downloadBtn" data-i18n="downloadMd"></button>
      <button class="btn btn-ghost" id="pptxBtn" data-i18n="downloadPptx"></button>
      <button class="btn btn-primary" id="presentBtn" data-i18n="present"></button>
    </div>
    <div class="edit-grid">
      <div class="field">
        <label class="field-label" for="editor" data-i18n="editorLabel"></label>
        <textarea id="editor" spellcheck="false"></textarea>
      </div>
      <div class="field">
        <span class="field-label" data-i18n="previewLabel"></span>
        <div id="preview"></div>
      </div>
    </div>
    <div class="hints">
      <span><kbd>Ctrl</kbd>+<kbd>Enter</kbd> <span data-i18n="hintPresent"></span></span>
    </div>
  </section>

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
    view: "input",          // input | edit | present
    source: null,           // {name, kind, text?|base64?, multi?} — see readSourceFile
    md: "",
    slides: [],
    current: 0,
    generating: false,
    slideLang: "pl",
  };
  function setView(v) { state.view = v; render(); }

  // Single entry point for markdown changes — keeps slides in sync.
  function setMd(md, current = 0) {
    state.md = md;
    state.current = current;
    renderSlides();
  }

  // ─── DOM refs ───────────────────────────────────
  const viewEls = {
    input: document.getElementById("view-input"),
    edit: document.getElementById("view-edit"),
    present: document.getElementById("view-present"),
  };
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
  const presentDirectBtn = document.getElementById("presentDirectBtn");
  const genStatusEl = document.getElementById("genStatus");
  const genStatusTextEl = document.getElementById("genStatusText");
  const errorPanelEl = document.getElementById("errorPanel");
  const errorTitleEl = document.getElementById("errorTitle");
  const errorDetailEl = document.getElementById("errorDetail");
  const errorDismissBtn = document.getElementById("errorDismiss");
  const editorEl = document.getElementById("editor");
  const previewEl = document.getElementById("preview");
  const backBtn = document.getElementById("backBtn");
  const pptxBtn = document.getElementById("pptxBtn");
  const regenBtn = document.getElementById("regenBtn");
  const downloadBtn = document.getElementById("downloadBtn");
  const presentBtn = document.getElementById("presentBtn");

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
    if (state.view === "input") renderInput();
  }

  function render() {
    for (const [name, el] of Object.entries(viewEls)) {
      el.classList.toggle("hidden", state.view !== name);
    }
    document.body.classList.toggle("presenting", state.view === "present");
    renderTexts();
    if (state.view === "edit") renderEdit();
    if (state.view === "present") renderPresent();
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

  function renderEdit() {
    if (editorEl.value !== state.md) editorEl.value = state.md;
    regenBtn.classList.toggle("hidden", !state.source);
    renderPreview();
  }

  // Preview cards are reused between renders; only cards whose HTML actually
  // changed are rewritten (matters during streaming and while typing).
  function renderPreview() {
    state.slides.forEach((html, i) => {
      let card = previewEl.children[i];
      if (!card) {
        card = document.createElement("div");
        card.className = "mini";
        card.addEventListener("click", () => { state.current = Number(card.dataset.index); setView("present"); });
        previewEl.appendChild(card);
      }
      card.dataset.index = i;
      const inner = `<div class="mini-eyebrow">${i + 1}</div>` + html;
      if (card._html !== inner) {
        card.innerHTML = inner;
        card._html = inner;
      }
    });
    while (previewEl.children.length > state.slides.length) previewEl.lastChild.remove();
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

  function renderInput() {
    const src = state.source;
    fileChipEl.classList.toggle("hidden", !src);
    if (src) {
      const langInfo = src.kind === "text" ? ` · ${t("detected")}: ${state.slideLang.toUpperCase()}` : "";
      fileChipEl.textContent = `✓ ${t("fileLoaded")}: ${src.name}${langInfo}`;
    }
    generateBtn.disabled = !src;
    presentDirectBtn.classList.toggle("hidden", !src?.multi);
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
      source.multi = splitSlides(source.text).length > 1; // computed once, read by renderInput
    }
    errorPanelEl.classList.add("hidden");
    render();
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
            setMd("");
            setView("edit");
          }
          const now = Date.now();
          if (now - lastRender > 400) {
            lastRender = now;
            editorEl.value = text;
            editorEl.scrollTop = editorEl.scrollHeight;
            state.md = text;
            renderSlides();
            renderPreview();
          }
        },
      });
      if (!acc.trim()) throw new Error(t("errEmpty"));
      setMd(stripOuterFence(acc.trim()));
      setView("edit");
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
  dropzoneEl.addEventListener("click", e => { if (e.target === dropzoneEl || e.target.closest(".dz-icon,.dz-label,.dz-sub")) fileInputEl.click(); });
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

  slideLangPlBtn.addEventListener("click", () => { state.slideLang = "pl"; renderInput(); });
  slideLangEnBtn.addEventListener("click", () => { state.slideLang = "en"; renderInput(); });
  errorDismissBtn.addEventListener("click", () => errorPanelEl.classList.add("hidden"));

  presentDirectBtn.addEventListener("click", () => {
    setMd(state.source.text);
    setView("present");
  });
  generateBtn.addEventListener("click", () => generateSlides());

  // edit view
  let previewTimer;
  editorEl.addEventListener("input", () => {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(() => {
      setMd(editorEl.value, state.current);
      renderPreview();
    }, 300);
  });
  editorEl.addEventListener("keydown", e => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      setMd(editorEl.value, state.current);
      setView("present");
    }
  });
  backBtn.addEventListener("click", () => setView("input"));
  regenBtn.addEventListener("click", () => generateSlides());
  downloadBtn.addEventListener("click", downloadMd);
  pptxBtn.addEventListener("click", downloadPptx);
  presentBtn.addEventListener("click", () => { setMd(editorEl.value, state.current); setView("present"); });

  document.addEventListener("keydown", e => {
    if (state.view === "input" && e.key === "Enter" && state.source && !state.generating
        && !/^(TEXTAREA|SELECT|BUTTON|A)$/.test(e.target.tagName)) {
      e.preventDefault(); generateSlides(); return;
    }
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (state.view === "present") {
      if (["ArrowRight", " ", "PageDown"].includes(e.key)) { e.preventDefault(); showSlide(state.current + 1); }
      else if (["ArrowLeft", "PageUp"].includes(e.key)) { e.preventDefault(); showSlide(state.current - 1); }
      else if (e.key === "Home") { e.preventDefault(); showSlide(0); }
      else if (e.key === "End") { e.preventDefault(); showSlide(state.slides.length - 1); }
      else if (e.key === "Escape") setView("edit");
      else if (/^[1-9]$/.test(e.key)) showSlide(Number(e.key) - 1);
    }
  });

  // ─── Init ───────────────────────────────────────
  document.querySelectorAll(".brand-logo").forEach(el => { el.src = BRAND.logo; });
  if (BRAND.wordmark) document.querySelector(".wordmark").textContent = BRAND.wordmark;
  document.querySelector(".chrome .tag").textContent = BRAND.tag;
  const aiSelector = mountAiSelector({ chip: aiChipEl, getLang: () => uiLang });
  {
    const params = new URLSearchParams(location.search);
    if (["pl", "en"].includes(params.get("lang"))) { uiLang = params.get("lang"); localStorage.setItem(LS_LANG, uiLang); }
    if (params.has("demo")) { state.md = SAMPLE_MD; renderSlides(); }
    if (params.has("slide")) state.current = Math.max(0, Number(params.get("slide")) - 1);
    if (location.hash === "#present" && state.slides.length) state.view = "present";
    else if (location.hash === "#edit" && state.md) state.view = "edit";
  }
  document.documentElement.lang = uiLang; // after ?lang so the param wins
  document.title = t("appTitle");
  render();
})();
