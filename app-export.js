/* ============================================================
   app-export — standalone HTML and PowerPoint export.

   Classic script. Exposes a factory built by app.js inside its IIFE:

     const exporter = createExportController(ctx);
     // ctx: { BRAND, state, t, uiLang(), style, deckTitle, splitSlides,
     //        stripOuterFence, ensurePptxDeps, exportDeckToPptx: () => fn,
     //        showError }

   Load order: shared.js → app-style.js → app-export.js → deck-model.js → app.js
   ============================================================ */
(function (root) {
  "use strict";

  function createExportController(ctx) {
    const {
      BRAND, state, t, uiLang, style, deckTitle, splitSlides, stripOuterFence,
      ensurePptxDeps, showError, pptxBtn,
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
          logo: style.effectiveLogo() || null,
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
      "|font-grid|font-chip|logo-",
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
      const exportLogo = style.effectiveLogo();
      const logo = exportLogo
        ? `<img class="slide-logo" src="${escapeHtml(exportLogo)}" alt="" aria-hidden="true">`
        : "";
      const html = `<!DOCTYPE html>
<html lang="${escapeHtml(uiLang())}">
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
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = title + ".html";
      a.click();
      URL.revokeObjectURL(a.href);
    }

    return { downloadPptx, downloadHtml, readDeckTheme, collectExportCss, collectExportPresetCss, EXPORT_CHROME_SELECTOR };
  }

  root.createExportController = createExportController;
})(typeof window !== "undefined" ? window : globalThis);
