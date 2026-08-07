/* ============================================================
   pptx-export — semantic, theme-native PowerPoint renderer.

   Content remains editable and uses PowerPoint placeholders,
   scheme colors, theme fonts, native lists and native tables.
   ============================================================ */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(
      require("pptxgenjs"),
      require("marked").marked,
      require("jszip"),
      require("./deck-model.js"),
      require("node:fs/promises"),
    );
  } else {
    root.exportDeckToPptx = factory(
      root.PptxGenJS,
      root.marked,
      root.JSZip,
      root.DeckModel,
      null,
    );
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (PptxGenJS, marked, JSZip, DeckModel, nodeFs) {
  "use strict";

  const W = 10;
  const H = 5.625;
  const LEFT = 0.62;
  const RIGHT = 0.62;
  const TITLE_Y = 0.54;
  const TITLE_H = 0.72;
  const BODY_Y = 1.42;
  const BODY_BOTTOM = 5.16;
  const BODY_H = BODY_BOTTOM - BODY_Y;
  const BODY_W = W - LEFT - RIGHT;
  const PAGE_CAPACITY = 11.5;
  const MAX_PARAGRAPH_CHARS = 620;
  const MAX_LIST_ITEMS = 7;
  const MAX_CODE_LINES = 12;
  const MAX_TABLE_ROWS = 8;
  // Reserved column for a slide illustration, shared by the TITLE_IMAGE layout
  // placeholder and the picture placed into it.
  const IMAGE_X = 6.04;
  const IMAGE_W = 3.34;

  // ─── Color helpers ──────────────────────────────
  function hex(color, fallback) {
    const value = String(color ?? "").trim();
    if (/^#[0-9a-f]{3}$/i.test(value)) {
      return value.slice(1).split("").map(char => char + char).join("").toUpperCase();
    }
    if (/^#[0-9a-f]{6,8}$/i.test(value)) return value.slice(1, 7).toUpperCase();
    const rgb = value.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
    if (rgb) {
      return rgb.slice(1, 4).map(channel =>
        Math.max(0, Math.min(255, Math.round(Number(channel))))
          .toString(16).padStart(2, "0")).join("").toUpperCase();
    }
    const srgb = value.match(/^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/i);
    if (srgb) {
      return srgb.slice(1, 4).map(channel =>
        Math.max(0, Math.min(255, Math.round(Number(channel) * 255)))
          .toString(16).padStart(2, "0")).join("").toUpperCase();
    }
    return fallback;
  }

  function mix(foreground, background, ratio) {
    const channels = value => [0, 2, 4].map(index => parseInt(value.slice(index, index + 2), 16));
    const fg = channels(foreground);
    const bg = channels(background);
    return fg.map((channel, index) =>
      Math.round(channel * ratio + bg[index] * (1 - ratio))
        .toString(16).padStart(2, "0")).join("").toUpperCase();
  }

  // XML 1.0 forbids most C0 control characters. PowerPoint and Google Slides
  // reject the whole package when one reaches a text run, so they are replaced
  // with a space — they usually arrive as separators in text copied out of a
  // PDF or spreadsheet, and dropping them would join adjacent words.
  const XML_ILLEGAL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g;

  function stripXmlIllegal(value) {
    return String(value).replace(XML_ILLEGAL, " ");
  }

  function sanitizeDeckText(value) {
    if (typeof value === "string") return stripXmlIllegal(value);
    if (Array.isArray(value)) return value.map(sanitizeDeckText);
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sanitizeDeckText(item)]));
    }
    return value;
  }

  function escapeXml(value) {
    return stripXmlIllegal(String(value ?? ""))
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  // ─── Deck normalization and pagination ──────────
  function resolveDeck(opts) {
    if (opts.deck?.slides && Array.isArray(opts.deck.slides)) return opts.deck;
    if (!DeckModel?.create) throw new Error("DeckModel is required when opts.deck is not supplied");
    return DeckModel.create(opts.slidesMd ?? [], { marked });
  }

  function runText(runs) {
    return (runs ?? []).map(run => {
      if (run.type === "break") return "\n";
      if (run.type === "image") return run.alt ?? "";
      return run.text ?? "";
    }).join("");
  }

  function splitRuns(runs, maxChars) {
    const groups = [];
    let current = [];
    let length = 0;
    (runs ?? []).forEach(run => {
      if (run.type === "break") {
        current.push(run);
        length += 1;
        return;
      }
      const text = String(run.type === "image" ? (run.alt ?? "") : (run.text ?? ""));
      let offset = 0;
      while (offset < text.length) {
        const room = Math.max(1, maxChars - length);
        let end = Math.min(text.length, offset + room);
        if (end < text.length) {
          const boundary = text.lastIndexOf(" ", end);
          if (boundary > offset + Math.floor(room * 0.55)) end = boundary + 1;
        }
        current.push({ ...run, type: "text", text: text.slice(offset, end) });
        length += end - offset;
        offset = end;
        if (length >= maxChars && offset < text.length) {
          groups.push(current);
          current = [];
          length = 0;
        }
      }
    });
    if (current.length || !groups.length) groups.push(current);
    return groups;
  }

  function blockUnits(block) {
    switch (block?.type) {
      case "heading": return 1.5;
      case "paragraph": return Math.max(1.25, Math.ceil(runText(block.runs).length / 135) * 0.9);
      case "list": return Math.max(1.5, listLineCount(block) * 0.95);
      case "blockquote": return Math.max(2, Math.ceil(blockText(block).length / 120) * 0.9 + 0.8);
      case "code": return Math.max(2, String(block.text ?? "").split("\n").length * 0.72 + 0.7);
      case "table": return Math.max(2.5, ((block.rows?.length ?? 0) + 1) * 0.82);
      case "divider": return 0.5;
      case "unsupported": return Math.max(1.25, Math.ceil(String(block.raw ?? "").length / 135));
      default: return 0;
    }
  }

  function listLineCount(block) {
    return (block.items ?? []).reduce((count, item) => {
      const nested = (item.blocks ?? []).filter(child => child.type === "list")
        .reduce((sum, child) => sum + listLineCount(child), 0);
      return count + 1 + nested;
    }, 0);
  }

  function blockText(block) {
    if (block?.runs) return runText(block.runs);
    if (block?.type === "blockquote") return (block.blocks ?? []).map(blockText).join("\n");
    return String(block?.raw ?? block?.text ?? "");
  }

  function splitBlock(block) {
    if (!block) return [];
    if (block.type === "paragraph" && runText(block.runs).length > MAX_PARAGRAPH_CHARS) {
      return splitRuns(block.runs, MAX_PARAGRAPH_CHARS)
        .map((runs, index) => ({ ...block, runs, continuation: index > 0 }));
    }
    if (block.type === "code") {
      const lines = String(block.text ?? "").split("\n");
      if (lines.length > MAX_CODE_LINES) {
        const pieces = [];
        for (let index = 0; index < lines.length; index += MAX_CODE_LINES) {
          pieces.push({
            ...block,
            text: lines.slice(index, index + MAX_CODE_LINES).join("\n"),
            continuation: index > 0,
          });
        }
        return pieces;
      }
    }
    if (block.type === "table" && (block.rows?.length ?? 0) > MAX_TABLE_ROWS) {
      const pieces = [];
      for (let index = 0; index < block.rows.length; index += MAX_TABLE_ROWS) {
        pieces.push({
          ...block,
          rows: block.rows.slice(index, index + MAX_TABLE_ROWS),
          continuation: index > 0,
        });
      }
      return pieces;
    }
    if (block.type === "list" && (block.items?.length ?? 0) > MAX_LIST_ITEMS) {
      const pieces = [];
      for (let index = 0; index < block.items.length; index += MAX_LIST_ITEMS) {
        pieces.push({
          ...block,
          items: block.items.slice(index, index + MAX_LIST_ITEMS),
          start: (block.start ?? 1) + index,
          continuation: index > 0,
        });
      }
      return pieces;
    }
    return [block];
  }

  function paginate(blocks) {
    const renderable = (blocks ?? [])
      .filter(block => !["space", "definition"].includes(block.type))
      .flatMap(splitBlock);
    if (!renderable.length) return [[]];
    const pages = [];
    let page = [];
    let used = 0;
    renderable.forEach(block => {
      const units = Math.min(PAGE_CAPACITY, blockUnits(block));
      if (page.length && used + units > PAGE_CAPACITY) {
        pages.push(page);
        page = [];
        used = 0;
      }
      page.push(block);
      used += units;
    });
    if (page.length) pages.push(page);
    return pages;
  }

  function preflight(deck, pagesBySlide) {
    const warnings = [...(deck.warnings ?? [])];
    pagesBySlide.forEach((pages, index) => {
      const titleContinuation = deck.slides[index]?.type === "title"
        && pages.some(page => page.length);
      if (pages.length > 1 || titleContinuation) {
        const outputSlides = pages.length + (titleContinuation ? 1 : 0);
        warnings.push({
          code: "pptx_continuation_created",
          slide: index,
          message: `Slide ${index + 1} required ${outputSlides} PowerPoint slides; continuation slides were created`,
        });
      }
    });
    return warnings;
  }

  // ─── Image geometry ─────────────────────────────
  // PptxGenJS writes the requested w/h straight into <a:ext> and does not
  // decode base64 images, so its sizing:{type:"contain"} never shrinks the
  // frame and any picture whose aspect ratio differs from the box is
  // stretched. Read the intrinsic size from the data URI and fit the box here.
  function base64Bytes(base64) {
    if (typeof atob === "function") {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      return bytes;
    }
    if (typeof Buffer !== "undefined") return new Uint8Array(Buffer.from(base64, "base64"));
    return null;
  }

  function pixelSize(bytes) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    // PNG: 8-byte signature, then an IHDR chunk carrying width/height.
    if (bytes.length > 24 && view.getUint32(0) === 0x89504e47) {
      return { w: view.getUint32(16), h: view.getUint32(20) };
    }
    // GIF: logical screen descriptor, little-endian.
    if (bytes.length > 10 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
      return { w: view.getUint16(6, true), h: view.getUint16(8, true) };
    }
    // JPEG: walk the segment chain to the frame header.
    if (bytes.length > 4 && view.getUint16(0) === 0xffd8) {
      let offset = 2;
      while (offset + 9 < bytes.length) {
        if (bytes[offset] !== 0xff) { offset += 1; continue; }
        const marker = bytes[offset + 1];
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          return { w: view.getUint16(offset + 7), h: view.getUint16(offset + 5) };
        }
        if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { offset += 2; continue; }
        offset += 2 + view.getUint16(offset + 2);
      }
    }
    return null;
  }

  function imageAspect(data) {
    const match = /^data:image\/[a-z.+-]+;base64,([\s\S]+)$/i.exec(String(data ?? "").trim());
    if (!match) return null;
    let bytes;
    try { bytes = base64Bytes(match[1].replace(/\s+/g, "")); } catch { return null; }
    if (!bytes || !bytes.length) return null;
    const size = pixelSize(bytes);
    return size?.w > 0 && size?.h > 0 ? size.w / size.h : null;
  }

  // Largest w/h with the image's aspect ratio that fits inside box, anchored by
  // `align`. Unreadable formats keep the full box, which is the previous
  // behaviour rather than a new guess.
  function containImage(data, box, align = {}) {
    const aspect = imageAspect(data);
    if (!aspect) return { x: box.x, y: box.y, w: box.w, h: box.h };
    const w = Math.min(box.w, box.h * aspect);
    const h = w / aspect;
    const x = align.x === "right" ? box.x + box.w - w
      : align.x === "center" ? box.x + (box.w - w) / 2
        : box.x;
    const y = align.y === "bottom" ? box.y + box.h - h
      : align.y === "top" ? box.y
        : box.y + (box.h - h) / 2;
    return { x, y, w, h };
  }

  // ─── Theme-native masters ───────────────────────
  function masterDecoration(SC, logo) {
    const objects = [{
      rect: {
        x: 0, y: 0, w: W, h: 0.055,
        fill: { color: SC.accent1 },
        line: { color: SC.accent1, transparency: 100 },
        objectName: "Brand accent",
      },
    }];
    if (logo) {
      const image = typeof logo === "string" ? { data: logo } : logo;
      // Right-aligned in the reserved corner so the mark keeps its position
      // against the slide edge whatever its proportions.
      const frame = containImage(image.data, { x: W - 1.66, y: 0.18, w: 1.12, h: 0.46 }, { x: "right" });
      objects.push({
        image: {
          ...image,
          ...frame,
          altText: image.altText ?? "Brand logo",
          objectName: "Brand logo",
        },
      });
    }
    return objects;
  }

  function placeholder(name, type, x, y, w, h, options = {}) {
    return {
      placeholder: {
        text: "",
        options: { name, type, x, y, w, h, margin: 0, ...options },
      },
    };
  }

  function defineMasters(pptx, SC, logo) {
    const common = {
      background: { color: SC.background1 },
      slideNumber: {
        x: 9.2, y: 5.25, w: 0.32, h: 0.18,
        fontSize: 9, color: SC.text1, transparency: 40,
        align: "right", margin: 0,
      },
    };
    const title = options => placeholder(
      "title", "title", LEFT, TITLE_Y, BODY_W, TITLE_H,
      { fontSize: 27, bold: true, color: SC.text1, ...options },
    );
    const body = (name, x, y, w, h, options = {}) => placeholder(
      name, "body", x, y, w, h,
      { fontSize: 15, color: SC.text1, valign: "top", ...options },
    );

    pptx.defineSlideMaster({
      title: "TITLE",
      ...common,
      objects: [
        ...masterDecoration(SC, logo),
        title({ x: 0.8, y: 1.65, w: 8.4, h: 1.25, fontSize: 40, align: "center", valign: "middle" }),
        body("subtitle", 1.15, 3.08, 7.7, 0.85, { fontSize: 18, align: "center" }),
      ],
    });
    pptx.defineSlideMaster({
      title: "TITLE_BODY",
      ...common,
      objects: [
        ...masterDecoration(SC, logo),
        title(),
        body("body", LEFT, BODY_Y, BODY_W, BODY_H),
      ],
    });
    pptx.defineSlideMaster({
      title: "TITLE_TWO_COLUMN",
      ...common,
      objects: [
        ...masterDecoration(SC, logo),
        title(),
        body("body_left", LEFT, BODY_Y, 4.18, BODY_H),
        body("body_right", 5.2, BODY_Y, 4.18, BODY_H),
      ],
    });
    pptx.defineSlideMaster({
      title: "TITLE_TABLE",
      ...common,
      objects: [
        ...masterDecoration(SC, logo),
        title(),
        placeholder("table", "table", LEFT, BODY_Y, BODY_W, BODY_H),
      ],
    });
    pptx.defineSlideMaster({
      title: "TITLE_IMAGE",
      ...common,
      objects: [
        ...masterDecoration(SC, logo),
        title(),
        body("body", LEFT, BODY_Y, 5.05, BODY_H),
        placeholder("image", "image", IMAGE_X, BODY_Y, IMAGE_W, BODY_H),
      ],
    });
    pptx.defineSlideMaster({
      title: "SECTION",
      ...common,
      objects: [
        ...masterDecoration(SC, logo),
        title({ x: 0.95, y: 1.9, w: 8.1, h: 1.1, fontSize: 36, align: "center", valign: "middle" }),
        body("body", 1.35, 3.12, 7.3, 0.72, { fontSize: 17, align: "center" }),
      ],
    });
  }

  // ─── Text, list, table and block rendering ──────
  function toTextRuns(runs, SC, theme, base = {}) {
    const output = [];
    (runs ?? []).forEach(run => {
      if (run.type === "break") {
        output.push({ text: "", options: { ...base, breakLine: true } });
        return;
      }
      const text = run.type === "image" ? (run.alt ?? "") : String(run.text ?? "");
      if (!text) return;
      const options = {
        color: SC.text1,
        ...base,
        bold: Boolean(run.bold || base.bold),
        italic: Boolean(run.italic || base.italic),
        strike: Boolean(run.strike || base.strike),
      };
      if (run.code) options.fontFace = theme.monoFont;
      if (run.href) options.hyperlink = { url: run.href, tooltip: run.title ?? undefined };
      output.push({ text, options });
    });
    return output.length ? output : [{ text: " ", options: { color: SC.text1, ...base } }];
  }

  function listRuns(block, SC, theme, depth = 0, output = [], sequenceStart) {
    const start = sequenceStart ?? block.start ?? 1;
    (block.items ?? []).forEach((item, index) => {
      const runs = toTextRuns(item.runs, SC, theme, { fontSize: 14 });
      runs[0].options = {
        ...runs[0].options,
        indentLevel: Math.min(depth, 8),
        bullet: block.ordered
          ? { type: "number", numberType: "arabicPeriod", numberStartAt: start + index, indent: 16 + depth * 8 }
          : { characterCode: "2022", indent: 16 + depth * 8 },
      };
      runs[runs.length - 1].options = { ...runs[runs.length - 1].options, breakLine: true };
      output.push(...runs);
      (item.blocks ?? []).filter(child => child.type === "list")
        .forEach(child => listRuns(child, SC, theme, depth + 1, output));
    });
    return output;
  }

  function quoteRuns(block, SC, theme) {
    const runs = [];
    (block.blocks ?? []).forEach((child, index) => {
      if (child.type === "list") runs.push(...listRuns(child, SC, theme));
      else runs.push(...toTextRuns(child.runs ?? [{ type: "text", text: blockText(child) }], SC, theme, {
        fontSize: 14, italic: true,
      }));
      if (index < block.blocks.length - 1 && runs.length) {
        runs[runs.length - 1].options = { ...runs[runs.length - 1].options, breakLine: true };
      }
    });
    return runs.length ? runs : toTextRuns([{ type: "text", text: blockText(block) }], SC, theme, {
      fontSize: 14, italic: true,
    });
  }

  function tableCell(cell, SC, theme, align, header) {
    return {
      text: toTextRuns(cell?.runs, SC, theme, {
        fontSize: header ? 11 : 12.5,
        bold: header,
        color: header ? SC.background1 : SC.text1,
      }),
      options: {
        align: align || "left",
        valign: "middle",
        fill: { color: header ? SC.accent1 : SC.background1 },
        color: header ? SC.background1 : SC.text1,
        margin: 4,
      },
    };
  }

  function renderBlock(slide, block, box, context) {
    const { SC, theme, index } = context;
    const height = Math.max(0.18, box.h);
    const common = {
      x: box.x, y: box.y, w: box.w, h: height,
      margin: 0, fit: "shrink", breakLine: false,
    };
    switch (block.type) {
      case "heading":
        slide.addText(toTextRuns(block.runs, SC, theme, {
          fontSize: block.level <= 3 ? 18 : 16,
          bold: true,
          color: SC.text1,
        }), { ...common, objectName: `Secondary heading ${index}` });
        break;
      case "paragraph":
        slide.addText(toTextRuns(block.runs, SC, theme, { fontSize: 15, color: SC.text1 }), {
          ...common, objectName: `Paragraph ${index}`,
        });
        break;
      case "list":
        slide.addText(listRuns(block, SC, theme), {
          ...common, paraSpaceAfterPt: 7, breakLine: false, objectName: `List ${index}`,
        });
        break;
      case "blockquote":
        slide.addShape(PptxGenJS.ShapeType?.rect ?? "rect", {
          ...common,
          fill: { color: SC.accent1, transparency: 84 },
          line: { color: SC.accent1, width: 1.25 },
          objectName: `Quote background ${index}`,
        });
        slide.addText(quoteRuns(block, SC, theme), {
          x: box.x + 0.18, y: box.y + 0.12, w: box.w - 0.36, h: Math.max(0.15, height - 0.24),
          margin: 0, fit: "shrink", objectName: `Quote text ${index}`,
        });
        break;
      case "code": {
        slide.addShape(PptxGenJS.ShapeType?.rect ?? "rect", {
          ...common,
          fill: { color: SC.background2 },
          line: { color: SC.text1, transparency: 78, width: 0.75 },
          objectName: `Code background ${index}`,
        });
        const lines = String(block.text ?? "").split("\n");
        const runs = lines.map((line, lineIndex) => ({
          text: line || " ",
          options: {
            fontFace: theme.monoFont,
            fontSize: 11.5,
            color: SC.text1,
            breakLine: lineIndex < lines.length - 1,
          },
        }));
        slide.addText(runs, {
          x: box.x + 0.16, y: box.y + 0.12, w: box.w - 0.32, h: Math.max(0.15, height - 0.24),
          margin: 0, fit: "shrink", objectName: `Code text ${index}`,
        });
        break;
      }
      case "table": {
        const align = block.align ?? [];
        const rows = [
          (block.header ?? []).map((cell, cellIndex) => tableCell(cell, SC, theme, align[cellIndex], true)),
          ...(block.rows ?? []).map(row =>
            row.map((cell, cellIndex) => tableCell(cell, SC, theme, align[cellIndex], false))),
        ];
        slide.addTable(rows, {
          ...common,
          ...(context.tablePlaceholder ? { placeholder: "table" } : {}),
          border: { type: "solid", pt: 0.65, color: SC.text1, transparency: 72 },
          fill: { color: SC.background1 },
          color: SC.text1,
          valign: "middle",
          margin: 4,
          autoFit: false,
          objectName: `Table ${index}`,
        });
        break;
      }
      case "divider":
        slide.addShape(PptxGenJS.ShapeType?.line ?? "line", {
          x: box.x, y: box.y + 0.1, w: box.w, h: 0,
          line: { color: SC.accent1, transparency: 35, width: 1 },
          objectName: `Divider ${index}`,
        });
        break;
      case "unsupported":
        slide.addText(toTextRuns([{
          type: "text",
          text: String(block.raw || `[Unsupported ${block.tokenType || "content"}]`),
        }], SC, theme, { fontSize: 12 }), {
          ...common, objectName: `Unsupported content ${index}`,
        });
        break;
      default:
        if (blockText(block)) {
          slide.addText(toTextRuns([{ type: "text", text: blockText(block) }], SC, theme, {
            fontSize: 14,
          }), { ...common, objectName: `Content ${index}` });
        }
    }
  }

  function renderBlockColumn(slide, blocks, box, context) {
    const totalUnits = Math.max(1, blocks.reduce((sum, block) => sum + blockUnits(block), 0));
    let y = box.y;
    blocks.forEach((block, index) => {
      const proportional = box.h * (blockUnits(block) / totalUnits);
      const h = Math.max(0.18, proportional - (index < blocks.length - 1 ? 0.1 : 0));
      renderBlock(slide, block, { x: box.x, y, w: box.w, h }, { ...context, index: index + 1 });
      y += proportional;
    });
  }

  function shouldUseTwoColumns(blocks) {
    return blocks.length >= 5
      && blocks.every(block => ["heading", "paragraph", "list", "divider"].includes(block.type))
      && blocks.reduce((sum, block) => sum + blockUnits(block), 0) <= PAGE_CAPACITY;
  }

  function splitColumns(blocks) {
    const target = blocks.reduce((sum, block) => sum + blockUnits(block), 0) / 2;
    let accumulated = 0;
    let splitAt = 1;
    for (let index = 0; index < blocks.length - 1; index += 1) {
      accumulated += blockUnits(blocks[index]);
      splitAt = index + 1;
      if (accumulated >= target) break;
    }
    return [blocks.slice(0, splitAt), blocks.slice(splitAt)];
  }

  function addTitle(slide, runs, SC, theme, name = "title") {
    slide.addText(toTextRuns(runs, SC, theme, {
      fontSize: 27, bold: true, color: SC.text1,
    }), { placeholder: name, fit: "shrink", margin: 0, objectName: "Slide title" });
  }

  function continuedTitle(runs, language) {
    const suffix = language === "pl" ? " (ciąg dalszy)" : " (continued)";
    const result = (runs ?? []).map(run => ({ ...run }));
    const lastText = [...result].reverse().find(run => run.type === "text");
    if (lastText) lastText.text = `${lastText.text}${suffix}`;
    else result.push({ type: "text", text: suffix.trim() });
    return result;
  }

  function normalizeImage(image, slideIndex) {
    if (!image) return null;
    if (typeof image === "string") {
      return { data: image, altText: `Illustration for slide ${slideIndex + 1}` };
    }
    return {
      ...image,
      altText: image.altText || image.alt || `Illustration for slide ${slideIndex + 1}`,
    };
  }

  // ─── OOXML theme post-processing and output ─────
  function replaceThemeColor(xml, tag, color) {
    const pattern = new RegExp(`<a:${tag}>[\\s\\S]*?<\\/a:${tag}>`);
    return xml.replace(pattern, `<a:${tag}><a:srgbClr val="${color}"/></a:${tag}>`);
  }

  function repairPlaceholderTypes(xml) {
    // PptxGenJS 4.0.1 emits pic/tbl placeholders without their type
    // attribute. Keep the documented placeholder API above and repair the
    // resulting OOXML until the upstream serializer handles these types.
    const placeholderType = /<p:cSld name="TITLE_IMAGE">/.test(xml)
      ? "pic"
      : (/<p:cSld name="TITLE_TABLE">/.test(xml) ? "tbl" : null);
    if (!placeholderType) return xml;
    return xml.replace(/<p:ph[\s\S]*?\/>/g, match =>
      /\stype=/.test(match) ? match : match.replace("<p:ph", `<p:ph type="${placeholderType}"`));
  }

  // PptxGenJS 4.0.1 numbers tables independently of text shapes, so a table
  // sharing a slide with other content collides with an existing shape id.
  // Ids must be unique within one spTree; PowerPoint repairs the file and
  // Google Slides rejects it. Renumber the duplicates above the current max.
  function repairShapeIds(xml) {
    const pattern = /(<p:cNvPr\b[^>]*\bid=")(\d+)(")/g;
    let next = 0;
    for (const match of xml.matchAll(pattern)) next = Math.max(next, Number(match[2]));
    const seen = new Set();
    return xml.replace(pattern, (full, head, id, tail) => {
      if (!seen.has(id)) {
        seen.add(id);
        return full;
      }
      next += 1;
      seen.add(String(next));
      return head + next + tail;
    });
  }

  async function patchPackage(bytes, palette, metadata, outputType) {
    const zip = await JSZip.loadAsync(bytes);
    const themeFile = zip.file("ppt/theme/theme1.xml");
    if (!themeFile) throw new Error("Generated presentation is missing ppt/theme/theme1.xml");
    let themeXml = await themeFile.async("string");
    const colors = {
      dk1: palette.fg,
      lt1: palette.bg,
      dk2: palette.body,
      lt2: palette.wash,
      accent1: palette.accent,
      accent2: mix(palette.accent, palette.fg, 0.55),
      accent3: mix(palette.accent, palette.bg, 0.58),
      accent4: mix(palette.fg, palette.bg, 0.58),
      accent5: mix(palette.accent, palette.bg, 0.36),
      accent6: mix(palette.fg, palette.bg, 0.36),
      hlink: palette.accent,
      folHlink: mix(palette.accent, palette.fg, 0.65),
    };
    Object.entries(colors).forEach(([tag, color]) => {
      themeXml = replaceThemeColor(themeXml, tag, color);
    });
    themeXml = themeXml
      .replace(/<a:clrScheme name="[^"]*">/, `<a:clrScheme name="${escapeXml(metadata.themeName)}">`)
      .replace(/<a:fontScheme name="[^"]*">/, `<a:fontScheme name="${escapeXml(metadata.themeName)}">`);
    zip.file("ppt/theme/theme1.xml", themeXml);

    await Promise.all(Object.keys(zip.files)
      .filter(path => /^ppt\/slideLayouts\/slideLayout\d+\.xml$/.test(path))
      .map(async path => {
        const file = zip.file(path);
        const xml = await file.async("string");
        zip.file(path, repairPlaceholderTypes(xml));
      }));

    await Promise.all(Object.keys(zip.files)
      .filter(path => /^ppt\/slides\/slide\d+\.xml$/.test(path))
      .map(async path => {
        const xml = await zip.file(path).async("string");
        zip.file(path, repairShapeIds(xml));
      }));

    if (metadata.language) {
      const coreFile = zip.file("docProps/core.xml");
      if (coreFile) {
        let coreXml = await coreFile.async("string");
        if (/<dc:language>[\s\S]*?<\/dc:language>/.test(coreXml)) {
          coreXml = coreXml.replace(
            /<dc:language>[\s\S]*?<\/dc:language>/,
            `<dc:language>${escapeXml(metadata.language)}</dc:language>`,
          );
        } else {
          coreXml = coreXml.replace(
            /<\/cp:coreProperties>/,
            `<dc:language>${escapeXml(metadata.language)}</dc:language></cp:coreProperties>`,
          );
        }
        zip.file("docProps/core.xml", coreXml);
      }
    }
    return zip.generateAsync({ type: outputType, compression: "DEFLATE" });
  }

  async function outputPresentation(pptx, opts, palette, metadata) {
    const generated = await pptx.write({ outputType: "uint8array", compression: true });
    const isBrowser = typeof window !== "undefined" && typeof document !== "undefined";
    const requestedType = opts.outputType || (isBrowser ? "blob" : "nodebuffer");
    const data = await patchPackage(generated, palette, metadata, requestedType);
    if (opts.outputType) return data;
    const fileName = opts.fileName || "presentation.pptx";
    if (!isBrowser) {
      if (!nodeFs?.writeFile) throw new Error("Node file output is unavailable");
      await nodeFs.writeFile(fileName, data);
      return fileName;
    }
    const blob = data instanceof Blob ? data : new Blob([data], {
      type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return fileName;
  }

  // ─── Public API ─────────────────────────────────
  return async function exportDeckToPptx(opts = {}) {
    if (!PptxGenJS || !JSZip) throw new Error("PptxGenJS and JSZip are required for PowerPoint export");
    const deck = sanitizeDeckText(resolveDeck(opts));
    const inputTheme = opts.theme ?? {};
    const palette = {
      bg: hex(inputTheme.bg, "FFFFFF"),
      fg: hex(inputTheme.fg, "172033"),
      accent: hex(inputTheme.accent, "356AE6"),
    };
    palette.body = mix(palette.fg, palette.bg, 0.76);
    palette.wash = mix(palette.fg, palette.bg, 0.08);
    const theme = {
      headingFont: inputTheme.headingFont || "Aptos Display",
      bodyFont: inputTheme.bodyFont || "Aptos",
      monoFont: inputTheme.monoFont || "Aptos Mono",
    };

    const pptx = new PptxGenJS();
    pptx.layout = "LAYOUT_16x9";
    pptx.theme = {
      headFontFace: theme.headingFont,
      bodyFontFace: theme.bodyFont,
    };
    const titleText = runText(deck.slides?.[0]?.title) || opts.brandName || "Presentation";
    pptx.author = opts.brandName || opts.company || "Doc2Slide";
    pptx.company = opts.company || opts.brandName || "";
    pptx.subject = titleText;
    pptx.title = titleText;
    pptx.revision = "1";
    const language = opts.language || "en";

    const SC = pptx.SchemeColor;
    defineMasters(pptx, SC, opts.logo);

    const pagesBySlide = deck.slides.map(slide => paginate(slide.blocks));
    const warnings = preflight(deck, pagesBySlide);
    if (warnings.length) {
      if (typeof opts.onWarnings === "function") opts.onWarnings(warnings);
      else if (typeof console !== "undefined" && console.warn) {
        console.warn(`PowerPoint export preflight produced ${warnings.length} warning(s)`, warnings);
      }
    }

    deck.slides.forEach((sourceSlide, sourceIndex) => {
      const pages = pagesBySlide[sourceIndex];
      const illustration = normalizeImage(opts.images?.[sourceIndex], sourceIndex);

      if (sourceSlide.type === "title") {
        const titleSlide = pptx.addSlide({ masterName: "TITLE" });
        addTitle(titleSlide, sourceSlide.title, SC, theme);
        titleSlide.addText(toTextRuns(sourceSlide.subtitle, SC, theme, {
          fontSize: 18, color: SC.text1,
        }), {
          placeholder: "subtitle", fit: "shrink", margin: 0,
          objectName: "Slide subtitle",
        });
        if (opts.brandName) {
          titleSlide.addText(opts.brandName.toUpperCase(), {
            x: 2, y: 1.25, w: 6, h: 0.26,
            align: "center", charSpacing: 3, fontSize: 10,
            color: SC.accent1, margin: 0,
            objectName: "Brand name",
          });
        }
        if (sourceSlide.notes?.length) titleSlide.addNotes(sourceSlide.notes.join("\n\n"));
        pages.filter(page => page.length).forEach((page, pageIndex) => {
          const continuation = pptx.addSlide({ masterName: "TITLE_BODY" });
          addTitle(continuation, continuedTitle(sourceSlide.title, language), SC, theme);
          continuation.addText(" ", { placeholder: "body", objectName: "Body placeholder" });
          renderBlockColumn(continuation, page, {
            x: LEFT, y: BODY_Y, w: BODY_W, h: BODY_H,
          }, { SC, theme, pageIndex });
        });
        return;
      }

      pages.forEach((page, pageIndex) => {
        const isFirst = pageIndex === 0;
        let masterName = sourceSlide.type === "section" && isFirst
          ? "SECTION"
          : (illustration && isFirst ? "TITLE_IMAGE" : "TITLE_BODY");
        if (masterName === "TITLE_BODY" && page.length === 1 && page[0].type === "table") {
          masterName = "TITLE_TABLE";
        }
        if (masterName === "TITLE_BODY" && shouldUseTwoColumns(page)) masterName = "TITLE_TWO_COLUMN";
        const slide = pptx.addSlide({ masterName });
        addTitle(
          slide,
          pageIndex ? continuedTitle(sourceSlide.title, language) : sourceSlide.title,
          SC,
          theme,
        );
        if (sourceSlide.notes?.length && isFirst) slide.addNotes(sourceSlide.notes.join("\n\n"));

        if (masterName === "SECTION") {
          slide.addText(toTextRuns(sourceSlide.subtitle, SC, theme, {
            fontSize: 17, color: SC.text1,
          }), { placeholder: "body", fit: "shrink", margin: 0, objectName: "Section subtitle" });
          if (page.length) {
            renderBlockColumn(slide, page, {
              x: 1.35, y: 3.12, w: 7.3, h: 1.45,
            }, { SC, theme, pageIndex });
          }
          return;
        }

        if (masterName === "TITLE_IMAGE") {
          slide.addText(" ", { placeholder: "body", objectName: "Body placeholder" });
          // Explicit geometry rather than the placeholder's own box: the frame
          // has to match the picture's aspect ratio, and it stays centred in
          // the area the TITLE_IMAGE layout reserves for it.
          slide.addImage({
            ...illustration,
            ...containImage(illustration.data, { x: IMAGE_X, y: BODY_Y, w: IMAGE_W, h: BODY_H }, { x: "center" }),
            placeholder: "image",
            objectName: `Slide ${sourceIndex + 1} illustration`,
          });
          renderBlockColumn(slide, page, {
            x: LEFT, y: BODY_Y, w: 5.05, h: BODY_H,
          }, { SC, theme, pageIndex });
          return;
        }

        if (masterName === "TITLE_TABLE") {
          renderBlockColumn(slide, page, {
            x: LEFT, y: BODY_Y, w: BODY_W, h: BODY_H,
          }, { SC, theme, pageIndex, tablePlaceholder: true });
          return;
        }

        if (masterName === "TITLE_TWO_COLUMN") {
          slide.addText(" ", { placeholder: "body_left", objectName: "Left body placeholder" });
          slide.addText(" ", { placeholder: "body_right", objectName: "Right body placeholder" });
          const [left, right] = splitColumns(page);
          renderBlockColumn(slide, left, {
            x: LEFT, y: BODY_Y, w: 4.18, h: BODY_H,
          }, { SC, theme, pageIndex });
          renderBlockColumn(slide, right, {
            x: 5.2, y: BODY_Y, w: 4.18, h: BODY_H,
          }, { SC, theme, pageIndex });
          return;
        }

        slide.addText(" ", { placeholder: "body", objectName: "Body placeholder" });
        renderBlockColumn(slide, page, {
          x: LEFT, y: BODY_Y, w: BODY_W, h: BODY_H,
        }, { SC, theme, pageIndex });
      });
    });

    return outputPresentation(pptx, opts, palette, {
      language,
      themeName: opts.brandName || opts.company || "Custom",
    });
  };
});
