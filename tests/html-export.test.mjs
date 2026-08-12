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

function makeController() {
  const fontLink = { href: "https://fonts.googleapis.com/css2?family=Raleway:wght@400;700" };
  const document = {
    baseURI: "https://example.test/app/",
    styleSheets: [{ cssRules: [{
      selectorText: ".slide",
      cssText: ".slide { color: var(--slide-fg); }",
      style: { cssText: "color: var(--slide-fg);" },
    }] }],
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
    if (String(url).startsWith("https://fonts.googleapis.com/")) {
      return new Response("@font-face { font-family: 'Raleway'; src: url(https://fonts.gstatic.com/raleway.woff2) format('woff2'); font-weight: 400; }");
    }
    if (url === "https://fonts.gstatic.com/raleway.woff2") {
      return new Response(new Uint8Array([1, 2, 3]), {
        headers: { "Content-Type": "font/woff2" },
      });
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
    },
    state: {
      md: "# Offline deck",
      deckModel: { slides: [{ type: "title" }] },
      slides: [
        '<h1>Offline deck</h1><p>Ready to present.</p><img src="https://assets.example.test/chart.png" alt="Chart">',
      ],
      images: [],
    },
    t: key => key,
    uiLang: () => "en",
    style: { activePreset: 0, activeFont: "Raleway", effectiveLogo: () => null },
    deckTitle: () => "Offline deck",
    splitSlides: () => [],
    stripOuterFence: value => value,
    ensurePptxDeps: async () => {},
    showError() {},
  });
}

test("standalone HTML embeds presentation CSS, fonts, images, and navigation", async () => {
  const exporter = makeController();
  const { html, title } = await exporter.buildStandaloneHtml();

  assert.equal(title, "Offline deck");
  assert.match(html, /<!DOCTYPE html>/);
  assert.match(html, /\.slide \{ color: var\(--slide-fg\); \}/);
  assert.match(html, /@font-face/);
  assert.match(html, /data:font\/woff2;base64,AQID/);
  assert.match(html, /data:image\/png;base64,iVBORw==/);
  assert.match(html, /id="prevBtn"/);
  assert.match(html, /id="nextBtn"/);
  assert.match(html, /document\.addEventListener\("keydown"/);
  assert.doesNotMatch(html, /<link\b/i);
  assert.doesNotMatch(html, /https:\/\/fonts\.(?:googleapis|gstatic)\.com/);
  assert.doesNotMatch(html, /https:\/\/assets\.example\.test/);
});
