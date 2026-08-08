import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const ROOT = new URL("../", import.meta.url);
const read = file => readFile(new URL(file, ROOT), "utf8");

test("deck-first shells load shared model and layered styles", async () => {
  const shells = {
    "index.html": ["deck-base.css", "theme-edulab.css", "theme-illustrated.css"],
    "edu.html": ["deck-base.css", "theme-edulab.css"],
    "quantica.html": ["deck-base.css", "theme-edulab.css", "theme-quantica.css"],
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
