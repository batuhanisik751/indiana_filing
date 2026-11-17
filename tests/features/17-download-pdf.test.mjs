// Feature: Download PDF. The official form, filled in and ready to print or upload.
// "Ready to upload" is checked against the Indiana E-Filing User Guide (updated September 1, 2026), pages 23 to 26:
// no fillable fields, 8.5 x 11 portrait, 50 MB per document, no encryption or embedded files, names of 100 characters
// or fewer, and "/s/" followed by the name as a signature.
import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fresh, close, inject } from "../lib.mjs";

let p;
before(async () => { p = await fresh(); });
after(close);
const ready = (q = p) => q.waitForFunction(() => pdfState.result && pdfState.key === pdfKey() && !pdfState.busy, null, { timeout: 120000 });
// Clicks a download button and returns the file the browser saved: its name and bytes.
async function download(selector, q = p) {
  const [d] = await Promise.all([q.waitForEvent("download"), q.click(selector)]);
  return { name: d.suggestedFilename(), bytes: fs.readFileSync(await d.path()) };
}
// What a PDF holds, read with the page's own PDF viewer.
const inspect = (bytes, q = p) => q.evaluate(async b64 => {
  await loadPreviewTools();
  const data = Uint8Array.from(atob(b64), c => c.charCodeAt(0)), raw = new TextDecoder("latin1").decode(data);
  const doc = await pdfjsLib.getDocument({ data }).promise;
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const pg = await doc.getPage(i), vp = pg.getViewport({ scale: 1 }), tc = await pg.getTextContent();
    pages.push({ w: vp.width, h: vp.height, widgets: (await pg.getAnnotations()).filter(a => a.subtype === "Widget").length,
      text: tc.items.map(t => t.str).join(" ").replace(/\s+/g, " "), top: tc.items.filter(t => t.str.trim() && vp.height - t.transform[5] < 72).map(t => t.str) });
  }
  return { pages, title: (await doc.getMetadata()).info.Title, encrypted: /\/Encrypt\b/.test(raw), embedded: /\/EmbeddedFile/.test(raw), header: raw.slice(0, 5) };
}, Buffer.from(bytes).toString("base64"));

