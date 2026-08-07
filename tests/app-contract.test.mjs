import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const ROOT = new URL("../", import.meta.url);
const read = file => readFile(new URL(file, ROOT), "utf8");

test("deck-first shells load shared model and layered styles", async () => {
  const shells = {
    "edu.html": ["deck-base.css", "theme-edulab.css"],
    "quantica.html": ["deck-base.css", "theme-edulab.css", "theme-quantica.css"],
    "experimental.html": ["deck-base.css", "theme-edulab.css", "theme-experimental.css"],
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

test("controllers build one semantic model and expose the DOM contract", async () => {
  for (const file of ["app.js", "index.html"]) {
    const source = await read(file);
    assert.match(source, /DeckModel\.create\(/, `${file} creates the semantic model`);
    assert.match(source, /dataset\.slideType/, `${file} publishes the semantic slide type`);
    assert.match(source, /dataset\.warningCount/, `${file} publishes validation warnings`);
    assert.match(source, /deck:\s*state\.deckModel/, `${file} passes the model to PowerPoint`);
  }
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
