// Loads the PDF tools, fits the text to the boxes and builds the filled PDF.
/* =====================================================================
   PDF ENGINE
   Fills the official PDF in the browser with pdf-lib and keeps only the
   form pages. Nothing leaves the device.
   ===================================================================== */
const loaded = {};
const LOAD_TIMEOUT_MS = 120000; // the whole download, which is about 1.6 MB for the largest form
function loadScript({ src, integrity }) {
  if (!loaded[src]) loaded[src] = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    const fail = () => { clearTimeout(timer); delete loaded[src]; s.remove(); reject(new Error("load")); };
    const timer = setTimeout(fail, LOAD_TIMEOUT_MS); // a stalled connection never reports an error
    s.src = src;
    if (integrity) { s.integrity = integrity; s.crossOrigin = "anonymous"; }
    s.onload = () => { clearTimeout(timer); resolve(); };
    s.onerror = fail;
    document.head.appendChild(s);
  });
  return loaded[src];
}
// What the download needs: pdf-lib and the official PDF packet.
let formDataTry = 0; // after a failed build the form may have come through damaged, so Try again fetches it fresh
const formDataSrc = file => `forms/data/${file}.js${formDataTry ? `?try=${formDataTry}` : ""}`;
async function loadPdfTools(file) {
  // Each official PDF is packed in its own script (see scripts/build-form-data.mjs).
  await Promise.all([loadScript(LIBS.pdfLib), loadScript({ src: formDataSrc(file) })]);
}
// What only the preview needs: PDF.js and its worker. The worker is fetched with
// an integrity check too, then started from a local copy.
let workerReady = null;
async function loadPreviewTools() {
  await loadScript(LIBS.pdfJs);
  if (!workerReady) {
    const stop = new AbortController(), timer = setTimeout(() => stop.abort(), LOAD_TIMEOUT_MS); // a stalled connection never reports an error
    workerReady = fetch(LIBS.pdfJsWorker.src, { integrity: LIBS.pdfJsWorker.integrity, mode: "cors", signal: stop.signal })
      .then(r => { if (!r.ok) throw new Error("worker"); return r.blob(); })
      .then(b => { pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(b); })
      .catch(e => { workerReady = null; throw e; })
      .finally(() => clearTimeout(timer));
  }
  await workerReady;
}

const b64ToBytes = b64 => Uint8Array.from(atob(b64), c => c.charCodeAt(0));

// The forms' standard fonts only cover Western European characters. A letter
// outside that set is printed as its closest plain letter when there is one
// (for example "Ł" as "L"), otherwise as "?". Either way it is reported.
const LOOKALIKE = { "Ł": "L", "ł": "l", "Đ": "D", "đ": "d", "Ħ": "H", "ħ": "h", "ı": "i", "Ŀ": "L", "ŀ": "l", "Ŧ": "T", "ŧ": "t", "ĸ": "k",
  "\u2018": "'", "\u2019": "'", "\u201C": '"', "\u201D": '"', "\u2013": "-", "\u2014": "-", "\u2026": "..." };