describe("Download PDF", () => {
  test("Download all forms saves one PDF of the whole packet, titled with its forms", async () => {
    await inject(p, "respond"); await ready();
    const { name, bytes } = await download("#dlAll"), pdf = await inspect(bytes);
    assert.equal(pdf.header, "%PDF-");
    assert.equal(name, "Appearance-and-Answer-forms-02D01-2611-CC-001234.pdf");
    assert.match(pdf.title, /Appearance \(CCA-GF-1225-6003\), Answer \(CCA-GF-0626-6008\)/);
    assert.equal(pdf.pages.length, 4, "the Appearance's 2 pages and the Answer's 2");
  });
  test("each form downloads on its own, named after it and its form number, for e-filing", async () => {
    await inject(p, "continuance"); await ready();
    const names = [];
    for (const key of await p.$$eval("[data-dl]", b => b.map(x => x.dataset.dl))) names.push((await download(`[data-dl="${key}"]`)).name);
    assert.deepEqual(names, ["Continuance-Appearance-CCA-GF-1219-3000-02D01-2611-CC-001234.pdf", "Continuance-Verified-Motion-for-Continuance-CCA-GF-1219-3002-02D01-2611-CC-001234.pdf", "Continuance-Order-on-Verified-Motion-for-Continuance-CCA-GF-1219-3002-02D01-2611-CC-001234.pdf"]);
  });
  test("the answers are real text in the PDF, so it can be searched and read once uploaded", async () => {
    await inject(p, "appearance", { name: "Pat Searchable" }); await ready();
    const { text } = (await inspect((await download("#dlAll")).bytes)).pages[0];
    for (const t of ["Pat Searchable", "02D01-2611-CC-001234", "Allen", "1 Main St, Fort Wayne, IN 46802"]) assert.ok(text.includes(t), t);
  });
  test("no fillable fields are left: the guide says a saved fillable PDF can't be uploaded", async () => {
    for (const form of ["respond", "appearance", "continuance", "feewaiver"]) {
      await inject(p, form, { housing: "500" }); await ready();
      const pdf = await inspect((await download("#dlAll")).bytes);
      assert.equal(pdf.pages.reduce((n, x) => n + x.widgets, 0), 0, form);
    }
  });
  test("every page is 8.5 x 11 inches, portrait", async () => {
    for (const form of ["respond", "feewaiver"]) {
      await inject(p, form, { housing: "500" }); await ready();
      const pdf = await inspect((await download("#dlAll")).bytes);
      assert.deepEqual([...new Set(pdf.pages.map(x => `${x.w}x${x.h}`))], ["612x792"], form);
    }
  });
  test("edge: nothing is encrypted or embedded, and each file is far under the guide's 50 MB limit", async () => {
    await inject(p, "continuance"); await ready();
    for (const sel of ["#dlAll", '[data-dl="motion"]']) {
      const { bytes } = await download(sel), pdf = await inspect(bytes);
      assert.equal(pdf.encrypted, false); assert.equal(pdf.embedded, false);
      assert.ok(bytes.length < 5 * 1024 * 1024, `${bytes.length} bytes`);
    }
  });
  test("edge: an answer too long for the form goes on added pages, numbered in order, with their top inch clear", async () => {
    await inject(p, "respond", { defenses: "I paid this debt in full and have the receipts to show it. ".repeat(120) }); await ready();
    const pdf = await inspect((await download('[data-dl="answer"]')).bytes);
    const first = pdf.pages.findIndex(x => /Attachment to Answer/.test(x.text)), added = pdf.pages.slice(first), n = added.length;
    assert.ok(first > 0 && n >= 1, "added after the form's own pages");
    added.forEach((x, i) => {
      assert.match(x.text, new RegExp(`Page ${first + i + 1} \\(attachment page ${i + 1} of ${n} to the Answer\\)`));
      assert.deepEqual(x.top, [], `nothing in the top inch of added page ${i + 1}`);
    });
  });
  test("edge: file names stay at 100 characters or fewer, however long the form's name", async () => {
    await inject(p, "respond"); await ready();
    const [d] = await Promise.all([p.waitForEvent("download"), p.evaluate(() => downloadPdf(pdfState.result.all, "A very long form name ".repeat(20)))]);
    assert.ok(d.suggestedFilename().length <= 100, d.suggestedFilename());
    assert.ok(d.suggestedFilename().endsWith("-02D01-2611-CC-001234.pdf"), "the case number is kept");
  });
  test("edge: something typed in the case number box that isn't a case number never goes in the file name", async () => {
    await inject(p, "appearance", { caseNumber: "123-45-6789" }); await ready();
    assert.equal((await download("#dlAll")).name, "Appearance-CCA-GF-1225-6003.pdf");
  });
  test("edge: e-filing signs with /s/ and the name; filing on paper leaves the lines to sign by hand", async () => {
    await inject(p, "appearance", { fileMethod: "efile" }); await ready();
    assert.ok((await inspect((await download("#dlAll")).bytes)).pages.some(x => x.text.includes("/s/ Pat Example")));
    await inject(p, "appearance", { fileMethod: "paper" }); await ready();
    assert.ok(!(await inspect((await download("#dlAll")).bytes)).pages.some(x => x.text.includes("/s/")));
  });
  test("edge: if the PDF tools don't load, it says so, and Try again makes the PDF once they do", async () => {
    const q = await fresh();
    let block = true;
    await q.context().route(/cdnjs\.cloudflare\.com\/ajax\/libs\/pdf-lib\//, r => (block ? r.abort() : r.continue()));
    await inject(q, "appearance");
    await q.waitForSelector("#retryPdf", { timeout: 120000 });
    assert.match(await q.textContent("#app"), /couldn't make the PDF/);
    block = false;
    await q.click("#retryPdf");
    await ready(q);
    assert.equal(await q.locator("#dlAll").isEnabled(), true);
    await q.context().close();
  });
});
