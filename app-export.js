/* ============================================================
   app-export — standalone HTML and PowerPoint export.

   Classic script. Exposes a factory built by app.js inside its IIFE:

     const exporter = createExportController(ctx);
     // ctx: { BRAND, state, t, uiLang(), style, deckTitle, splitSlides,
     //        stripOuterFence, ensurePptxDeps, exportDeckToPptx: () => fn,
     //        showError, downloadBtn, pptxBtn }

   Load order: shared.js → app-style.js → app-export.js → deck-model.js → app.js
   ============================================================ */
(function (root) {
  "use strict";

  // A file:// page can apply sibling stylesheets while still denying both
  // CSSOM and fetch access to them. Keep a compact presentation-only fallback
  // so an export never degrades into an unstyled document in that environment.
  const STANDALONE_FALLBACK_CSS = `
:root {
  --export-muted: color-mix(in srgb, var(--slide-fg) 72%, var(--slide-bg));
  --export-surface: color-mix(in srgb, var(--slide-fg) 8%, var(--slide-bg));
  --export-line: color-mix(in srgb, var(--slide-fg) 22%, var(--slide-bg));
  --export-link: color-mix(in srgb, var(--slide-accent) 62%, var(--slide-fg));
  --export-radius: 14px;
  --export-body-font: var(--slide-body-font, system-ui, sans-serif);
  --export-heading-font: var(--slide-heading-font, system-ui, sans-serif);
  --export-mono-font: ui-monospace, monospace;
  --export-slide-size: clamp(15px, 1.55vw + .9vh, 46px);
  --export-h1-size: 3em;
  --export-h2-size: 2.1em;
  --export-h3-size: 1.35em;
  --export-title-size: 3.6em;
  --export-body-size: 1em;
  --export-caption-size: 13px;
  --export-title-align: center;
}
* { box-sizing: border-box; }
html, body { width: 100%; height: 100%; margin: 0; }
body { overflow: hidden; background: var(--slide-bg); color: var(--slide-fg); }
.hidden { display: none !important; }
#view-present {
  position: fixed; inset: 0; display: flex; flex-direction: column;
  background: var(--slide-bg);
}
.present-bar {
  position: absolute; top: 0; left: 0; width: 0%; height: 4px; z-index: 5;
  background: var(--slide-accent); transition: width 450ms cubic-bezier(.2,.6,.2,1);
}
.slide-logo {
  position: absolute; top: calc(4px + 2.5vh); right: 3vw; z-index: 4;
  width: auto; height: clamp(36px, 4vh + 1.8vw, 88px); opacity: .9;
}
.stage {
  flex: 1; display: grid; place-items: start center;
  padding: 14vh 4vw 3vh; overflow: hidden;
}
.slide {
  width: min(1600px, 90vw); max-height: 88vh; overflow: auto;
  font-family: var(--export-body-font);
  font-size: var(--export-slide-size); color: var(--slide-fg);
}
.slide .slide-eyebrow {
  margin-bottom: .9em; color: var(--slide-accent); font-size: .55em;
  font-weight: 600; letter-spacing: .12em; text-transform: uppercase;
}
.slide h1, .slide h2, .slide h3 {
  font-family: var(--export-heading-font); color: var(--slide-fg);
}
.slide h1 { margin: 0 0 .35em; font-size: var(--export-h1-size); line-height: 1.05; }
.slide h2 { margin: 0 0 .6em; font-size: var(--export-h2-size); line-height: 1.1; }
.slide h3 { margin: 1em 0 .5em; font-size: var(--export-h3-size); }
.slide p, .slide li { color: var(--export-muted); font-size: var(--export-body-size); line-height: 1.55; }
.slide p { margin: 0 0 .6em; }
.slide li { margin-bottom: .45em; }
.slide li::marker { color: var(--slide-accent); }
.slide a { color: var(--export-link); }
.slide strong, .slide em { color: var(--slide-fg); }
.slide code, .slide pre { font-family: var(--export-mono-font); }
.slide code { padding: .1em .4em; border-radius: 6px; background: var(--export-surface); }
.slide pre {
  padding: .8em; overflow-x: auto; border: 1px solid var(--export-line);
  border-radius: var(--export-radius); background: var(--export-surface);
}
.slide pre code { padding: 0; background: none; }
.slide blockquote {
  margin: .9em 0; padding: .6em 1em; color: var(--slide-fg);
  border-left: .18em solid var(--slide-accent); background: var(--export-surface);
}
.slide blockquote p { margin: 0; color: inherit; }
.slide table { width: 100%; border-collapse: collapse; font-size: .92em; }
.slide th, .slide td { padding: .55em .7em; border-bottom: 1px solid var(--export-line); }
.slide th { text-align: left; color: var(--slide-fg); }
.slide td { color: var(--export-muted); }
.slide--title { align-self: center; text-align: var(--export-title-align); }
.slide--title h1 { font-size: var(--export-title-size); }
.slide--title p { color: var(--export-muted); font-size: 1.3em; }
.export-brand--quantica .slide--title h1 { color: var(--slide-accent); }
.slide--illustrated { width: min(1600px, 94vw); }
.slide-layout {
  display: grid; grid-template-columns: minmax(0, 1.08fr) minmax(260px, .92fr);
  gap: 1.4em; align-items: center; padding: 0 1.1em .9em 0;
}
.slide-copy { min-width: 0; }
.slide-generated-image {
  display: block; max-width: 100%; max-height: 52vh; width: auto; height: auto;
  justify-self: center;
  border-radius: var(--export-radius);
  box-shadow: var(--shadow-image, 0 12px 34px rgba(33,30,26,.14));
}
.present-footer {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 24px; color: var(--export-muted);
  font-family: var(--export-mono-font); font-size: var(--export-caption-size);
}
@media (max-width: 768px) {
  .stage { padding: 64px 16px 16px; }
  .slide-layout { grid-template-columns: 1fr; }
  .slide-generated-image { max-height: 34vh; }
}
`;

  function createExportController(ctx) {
    const {
      BRAND, state, t, uiLang, style, deckTitle, splitSlides, stripOuterFence,
      illustratedSlideHtml, ensurePptxDeps, showError, downloadBtn, pptxBtn,
    } = ctx;

    function escapeHtml(value) {
      return String(value).replace(/[&<>"']/g, char => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
      })[char]);
    }

    // ─── PPTX export ──────────────────────────────
    // Keep export colors in canonical hex form. Reading computed CSS is brittle:
    // modern browsers may serialize derived colors as `color(srgb ...)`, and
    // those values are not suitable PowerPoint theme inputs.
    function readDeckTheme() {
      const preset = BRAND.presets[style.activePreset] ?? BRAND.presets[0];
      return {
        bg: preset?.bg ?? "#FFFFFF",
        fg: preset?.fg ?? "#111111",
        accent: preset?.accent ?? "#4472C4",
        headingFont: style.activeFont,
        bodyFont: style.activeFont,
        monoFont: BRAND.pptx.monoFont,
      };
    }

    async function downloadPptx() {
      try {
        if (pptxBtn) pptxBtn.disabled = true;
        await ensurePptxDeps();
        await exportDeckToPptx({
          slidesMd: splitSlides(stripOuterFence(state.md)),
          deck: state.deckModel,
          images: state.images,
          theme: readDeckTheme(),
          logo: await logoDataUrl(),
          // No brandName: the title slide uses the TITLE_PLAIN master so the
          // deck carries no brand eyebrow. Document metadata still gets the
          // brand through `company`.
          company: BRAND.pptx.company || BRAND.presentBrand,
          language: uiLang(),
          fileName: (deckTitle(state.md) || "slides") + ".pptx",
        });
      } catch (err) {
        showError(t("errPptxTitle"), String(err.message ?? err));
      } finally {
        if (pptxBtn) pptxBtn.disabled = false;
      }
    }

    // ─── Standalone HTML export ───────────────────
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
      "|font-grid|font-chip|logo-controls|brand-home",
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

    async function collectExportCss() {
      const styles = await Promise.all([...document.styleSheets].map(async sheet => {
        if (/^https:\/\/fonts\.googleapis\.com\//.test(sheet.href || "")) return "";
        try {
          // A readable sheet is authoritative even when every rule was
          // chrome-filtered; only a sheet exposing no rules needs the fetch.
          const rules = [...sheet.cssRules];
          const css = rules.map(exportRuleText).filter(Boolean).join("\n");
          if (rules.length || !sheet.href) return css;
        } catch { /* fall through to fetching the applied stylesheet */ }
        // Some browsers expose an applied linked stylesheet but deny CSSOM
        // access to its rules. Fetch the same-origin source instead; without
        // this fallback the export contains only fonts and renders as raw
        // HTML. Raw workbench rules are harmless because their elements are
        // absent from a standalone presentation.
        if (!sheet.href) return "";
        try {
          const response = await fetch(sheet.href);
          return response.ok ? await response.text() : "";
        } catch {
          return "";
        }
      }));
      const css = styles.filter(Boolean).join("\n");
      const hasPresentationCore = [".hidden", "#view-present", ".stage", ".slide-logo"]
        .every(selector => css.includes(selector));
      return hasPresentationCore ? css : [css, STANDALONE_FALLBACK_CSS].filter(Boolean).join("\n");
    }

    function blobDataUrl(blob) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(reader.error || new Error("Could not read an exported asset"));
        reader.readAsDataURL(blob);
      });
    }

    async function fetchDataUrl(url) {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Could not embed ${url} (${response.status})`);
      return blobDataUrl(await response.blob());
    }

    // One cache spans a whole export so an asset shared by CSS and any
    // number of slides is fetched and encoded exactly once.
    function fetchDataUrlCached(url, assetCache) {
      if (!assetCache.has(url)) assetCache.set(url, fetchDataUrl(url));
      return assetCache.get(url);
    }

    // The brand logo is usually a data URL, but a brand may ship a plain image
    // file (Quantica's PNG wordmarks). Both exports need an embeddable data
    // URL, so fetch-and-encode the file when it isn't already one.
    async function logoDataUrl() {
      const logo = style.effectiveLogo();
      if (!logo) return null;
      if (/^data:/i.test(logo)) return logo;
      try { return await fetchDataUrl(new URL(logo, document.baseURI).href); }
      catch { return logo; /* keep the path rather than failing the export */ }
    }

    async function replaceAsync(source, pattern, replacer) {
      const matches = [...source.matchAll(pattern)];
      if (!matches.length) return source;
      const replacements = await Promise.all(matches.map(match => replacer(match)));
      let output = "";
      let cursor = 0;
      matches.forEach((match, index) => {
        output += source.slice(cursor, match.index) + replacements[index];
        cursor = match.index + match[0].length;
      });
      return output + source.slice(cursor);
    }

    async function inlineCssAssets(css, baseUrl, assetCache = new Map()) {
      return replaceAsync(css, /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*?))\s*\)/gi, async match => {
        const raw = String(match[1] ?? match[2] ?? match[3] ?? "").trim();
        if (!raw || /^(?:data:|#)/i.test(raw)) return match[0];
        const url = new URL(raw, baseUrl).href;
        return `url("${await fetchDataUrlCached(url, assetCache)}")`;
      });
    }

    function exportFontFamilies() {
      return new Set([
        style.activeFont,
        BRAND.pptx.headingFont,
        BRAND.pptx.bodyFont,
        BRAND.pptx.monoFont,
      ].filter(Boolean).map(name => String(name).trim().toLowerCase()));
    }

    async function collectEmbeddedFontCss(pageCss = "", assetCache = new Map()) {
      // The exported page can use fonts beyond the PPTX config (theme tokens
      // like --font-mono resolve to brand-specific families), so any family
      // the collected CSS mentions must be embedded as well.
      const families = exportFontFamilies();
      const cssFamilies = String(pageCss).toLowerCase();
      const links = [...document.querySelectorAll('link[rel="stylesheet"]')]
        .filter(link => /^https:\/\/fonts\.googleapis\.com\//.test(link.href));
      const blocks = new Set();
      await Promise.all(links.map(async link => {
        try {
          const response = await fetch(link.href);
          if (!response.ok) return;
          const css = await response.text();
          const inlined = await Promise.all([...css.matchAll(/@font-face\s*\{[^{}]*\}/gi)].map(async match => {
            const family = /font-family:\s*['"]?([^;'"}]+)['"]?\s*;/i.exec(match[0])?.[1]
              ?.trim().toLowerCase();
            if (!family || !(families.has(family) || cssFamilies.includes(family))) return "";
            try { return await inlineCssAssets(match[0], link.href, assetCache); } catch { return ""; /* use CSS fallbacks */ }
          }));
          for (const block of inlined) if (block) blocks.add(block);
        } catch { /* an offline export remains self-contained via CSS fallbacks */ }
      }));
      return [...blocks].join("\n");
    }

    async function inlineHtmlImages(html, assetCache = new Map()) {
      const template = document.createElement("template");
      template.innerHTML = html;
      await Promise.all([...template.content.querySelectorAll("img[src]")].map(async image => {
        const raw = image.getAttribute("src");
        if (!raw || /^data:/i.test(raw)) return;
        const url = new URL(raw, document.baseURI).href;
        try {
          image.setAttribute("src", await fetchDataUrlCached(url, assetCache));
        } catch { /* keep the original src rather than failing the export */ }
      }));
      return template.innerHTML;
    }

    async function buildStandaloneHtml() {
      const title = deckTitle(state.md) || "slides";
      const hasTitle = state.deckModel.slides[0]?.type === "title";
      const assetCache = new Map();
      // The CSS pipeline (collect → inline assets / pick fonts) and the
      // slide-image inlining are independent; run them concurrently.
      const cssPromise = collectExportCss().then(collected => Promise.all([
        inlineCssAssets(collected, document.baseURI, assetCache),
        collectEmbeddedFontCss(collected, assetCache),
      ]));
      const slidesPromise = Promise.all(state.slides.map(async (slideHtml, index) => {
        const isTitle = index === 0 && hasTitle;
        const image = state.images[index];
        const eyebrow = isTitle
          ? ""
          : [`${index + 1} / ${state.slides.length}`, title].filter(Boolean).join(" · ");
        const content = image
          ? illustratedSlideHtml(slideHtml, `<img class="slide-generated-image" src="${escapeHtml(image)}" alt="${escapeHtml(t("imageAlt"))}">`)
          : slideHtml;
        const eyebrowHtml = eyebrow ? `<div class="slide-eyebrow">${escapeHtml(eyebrow)}</div>` : "";
        return inlineHtmlImages(`<section class="slide${isTitle ? " slide--title" : ""}${image ? " slide--illustrated" : ""}${index ? " hidden" : ""}" data-export-slide>
        ${eyebrowHtml}${content}</section>`, assetCache);
      }));
      const [[baseCss, fontCss], renderedSlides] = await Promise.all([cssPromise, slidesPromise]);
      const styleText = [baseCss, fontCss, collectExportPresetCss()].filter(Boolean).join("\n");
      const slides = renderedSlides.join("\n");
      const exportLogo = await logoDataUrl();
      const logo = exportLogo
        ? `<img class="slide-logo" src="${escapeHtml(exportLogo)}" alt="" aria-hidden="true">`
        : "";
      const brandClass = /quantica/i.test(BRAND.presetKey || "") ? " export-brand--quantica" : "";
      const html = `<!DOCTYPE html>
<html lang="${escapeHtml(uiLang())}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<style>${styleText}
.export-nav { display: flex; align-items: center; gap: 8px; }
.export-nav button { border: 1px solid var(--line-2, currentColor); border-radius: 999px; padding: 4px 14px; background: transparent; color: inherit; font: inherit; cursor: pointer; }
</style>
</head>
<body class="presenting${brandClass}">
<main id="app">
  <section id="view-present">
    <div class="present-bar" id="presentBar" aria-hidden="true"></div>
    ${logo}
    <div class="stage">${slides}</div>
    <div class="present-footer">
      <div class="export-nav">
        <button id="prevBtn" type="button" aria-label="${uiLang() === "pl" ? "Poprzedni slajd" : "Previous slide"}">←</button>
        <button id="nextBtn" type="button" aria-label="${uiLang() === "pl" ? "Następny slajd" : "Next slide"}">→</button>
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
      return { html, title };
    }

    async function downloadHtml() {
      try {
        if (downloadBtn) downloadBtn.disabled = true;
        const { html, title } = await buildStandaloneHtml();
        const blob = new Blob([html], { type: "text/html;charset=utf-8" });
        const a = document.createElement("a");
        const url = URL.createObjectURL(blob);
        a.href = url;
        a.download = title + ".html";
        a.style.display = "none";
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch (err) {
        showError(t("errHtmlTitle"), String(err.message ?? err));
      } finally {
        if (downloadBtn) downloadBtn.disabled = false;
      }
    }

    return {
      downloadPptx, downloadHtml, buildStandaloneHtml,
      readDeckTheme, collectExportCss, collectExportPresetCss, EXPORT_CHROME_SELECTOR,
    };
  }

  root.createExportController = createExportController;
})(typeof window !== "undefined" ? window : globalThis);
