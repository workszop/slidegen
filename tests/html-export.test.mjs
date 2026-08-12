import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const SOURCE = await readFile(new URL("../app-export.js", import.meta.url), "utf8");

class TestFileReader {
  readAsDataURL(blob) {
    blob.arrayBuffer().then(buffer => {
      this.result = `data:${blob.type};base64,${Buffer.from(buffer).toString("base64")}`;
      this.onload?.();
    }, error => {
      this.error = error;
      this.onerror?.();
    });
  }
}

class TestTemplate {
  constructor() {
    this._html = "";
    this.images = [];
    this.content = { querySelectorAll: () => this.images };
  }

  set innerHTML(value) {
    this._html = value;
    this.images = [...value.matchAll(/<img\b[^>]*\bsrc="([^"]*)"[^>]*>/gi)].map(match => {
      let source = match[1];
      return {
        getAttribute(name) { return name === "src" ? source : null; },
        setAttribute(name, next) {
          if (name !== "src") return;
          source = next;
        },
        original: match[1],
        current: () => source,
      };
    });
  }

  get innerHTML() {
    return this.images.reduce((html, image) =>
      html.replace(`src="${image.original}"`, `src="${image.current()}"`), this._html);
  }
}

function makeController({
  localCssAvailable = true, slides, pageRules = [], googleCss, extraSheets = [], fetchLog = [],
} = {}) {
  const fontLink = { href: "https://fonts.googleapis.com/css2?family=Raleway:wght@400;700" };
  const document = {
    baseURI: "https://example.test/app/",
    styleSheets: [
      { cssRules: [
        ...pageRules,
        {
          selectorText: ".slide",
          cssText: ".slide { color: var(--slide-fg); }",
          style: { cssText: "color: var(--slide-fg);" },
        },
        {
          selectorText: ".slide-logo",
          cssText: ".slide-logo { position: absolute; height: 72px; width: auto; }",
          style: { cssText: "position: absolute; height: 72px; width: auto;" },
        },
        {
          selectorText: ".logo-controls",
          cssText: ".logo-controls { display: flex; }",
          style: { cssText: "display: flex;" },
        },
      ] },
      {
        href: "https://example.test/app/deck-base.css",
        get cssRules() { throw new DOMException("Stylesheet rules are unavailable", "SecurityError"); },
      },
      ...extraSheets,
    ],
    documentElement: { style: { getPropertyValue: name => ({
      "--slide-bg": "#ffffff",
      "--slide-fg": "#111111",
      "--slide-accent": "#d20757",
      "--slide-heading-font": "Raleway, sans-serif",
      "--slide-body-font": "Raleway, sans-serif",
    })[name] || "" } },
    querySelectorAll: selector => selector === 'link[rel="stylesheet"]' ? [fontLink] : [],
    createElement: tag => {
      assert.equal(tag, "template");
      return new TestTemplate();
    },
  };
  const fetch = async url => {
    fetchLog.push(String(url));
    if (String(url).startsWith("https://fonts.googleapis.com/")) {
      return new Response(googleCss
        ?? "@font-face { font-family: 'Raleway'; src: url(https://fonts.gstatic.com/raleway.woff2) format('woff2'); font-weight: 400; }");
    }
    if (url === "https://fonts.gstatic.com/raleway.woff2") {
      return new Response(new Uint8Array([1, 2, 3]), {
        headers: { "Content-Type": "font/woff2" },
      });
    }
    if (url === "https://fonts.gstatic.com/space-grotesk.woff2") {
      return new Response(new Uint8Array([4, 5, 6]), {
        headers: { "Content-Type": "font/woff2" },
      });
    }
    if (url === "https://assets.example.test/missing.png") {
      return new Response("not found", { status: 404 });
    }
    if (url === "https://example.test/app/chrome.css") {
      return new Response(".workbench { color: red; }");
    }
    if (url === "https://example.test/app/deck-base.css") {
      if (!localCssAvailable) throw new TypeError("Failed to fetch");
      return new Response(".hidden { display: none !important; } #view-present { position: fixed; inset: 0; }");
    }
    if (url === "https://assets.example.test/chart.png") {
      return new Response(new Uint8Array([137, 80, 78, 71]), {
        headers: { "Content-Type": "image/png" },
      });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };
  const window = {};
  vm.runInNewContext(SOURCE, {
    window, document, fetch, FileReader: TestFileReader, URL, Blob, Response,
    setTimeout, console,
  });
  return window.createExportController({
    BRAND: {
      pptx: { headingFont: "Raleway", bodyFont: "Raleway", monoFont: "DM Mono" },
      presets: [{ bg: "#ffffff", fg: "#111111", accent: "#d20757" }],
      presetKey: "test_quantica",
    },
    state: {
      md: "# Offline deck",
      deckModel: { slides: [{ type: "title" }, { type: "content" }, { type: "content" }] },
      slides: slides ?? [
        '<h1>Offline deck</h1><p>Ready to present.</p><img src="https://assets.example.test/chart.png" alt="Chart">',
        "<h2>Second slide</h2><p>Only one slide should be visible.</p>",
        "<h2>Third slide</h2><p>Navigation must reach this slide.</p>",
      ],
      images: [],
    },
    t: key => key,
    uiLang: () => "en",
    style: {
      activePreset: 0,
      activeFont: "Raleway",
      effectiveLogo: () => "data:image/png;base64,TE9HTw==",
    },
    deckTitle: () => "Offline deck",
    splitSlides: () => [],
    stripOuterFence: value => value,
    ensurePptxDeps: async () => {},
    showError() {},
  });
}

function slideSections(html) {
  return [...html.matchAll(/<section class="([^"]*)" data-export-slide(?:="")?>/g)]
    .map(match => match[1].split(/\s+/));
}

function exerciseNavigation(html) {
  class ClassList {
    constructor(classes) { this.classes = new Set(classes); }
    contains(name) { return this.classes.has(name); }
    toggle(name, force) {
      const active = force === undefined ? !this.classes.has(name) : Boolean(force);
      if (active) this.classes.add(name);
      else this.classes.delete(name);
      return active;
    }
  }

  const slides = slideSections(html).map(classes => ({ classList: new ClassList(classes) }));
  const listeners = {};
  const button = () => ({ addEventListener(type, handler) { listeners[type] = handler; } });
  const prev = button();
  const next = button();
  const bar = { style: {} };
  const counter = { textContent: "" };
  let keydown;
  const document = {
    querySelectorAll: selector => selector === "[data-export-slide]" ? slides : [],
    getElementById: id => ({ prevBtn: prev, nextBtn: next, presentBar: bar, presentCounter: counter })[id],
    addEventListener(type, handler) { if (type === "keydown") keydown = handler; },
  };
  const script = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1];
  assert.ok(script, "standalone export must contain its navigation script");
  vm.runInNewContext(script, { document });
  return { slides, listeners, keydown, bar, counter };
}

