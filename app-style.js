/* ============================================================
   app-style — style presets, deck fonts, and logo management.

   Classic script. Exposes a single factory on window so app.js can build the
   controller inside its own IIFE and hand over the shared context:

     const style = createStyleController(ctx);
     // ctx: { BRAND, state, t, uiLang(), readStored, writeStored, removeStored,
     //        presetGridEl, fontGridEl, customFontEl,
     //        logoInputEl, logoBtnEl, logoClearEl, onLogoChange }

   Load order: shared.js → app-style.js → app-export.js → deck-model.js → app.js
   ============================================================ */
(function (root) {
  "use strict";

  // ─── Deck font catalogue ────────────────────────
  // The picker drives slide-scoped tokens only, so the app chrome keeps the
  // brand font no matter what the user selects for the deck.
  const DECK_FONTS = [
    { name: "Raleway", stack: "system-ui, sans-serif" },
    { name: "Lato", stack: "system-ui, sans-serif" },
    { name: "Poppins", stack: "system-ui, sans-serif" },
    { name: "PT Serif", stack: "Georgia, serif" },
  ];
  // Google's CSS API takes the family verbatim, so anything outside this
  // shape is a typo (or an injection attempt) rather than a font.
  const FONT_NAME = /^[A-Za-z0-9][A-Za-z0-9 ]{0,48}$/;

  function createStyleController(ctx) {
    const {
      BRAND, state, t, uiLang, readStored, writeStored, removeStored,
      presetGridEl, fontGridEl, customFontEl,
      logoInputEl, logoBtnEl, logoClearEl, onLogoChange,
    } = ctx;

    const FONT_KEY = `${BRAND.presetKey}_font`;
    const LOGO_KEY = `${BRAND.presetKey}_logo`;
    const DEFAULT_FONT = BRAND.pptx.headingFont || DECK_FONTS[0].name;
    // null = never stored anything (use BRAND.logo); "" = user removed the
    // logo; otherwise a data-URL for a user-uploaded mark.
    let logoMode = readStored(LOGO_KEY); // null | "" | data-url
    let activePreset = 0;
    let activeFont = DEFAULT_FONT;

    // ─── Style presets ────────────────────────────
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
      refreshLogo();
    }

    function renderPresets() {
      presetGridEl.innerHTML = "";
      BRAND.presets.forEach((p, i) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "preset";
        b.innerHTML = `<span class="dots"><span style="background:${p.bg}"></span><span style="background:${p.fg}"></span><span style="background:${p.accent}"></span></span><span class="name"></span>`;
        b.querySelector(".name").textContent = p.name[uiLang()] ?? p.name.pl;
        b.addEventListener("click", () => applyPreset(i));
        presetGridEl.appendChild(b);
      });
    }

    // ─── Deck font ────────────────────────────────
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
      // Unquoted multi-word families are valid CSS and keep the value inside
      // the character set collectExportPresetCss is willing to inline.
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

    // ─── Logo management ─────────────────────────
    // Ported from old_index.html (the style studio). The user can upload a
    // mark, remove it, or fall back to the brand default. Stored per brand in
    // localStorage; a data-URL survives a reload and feeds both the on-screen
    // deck corner and the PowerPoint/HTML export.
    function isDarkPreset() {
      const preset = BRAND.presets[activePreset] ?? BRAND.presets[0];
      const bg = String(preset?.bg ?? "#FFFFFF");
      const rgb = [1, 3, 5].map(i => parseInt(bg.slice(i, i + 2), 16));
      return rgb.every(Number.isFinite)
        && (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) < 128;
    }

    function effectiveLogo() {
      if (logoMode === "") return null;               // user removed it
      if (typeof logoMode === "string" && logoMode.startsWith("data:")) return logoMode;
      // A brand may ship a distinct dark-preset mark (e.g. a white wordmark)
      // instead of relying on refreshLogo's invert filter.
      if (BRAND.logoDark && isDarkPreset()) return BRAND.logoDark;
      return BRAND.logo || null;                       // brand default
    }

    function refreshLogo() {
      const logo = effectiveLogo();
      document.querySelectorAll(".brand-logo").forEach(el => {
        // The chrome mark always shows the brand identity; only deck/slide
        // corner logos follow the user's override.
        if (el.classList.contains("chrome-mark")) {
          el.src = BRAND.logo;
          return;
        }
        el.classList.toggle("hidden", !logo);
        if (logo) {
          el.src = logo;
          // A dark preset under an ink-coloured default mark swallows it, so
          // invert the brand mark there; a brand with a dedicated dark mark
          // (logoDark) has already swapped it in via effectiveLogo. Never
          // filter a user-uploaded logo.
          const dark = isDarkPreset();
          el.style.filter = (dark && logo === BRAND.logo) ? "invert(1)" : "";
        } else {
          el.style.filter = "";
        }
      });
      onLogoChange?.(logo);
    }

    function setLogo(dataUrl) {
      logoMode = dataUrl || "";
      writeStored(LOGO_KEY, logoMode);
      refreshLogo();
    }

    // Back to "never stored": the brand mark returns, unlike setLogo("")
    // which records that the user removed the logo on purpose.
    function resetLogo() {
      logoMode = null;
      removeStored(LOGO_KEY);
      refreshLogo();
    }

    function resetToDefaults() {
      applyPreset(0);
      resetFont();
      resetLogo();
    }

    // True when every visual still matches the brand default: first preset,
    // default font, and no stored logo override (null means "never touched").
    function isDefault() {
      return activePreset === 0 && activeFont === DEFAULT_FONT && logoMode === null;
    }

    function bindLogoControls() {
      if (!logoBtnEl || !logoInputEl) return;
      logoBtnEl.addEventListener("click", () => logoInputEl.click());
      logoInputEl.addEventListener("change", () => {
        const file = logoInputEl.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => { setLogo(String(reader.result || "")); logoInputEl.value = ""; };
        reader.readAsDataURL(file);
      });
      logoClearEl?.addEventListener("click", () => setLogo(""));
    }

    // ─── Init ─────────────────────────────────────
    function init() {
      renderPresets();
      const savedPreset = BRAND.presets.findIndex(p => p.id === readStored(BRAND.presetKey));
      applyPreset(savedPreset >= 0 ? savedPreset : 0);
      renderFonts();
      // A stored value can be anything; applyFont rejects it. With no stored
      // choice the tokens stay unset so each brand keeps the typography its
      // own stylesheet defines.
      if (!applyFont(readStored(FONT_KEY), { store: false })) markFont(DEFAULT_FONT);
      bindLogoControls();
      refreshLogo();
    }

    return {
      init,
      renderPresets,
      renderFonts,
      applyPreset,
      applyFont,
      resetFont,
      resetToDefaults,
      isDefault,
      preloadPickerFonts,
      refreshLogo,
      effectiveLogo,
      get activePreset() { return activePreset; },
      get activeFont() { return activeFont; },
      DEFAULT_FONT,
      FONT_NAME,
    };
  }

  root.createStyleController = createStyleController;
})(typeof window !== "undefined" ? window : globalThis);
