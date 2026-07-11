/* ============================================================
   pptx-export — shared PPTX exporter for the eduapp deck apps.

   Maps the slide-markdown contract (title slide, ## slides,
   bullets, quotes, code, tables) onto a 16:9 PowerPoint file
   using PptxGenJS. Fonts are referenced by name, not embedded —
   machines without the Google font installed will substitute.

   UMD-ish: exposes window.exportDeckToPptx in the browser and
   module.exports in node (used by the verification harness).
   ============================================================ */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("pptxgenjs"), require("marked").marked);
  } else {
    root.exportDeckToPptx = factory(root.PptxGenJS, root.marked);
  }
})(typeof self !== "undefined" ? self : this, function (PptxGenJS, marked) {
  "use strict";

  const W = 10, H = 5.625;            // LAYOUT_16x9 inches
  const LEFT = 0.6, BODY_W = W - 1.2; // content column
  const TITLE_Y = 0.72;               // fixed heading position on every slide
  const BODY_Y = 1.55;

  // ─── Color helpers ──────────────────────────────
  function hex(c) {
    if (!c) return "000000";
    c = String(c).trim();
    if (c.startsWith("#")) {
      let h = c.slice(1);
      if (h.length === 3) h = [...h].map(x => x + x).join("");
      return h.slice(0, 6).toUpperCase();
    }
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return "000000";
    return m[1].split(",").slice(0, 3)
      .map(n => Math.round(Number(n)).toString(16).padStart(2, "0"))
      .join("").toUpperCase();
  }
  function mix(fg, bg, ratio) {
    const p = h => [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
    const [f, b] = [p(fg), p(bg)];
    return f.map((v, i) => Math.round(v * ratio + b[i] * (1 - ratio))
      .toString(16).padStart(2, "0")).join("").toUpperCase();
  }

  // ─── Inline markdown tokens → pptx text runs ────
  function inlineRuns(tokens, base, th) {
    const runs = [];
    (tokens ?? []).forEach(tok => {
      const o = Object.assign({}, base);
      switch (tok.type) {
        case "strong": o.bold = true; runs.push(...inlineRuns(tok.tokens, o, th)); return;
        case "em": o.italic = true; runs.push(...inlineRuns(tok.tokens, o, th)); return;
        case "codespan":
          o.fontFace = th.monoFont;
          runs.push({ text: tok.text, options: o }); return;
        case "link":
          o.hyperlink = { url: tok.href }; // inherited by child runs via the base copy
          runs.push(...inlineRuns(tok.tokens, o, th));
          return;
        case "br": runs.push({ text: "", options: Object.assign({}, base, { breakLine: true }) }); return;
        default:
          if (tok.tokens?.length) runs.push(...inlineRuns(tok.tokens, o, th));
          else if (tok.text) runs.push({ text: tok.text, options: o });
      }
    });
    return runs;
  }
  const plain = tokens => (tokens ?? []).map(t => t.tokens?.length ? plain(t.tokens) : (t.text ?? "")).join("");

  // ─── Main export ────────────────────────────────
  // opts: { slidesMd: string[], theme: {bg, fg, bodyColor?, accent,
  //         headingFont, bodyFont, monoFont}, logo?: dataURI,
  //         brandName?: string, images?: (dataURI|undefined)[], fileName: string }
  return async function exportDeckToPptx(opts) {
    const t = opts.theme;
    const th = {
      bg: hex(t.bg), fg: hex(t.fg), accent: hex(t.accent),
      headingFont: t.headingFont, bodyFont: t.bodyFont, monoFont: t.monoFont,
    };
    th.body = t.bodyColor ? hex(t.bodyColor) : mix(th.fg, th.bg, 0.74);
    th.faint = mix(th.fg, th.bg, 0.45);
    th.line = mix(th.fg, th.bg, 0.16);
    th.wash = mix(th.fg, th.bg, 0.07);
    th.accentSoft = mix(th.accent, th.bg, 0.18);

    const pptx = new PptxGenJS();
    pptx.layout = "LAYOUT_16x9";

    const masterObjects = [
      { rect: { x: 0, y: 0, w: W, h: 0.055, fill: { color: th.accent } } },
    ];
    if (opts.logo) {
      masterObjects.push({
        image: { data: opts.logo, x: W - 1.75, y: 0.22, w: 1.3, h: 0.55, sizing: { type: "contain", w: 1.3, h: 0.55 } },
      });
    }
    pptx.defineSlideMaster({ title: "DECK", background: { color: th.bg }, objects: masterObjects });

    const baseRun = { fontFace: th.bodyFont, color: th.body, fontSize: 15 };

    opts.slidesMd.forEach((md, idx) => {
      const slide = pptx.addSlide({ masterName: "DECK" });
      const tokens = marked.lexer(md);
      const illustration = opts.images?.[idx];
      const bodyW = illustration ? 5.25 : BODY_W;

      // Title slide: first `#` heading + intro paragraph, centered.
      const head = idx === 0 ? tokens.find(tok => tok.type === "heading" && tok.depth === 1) : null;
      if (head) {
        const para = tokens.find(tok => tok.type === "paragraph");
        if (opts.brandName) {
          slide.addText(opts.brandName.toUpperCase(), {
            x: 0.5, y: H / 2 - 1.7, w: W - 1, h: 0.4, align: "center",
            fontFace: th.monoFont, fontSize: 12, charSpacing: 4, color: th.accent,
          });
        }
        slide.addText(inlineRuns(head.tokens, { fontFace: th.headingFont, fontSize: 40, bold: true, color: th.fg }, th), {
          x: 0.5, y: H / 2 - 1.25, w: W - 1, h: 1.5, align: "center", valign: "middle", fit: "shrink",
        });
        if (para) {
          slide.addText(inlineRuns(para.tokens, { fontFace: th.bodyFont, fontSize: 18, color: th.body }, th), {
            x: 1, y: H / 2 + 0.35, w: W - 2, h: 0.7, align: "center", fit: "shrink",
          });
        }
        return;
      }

      if (illustration) {
        slide.addImage({
          data: illustration,
          x: 6.25, y: 1.42, w: 3.15, h: 3.55,
          sizing: { type: "contain", w: 3.15, h: 3.55 },
        });
      }

      let y = BODY_Y;
      const room = () => Math.max(H - 0.45 - y, 0.4);
      const headingRuns = (tok, size) =>
        inlineRuns(tok.tokens, { fontFace: th.headingFont, fontSize: size, bold: true, color: th.fg }, th);

      tokens.forEach(tok => {
        if (y >= H - 0.7 && tok.type !== "space") return; // overflow guard
        switch (tok.type) {
          case "heading": {
            if (tok.depth <= 2) {
              slide.addText(headingRuns(tok, 27), { x: LEFT, y: TITLE_Y, w: bodyW, h: 0.62, fit: "shrink" });
            } else {
              slide.addText(headingRuns(tok, 17), { x: LEFT, y, w: bodyW, h: 0.38, fit: "shrink" });
              y += 0.46;
            }
            break;
          }
          case "list": {
            const runs = [];
            tok.items.forEach(item => {
              const itemRuns = inlineRuns(item.tokens?.[0]?.tokens ?? [], baseRun, th);
              itemRuns.forEach((r, i) => {
                if (i === 0) r.options = Object.assign({}, r.options, { bullet: { code: "2022" }, indentLevel: 0 });
                if (i === itemRuns.length - 1) r.options = Object.assign({}, r.options, { breakLine: true });
              });
              runs.push(...itemRuns);
            });
            const hEst = Math.min(tok.items.length * 0.42, room());
            slide.addText(runs, { x: LEFT + 0.1, y, w: bodyW - 0.1, h: hEst, fit: "shrink", paraSpaceAfter: 8 });
            y += hEst + 0.12;
            break;
          }
          case "paragraph": {
            const lines = Math.max(1, Math.ceil(plain(tok.tokens).length / 95));
            const hEst = Math.min(lines * 0.3 + 0.08, room());
            slide.addText(inlineRuns(tok.tokens, baseRun, th), { x: LEFT, y, w: bodyW, h: hEst, fit: "shrink" });
            y += hEst + 0.12;
            break;
          }
          case "blockquote": {
            const text = plain(tok.tokens);
            const lines = Math.max(1, Math.ceil(text.length / 85));
            const hEst = Math.min(lines * 0.32 + 0.28, room());
            slide.addText(text, {
              x: LEFT, y, w: bodyW, h: hEst, fit: "shrink",
              fontFace: th.bodyFont, fontSize: 15, italic: true, color: th.fg,
              fill: { color: th.accentSoft }, margin: 10,
            });
            y += hEst + 0.16;
            break;
          }
          case "code": {
            const lines = tok.text.split("\n");
            const runs = lines.map((line, i) => ({
              text: line || " ",
              options: { fontFace: th.monoFont, fontSize: 12, color: th.fg, breakLine: i < lines.length - 1 },
            }));
            const hEst = Math.min(lines.length * 0.24 + 0.3, room());
            slide.addText(runs, { x: LEFT, y, w: bodyW, h: hEst, fill: { color: th.wash }, margin: 10, fit: "shrink" });
            y += hEst + 0.16;
            break;
          }
          case "table": {
            const header = tok.header.map(c => ({
              text: plain(c.tokens).toUpperCase(),
              options: { fontFace: th.monoFont, fontSize: 10, color: th.faint, bold: true },
            }));
            const rows = tok.rows.map(row => row.map(c => ({
              text: plain(c.tokens),
              options: { fontFace: th.bodyFont, fontSize: 13, color: th.body },
            })));
            slide.addTable([header, ...rows], {
              x: LEFT, y, w: bodyW,
              border: { type: "solid", pt: 0.75, color: th.line },
              fill: { color: th.bg }, valign: "middle", margin: 4,
            });
            y += Math.min((tok.rows.length + 1) * 0.34 + 0.1, room());
            break;
          }
          default: break; // space, hr, html — skip
        }
      });
    });

    return pptx.writeFile({ fileName: opts.fileName });
  };
});
