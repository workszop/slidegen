import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const JSZip = require("jszip");
const { marked } = require("marked");
const DeckModel = require("../deck-model.js");
const exportDeckToPptx = require("../pptx-export.js");

const PIXEL_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAE/wJ/lvWRWQAAAABJRU5ErkJggg==";

const SLIDES = [
  "# Theme-native deck\nA subtitle that remains editable",
  [
    "## Native content",
    "### Secondary heading",
    "A paragraph with **bold**, *italic*, ~~strike~~, `inline code`, and [a link](https://example.com).",
    "1. First ordered item",
    "   - Nested unordered item",
    "   - Another nested item",
    "2. Second ordered item",
    "",
    "> An *editable* blockquote with **rich text**.",
    "",
    "```js",
    "const answer = 42;",
    "console.log(answer);",
    "```",
    "",
    "<!-- notes:",
    "Speaker note for native content.",
    "-->",
  ].join("\n"),
  [
    "## Native table",
    "| Name | Value |",
    "|:-----|------:|",
    "| **Alpha** | `one` |",
    "| Beta | two |",
  ].join("\n"),
  "## Native image\nAn editable caption next to the illustration.",
  "## Section",
  [
    "## Long content",
    ...Array.from({ length: 18 }, (_, index) => `${index + 1}. Item ${index + 1} is preserved on a continuation slide`),
  ].join("\n"),
];

async function makePackage(overrides = {}) {
  const warnings = [];
  const deck = DeckModel.create(SLIDES, { marked });
  const buffer = await exportDeckToPptx({
    deck,
    theme: {
      bg: "#FAF7F0",
      fg: "#263238",
      accent: "#F05A28",
      headingFont: "Raleway",
      bodyFont: "Poppins",
      monoFont: "Fira Code",
    },
    images: [null, null, null, { data: PIXEL_PNG, altText: "Orange test pixel" }],
    logo: { data: PIXEL_PNG, altText: "Test brand logo" },
    brandName: "Test Brand",
    company: "Test Company",
    language: "pl",
    outputType: "nodebuffer",
    onWarnings(value) { warnings.push(...value); },
    ...overrides,
  });
  return { zip: await JSZip.loadAsync(buffer), warnings, buffer };
}

async function xmlFiles(zip, pattern) {
  const names = Object.keys(zip.files).filter(name => pattern.test(name)).sort((a, b) => {
    const aNumber = Number(a.match(/(\d+)\.xml$/)?.[1] ?? 0);
    const bNumber = Number(b.match(/(\d+)\.xml$/)?.[1] ?? 0);
    return aNumber - bNumber;
  });
  return Promise.all(names.map(async name => ({ name, xml: await zip.file(name).async("string") })));
}