// Accents typed as separate marks become one letter (NFC). Invisible formatting characters (zero-width spaces,
// soft hyphens, direction marks) are dropped, and look-alike spaces and hyphens, common in pasted text, become plain ones.
const cleanText = v => String(v ?? "").normalize("NFC").replace(/\p{Cf}/gu, "").replace(/[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g, " ").replace(/[\u2010-\u2012\u2212]/g, "-");
function makeSafe(font, report) {
  const ok = new Map();
  const fits = ch => {
    if (!ok.has(ch)) { try { font.widthOfTextAtSize(ch, 10); ok.set(ch, true); } catch { ok.set(ch, false); } }
    return ok.get(ch);
  };
  return text => Array.from(cleanText(text).replace(/\t/g, " ")).map(ch => {
    if (ch === "\n" || ch === "\r" || fits(ch)) return ch;
    if (/[\u0300-\u036f]/.test(ch)) return ""; // a leftover accent mark with no letter
    const plain = LOOKALIKE[ch] ?? ch.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const out = plain && plain !== ch && Array.from(plain).every(fits) ? plain : "?";
    report(ch, out);
    return out;
  }).join("");
}

// Break text into lines no wider than maxWidth, keeping the user's own line breaks.
// The same line breaking as wrapLines, for a box maxWidth wide.
// spacesOnly: break only at spaces, as pdf-lib does for a field it wraps itself. "commas": at commas and semicolons too.
function wrap(text, font, size, maxWidth, spacesOnly = false) {
  return wrapLines(text, font, size, { x0: 0, x1: maxWidth + 4, ys: [0], spacesOnly });
}

const SIZES = [11, 10.5, 10, 9.5, 9, 8.5, 8];
const LINES_MAX = 3000;
const ANSWER_MAX = 20000; // the longest answer a question accepts: past this, building the form gets slow

// Text written on a form's printed rules: one rule per line, shrinking the
// text if needed. With op.continues, text that still doesn't fit goes on an
// added page; otherwise it is reported as cut off.
// x0 can be one number, or one per line when the first line starts after a label.
const lineX0 = (op, i) => (Array.isArray(op.x0) ? op.x0[i] : op.x0);
// Returns the wrapped lines, plus lines.ends: where in the text each line stops,
// so text that doesn't fit can continue elsewhere exactly as the person typed it.
function wrapLines(text, font, size, op) {
  const src = String(text), lines = [], ends = [];
  const widthAt = n => op.x1 - lineX0(op, Math.min(n, op.ys.length - 1)) - 4;
  let offset = 0;
  for (const para of src.split(/\r?\n/)) {
    const base = offset;
    let line = "", lineEnd = base;
    // Words, with hyphenated words split after each hyphen ("Smith-", "Jones"), so a
    // long hyphenated name can break where it already has a hyphen.
    const tokens = [];
    const wordRe = /\S+/g; let m;
    while ((m = wordRe.exec(para)) !== null) {
      let off = 0;
      for (const part of op.spacesOnly === "commas" ? m[0].match(/[^,;]*[,;]+|[^,;]+/g) : op.spacesOnly ? [m[0]] : m[0].match(/[^-]*-+|[^-]+/g)) {
        tokens.push({ text: part, start: base + m.index + off, joined: off > 0 }); off += part.length;
      }
    }
    for (const { text: word, start, joined } of tokens) {
      const tryLine = line ? (joined ? line + word : `${line} ${word}`) : word;
      if (font.widthOfTextAtSize(tryLine, size) <= widthAt(lines.length)) { line = tryLine; lineEnd = start + word.length; continue; }
      if (line) { lines.push(line); ends.push(lineEnd); }
      // A single piece longer than the line is broken by characters (unless only spaces may
      // break it, as pdf-lib wraps: then it stays whole and the caller sees it doesn't fit).
      if (op.spacesOnly) { line = word; lineEnd = start + word.length; continue; }
      let piece = "", used = 0;
      for (const ch of word) {
        if (piece && font.widthOfTextAtSize(piece + ch, size) > widthAt(lines.length)) { lines.push(piece); ends.push(start + used); piece = ""; }
        piece += ch; used += ch.length;
      }
      line = piece; lineEnd = start + word.length;
    }
    lines.push(line); ends.push(lineEnd);
    offset = base + para.length;
    if (src[offset] === "\r") offset++;
    if (src[offset] === "\n") offset++;
  }
  lines.ends = ends;
  return lines;
}
// For addresses (op.runOn), lines may run together ("street, city") before the
// text is made smaller, so a 3-line address fits a form that has 2 lines.
function fitLines(text, font, op) {
  if (!op.continues) text = String(text).slice(0, LINES_MAX); // lines that can't continue elsewhere never hold this much
  // A line that can grow upward from its printed rule (op.layouts): try one line,
  // then two, then three, each over a range of sizes. The last line sits on the rule.
  if (op.layouts) {
    const one = String(text).replace(/\s*\n+\s*/g, " ");
    const place = (lines, size) => lines.map((_, i) => op.ys[0] + (lines.length - 1 - i) * size * 1.15);
    const inside = (l, size) => font.widthOfTextAtSize(l, size) <= op.x1 - lineX0(op, 0) - 4;
    for (const { n, sizes } of op.layouts) {
      for (const size of sizes) {
        const lines = wrapLines(one, font, size, op);
        if (lines.length > n || !lines.every(l => inside(l, size))) continue;
        const ys = place(lines, size);
        if (op.maxTop && lines.length > 1 && ys[0] + 2.5 + size * 0.95 > op.maxTop) continue;
        return { size, lines, overflow: false, ys };
      }
    }
    // Nothing fits: of each layout's smallest size, use the one that shows the most text,
    // and end it with "…" so the cut is visible.
    let best = null;
    for (const { n, sizes } of op.layouts) {
      const size = sizes[sizes.length - 1], all = wrapLines(one, font, size, op);
      const lines = all.slice(0, n), ys = place(lines, size);
      if (op.maxTop && lines.length > 1 && ys[0] + 2.5 + size * 0.95 > op.maxTop) continue;
      const shown = lines.join(" ").length;
      if (!best || shown > best.shown) best = { size, lines, ys, shown };
    }
    const lines = best.lines.map(l => { while (l && !inside(l, best.size)) l = l.slice(0, -1); return l; }), width = (op.x1 - lineX0(op, lines.length - 1) - 4);
    let lastLine = lines[lines.length - 1];
    while (lastLine && font.widthOfTextAtSize(lastLine + "…", best.size) > width) lastLine = lastLine.slice(0, -1);
    lines[lines.length - 1] = lastLine.replace(/\s+$/, "") + "…";
    return { size: best.size, lines, overflow: true, ys: best.ys };
  }
  const variants = op.runOn ? [text, String(text).replace(/\s*\n+\s*/g, ", ")] : [text];
  for (const size of SIZES) {
    for (const t of variants) {
      const lines = wrapLines(t, font, size, op);
      if (lines.length <= op.ys.length) return { size, lines, overflow: false };
    }
  }
  const size = SIZES[SIZES.length - 1];
  return { size, lines: wrapLines(variants[variants.length - 1], font, size, op).slice(0, op.ys.length), overflow: true };
}

// Pick a font size so the value fits inside the field's box. A one-line box
// that would need tiny text switches to two smaller lines when its box is tall
// enough (wrap: true).
// The room inside a form box: pdf-lib's border and padding, less 2% because PDF viewers
// like Chrome's draw Helvetica slightly wider than its standard measurements.
const innerWidth = rect => (Math.abs(rect.width) - 4) * 0.98;
// ownBreaks: the app writes this field's line breaks itself (a field with one box).
// Otherwise pdf-lib wraps it, only at spaces, so a word wider than the box doesn't fit.
// The most characters a box could hold in its smallest text, even if all were as narrow as "i".
const boxRoom = rect => Math.ceil((innerWidth(rect) / 1.3) * Math.max(1, (Math.abs(rect.height) - 2) / 6.9));
function fitField(text, font, rect, multiline, maxSize, ownBreaks = true, oneLine = false) {
  const width = innerWidth(rect), height = Math.abs(rect.height) - 2;
  if (text.length > boxRoom(rect)) return { size: 6, overflow: true }; // no size can fit it, and trying them is slow on long text
  const sizes = [maxSize, ...SIZES.filter(s => s < maxSize), 7.5, 7, 6.5, 6];
  const wrapped = size => {
    const lines = wrap(text, font, size, width, !ownBreaks);
    return lines.some(l => font.widthOfTextAtSize(l, size) > width) ? { length: Infinity } : lines;
  };
  const fitsLines = size => wrapped(size).length * size * 1.15 <= height;
  if (!multiline) {
    for (const size of sizes.filter(s => s >= 7.5)) if (font.widthOfTextAtSize(text, size) <= width) return { size, overflow: false };
    if (!oneLine) for (const size of sizes) if (wrapped(size).length > 1 && fitsLines(size)) return { size, overflow: false, wrap: true };
    for (const size of sizes) if (font.widthOfTextAtSize(text, size) <= width) return { size, overflow: false };
    return { size: 6, overflow: true };
  }
  for (const size of sizes) if (fitsLines(size)) return { size, overflow: false };
  return { size: 6, overflow: true };
}

async function buildPdf(key, a) {
  const { PDFDocument, StandardFonts } = PDFLib;
  const sit = SITUATIONS[key];
  const off = OFFICIAL[sit.official.packet];
  const src = await PDFDocument.load(b64ToBytes(window.OFFICIAL_PDFS[off.file]));
  const form = src.getForm();
  // The official continuance Appearance stores two boxes upside down (Case Number and County), which
  // puts wrapped text outside the box. Same box, stored the right way up.
  form.getFields().forEach(fl => fl.acroField.getWidgets().forEach(w => {
    const r = w.getRectangle();
    if (r.width < 0 || r.height < 0) w.setRectangle({ x: Math.min(r.x, r.x + r.width), y: Math.min(r.y, r.y + r.height), width: Math.abs(r.width), height: Math.abs(r.height) });
  }));
  const font = await src.embedFont(StandardFonts[off.font]);
  const notes = [];
  const draws = [];
  const blankWidgets = []; // boxes whose text is drawn on their rule instead
  const srcPages = src.getPages();
  const widgetPage = w => {
    const P = w.P();
    let i = P ? srcPages.findIndex(pg => pg.ref === P) : -1;
    if (i < 0) {
      const ref = src.context.getObjectRef(w.dict);
      i = srcPages.findIndex(pg => { const an = pg.node.Annots(); return !!(an && ref && an.asArray().includes(ref)); });
    }
    return i;
  };

  for (const name of off.removeButtons || []) { try { form.removeField(form.getButton(name)); } catch { /* not there */ } }
  // Some fields are marked "rich text", which pdf-lib can't draw. Treat them as plain text.
  for (const field of form.getFields()) {
    if (field instanceof PDFLib.PDFTextField && field.isRichFormatted()) field.disableRichFormatting();
  }

  for (const item of sit.fields(a)) {
    const safe = makeSafe(font, item.quietChars ? () => {} : (ch, out) => notes.push({ kind: "chars", step: item.step, label: item.label, ch, out }));
    for (const op of item.pdf) {
      if (op.t === "text") {
        const tf = form.getTextField(op.name);
        if (op.align) tf.setAlignment(PDFLib.TextAlignment[op.align]);
        if (op.multiline) tf.enableMultiline();
        const value = safe(op.value);
        tf.setText(value);
        if (!value) continue;
        // A field can appear in several boxes (for example the caption and "My name is"),
        // so size the text for each box on its own.
        const boxes = tf.acroField.getWidgets();
        const fits = boxes.map(w => {
          const fit = fitField(value, font, w.getRectangle(), tf.isMultiline(), op.maxSize || off.maxSize, boxes.length === 1, op.oneLine);
          w.setDefaultAppearance(`/Helv ${fit.size} Tf 0 g`);
          // A name that doesn't fit its caption box, or only in small text, is drawn on the
          // box's rule instead. (Only caption boxes: narrow ones at the left margin.)
          const r = w.getRectangle();
          const caption = r.x < 80 && r.width < 190;
          if ((fit.overflow || fit.size < 7.5) && op.growUp) {
            const pg = widgetPage(w);
            if (pg >= 0) {
              blankWidgets.push(w);
              // Under the printed "v.", and in other boxes with text around them, the lines
              // stay within the box; caption lines (and the fee waiver's) can grow above it.
              const vLine = op.growUp === "vLine" && caption;
              const keepInside = vLine || (!caption && op.growUp !== "all");
              draws.push({ op: { t: "lines", page: pg, x0: r.x, x1: r.x + r.width, ys: [r.y + 0.5], layouts: vLine ? NAME_V_LINE : NAME_LAYOUTS,
                maxTop: keepInside ? r.y + r.height + 1.4 : null }, item, value });
              return { drawn: true };
            }
          }
          return fit;
        });
        const real = fits.filter(x => !x.drawn); // boxes still filled by the form itself
        if (real.some(x => x.wrap)) tf.enableMultiline();
        tf.setFontSize(real.length ? Math.min(...real.map(x => x.size)) : 11);
        // pdf-lib's own line breaking leaves out the spaces when it measures, so its lines
        // can run past the box edge. A field with one box gets our line breaks instead.
        const widgets = tf.acroField.getWidgets();
        // What can't fit is cut here: pdf-lib laying out thousands of characters would freeze the page.
        const fitsBoxes = value.slice(0, Math.max(...widgets.map(w => boxRoom(w.getRectangle()))));
        if (widgets.length === 1 && tf.isMultiline() && !fits[0].drawn)
          tf.setText(wrap(fitsBoxes, font, fits[0].size, innerWidth(widgets[0].getRectangle())).join("\n"));
        else if (fitsBoxes !== value) tf.setText(fitsBoxes);
        if (real.some(x => x.overflow)) notes.push({ kind: "overflow", step: item.step, label: item.label });
        else if (real.length && Math.min(...real.map(x => x.size)) < (op.smallOk || 7.5)) notes.push({ kind: "small", step: item.step, label: item.label, size: Math.min(...real.map(x => x.size)) });
      } else if (op.t === "radio") {
        form.getRadioGroup(op.name).select(op.option);
      } else if (op.t === "check") {
        const cb = form.getCheckBox(op.name);
        if (op.on) cb.check(); else cb.uncheck();
      } else if (op.t === "drop") {
        form.getDropdown(op.name).select(op.option);
      } else if ((op.t === "lines" || op.t === "draw") && !empty(op.value)) {
        draws.push({ op, item, value: safe(op.value) });
      }
    }
  }

  // Bake the answers into the pages so the filed form can't change.
  form.updateFieldAppearances(font);
  for (const w of blankWidgets) {
    const r = w.getRectangle();
    w.setNormalAppearance(src.context.register(src.context.formXObject([], { BBox: [0, 0, r.width, r.height] })));
  }
  form.flatten();

  const pages = src.getPages();
  const docOfPage = pg => sit.official.docs.find(k => off.docs[k].pages.includes(pg));
  const continuations = {};
  for (const { op, item, value } of draws) {
    if (op.t === "draw") {
      // Shrink to fit the line it sits on (op.w); report if even small text won't fit.
      let size = 11;
      while (op.w && size > 6 && font.widthOfTextAtSize(value, size) > op.w) size -= 0.5;
      pages[op.page].drawText(value, { x: op.x, y: op.y, size, font });
      if (op.w && font.widthOfTextAtSize(value, size) > op.w) notes.push({ kind: "overflow", step: item.step, label: item.label });
      else if (size < 7.5) notes.push({ kind: "small", step: item.step, label: item.label, size });
      continue;
    }
    let fit = fitLines(value, font, op);
    if (fit.overflow && op.continues) {
      // Keep the last rule for the note, and move the rest to an added page.
      const keep = op.ys.length - 1;
      const all = wrapLines(value, font, 9, op);
      fit = { size: 9, lines: [...all.slice(0, keep), "(continued on attached page)"] };
      const doc = docOfPage(op.page);
      // The rest of the answer, exactly as typed (line breaks kept).
      const rest = value.slice(all.ends[keep - 1]).replace(/^[ \t]+/, "").replace(/^\r?\n/, "");
      (continuations[doc] = continuations[doc] || []).push({ label: op.continues, text: rest });
      notes.push({ kind: "continued", step: item.step, label: item.label, doc: off.docs[doc].name });
    }
    const ys = fit.ys || op.ys;
    fit.lines.forEach((line, i) => {
      const x0 = lineX0(op, i);
      const x = op.center ? x0 + Math.max(2, (op.x1 - x0 - font.widthOfTextAtSize(line, fit.size)) / 2) : x0 + 2;
      pages[op.page].drawText(line, { x, y: ys[i] + 2.5, size: fit.size, font });
    });
    if (fit.overflow) notes.push({ kind: "overflow", step: item.step, label: item.label });
    else if (fit.size < (op.smallOk || 7.5)) notes.push({ kind: "small", step: item.step, label: item.label, size: fit.size });
  }

  cleanUpAfterFlatten(src);

  // An added page that carries the rest of a long answer, right after its form.
  const caption = [a.caseNumber ? `Case number: ${a.caseNumber}` : "", a.county ? `${a.county} County` : ""].filter(Boolean).join("    ");
  const addContinuation = async (out, docKey) => {
    const conts = continuations[docKey];
    if (!conts) return;
    const f = await out.embedFont(PDFLib.StandardFonts.Helvetica);
    const bold = await out.embedFont(PDFLib.StandardFonts.HelveticaBold);
    // The E-Filing User Guide asks for a 1-inch top margin and numbered pages, so text starts below 1 inch.
    const added = [out.addPage([612, 792])];
    let y = 708;
    const line = (text, fnt, size, gap) => {
      for (const l of wrap(safeOut(text), fnt, size, 468)) {
        if (y < 72) { added.push(out.addPage([612, 792])); y = 708; }
        added[added.length - 1].drawText(l, { x: 72, y, size, font: fnt }); y -= gap;
      }
    };
    const d = off.docs[docKey];
    line(`Attachment to ${d.name}${d.number ? ` (${d.number})` : ""}`, bold, 12, 18);
    if (caption) line(caption, f, 10, 14);
    if (a.name) line(`Filed by: ${a.name}`, f, 10, 20);
    for (const c of conts) { line(`Continued from: ${c.label}`, bold, 10, 15); line(c.text, f, 10, 14); y -= 10; }
    // Number the added pages after the form's own pages.
    const formPages = off.docs[docKey].pages.length;
    added.forEach((pg, i) => pg.drawText(`Page ${formPages + i + 1} (attachment page ${i + 1} of ${added.length} to the ${off.docs[docKey].name})`, { x: 72, y: 40, size: 9, font: f }));
  };
  const safeOut = makeSafe(font, () => {});
  const docs = sit.official.docs.map(k => ({ key: k, ...off.docs[k] }));
  const make = async (parts, title) => {
    const out = await PDFDocument.create();
    for (const d of parts) {
      (await out.copyPages(src, d.pages)).forEach(p => out.addPage(p));
      await addContinuation(out, d.key);
    }
    out.setTitle(title);
    out.setCreator("Indiana Court Form Helper");
    return out.save();
  };
  const all = await make(docs, `${sit.title}: ${docs.map(d => d.number ? `${d.name} (${d.number})` : d.name).join(", ")}`);
  const each = docs.length > 1 ? await Promise.all(docs.map(async d => ({ ...d, bytes: await make([d], d.number ? `${d.name} (${d.number})` : d.name) }))) : [];
  return { all, each, notes };
}

function cleanUpAfterFlatten(doc) {
  const { PDFName, PDFArray, PDFDict, PDFRef } = PDFLib;
  const ctx = doc.context;
  for (const page of doc.getPages()) {
    const annots = page.node.lookupMaybe(PDFName.of("Annots"), PDFArray);
    if (annots) {
      const kept = annots.asArray().filter(r => !(r instanceof PDFRef) || ctx.lookup(r) !== undefined);
      if (kept.length) page.node.set(PDFName.of("Annots"), ctx.obj(kept)); else page.node.delete(PDFName.of("Annots"));
    }
    const res = page.node.Resources();
    const xobjs = res && res.lookupMaybe(PDFName.of("XObject"), PDFDict);
    if (!xobjs) continue;
    for (const [, ref] of xobjs.entries()) {
      const stream = ref instanceof PDFRef ? ctx.lookup(ref) : ref;
      const dict = stream && stream.dict;
      if (dict && !dict.has(PDFName.of("Subtype")) && dict.has(PDFName.of("BBox"))) {
        dict.set(PDFName.of("Type"), PDFName.of("XObject"));
        dict.set(PDFName.of("Subtype"), PDFName.of("Form"));
      }
    }
  }
}
