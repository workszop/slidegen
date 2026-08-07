import { test } from "node:test";
import { deflateSync as zlibSync } from "node:zlib";
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

test("strips XML-illegal control characters so the package stays openable", async () => {
  const verticalTab = String.fromCharCode(0x0b);
  const deck = DeckModel.create([
    "# Control chars",
    `## Pasted text\n\nA paragraph with${verticalTab}a vertical tab.`,
  ], { marked });
  const buffer = await exportDeckToPptx({
    deck, theme: {}, outputType: "nodebuffer", onWarnings() {},
  });
  const zip = await JSZip.loadAsync(buffer);
  const slides = await xmlFiles(zip, /^ppt\/slides\/slide\d+\.xml$/);

  for (const { name, xml } of slides) {
    const illegal = [...xml].filter(char => {
      const code = char.charCodeAt(0);
      return code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d;
    });
    assert.equal(illegal.length, 0, `${name} must not contain XML-illegal control characters`);
  }
  assert.match(slides.map(item => item.xml).join("\n"), /A paragraph with a vertical tab\./);
});

test("keeps shape ids unique when a table shares a slide with other content", async () => {
  const deck = DeckModel.create([
    "# Ids",
    "## Text plus table\n\nA lead-in paragraph.\n\n| Key | Action |\n|---|---|\n| a | b |",
  ], { marked });
  const buffer = await exportDeckToPptx({
    deck, theme: {}, outputType: "nodebuffer", onWarnings() {},
  });
  const zip = await JSZip.loadAsync(buffer);
  const slides = await xmlFiles(zip, /^ppt\/slides\/slide\d+\.xml$/);

  for (const { name, xml } of slides) {
    const ids = [...xml.matchAll(/<p:cNvPr\b[^>]*\bid="(\d+)"/g)].map(match => match[1]);
    assert.equal(new Set(ids).size, ids.length, `${name} must not reuse a shape id`);
  }
});

// A real PNG of exact dimensions, so the exporter must read its intrinsic size.
function makePng(width, height) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = buf => {
    let c = 0xffffffff;
    for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, sum]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit truecolour
  const raw = Buffer.alloc(height * (width * 3 + 1)); // filter byte + RGB per row
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlibSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  return "data:image/png;base64," + png.toString("base64");
}

async function picGeometry(zip, pattern, objectName) {
  const EMU = 914400;
  const files = await xmlFiles(zip, pattern);
  for (const { xml } of files) {
    for (const m of xml.matchAll(/<p:pic>[\s\S]*?<\/p:pic>/g)) {
      if (!m[0].includes(`name="${objectName}"`)) continue;
      const ext = m[0].match(/<a:ext cx="(\d+)" cy="(\d+)"\/>/);
      if (ext) return { w: +ext[1] / EMU, h: +ext[2] / EMU };
    }
  }
  return null;
}

test("the brand logo keeps its aspect ratio inside the reserved corner", async () => {
  for (const [w, h] of [[135, 108], [400, 100], [100, 400]]) {
    const deck = DeckModel.create(["# T\nsub", "## Body\n\ntext"], { marked });
    const buffer = await exportDeckToPptx({
      deck, theme: {}, logo: makePng(w, h), outputType: "nodebuffer", onWarnings() {},
    });
    const zip = await JSZip.loadAsync(buffer);
    const box = await picGeometry(zip, /^ppt\/slideLayouts\/slideLayout\d+\.xml$/, "Brand logo");
    assert.ok(box, `logo ${w}x${h} should be placed`);
    assert.ok(Math.abs(box.w / box.h - w / h) < 0.02,
      `logo ${w}x${h}: expected aspect ${(w / h).toFixed(3)}, got ${(box.w / box.h).toFixed(3)}`);
    assert.ok(box.w <= 1.12 + 1e-6 && box.h <= 0.46 + 1e-6,
      `logo ${w}x${h} must stay inside the reserved 1.12x0.46 area, got ${box.w}x${box.h}`);
  }
});

test("a slide illustration keeps its aspect ratio inside its column", async () => {
  const deck = DeckModel.create(["# T\nsub", "## Illustrated\n\nA caption."], { marked });
  const buffer = await exportDeckToPptx({
    deck, theme: {}, images: [null, { data: makePng(1536, 1024), altText: "wide" }],
    outputType: "nodebuffer", onWarnings() {},
  });
  const zip = await JSZip.loadAsync(buffer);
  const box = await picGeometry(zip, /^ppt\/slides\/slide\d+\.xml$/, "Slide 2 illustration");
  assert.ok(box, "illustration should be placed");
  assert.ok(Math.abs(box.w / box.h - 1536 / 1024) < 0.02,
    `expected aspect 1.500, got ${(box.w / box.h).toFixed(3)}`);
});
