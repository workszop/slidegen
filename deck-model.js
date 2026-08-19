/* ============================================================
   deck-model — semantic Markdown deck model shared by HTML and
   PowerPoint renderers. It intentionally has no Markdown dependency:
   inject a Marked-compatible lexer in create(), or pass lexer output to
   fromTokens() in tests and non-browser renderers.
   ============================================================ */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.DeckModel = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  const DEFAULT_LIMITS = Object.freeze({
    maxTitleChars: 110,
    maxSubtitleChars: 240,
    maxBlocks: 9,
    maxListItems: 8,
    maxListDepth: 3,
    maxCodeLines: 14,
    maxTableRows: 9,
    maxTableColumns: 6,
    maxBodyChars: 1100,
  });

  // ─── Public API ─────────────────────────────────
  function create(slides, options = {}) {
    if (!Array.isArray(slides)) throw new TypeError("DeckModel.create expects an array of slide Markdown strings");
    const lexer = resolveLexer(options);
    const prepared = slides.map((markdown, index) => extractNotes(String(markdown ?? ""), index));
    const tokenLists = prepared.map(({ markdown }, index) => {
      try {
        const tokens = lexer(markdown);
        if (!Array.isArray(tokens)) throw new TypeError("lexer did not return an array");
        return tokens;
      } catch (error) {
        return [{ type: "error", raw: markdown, message: error.message || String(error) }];
      }
    });
    return fromTokens(tokenLists, {
      ...options,
      notes: prepared.map(item => item.notes),
      sourceWarnings: prepared.flatMap(item => item.warnings),
    });
  }

  function fromTokens(tokenLists, options = {}) {
    if (!Array.isArray(tokenLists)) throw new TypeError("DeckModel.fromTokens expects an array of token arrays");
    const limits = Object.assign({}, DEFAULT_LIMITS, options.limits);
    const deckWarnings = [...(options.sourceWarnings ?? [])];
    const slides = tokenLists.map((tokens, index) => {
      const slideWarnings = [];
      const blocks = blocksFromTokens(Array.isArray(tokens) ? tokens : [], slideWarnings);
      const notes = Array.isArray(options.notes?.[index]) ? options.notes[index] : [];
      const slide = buildSlide(index, blocks, notes, slideWarnings);
      slide.warnings.push(...validateSlide(slide, limits));
      return slide;
    });
    slides.forEach(slide => deckWarnings.push(...slide.warnings.map(warning => ({ ...warning, slide: slide.index }))));
    return {
      version: 1,
      slides,
      warnings: deckWarnings,
      stats: deckStats(slides),
    };
  }

  // ─── Lexer and source helpers ───────────────────
  function resolveLexer(options) {
    if (typeof options.lexer === "function") return options.lexer;
    if (typeof options.marked?.lexer === "function") return options.marked.lexer.bind(options.marked);
    if (typeof root?.marked?.lexer === "function") return root.marked.lexer.bind(root.marked);
    throw new TypeError("DeckModel.create needs options.lexer or options.marked.lexer");
  }

  // Notes are deliberately limited to a standalone HTML comment. This keeps
  // comments in normal Markdown content untouched and avoids a hidden syntax.
  function extractNotes(markdown, slide) {
    const notes = [];
    const warnings = [];
    const notePattern = /^<!--[ \t]*notes:[ \t]*\n?([\s\S]*?)-->[ \t]*$/gmi;
    const clean = markdown.replace(notePattern, (match, noteText) => {
      const text = String(noteText).trim();
      if (text) notes.push(text);
      else warnings.push(warning("empty_note", "Speaker-note comment is empty", { slide }));
      return "";
    });
    if (/<!--[ \t]*notes:/i.test(clean)) {
      warnings.push(warning("invalid_note", "Speaker notes must use a standalone <!-- notes: ... --> comment", { slide }));
    }
    return { markdown: clean, notes, warnings };
  }

  // ─── Tokens → semantic blocks ───────────────────
  function buildSlide(index, blocks, notes, warnings) {
    const visible = blocks.filter(block => block.type !== "definition" && block.type !== "divider");
    const primaryHeadings = visible.filter(block => block.type === "heading" && block.level <= 2);
    const firstHeading = primaryHeadings[0];
    const bodyBlocks = firstHeading ? blocks.filter(block => block !== firstHeading) : blocks;
    const renderableBody = bodyBlocks.filter(isRenderable);
    const title = firstHeading ? firstHeading.runs : [];
    const subtitle = firstHeading?.level === 1 && bodyBlocks[0]?.type === "paragraph"
      ? bodyBlocks[0].runs : [];
    const remainingBody = subtitle.length ? bodyBlocks.slice(1) : bodyBlocks;
    let type = "content";
    if (firstHeading?.level === 1) type = "title";
    else if (firstHeading?.level === 2 && !renderableBody.length) type = "section";
    if (primaryHeadings.length > 1) {
      warnings.push(warning("multiple_primary_headings", "More than one level-one or level-two heading may overlap in a fixed slide title area"));
    }
    return {
      index,
      type,
      title,
      subtitle,
      blocks: type === "title" ? remainingBody : (firstHeading ? bodyBlocks : blocks),
      notes,
      warnings,
    };
  }

  function blocksFromTokens(tokens, warnings) {
    return tokens.map(token => blockFromToken(token, warnings)).filter(Boolean);
  }

  function blockFromToken(token, warnings) {
    if (!token || typeof token !== "object") return unsupported(token, warnings, "invalid");
    switch (token.type) {
      case "heading": return { type: "heading", level: Number(token.depth) || 1, runs: inlineRuns(token.tokens, token.text) };
      case "paragraph": return { type: "paragraph", runs: inlineRuns(token.tokens, token.text) };
      case "text": return { type: "paragraph", runs: inlineRuns(token.tokens, token.text) };
      case "list": return listBlock(token, warnings);
      case "blockquote": return { type: "blockquote", blocks: blocksFromTokens(token.tokens ?? [], warnings) };
      case "code": return { type: "code", language: token.lang || null, text: token.text ?? "" };
      case "table": return tableBlock(token);
      case "hr": return { type: "divider" };
      case "space": return { type: "space" };
      case "def": return { type: "definition", id: token.tag ?? token.href ?? "" };
      case "html":
        warnings.push(warning("unsupported_html", "HTML is preserved as unsupported content and will not be safely rendered by every exporter", { raw: token.raw ?? token.text ?? "" }));
        return { type: "unsupported", tokenType: "html", raw: token.raw ?? token.text ?? "" };
      case "error":
        warnings.push(warning("lexer_error", `Markdown lexer failed: ${token.message ?? "unknown error"}`));
        return { type: "unsupported", tokenType: "error", raw: token.raw ?? "" };
      default: return unsupported(token, warnings);
    }
  }

  function listBlock(token, warnings) {
    return {
      type: "list",
      ordered: Boolean(token.ordered),
      start: Number.isFinite(token.start) ? token.start : 1,
      items: (token.items ?? []).map(item => {
        const blocks = blocksFromTokens(item.tokens ?? [], warnings);
        const paragraph = blocks.find(block => block.type === "paragraph");
        return {
          checked: typeof item.checked === "boolean" ? item.checked : null,
          runs: paragraph?.runs ?? inlineRuns(item.tokens?.[0]?.tokens, item.text),
          blocks,
        };
      }),
    };
  }

  function tableBlock(token) {
    const cell = source => ({ runs: inlineRuns(source?.tokens, source?.text ?? source?.raw ?? source ?? "") });
    return {
      type: "table",
      align: Array.isArray(token.align) ? token.align.map(value => value ?? null) : [],
      header: (token.header ?? []).map(cell),
      rows: (token.rows ?? []).map(row => (row ?? []).map(cell)),
    };
  }

  function unsupported(token, warnings, fallbackType) {
    const tokenType = token?.type ?? fallbackType ?? "unknown";
    const raw = typeof token === "string" ? token : (token?.raw ?? token?.text ?? "");
    warnings.push(warning("unsupported_token", `Unsupported Markdown token: ${tokenType}`, { tokenType, raw }));
    return { type: "unsupported", tokenType, raw };
  }

  // ─── Inline runs ─────────────────────────────────
  function inlineRuns(tokens, fallbackText = "", inherited = {}) {
    if (!Array.isArray(tokens)) return fallbackText ? [{ type: "text", text: String(fallbackText), ...inherited }] : [];
    const runs = [];
    tokens.forEach(token => {
      if (!token || typeof token !== "object") return;
      const format = { ...inherited };
      switch (token.type) {
        case "strong": runs.push(...inlineRuns(token.tokens, token.text, { ...format, bold: true })); break;
        case "em": runs.push(...inlineRuns(token.tokens, token.text, { ...format, italic: true })); break;
        case "del": runs.push(...inlineRuns(token.tokens, token.text, { ...format, strike: true })); break;
        case "codespan": runs.push({ type: "text", text: token.text ?? "", ...format, code: true }); break;
        case "link": {
          const linkFormat = { ...format, href: token.href ?? "", title: token.title ?? null };
          runs.push(...inlineRuns(token.tokens, token.text, linkFormat));
          break;
        }
        case "image": runs.push({ type: "image", src: token.href ?? "", alt: token.text ?? "", title: token.title ?? null, ...format }); break;
        case "br": runs.push({ type: "break" }); break;
        case "text": runs.push({ type: "text", text: token.text ?? token.raw ?? "", ...format }); break;
        case "escape": runs.push({ type: "text", text: token.text ?? "", ...format }); break;
        default:
          if (token.tokens?.length) runs.push(...inlineRuns(token.tokens, token.text, format));
          else if (token.text ?? token.raw) runs.push({ type: "text", text: token.text ?? token.raw, ...format });
      }
    });
    return runs;
  }

  // ─── Validation ─────────────────────────────────
  function validateSlide(slide, limits) {
    const warnings = [];
    const titleChars = runText(slide.title).length;
    const subtitleChars = runText(slide.subtitle).length;
    const bodyChars = runTextFromBlocks(slide.blocks).length;
    const bodyBlocks = slide.blocks.filter(isRenderable).length;
    if (titleChars > limits.maxTitleChars) warnings.push(warning("title_overflow_risk", `Title has ${titleChars} characters (recommended maximum: ${limits.maxTitleChars})`));
    if (subtitleChars > limits.maxSubtitleChars) warnings.push(warning("subtitle_overflow_risk", `Subtitle has ${subtitleChars} characters (recommended maximum: ${limits.maxSubtitleChars})`));
    if (bodyBlocks > limits.maxBlocks) warnings.push(warning("block_overflow_risk", `Slide has ${bodyBlocks} body blocks (recommended maximum: ${limits.maxBlocks})`));
    if (bodyChars > limits.maxBodyChars) warnings.push(warning("body_overflow_risk", `Slide body has ${bodyChars} characters (recommended maximum: ${limits.maxBodyChars})`));
    walkBlocks(slide.blocks, (block, depth) => {
      if (block.type === "list") {
        if (block.items.length > limits.maxListItems) warnings.push(warning("list_overflow_risk", `List has ${block.items.length} items (recommended maximum: ${limits.maxListItems})`));
        if (depth > limits.maxListDepth) warnings.push(warning("list_depth_risk", `List nesting depth ${depth} exceeds recommended maximum ${limits.maxListDepth}`));
      }
      if (block.type === "code" && String(block.text).split("\n").length > limits.maxCodeLines) warnings.push(warning("code_overflow_risk", `Code block has more than ${limits.maxCodeLines} lines`));
      if (block.type === "table") {
        if (block.rows.length + 1 > limits.maxTableRows) warnings.push(warning("table_rows_risk", `Table has more than ${limits.maxTableRows} rows including the header`));
        if (block.header.length > limits.maxTableColumns) warnings.push(warning("table_columns_risk", `Table has more than ${limits.maxTableColumns} columns`));
      }
    });
    return warnings;
  }

  function walkBlocks(blocks, visit, listDepth = 0) {
    (blocks ?? []).forEach(block => {
      const depth = block.type === "list" ? listDepth + 1 : listDepth;
      visit(block, depth);
      if (block.type === "blockquote") walkBlocks(block.blocks, visit, depth);
      if (block.type === "list") block.items.forEach(item => walkBlocks(item.blocks, visit, depth));
    });
  }

  function isRenderable(block) {
    return !["space", "definition", "divider"].includes(block.type);
  }
  function runText(runs) {
    return (runs ?? []).map(run => run.type === "break" ? "\n" : (run.type === "image" ? run.alt : run.text ?? "")).join("");
  }
  function runTextFromBlocks(blocks) {
    let text = "";
    walkBlocks(blocks, block => {
      if (block.runs) text += runText(block.runs);
      if (block.type === "code") text += block.text;
      if (block.type === "table") text += [...block.header, ...block.rows.flat()].map(cell => runText(cell.runs)).join("");
    });
    return text;
  }
  function deckStats(slides) {
    return {
      slideCount: slides.length,
      titleSlides: slides.filter(slide => slide.type === "title").length,
      sectionSlides: slides.filter(slide => slide.type === "section").length,
      notesCount: slides.reduce((count, slide) => count + slide.notes.length, 0),
    };
  }
  function warning(code, message, extra = {}) { return { code, message, ...extra }; }

  return Object.freeze({
    DEFAULT_LIMITS,
    create,
    fromTokens,
    inlineRuns,
  });
});