test("standalone HTML embeds presentation CSS, fonts, images, and navigation", async () => {
  const exporter = makeController();
  const { html, title } = await exporter.buildStandaloneHtml();

  assert.equal(title, "Offline deck");
  assert.match(html, /<!DOCTYPE html>/);
  assert.match(html, /\.slide \{ color: var\(--slide-fg\); \}/);
  assert.match(html, /\.slide-logo \{ position: absolute; height: 72px; width: auto; \}/);
  assert.doesNotMatch(html, /\.logo-controls\s*\{/);
  assert.match(html, /\.hidden \{ display: none !important; \}/);
  assert.match(html, /#view-present \{ position: fixed; inset: 0; \}/);
  assert.match(html, /@font-face/);
  assert.match(html, /data:font\/woff2;base64,AQID/);
  assert.match(html, /data:image\/png;base64,iVBORw==/);
  assert.match(html, /<img class="slide-logo" src="data:image\/png;base64,TE9HTw=="/);
  assert.match(html, /id="prevBtn"/);
  assert.match(html, /id="nextBtn"/);
  assert.match(html, /document\.addEventListener\("keydown"/);
  assert.doesNotMatch(html, /<link\b/i);
  assert.doesNotMatch(html, /https:\/\/fonts\.(?:googleapis|gstatic)\.com/);
  assert.doesNotMatch(html, /https:\/\/assets\.example\.test/);
});

test("an unfetchable slide image keeps its original src instead of failing the export", async () => {
  const exporter = makeController({
    slides: [
      '<h1>Offline deck</h1><img src="https://assets.example.test/chart.png" alt="Chart"><img src="https://assets.example.test/missing.png" alt="Broken">',
      "<h2>Second slide</h2>",
      "<h2>Third slide</h2>",
    ],
  });
  const { html } = await exporter.buildStandaloneHtml();

  assert.match(html, /data:image\/png;base64,iVBORw==/,
    "reachable images must still be inlined");
  assert.match(html, /src="https:\/\/assets\.example\.test\/missing\.png"/,
    "an unfetchable image must keep its original src");
});

test("embedded fonts cover families used by the page CSS, not just the PPTX config", async () => {
  const exporter = makeController({
    pageRules: [{
      selectorText: ".present-counter",
      cssText: '.present-counter { font-family: "Space Grotesk", monospace; }',
      style: { cssText: 'font-family: "Space Grotesk", monospace;' },
    }],
    googleCss: [
      "@font-face { font-family: 'Raleway'; src: url(https://fonts.gstatic.com/raleway.woff2) format('woff2'); font-weight: 400; }",
      "@font-face { font-family: 'Space Grotesk'; src: url(https://fonts.gstatic.com/space-grotesk.woff2) format('woff2'); }",
    ].join("\n"),
  });
  const { html } = await exporter.buildStandaloneHtml();

  assert.match(html, /data:font\/woff2;base64,AQID/,
    "configured fonts must still be embedded");
  assert.match(html, /@font-face \{ font-family: 'Space Grotesk'; src: url\("data:font\/woff2;base64,BAUG"\)/,
    "fonts referenced only by the collected CSS must be embedded too");
});

test("standalone HTML keeps presentation styling when file CSS cannot be read", async () => {
  const exporter = makeController({ localCssAvailable: false });
  const { html } = await exporter.buildStandaloneHtml();

  for (const selector of [".hidden", "#view-present", ".stage", ".slide-logo", ".slide--title"]) {
    assert.ok(html.includes(selector), `file export fallback must include ${selector}`);
  }
  assert.match(html, /\.hidden \{ display: none !important; \}/);
  assert.match(html, /\.slide-logo \{[\s\S]*?position: absolute;/);
  assert.match(html, /\.slide-logo \{[\s\S]*?height: clamp\(36px, 4vh \+ 1\.8vw, 88px\);/);
  assert.match(html, /\.stage \{[\s\S]*?display: grid;/);

  const sections = slideSections(html);
  assert.equal(sections.length, 3);
  assert.equal(sections[0].includes("hidden"), false, "the first slide starts visible");
  assert.ok(sections.slice(1).every(classes => classes.includes("hidden")),
    "every later slide starts hidden");
});

test("a stylesheet whose rules were all chrome-filtered is not refetched raw", async () => {
  const exporter = makeController({
    extraSheets: [{
      href: "https://example.test/app/chrome.css",
      cssRules: [{
        selectorText: ".workbench",
        cssText: ".workbench { color: red; }",
        style: { cssText: "color: red;" },
      }],
    }],
  });
  const { html } = await exporter.buildStandaloneHtml();

  assert.doesNotMatch(html, /\.workbench/,
    "rules filtered from a readable stylesheet must not re-enter via the raw fetch fallback");
});

test("an image repeated across slides is fetched once for the whole export", async () => {
  const fetchLog = [];
  const exporter = makeController({
    fetchLog,
    slides: [
      '<h1>Offline deck</h1><img src="https://assets.example.test/chart.png" alt="Chart">',
      '<h2>Second slide</h2><img src="https://assets.example.test/chart.png" alt="Chart again">',
      "<h2>Third slide</h2>",
    ],
  });
  const { html } = await exporter.buildStandaloneHtml();

  assert.equal((html.match(/data:image\/png;base64,iVBORw==/g) || []).length, 2,
    "both slides must inline the image");
  assert.equal(fetchLog.filter(url => url === "https://assets.example.test/chart.png").length, 1,
    "a repeated image must be fetched once per export");
});

test("STANDALONE_FALLBACK_CSS stays in sync with the real presentation CSS", async () => {
  const deckCss = await readFile(new URL("../deck-base.css", import.meta.url), "utf8");
  const fallback = /const STANDALONE_FALLBACK_CSS = `([^`]*)`/.exec(SOURCE)?.[1];
  assert.ok(fallback, "app-export.js must define the fallback CSS block");

  // Real CSS carries brand-token defaults (var(--slide-fg, var(--ink))) and
  // writes leading zeros; strip both so only genuine value drift fails.
  const normalize = value => value
    .replace(/var\((--[\w-]+),\s*var\((--[\w-]+)\)\)/g, "var($1)")
    .replace(/(^|[\s(,])0\./g, "$1.")
    .replace(/\s+/g, " ")
    .trim();
  const token = (css, name) => normalize(new RegExp(`${name}:\\s*([^;]+);`).exec(css)?.[1] ?? "");
  const declaration = (css, selector, property) => {
    const block = new RegExp(`${selector}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? "";
    return normalize(new RegExp(`(?:^|[;\\s])${property}:\\s*([^;]+)`).exec(block)?.[1] ?? "");
  };

  for (const [exportToken, deckToken] of [
    ["--export-muted", "--slide-fg-muted"],
    ["--export-surface", "--slide-surface"],
    ["--export-line", "--slide-line"],
    ["--export-link", "--slide-link"],
  ]) {
    assert.equal(token(fallback, exportToken), token(deckCss, deckToken),
      `${exportToken} must match deck-base.css ${deckToken}`);
  }
  assert.equal(token(fallback, "--export-slide-size"), declaration(deckCss, "\\.slide", "font-size"),
    "--export-slide-size must match the deck-base.css .slide font-size");
  assert.equal(declaration(fallback, "\\.present-bar", "transition"), declaration(deckCss, "\\.present-bar", "transition"),
    "the progress bar must keep the deck-base.css easing");
  assert.match(fallback, /\.slide a \{ color: var\(--export-link\); \}/,
    "links must use the contrast-mixed link color, not the raw accent");
  assert.match(declaration(fallback, "\\.slide-generated-image", "box-shadow"), /^var\(--shadow-image/,
    "generated images must keep the theme shadow token");
});

test("standalone navigation shows exactly one slide and updates progress", async () => {
  const exporter = makeController({ localCssAvailable: false });
  const { html } = await exporter.buildStandaloneHtml();
  const navigation = exerciseNavigation(html);
  const visible = () => navigation.slides
    .map((slide, index) => slide.classList.contains("hidden") ? null : index)
    .filter(index => index !== null);

  assert.deepEqual(visible(), [0]);
  assert.equal(navigation.counter.textContent, "1 / 3");
  assert.ok(Math.abs(Number.parseFloat(navigation.bar.style.width) - (100 / 3)) < 1e-9);

  navigation.listeners.click();
  assert.deepEqual(visible(), [1]);
  assert.equal(navigation.counter.textContent, "2 / 3");

  let prevented = false;
  navigation.keydown({ key: "End", preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.deepEqual(visible(), [2]);
  assert.equal(navigation.counter.textContent, "3 / 3");
});