test("exports complete OOXML with continuations and editable native content", async () => {
  const { zip, warnings, buffer } = await makePackage();
  assert.ok(buffer.length > 20_000);

  const slides = await xmlFiles(zip, /^ppt\/slides\/slide\d+\.xml$/);
  assert.ok(slides.length > SLIDES.length, "long source content should create continuation slides");
  assert.ok(warnings.some(warning => warning.code === "pptx_continuation_created"));

  const allSlides = slides.map(item => item.xml).join("\n");
  for (const expected of [
    "Theme-native deck",
    "Native content",
    "Secondary heading",
    "First ordered item",
    "Nested unordered item",
    "editable",
    "const answer = 42;",
    "Alpha",
    "Orange test pixel",
    "Item 18 is preserved",
  ]) {
    assert.match(allSlides, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(allSlides, /<a:tbl>/, "tables must remain native PowerPoint tables");
  assert.match(allSlides, /<a:buAutoNum type="arabicPeriod" startAt="1"\/>/);
  assert.match(allSlides, /<a:buChar char="[^"]+"\/>/);
  assert.match(allSlides, /name="Table 1"/);
  assert.match(allSlides, /descr="Orange test pixel"/);
  assert.doesNotMatch(allSlides, /<a:srgbClr\b/, "slide content must use scheme colors, not fixed RGB");
  assert.match(allSlides, /<a:schemeClr val="tx1"/);
  assert.match(allSlides, /<a:schemeClr val="accent1"/);

  const explicitFonts = [...allSlides.matchAll(/typeface="([^"]+)"/g)].map(match => match[1]);
  assert.ok(explicitFonts.includes("Fira Code"), "code is allowed to use the explicit mono font");
  assert.ok(explicitFonts.every(font => font === "Fira Code" || /^\+m[jn]-/.test(font)));

  const mixedContentSlide = slides.find(item => item.xml.includes("Secondary heading"));
  assert.ok(mixedContentSlide);
  const orderedContent = [
    "Secondary heading",
    "A paragraph with",
    "First ordered item",
    "editable",
    "const answer = 42;",
  ].map(text => mixedContentSlide.xml.indexOf(text));
  assert.ok(orderedContent.every((position, index) =>
    position >= 0 && (index === 0 || position > orderedContent[index - 1])));
});

test("defines semantic layouts with native placeholders and slide numbers", async () => {
  const { zip } = await makePackage();
  const layouts = await xmlFiles(zip, /^ppt\/slideLayouts\/slideLayout\d+\.xml$/);
  const allLayouts = layouts.map(item => item.xml).join("\n");

  for (const layoutName of ["TITLE", "TITLE_BODY", "TITLE_TWO_COLUMN", "TITLE_TABLE", "TITLE_IMAGE", "SECTION"]) {
    assert.match(allLayouts, new RegExp(`<p:cSld name="${layoutName}">`));
  }
  assert.match(allLayouts, /<p:ph[\s\S]*?type="title"/);
  assert.match(allLayouts, /<p:ph[\s\S]*?type="body"/);
  assert.match(allLayouts, /<p:ph type="pic"[\s\S]*?idx="\d+"/);
  assert.match(allLayouts, /<p:ph type="tbl"[\s\S]*?idx="\d+"/);
  assert.match(allLayouts, /<p:ph type="sldNum"/);
  assert.match(allLayouts, /name="Brand accent"/);
  assert.match(allLayouts, /descr="Test brand logo"/);
});

test("routes table and illustrated content through their native layouts", async () => {
  const { zip } = await makePackage();
  const layouts = await xmlFiles(zip, /^ppt\/slideLayouts\/slideLayout\d+\.xml$/);
  const slides = await xmlFiles(zip, /^ppt\/slides\/slide\d+\.xml$/);
  const tableLayout = layouts.find(item => item.xml.includes('<p:cSld name="TITLE_TABLE">'));
  const imageLayout = layouts.find(item => item.xml.includes('<p:cSld name="TITLE_IMAGE">'));
  const tableSlide = slides.find(item => item.xml.includes("Alpha"));
  const imageSlide = slides.find(item => item.xml.includes('descr="Orange test pixel"'));
  assert.ok(tableLayout && imageLayout && tableSlide && imageSlide);

  const targetFor = async slidePath => {
    const relPath = slidePath.replace("ppt/slides/", "ppt/slides/_rels/") + ".rels";
    return zip.file(relPath).async("string");
  };
  const tableRels = await targetFor(tableSlide.name);
  const imageRels = await targetFor(imageSlide.name);
  assert.match(tableRels, new RegExp(`Target="\\.\\./slideLayouts/${tableLayout.name.split("/").pop()}"`));
  assert.match(imageRels, new RegExp(`Target="\\.\\./slideLayouts/${imageLayout.name.split("/").pop()}"`));
});

test("writes the selected initial palette, theme fonts and document metadata", async () => {
  const { zip } = await makePackage();
  const theme = await zip.file("ppt/theme/theme1.xml").async("string");
  assert.match(theme, /<a:clrScheme name="Test Brand">/);
  assert.match(theme, /<a:dk1><a:srgbClr val="263238"\/><\/a:dk1>/);
  assert.match(theme, /<a:lt1><a:srgbClr val="FAF7F0"\/><\/a:lt1>/);
  assert.match(theme, /<a:accent1><a:srgbClr val="F05A28"\/><\/a:accent1>/);
  assert.match(theme, /<a:majorFont><a:latin typeface="Raleway"/);
  assert.match(theme, /<a:minorFont><a:latin typeface="Poppins"/);

  const core = await zip.file("docProps/core.xml").async("string");
  const app = await zip.file("docProps/app.xml").async("string");
  assert.match(core, /<dc:title>Theme-native deck<\/dc:title>/);
  assert.match(core, /<dc:subject>Theme-native deck<\/dc:subject>/);
  assert.match(core, /<dc:creator>Test Brand<\/dc:creator>/);
  assert.match(core, /<dc:language>pl<\/dc:language>/);
  assert.match(app, /<Company>Test Company<\/Company>/);
});

test("exports speaker notes without rasterizing or flattening them", async () => {
  const { zip } = await makePackage();
  const notes = await xmlFiles(zip, /^ppt\/notesSlides\/notesSlide\d+\.xml$/);
  assert.ok(notes.length >= 1);
  assert.match(notes.map(item => item.xml).join("\n"), /Speaker note for native content\./);
});

test("supports slidesMd fallback and returns requested Node output type", async () => {
  const data = await exportDeckToPptx({
    slidesMd: ["# Fallback\nCreated through DeckModel"],
    theme: {
      bg: "color(srgb 1 0.5 0)",
      fg: "rgb(16, 32, 48)",
      accent: "#0af",
      headingFont: "Head",
      bodyFont: "Body",
      monoFont: "Mono",
    },
    outputType: "uint8array",
  });
  assert.ok(data instanceof Uint8Array);
  const zip = await JSZip.loadAsync(data);
  const theme = await zip.file("ppt/theme/theme1.xml").async("string");
  assert.match(theme, /<a:lt1><a:srgbClr val="FF8000"\/><\/a:lt1>/);
  assert.match(theme, /<a:dk1><a:srgbClr val="102030"\/><\/a:dk1>/);
  assert.match(theme, /<a:accent1><a:srgbClr val="00AAFF"\/><\/a:accent1>/);
});
