import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const ROOT = new URL("../", import.meta.url);
const read = file => readFile(new URL(file, ROOT), "utf8");

test("deck-first shells load shared model and layered styles", async () => {
  const shells = {
    "index.html": ["deck-base.css", "theme-edulab.css", "theme-illustrated.css"],
    "edu.html": ["deck-base.css", "theme-edulab.css", "theme-illustrated.css"],
    "quantica.html": ["deck-base.css", "theme-edulab.css", "theme-quantica.css", "theme-illustrated.css"],
  };

  for (const [file, styles] of Object.entries(shells)) {
    const html = await read(file);
    let previous = -1;
    for (const style of styles) {
      const position = html.indexOf(`href="${style}"`);
      assert.ok(position > previous, `${file} loads ${style} in cascade order`);
      previous = position;
    }
    assert.ok(html.indexOf('src="deck-model.js"') < html.indexOf('src="app.js"'));
    assert.match(html, /pptx:\s*\{\s*headingFont:/);
  }
});

test("one guide deck opens in every flavour, flow before options", async () => {
  const app = await read("app.js");
  // The deck must stay inside app.js. Split across files, the two halves are
  // cached separately and a half-stale deploy renders an empty workspace.
  const literal = /const EXAMPLE_DECK = \{[\s\S]*?\n  \};/.exec(app);
  assert.ok(literal, "app.js owns the example deck");
  const decks = new Function(`${literal[0]} return EXAMPLE_DECK;`)();
  assert.deepEqual(Object.keys(decks).sort(), ["en", "pl"]);
  assert.match(app, /exampleMd: EXAMPLE_DECK/);
  assert.ok(app.indexOf("const EXAMPLE_DECK") < app.indexOf("exampleMd: EXAMPLE_DECK"),
    "the deck must be declared before BRAND reads it (no temporal dead zone)");

  for (const file of ["index.html", "edu.html", "quantica.html"]) {
    const html = await read(file);
    assert.doesNotMatch(html, /exampleMd:/, `${file} must not carry its own copy`);
    assert.doesNotMatch(html, /example-deck\.js/, `${file} must not load a separate deck file`);
  }

  for (const [lang, md] of Object.entries(decks)) {
    const headings = [...md.matchAll(/^#{1,2} (.+)$/gm)].map(m => m[1]);
    for (const heading of headings) {
      assert.doesNotMatch(heading, /^\d+[.)]/, `${lang}: numbered slide title "${heading}"`);
    }
    // The deck is brand-neutral: every flavour opens the same words.
    assert.doesNotMatch(md, /edulab|Quantica/i, `${lang} deck names a brand`);
    // A bodyless "## Options" heading splits the flow from the settings.
    const divider = lang === "pl" ? "\n## Opcje\n" : "\n## Options\n";
    assert.ok(md.includes(divider), `${lang} deck has the options divider`);
    const flow = md.slice(0, md.indexOf(divider));
    const options = md.slice(md.indexOf(divider));
    assert.ok(/Generuj slajdy|Generate slides/.test(flow), `${lang}: flow comes first`);
    assert.ok(/czcionk|font/i.test(options), `${lang}: options come after the divider`);
    assert.ok(!/czcionk|font picker/i.test(flow), `${lang}: options must not leak into the flow`);
    // A closing slide of its own marks the end of the tour.
    const slides = md.split(/\n---\n/);
    assert.match(slides.at(-1), /^## (Gotowe|Ready when you are)\n/, `${lang}: closing slide`);
    assert.ok(!/Gotowe –|That is everything/.test(slides.at(-2)),
      `${lang}: the sign-off must not trail the previous slide`);
  }
});

test("an empty example deck is reported instead of rendering a blank stage", async () => {
  const app = await read("app.js");
  assert.match(app, /function exampleDeck\(lang\)/);
  assert.match(app, /if \(!md\.trim\(\)\)/);
  assert.match(app, /errExampleDeck/);
  // Nothing may reach setDeck without going through the guard.
  const rawReads = app.split("\n").filter(line => /setDeck\(BRAND\.exampleMd/.test(line));
  assert.deepEqual(rawReads, [], "example deck reads must go through exampleDeck()");
});

test("controllers build one semantic model and expose the DOM contract", async () => {
  for (const file of ["app.js"]) {
    const source = await read(file);
    assert.match(source, /DeckModel\.create\(/, `${file} creates the semantic model`);
    assert.match(source, /dataset\.slideType/, `${file} publishes the semantic slide type`);
    assert.match(source, /dataset\.warningCount/, `${file} publishes validation warnings`);
    assert.match(source, /deck:\s*state\.deckModel/, `${file} passes the model to PowerPoint`);
  }
});

test("the image model lives in the AI model dialog, not the side panel", async () => {
  const app = await read("app.js");
  const shared = await read("shared.js");
  assert.doesNotMatch(app, /id="imageModel"/, "the side panel no longer owns an image-model select");
  assert.match(app, /images:\s*BRAND\.illustrations/, "app.js gates the dialog field per brand");
  assert.match(app, /model:\s*aiSettings\.imageModel/, "illustrations read the persisted image model");
  assert.match(shared, /id="aiImageModel"/, "the dialog renders the image-model select");
  assert.match(shared, /settings\.imageModel\s*=\s*imageSel\.value/, "the dialog persists the choice");
});

test("the title slide carries no brand eyebrow in any output", async () => {
  const app = await read("app.js");
  assert.doesNotMatch(app, /presentEyebrowWord/, "the eyebrow wording is gone");
  assert.doesNotMatch(app, /brandName:\s*BRAND\.presentBrand/,
    "PPTX export must not request the brand eyebrow master");
  // presentBrand survives only as PPTX document metadata.
  const uses = app.split("\n").filter(line => line.includes("BRAND.presentBrand"));
  assert.deepEqual(uses.map(line => line.trim()),
    ["company: BRAND.pptx.company || BRAND.presentBrand,"]);
});

test("the deck font picker is slide-scoped and reaches every output", async () => {
  const app = await read("app.js");
  const base = await read("deck-base.css");
  const edulab = await read("theme-edulab.css");

  for (const font of ["Raleway", "Lato", "Poppins", "PT Serif"]) {
    assert.ok(app.includes(`"${font}"`), `${font} is offered in the picker`);
  }
  // Slide-scoped tokens: the picker must not restyle the app chrome.
  assert.match(base, /font-family: var\(--slide-body-font, var\(--font-sans\)\)/);
  assert.match(edulab, /var\(--slide-heading-font, var\(--font-display\)\)/);
  assert.match(app, /setProperty\("--slide-heading-font", stack\)/);
  assert.match(app, /setProperty\("--slide-body-font", stack\)/);
  // The choice has to survive into both exports.
  assert.match(app, /"--slide-heading-font", "--slide-body-font"/,
    "standalone HTML must inline the font tokens");
  assert.match(app, /headingFont: activeFont/);
  assert.match(app, /bodyFont: activeFont/);
  // A stored or typed family is untrusted input before it reaches a URL.
  assert.match(app, /const FONT_NAME = \/\^\[A-Za-z0-9\]/);
  assert.match(app, /if \(!FONT_NAME\.test\(clean\)\) return false/);
});

test("the custom font field never requests a partial family name", async () => {
  const app = await read("app.js");
  // Typing "Merriweather" used to fetch M, Me, Mer, … leaving a dozen dead
  // stylesheet links in the page and in every exported deck.
  assert.match(app, /clearTimeout\(customFontTimer\)/);
  assert.match(app, /customFontTimer = setTimeout\(/);
  const handler = /customFontEl\.addEventListener\("input"[\s\S]*?\n  \}\);/.exec(app)[0];
  assert.ok(handler.includes("setTimeout"), "the input handler must debounce before applying");
  assert.ok(!/^\s*if \(value\) applyFont/m.test(handler.split("setTimeout")[0]),
    "nothing may apply the font before the debounce");
  // Chips preview their own face, which needs the face on the page first.
  assert.match(app, /function preloadPickerFonts\(\)/);
  assert.match(app, /if \(open && toggle\.dataset\.fold === "styleFold"\) preloadPickerFonts\(\)/);
});

test("side-panel groups fold from their section title", async () => {
  const app = await read("app.js");
  const base = await read("deck-base.css");
  // One control per group: the title itself, no extra summary row.
  const toggles = [...app.matchAll(/class="side-fold-toggle" data-fold="(\w+)"/g)].map(m => m[1]);
  assert.deepEqual(toggles, ["styleFold", "genFold"]);
  for (const id of toggles) assert.ok(app.includes(`id="${id}"`), `${id} body exists`);
  // The always-visible parts stay outside the folds.
  assert.ok(app.indexOf('id="presetGrid"') < app.indexOf('id="styleFold"'));
  assert.ok(app.indexOf('id="genFold"') < app.indexOf('id="generateBtn"'));
  assert.match(app, /toggle\.setAttribute\("aria-expanded", String\(open\)\)/);
  assert.match(base, /\.side-fold-toggle\[aria-expanded="true"\]::after/);
});

test("every shell offers the same mechanics on its own visual identity", async () => {
  const shells = ["index.html", "edu.html", "quantica.html"];
  const brands = {};
  for (const file of shells) {
    const html = await read(file);
    assert.match(html, /illustrations: true/, `${file} enables illustrations`);
    assert.match(html, /href="theme-illustrated\.css"/, `${file} loads the illustration layer`);
    brands[file] = {
      presets: [...html.matchAll(/\{ id: "(\w+)"/g)].map(m => m[1]),
      storage: [...html.matchAll(/(presetKey|editorWKey): "([^"]+)"/g)].map(m => m[2]),
      pptx: /monoFont: "([^"]+)"/.exec(html)[1],
    };
  }
  // Distinct identity: no shared palette, storage namespace, or type stack.
  const seen = new Set();
  for (const [file, brand] of Object.entries(brands)) {
    assert.equal(brand.presets.length, 4, `${file} keeps four presets`);
    for (const key of brand.storage) {
      assert.ok(!seen.has(key), `${key} must not be shared between shells`);
      seen.add(key);
    }
  }
  assert.notDeepEqual(brands["quantica.html"].presets, brands["edu.html"].presets);
  // Quantica runs a closed palette: white or black grounds only, and type
  // and accents drawn from an agreed five.
  const quanticaHtml = await read("quantica.html");
  const presetLines = quanticaHtml.split("\n").filter(line => /\{ id: "\w+"/.test(line));
  assert.equal(presetLines.length, 4);
  const PALETTE = ["#FFFFFF", "#000000", "#111111", "#d20757", "#8A004C"];
  for (const line of presetLines) {
    assert.match(line, /bg: "(#FFFFFF|#000000)"/, `background off palette: ${line.trim()}`);
    for (const key of ["fg", "accent"]) {
      const value = new RegExp(`${key}: "(#[0-9A-Fa-f]{6})"`).exec(line)[1];
      assert.ok(PALETTE.includes(value), `${key} off palette: ${value}`);
    }
  }
  assert.notEqual(brands["quantica.html"].pptx, brands["edu.html"].pptx);
  // Both slide-font layers route through the shared token.
  const quantica = await read("theme-quantica.css");
  assert.match(quantica, /var\(--slide-heading-font, var\(--font-slide\)\)/);
});

test("API key persistence contract remains browser-local", async () => {
  const source = await read("shared.js");
  assert.match(source, /const LS_AI = "eduapp_ai"/);
  assert.match(source, /localStorage\.getItem\(LS_AI\)/);
  assert.match(source, /localStorage\.setItem\(LS_AI,\s*JSON\.stringify\(settings\)\)/);
  assert.doesNotMatch(source, /sessionStorage|indexedDB|document\.cookie/);
});

test("standalone HTML export inlines readable stylesheets", async () => {
  const source = await read("app.js");
  assert.match(source, /function collectExportCss\(\)/);
  assert.match(source, /sheet\.cssRules/);
  assert.ok(source.includes("fonts\\.googleapis\\.com"));
});

test("long-running generation and illustration requests are cancellable", async () => {
  const app = await read("app.js");
  const shared = await read("shared.js");
  assert.match(app, /generationController\s*=\s*new AbortController\(\)/);
  assert.match(app, /illustrationController\s*=\s*new AbortController\(\)/);
  assert.match(app, /signal:\s*state\.generationController\.signal/);
  assert.match(app, /signal:\s*state\.illustrationController\.signal/);
  assert.match(shared, /DEFAULT_STREAM_TIMEOUT_MS\s*=\s*180_000/);
  assert.match(shared, /DEFAULT_IMAGE_TIMEOUT_MS\s*=\s*180_000/);
});

test("every localStorage access is guarded so blocked storage cannot blank the app", async () => {
  const source = await read("app.js");
  const touches = source.split("\n")
    .filter(line => line.includes("localStorage") && !line.trim().startsWith("//"));
  assert.ok(touches.length, "expected at least one storage call site");
  for (const line of touches) {
    assert.match(line, /try\s*\{[^}]*localStorage\.(getItem|setItem)/,
      `unguarded localStorage access: ${line.trim()}`);
  }
  assert.match(source, /function readStored\(/);
  assert.match(source, /function writeStored\(/);
  // A corrupt value in the cross-app language key must not break t().
  assert.match(source, /\(T\[uiLang\] \?\? T\.pl\)/);
});

test("the slide query parameter rejects non-numeric input", async () => {
  const source = await read("app.js");
  assert.match(source, /Number\.parseInt\(params\.get\("slide"\), 10\)/);
  assert.match(source, /Number\.isFinite\(slideParam\)/);
});

test("standalone HTML export drops workbench-only rules", async () => {
  const source = await read("app.js");
  assert.match(source, /EXPORT_CHROME_SELECTOR/);
  assert.match(source, /function exportRuleText\(/);
  for (const chrome of ["workbench", "dropzone", "editor-", "panel-resizer", "ai-"]) {
    assert.ok(source.includes(chrome), `chrome filter should cover ${chrome}`);
  }
});
