import { test } from "node:test";
import assert from "node:assert/strict";
import DeckModel from "../deck-model.js";

const t = (text, extra = {}) => ({ type: "text", text, ...extra });
const paragraph = (...tokens) => ({ type: "paragraph", tokens });
const heading = (depth, ...tokens) => ({ type: "heading", depth, tokens });

test("creates title, section, and content slides from injected lexer output", () => {
  const fixtures = new Map([
    ["title", [heading(1, t("Deck title")), paragraph(t("A short introduction."))]],
    ["section", [heading(2, t("Part one"))]],
    ["content", [heading(2, t("Content")), paragraph(t("Body"))]],
  ]);
  const deck = DeckModel.create(["title", "section", "content"], { lexer: input => fixtures.get(input) });
  assert.deepEqual(deck.slides.map(slide => slide.type), ["title", "section", "content"]);
  assert.equal(deck.slides[0].subtitle[0].text, "A short introduction.");
  assert.equal(deck.slides[2].blocks[0].type, "paragraph");
  assert.equal(deck.stats.titleSlides, 1);
});

test("preserves inline formatting, links, images and manual line breaks", () => {
  const tokens = [[paragraph(
    t("plain "),
    { type: "strong", tokens: [t("bold")] },
    { type: "em", tokens: [t("italic")] },
    { type: "codespan", text: "const x" },
    { type: "link", href: "https://example.test", title: "Example", tokens: [t("link")] },
    { type: "br" },
    { type: "image", href: "image.png", text: "Diagram", title: "Alt title" },
  )]];
  const deck = DeckModel.fromTokens(tokens);
  const runs = deck.slides[0].blocks[0].runs;
  assert.deepEqual(runs.map(run => run.type), ["text", "text", "text", "text", "text", "break", "image"]);
  assert.equal(runs[1].bold, true);
  assert.equal(runs[2].italic, true);
  assert.equal(runs[3].code, true);
  assert.equal(runs[4].href, "https://example.test");
  assert.equal(runs[6].alt, "Diagram");
});

test("preserves nested and ordered lists instead of flattening them", () => {
  const tokenLists = [[{
    type: "list", ordered: true, start: 3, items: [{
      tokens: [paragraph(t("First")), {
        type: "list", ordered: false, items: [{ tokens: [paragraph(t("Nested"))] }],
      }],
    }],
  }]];
  const list = DeckModel.fromTokens(tokenLists).slides[0].blocks[0];
  assert.equal(list.ordered, true);
  assert.equal(list.start, 3);
  assert.equal(list.items[0].runs[0].text, "First");
  assert.equal(list.items[0].blocks[1].items[0].runs[0].text, "Nested");
});

test("preserves formatted blockquotes, code, table alignment and table cell runs", () => {
  const tokenLists = [[
    { type: "blockquote", tokens: [paragraph({ type: "strong", tokens: [t("Quoted")] })] },
    { type: "code", lang: "js", text: "const x = 1;\nconsole.log(x);" },
    {
      type: "table", align: ["left", "right"],
      header: [{ tokens: [{ type: "em", tokens: [t("Name")] }] }, { tokens: [t("Value")] }],
      rows: [[{ tokens: [t("A")] }, { tokens: [{ type: "codespan", text: "1" }] }]],
    },
  ]];
  const blocks = DeckModel.fromTokens(tokenLists).slides[0].blocks;
  assert.equal(blocks[0].blocks[0].runs[0].bold, true);
  assert.equal(blocks[1].language, "js");
  assert.deepEqual(blocks[2].align, ["left", "right"]);
  assert.equal(blocks[2].header[0].runs[0].italic, true);
  assert.equal(blocks[2].rows[0][1].runs[0].code, true);
});

test("extracts conservative speaker notes and reports malformed notes and unsupported tokens", () => {
  const lexer = markdown => [paragraph(t(markdown.trim()))];
  const deck = DeckModel.create([
    "Visible\n<!-- notes: Explain the source. -->",
    "<!-- notes: broken",
  ], { lexer });
  assert.deepEqual(deck.slides[0].notes, ["Explain the source."]);
  assert.equal(deck.slides[0].blocks[0].runs[0].text, "Visible");
  assert.ok(deck.warnings.some(item => item.code === "invalid_note"));
  const unsupported = DeckModel.fromTokens([[{ type: "html", raw: "<video>" }]]);
  assert.equal(unsupported.slides[0].blocks[0].type, "unsupported");
  assert.ok(unsupported.warnings.some(item => item.code === "unsupported_html"));
});

test("flags overflow risks without discarding content", () => {
  const tooMany = Array.from({ length: 10 }, (_, index) => ({ tokens: [paragraph(t(`Item ${index}`))] }));
  const deck = DeckModel.fromTokens([[{
    type: "list", ordered: false, items: tooMany,
  }, { type: "code", text: Array.from({ length: 15 }, (_, index) => String(index)).join("\n") }]]);
  assert.equal(deck.slides[0].blocks[0].items.length, 10);
  assert.ok(deck.warnings.some(item => item.code === "list_overflow_risk"));
  assert.ok(deck.warnings.some(item => item.code === "code_overflow_risk"));
});
