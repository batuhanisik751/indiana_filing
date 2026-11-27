// Break-test round 4 (BT50-BT110, TG11-TG20): problems seven independent testers found across the whole app, fixed most
// important first. BT50's tests are in ../loading.test.mjs.
import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fresh, close, inject, editHere, editAnswer, settle, pick, walk, answer, reset, pdfText, site, VALUES, SAVED, BROWSER } from "../lib.mjs";

let p;
before(async () => { p = await fresh(); });
after(close);
const listFlags = async (admitted, denied, notEnough = "") => { await inject(p, "respond", { admitted, denied, notEnough }); return p.evaluate(() => runChecks().filter(f => ["admitted", "denied", "notEnough"].includes(f.fix)).map(f => `${f.level}|${f.title}`)); };
const MISSING = "missing|Your answer";
const ready = q => q.waitForFunction(() => pdfState.result && !pdfState.busy, null, { timeout: 120000 });
// Opens page n of the filled form large, from "Show the pages" on the summary.
async function openPage(q, n) {
  await ready(q);
  await q.evaluate(() => { const d = document.querySelector('details[data-more="preview"]'); if (d) d.open = true; });
  await q.waitForSelector(`#preview [data-page="${n}"]`, { timeout: 60000 });
  await q.click(`#preview [data-page="${n}"]`);
  await q.waitForSelector("dialog.pageview .pvpage canvas", { timeout: 60000 });
}
const tap = async (q, id, k = 0) => { await q.locator(`dialog.pageview .pvspot[data-id="${id}"]`).nth(k).click(); await q.waitForSelector("#pvEdit"); };
const copy = q => q.evaluate(k => localStorage.getItem(k) || "", SAVED);
// A page of its own with saving on, so what's on the device can be read back.
async function savingPage() {
  const q = await fresh();
  await q.click("#savePref");
  return q;
}

describe("BT51. A sentence with \"all\" or \"every\" in it, or one starting \"First,\", isn't a list of paragraphs", () => {
  test("each of these, alone in Denied, is flagged Missing, as before last week", async () => {
    for (const s of ["I paid every month on time and never missed one", "I paid it all back", "I never missed a payment, I paid each one", "They are lying about everything",
      "The whole thing is a scam", "I paid the entire bill", "All of my payments were on time", "My ex husband is responsible for all of it", "I gave them everything they asked for",
      "I called every week and nobody answered", "First, this is not my debt", "First, I never signed. Second, I paid", "We all moved out in June", "I had the car the whole time"]) {
      assert.deepEqual(await listFlags("", s), [MISSING], s);
      assert.equal(await p.evaluate(() => { const s = completeness(); return s.filled < s.total; }), true, `${s}: not a full score`);
    }
  });
  test("\"all of them\" in other words still counts: alone it's a list, next to a named paragraph it's \"different things\"", async () => {
    for (const t of ["I agree with all of it", "I admit all of it because the store said so", "I deny all allegations", "Every single one", "Yes, all", "The whole complaint is false", "I deny everything", "I deny each and every allegation"]) {
      assert.deepEqual(await listFlags(t, ""), [], t);
      assert.deepEqual(await listFlags(t, "3"), ["check|Your lists say different things"], `${t} / 3`);
    }
  });
  test("next to \"1, 3\", \"The whole amount is wrong\" isn't read as all of them", async () => {
    assert.ok(!(await listFlags("1, 3", "The whole amount is wrong")).includes("check|Your lists say different things"));
  });
  test("edge: ordinals in a list are still paragraphs: \"first and second\", \"First, second and third\", \"First, 2\", \"Paragraph first,\"", async () => {
    assert.deepEqual(await p.evaluate(() => ["first and second", "First, second and third", "First, 2", "First.", "Paragraph first, I deny", "the first five", "First, I never signed"].map(t => [...paragraphNumbers(t)].join(","))),
      ["1,2", "1,2,3", "1,2", "1", "1", "1,2,3,4,5", ""]);
  });
});

describe("BT55. Text typed in a box on a page shown large leaves the device when the box is let go", () => {
  const TYPED = "My SSN is 123-45-6789";
  for (const [how, letGo] of [
    ["Cancel", q => q.click("#ieCancel")],
    ["Escape", q => q.keyboard.press("Escape")],
    ["Close", async q => { await q.keyboard.press("Escape"); await q.click("#pvClose"); }],
    ["Next page", q => q.click("#pvNext")],
    ["tapping another answer", q => tap(q, "email")],
  ]) test(`${how}: the saved copy no longer has what was typed or the open box`, async () => {
    const q = await savingPage();
    await inject(q, "respond");
    await q.evaluate(() => saveProgress());
    await openPage(q, 1);
    await tap(q, "plaintiff");
    await q.fill("#inEdit", TYPED);
    assert.match(await copy(q), /6789/, "kept while the box is open, as on the question");
    await letGo(q);
    assert.doesNotMatch(await copy(q), /6789|"inline"/);
    assert.equal(JSON.parse(await copy(q)).answers.plaintiff, "Acme Credit LLC");
    await q.context().close();
  });
  test("edge: reloaded with the box open, it comes back with what was typed, as on the summary", async () => {
    const q = await savingPage();
    await inject(q, "respond");
    await q.evaluate(() => saveProgress());
    await openPage(q, 1);
    await tap(q, "plaintiff");
    await q.fill("#inEdit", "Acme Credit Holdings LLC");
    await q.reload(); await q.waitForSelector("#app h1");
    if (await q.locator("#resume").count()) await q.click("#resume");
    await q.waitForSelector("#inEdit");
    assert.equal(await q.$eval("#inEdit", b => b.value), "Acme Credit Holdings LLC");
    await q.click("#ieCancel");
    assert.doesNotMatch(await copy(q), /Holdings|"inline"/);
    await q.context().close();
  });
});

describe("BT52. A protection order case says how its contact information and e-filing differ", () => {
  const PO = { caseNumber: "02D01-2611-PO-001234", role: "me", fileMethod: "efile" };
  const flagsAndSteps = (form, over) => inject(p, form, over).then(() => p.evaluate(() => ({
    flags: runChecks().filter(f => f.title === "Protection order case").map(f => `${f.fix}|${f.why}`),
    online: nextSteps(sitKey, visibleAnswers()).filter(s => /File online/.test(s.title)).map(s => `${s.short} ${s.body}`).join(" ") })));
  test("a continuance in a PO case: the contact boxes are flagged with what Rule 5 asks for, and e-filing names its own service", async () => {
    const { flags, online } = await flagsAndSteps("continuance", PO);
    assert.equal(flags.length, 1);
    assert.match(flags[0], /^address\|Your case type is PO, a protection order or workplace violence restraining order case\. If you're a victim or a witness/);
    assert.match(flags[0], /mailing address, email address and phone number out of the public record/);
    assert.match(flags[0], /confidential document \(on green paper if you file on paper\), along with a separate copy that leaves them out and an ACR Form/);
    assert.match(online, /Protection Order Registry's e-filing service/);
    assert.match(online, /every filing in the case/);
    assert.doesNotMatch(online, /you can always e-file at no cost/);
  });
  test("a JQ case and an Appearance: the same; with the Address Confidentiality Program, the mailing address isn't named", async () => {
    let { flags, online } = await flagsAndSteps("appearance", { caseNumber: "02D01-2611-JQ-001234", fileMethod: "efile" });
    assert.match(flags[0], /JQ, a child protection order case/);
    assert.match(online, /JQ cases \(requests for child protection orders\)/);
    ({ flags } = await flagsAndSteps("appearance", { caseNumber: "02D01-2611-PO-001234", acp: "yes", acpAddress: "PO Box 1, Indianapolis, IN 46204" }));
    assert.match(flags[0], /^email\|.*your email address and phone number out/);
  });
  test("the contact questions say so before anything is typed", async () => {
    await inject(p, "continuance", PO);
    for (const id of ["address", "email", "phone"]) {
      await p.evaluate(id => { cur = visible().findIndex(s => s.id === id); mode = "step"; returnToSummary = false; render(); }, id);
      assert.match(await p.textContent("#qneed"), /Your case type is PO.*Access to Court Records Rule 5 keeps this out of the public record/, id);
    }
  });
  test("edge: other case types are as before", async () => {
    const { flags, online } = await flagsAndSteps("continuance", { ...PO, caseNumber: "02D01-2611-CC-001234" });
    assert.deepEqual(flags, []);
    assert.match(online, /efile\.incourts\.gov/);
    await p.evaluate(() => { cur = visible().findIndex(s => s.id === "address"); mode = "step"; render(); });
    assert.doesNotMatch(await p.textContent("#qneed"), /case type/);
  });
});

describe("BT53 and BT54. Names and addresses aren't cut off at their box's edge", () => {
  const built = q => q.waitForFunction(() => pdfState.result && !pdfState.busy, null, { timeout: 120000 });
  // How far past the right edge of the official form's box each piece of these answers prints, read back from the made
  // PDF (pdf.js). Only pieces that start inside a box count.
  const pastEdge = (q, values) => q.evaluate(async values => {
    await loadPreviewTools();
    const r = pdfState.result, off = OFFICIAL[SITUATIONS[sitKey].official.packet];
    const src = await PDFLib.PDFDocument.load(b64ToBytes(window.OFFICIAL_PDFS[off.file])), pages = src.getPages(), boxes = [];
    for (const f of src.getForm().getFields()) for (const w of f.acroField.getWidgets()) {
      const ref = src.context.getObjectRef(w.dict), rc = w.getRectangle();
      const pg = pages.findIndex(p => p.ref === w.P() || (p.node.Annots() && p.node.Annots().asArray().includes(ref)));
      boxes.push({ pg, x1: Math.min(rc.x, rc.x + rc.width), x2: Math.max(rc.x, rc.x + rc.width), y1: Math.min(rc.y, rc.y + rc.height), y2: Math.max(rc.y, rc.y + rc.height) });
    }
    const doc = await pdfjsLib.getDocument({ data: r.all.slice() }).promise, out = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const at = r.allPages[i - 1]?.src;
      if (at === undefined) continue;
      for (const t of (await (await doc.getPage(i)).getTextContent()).items) {
        const x = t.transform[4], y = t.transform[5];
        if (t.str.trim().length < 3 || !values.some(v => v.includes(t.str.trim()))) continue;
        const b = boxes.find(b => b.pg === at && x >= b.x1 - 1 && x <= b.x2 && y >= b.y1 - 3 && y <= b.y2 + 3);
        if (b) out.push({ str: t.str, past: +(x + t.width - b.x2).toFixed(2) });
      }
    }
    await doc.destroy();
    return out;
  }, values);
  test("the Certificate of Service: \"J. P. M. C. Bank, N. A.\" and a ZIP code print inside their boxes", async () => {
    const name = "Meyer & Njus, P.A., c/o J. P. M. C. Bank, N. A.", address = "251 N. Main St. Apt. 4, Terre Haute, IN 46396";
    await inject(p, "respond", { svc1Name: name, svc1Address: address });
    await built(p);
    const pieces = await pastEdge(p, [name, address]);
    assert.ok(pieces.some(x => /Bank/.test(x.str)) && pieces.some(x => /46396/.test(x.str)), JSON.stringify(pieces));
    assert.deepEqual(pieces.filter(x => x.past > 0), []);
  });
  test("the fee waiver: TAWANDA Y. PAYTON-TAYLOR prints inside the caption's box", async () => {
    const name = "TAWANDA Y. PAYTON-TAYLOR";
    await inject(p, "feewaiver", { name });
    await built(p);
    const pieces = await pastEdge(p, [name]);
    assert.ok(pieces.length, "the name is found in a box");
    assert.deepEqual(pieces.filter(x => x.past > 0), []);
  });
  test("edge: text is measured as wide as it's drawn, kerning pairs and all", async () => {
    assert.equal(await p.evaluate(async () => {
      const d = await PDFLib.PDFDocument.create(), f = asDrawn(await d.embedFont(PDFLib.StandardFonts.Helvetica)), s = "AV. P.A. Y. TAWANDA";
      return Math.abs(f.widthOfTextAtSize(s, 10) - [...s].reduce((w, c) => w + f.widthOfTextAtSize(c, 10), 0)) < 1e-9;
    }), true);
  });
});

describe("BT56. A change in a box on the summary that isn't saved yet is pointed out before a download", () => {
  const notes = q => q.$$eval(".unsaved", els => els.map(e => (e.hidden ? "" : e.textContent)));
  test("as it's typed, the status and the downloads say so; a download asks first, and Cancel goes to the box", async () => {
    const q = await fresh({ viewport: { width: 390, height: 844 } });
    await inject(q, "respond");
    await q.waitForFunction(() => pdfState.result && !pdfState.busy, null, { timeout: 120000 });
    assert.deepEqual(await notes(q), ["", ""], "nothing to say before a box is open");
    await editHere(q, "address");
    assert.deepEqual(await notes(q), ["", ""], "an open box with nothing changed");
    await q.fill("#inEdit", "9 New St, Fort Wayne, IN 46802");
    const said = await notes(q);
    assert.equal(said.length, 2);
    for (const t of said) assert.match(t, /Your change to "Mailing address" isn't saved yet, so the form doesn't have it\./);
    q.removeAllListeners("dialog");
    q.once("dialog", d => { q.asked = d.message(); d.dismiss(); });
    let downloaded = false;
    q.once("download", () => { downloaded = true; });
    await q.click("#dlAll");
    assert.match(q.asked, /isn't saved yet.*Download the form without it\?/);
    assert.equal(await q.evaluate(() => document.activeElement.id), "inEdit");
    await q.waitForTimeout(300);
    assert.equal(downloaded, false);
    await q.click("#ieSave");
    assert.ok((await notes(q)).every(t => !t), "saved: nothing left to say (the form is being made again)");
    await q.context().close();
  });
  test("edge: OK downloads the form as it is; Cancel in the box takes the note away", async () => {
    const q = await fresh();
    await inject(q, "respond");
    await q.waitForFunction(() => pdfState.result && !pdfState.busy, null, { timeout: 120000 });
    await editHere(q, "address");
    await q.fill("#inEdit", "9 New St");
    const got = q.waitForEvent("download");
    await q.click("#dlAll"); // the dialog is accepted
    assert.match((await got).suggestedFilename(), /\.pdf$/);
    await q.click("#ieCancel");
    assert.deepEqual(await notes(q), ["", ""]);
    await q.context().close();
  });
});

describe("BT57. A page translator can't change the county that prints", () => {
  test("with the county names translated on the page, the answer is still the county's own name", async () => {
    await inject(p, "feewaiver", { county: "" });
    await p.evaluate(() => { cur = visible().findIndex(s => s.id === "county"); mode = "step"; returnToSummary = false; render(); });
    // What a translator does: it rewrites the words shown. Lake becomes "Lago".
    await p.evaluate(() => document.querySelectorAll("#ans option").forEach(o => { if (o.textContent === "Lake") o.textContent = "Lago"; }));
    await p.selectOption("#ans", { label: "Lago" });
    await p.click("#next");
    assert.equal(await p.evaluate(() => answers.county), "Lake");
  });
  test("the choices aren't translated, and a county that isn't on the list is refused", async () => {
    await inject(p, "feewaiver");
    await p.evaluate(() => { cur = visible().findIndex(s => s.id === "county"); mode = "step"; render(); });
    assert.equal(await p.$$eval("#ans option[value]:not([value=''])", os => os.every(o => o.getAttribute("translate") === "no" && o.value === o.textContent)), true);
    assert.equal(await p.evaluate(() => answerProblem(steps.find(s => s.id === "county"), "Lago")), "Choose your county from the list.");
    assert.equal(await p.evaluate(() => answerProblem(steps.find(s => s.id === "county"), "Lake")), "");
  });
});

describe("BT58. Showing the filled form's pages doesn't keep using more memory", () => {
  const pagesShown = q => q.waitForFunction(() => document.querySelectorAll("#preview canvas").length >= 4, null, { timeout: 180000 });
  const open = q => q.evaluate(() => pdfHolders.size);
  test("with the pages shown, opening and cancelling a box, or saving a change, keeps one worker and closes the old PDFs", async () => {
    const q = await fresh();
    await inject(q, "respond");
    await ready(q);
    await q.evaluate(() => { document.querySelector('details[data-more="preview"]').open = true; });
    await pagesShown(q);
    const workers = q.workers().length;
    for (let i = 0; i < 4; i++) { await editHere(q, "plaintiff"); await q.click("#ieCancel"); await pagesShown(q); }
    assert.equal(q.workers().length, workers, "open and cancel: no new worker");
    for (const name of ["Acme Credit Co", "Acme Credit Inc"]) {
      await editHere(q, "plaintiff"); await q.fill("#inEdit", name); await q.click("#ieSave");
      await ready(q); await q.evaluate(() => { document.querySelector('details[data-more="preview"]').open = true; }); await pagesShown(q);
    }
    assert.equal(q.workers().length, workers, "saved changes: no new worker");
    assert.equal(await open(q), 1, "only the preview's PDF is open");
    await q.context().close();
  });
  test("a page shown large and changed there twice, then closed: the old PDFs are closed", async () => {
    const q = await fresh();
    await inject(q, "respond");
    await openPage(q, 1);
    const workers = q.workers().length;
    for (const name of ["Acme Credit Co", "Acme Credit Inc"]) {
      await tap(q, "plaintiff");
      await q.fill("#inEdit", name);
      await q.keyboard.press("Enter");
      await q.waitForFunction(n => document.querySelector("dialog.pageview .pvpage canvas") && !document.getElementById("pvEdit") && answers.plaintiff === n, name, { timeout: 120000 });
      await q.waitForFunction(() => !document.querySelector("dialog.pageview .draftnote[role=status]"), null, { timeout: 120000 });
    }
    assert.equal(q.workers().length, workers);
    assert.ok(await open(q) <= 2, `open: ${await open(q)}`);
    await q.click("#pvClose");
    await q.waitForFunction(() => !document.querySelector("dialog.pageview"));
    await q.waitForFunction(() => pdfHolders.size <= 1, null, { timeout: 5000 }).catch(() => {});
    assert.ok(await open(q) <= 1, `after Close: ${await open(q)}`);
    await q.context().close();
  });
});

describe("BT59. \"Fix\" on a flagged part keeps the selected part in sight after the page settles", () => {
  const PW = "my portal password is Tr0ub4dor&3";
  const long = Array.from({ length: 30 }, (_, i) => `Line ${i + 1} of what happened.`).concat(PW).join("\n");
  // The selected text's line is in the box's view, and the box and its note are on the screen.
  const inSight = q => q.evaluate(() => {
    const el = document.getElementById("ans"), box = el.getBoundingClientRect(), note = document.getElementById("hitnote").getBoundingClientRect();
    const cs = getComputedStyle(el), lh = (el.scrollHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)) / el.value.split("\n").length;
    const line = el.value.slice(0, el.selectionStart).split("\n").length - 1, top = parseFloat(cs.paddingTop) + line * lh;
    return box.top >= 0 && note.bottom <= window.innerHeight && top >= el.scrollTop - 1 && top + lh <= el.scrollTop + el.clientHeight + 1;
  });
  for (const [what, w, h, size] of [["360x640 at 150%", 360, 640, 2], ["a landscape phone", 740, 360, 0]]) test(what, async () => {
    const q = await fresh({ viewport: { width: w, height: h } });
    await q.evaluate(n => { look.size = n; applyDisplay(); }, size);
    await inject(q, "respond", { defenses: long });
    await q.click('ul.flags button[data-fix="defenses"][data-hit]');
    await settle(q); await settle(q);
    assert.equal(await q.evaluate(() => { const el = document.getElementById("ans"); return el.value.slice(el.selectionStart, el.selectionEnd).length > 0; }), true);
    assert.equal(await inSight(q), true);
    await q.context().close();
  });
});

describe("BT60 and BT61. A box on the summary being typed in isn't drawn again; the rest of the summary is", () => {
  const NO_DATES = { skip: BROWSER === "webkit" && "Playwright's WebKit date box takes no typed dates" };
  // The filled form is made again slowly, so it finishes while the box is being typed in.
  const slowBuild = q => q.evaluate(() => { window.__realBuild ||= buildPdf; globalThis.eval("buildPdf = (...a) => new Promise(r => setTimeout(r, 1500)).then(() => window.__realBuild(...a))"); pdfState = { key: null }; ensurePdf(); renderSummary(true); });
  test("only the year of a whole date retyped, with the summary drawn again halfway: the same box, and the date typed is saved", NO_DATES, async () => {
    const q = await fresh();
    await inject(q, "continuance", { hearingDate: "2027-01-15" });
    await ready(q);
    await editHere(q, "hearingDate");
    const box = await q.$("#inEdit");
    await q.focus("#inEdit");
    await q.keyboard.press("ArrowRight"); await q.keyboard.press("ArrowRight"); // to the year, whatever the order of the parts
    await q.keyboard.type("20");
    await q.evaluate(() => keepFocus(() => renderSummary(true))); // what the filled form finishing does
    assert.equal(await box.evaluate(b => b.isConnected && document.activeElement === b), true, "the same box, still focused");
    await q.keyboard.type("28");
    assert.equal(await q.$eval("#inEdit", b => b.value), "2028-01-15");
    await q.click("#ieSave");
    assert.equal(await q.evaluate(() => answers.hearingDate), "2028-01-15");
    await q.context().close();
  });
  test("a date left half typed: the downloads still come up when the form is ready", NO_DATES, async () => {
    const q = await fresh();
    await inject(q, "continuance");
    await ready(q);
    await slowBuild(q);
    await editHere(q, "hearingDate");
    await q.evaluate(() => { document.getElementById("inEdit").value = ""; });
    await q.focus("#inEdit");
    await q.keyboard.type("02");
    await q.waitForFunction(() => !pdfState.busy, null, { timeout: 120000 });
    await q.waitForSelector("#dlAll", { timeout: 5000 });
    assert.equal(await q.evaluate(() => [document.activeElement.id, document.getElementById("inEdit").validity.badInput].join()), "inEdit,true");
    await q.context().close();
  });
  test("text being typed: the box, its cursor and its undo stay through a redraw, and the downloads and flags are new", async () => {
    const q = await fresh();
    await inject(q, "continuance");
    await ready(q);
    await editHere(q, "reason");
    const box = await q.$("#inEdit");
    await q.focus("#inEdit");
    await q.keyboard.press("End");
    await q.keyboard.type(" Surgery");
    const status = await q.$(".status");
    await q.evaluate(() => keepFocus(() => renderSummary(true)));
    assert.equal(await box.evaluate(b => b.isConnected && document.activeElement === b && b.selectionStart === b.value.length), true);
    assert.equal(await status.evaluate(s => s.isConnected), false, "the status was drawn again");
    assert.ok(await q.$("#dlAll"));
    await q.keyboard.press(process.platform === "darwin" ? "Meta+z" : "Control+z");
    assert.equal(await q.$eval("#inEdit", b => b.value.endsWith("Surgery")), false, "undo still works");
    await q.keyboard.press("Enter").catch(() => {});
    await q.context().close();
  });
});

describe("BT62. \"The bar moved back a little\" is said only when it did", () => {
  const pct = q => q.$eval(".bar[role=progressbar]", b => +b.getAttribute("aria-valuenow"));
  test("Yes to related cases on the Answer: the bar moves forward, and nothing says it moved back", async () => {
    await reset(p);
    await pick(p, "respond");
    await walk(p, "related");
    const before = await pct(p), total = await p.evaluate(() => completeness().total);
    await answer(p, "yes");
    assert.ok(await p.evaluate(() => completeness().total) > total, "it brought up a needed question");
    assert.ok(await pct(p) >= before, `${before}% to ${await pct(p)}%`);
    assert.equal(await p.locator("#barNote").count(), 0);
  });
  test("edge: when the bar does move back, the note is still there", async () => {
    await reset(p);
    await pick(p, "appearance");
    await walk(p, "svcMore1");
    const before = await pct(p);
    await answer(p, "yes");
    assert.ok(await pct(p) < before);
    assert.match(await p.textContent("#barNote"), /so the bar moved back a little\.$/);
  });
});

describe("BT65. Words in the phone box are told to type None, as the question says, not to leave a needed box blank", () => {
  test("Appearance, Answer and continuance: \"I don't have a phone\" is told to type None; a fax is told it can be left blank", async () => {
    for (const form of ["appearance", "respond", "continuance"]) {
      await inject(p, form, { phone: "I don't have a phone" });
      const why = (await p.evaluate(() => runChecks().filter(f => f.fix === "phone").map(f => f.why))).join(" ");
      assert.match(why, /type None if you don't have one\./, form);
      assert.doesNotMatch(why, /leave it blank/, form);
      await inject(p, form, { phone: "" });
      assert.match((await p.evaluate(() => runChecks().filter(f => f.fix === "phone").map(f => f.why))).join(" "), /None/, `${form}: blank is missing, and says None`);
    }
    await inject(p, "appearance", { fax: "ask my sister" });
    assert.match((await p.evaluate(() => runChecks().filter(f => f.fix === "fax").map(f => f.why))).join(" "), /leave it blank if you don't have one\./);
  });
});

describe("BT63. \"Your lists say different things\": its advice works, and two lists saying all, or the rest, are flagged", () => {
  const SAYS = "check|Your lists say different things";
  const why = () => p.evaluate(() => runChecks().filter(f => f.title === "Your lists say different things").map(f => f.why).join(" "));
  test("admitted 1, denied all, third list 4: the advice names 1 and 4, and following it leaves no flag", async () => {
    assert.ok((await listFlags("1", "all", "4")).includes(SAYS));
    assert.match(await why(), /your lists of paragraphs you admit and .+ name paragraphs 1 and 4\. .*"all except 1 and 4"/);
    assert.deepEqual(await listFlags("1", "all except 1 and 4", "4"), []);
  });
  test("\"all\" in two lists, \"the rest\" in two, or one of each: flagged", async () => {
    for (const [ad, de, ne, says] of [["all", "all", "", "all of them"], ["the rest", "", "the rest", "the rest"], ["all", "everything else", "", "all of them or the rest"]]) {
      assert.deepEqual(await listFlags(ad, de, ne), [SAYS], `${ad} / ${de} / ${ne}`);
      assert.match(await why(), new RegExp(`each say ${says}\\. A paragraph can only be in one list`));
    }
  });
  test("edge: one list says the rest next to numbers, or all on its own: no flag", async () => {
    assert.deepEqual(await listFlags("1-3", "the rest"), []);
    assert.deepEqual(await listFlags("all", ""), []);
  });
});

describe("BT64. Correct paragraph lists get no false flags", () => {
  test("next to the paragraphs they leave out, these lists get no flag", async () => {
    for (const [ad, de, ne = ""] of [
      ["all except one and two", "1, 2"], ["all except 3, 4, & 7", "3, 4, 7"], ["all except 3, 4, or 7", "3, 4, 7"], ["all except para. 3", "3"],
      ["all except #s 3 and 4", "3, 4"], ["all with the exception of 3", "3"], ["1-10, not 3", "3"], ["#1-#5", "6"], ["No. 1 to No. 5", "6"],
      ["1, 2, 3", "everything after 3"], ["1-7", "the last 3"], ["1, 2", "3 - I never got the 30 day notice"], ["the first 3", "4 - the first 30 days were paid"],
      ["#1, #2", "#3 (I made 2 payments in 2021)"], ["1,2,3,4", "5,6,7", "8,9 (I first learned of this in 2 letters)"],
      ["1. I live in Allen County\n2. I signed the lease", "3. I owe $900"],
    ]) assert.deepEqual(await listFlags(ad, de, ne), [], `${ad} / ${de} / ${ne}`);
  });
  test("edge: real mistakes are still flagged, and \"one - four\", \"1-3; the rest\" and \"4. I only agreed to one.\" read as before", async () => {
    assert.deepEqual(await listFlags("1, 2", "2, 3"), ["check|Paragraphs listed in more than one list"]);
    assert.deepEqual(await listFlags("1", "3 - I never got the notice"), ["check|Paragraphs not in any list"]);
    assert.deepEqual(await listFlags("1, 3 - I paid on time", ""), ["check|Paragraphs not in any list"]);
    assert.deepEqual(await p.evaluate(() => ["one - four", "1-3; the rest", "4. I only agreed to one.", "the first five", "the first 30 days"].map(t => [...paragraphNumbers(t)].join(","))),
      ["1,2,3,4", "1,2,3", "4", "1,2,3,4,5", "30"]);
  });
});

describe("BT73 and TG17. A sworn total on the fee waiver is never worked out from an amount that isn't a number", () => {
  const row = (q, label) => q.evaluate(l => (SITUATIONS.feewaiver.fields(visibleAnswers()).find(r => r.label.startsWith(l)) || {}).value, label);
  const base = { incomeKinds: "wages,ssi", expenseKinds: "housing", housing: "700", hourlyRate: "18.50", ssi: "943", bank: "250" };
  test("hours \"40 a week\": wages and Total Income are left blank, nothing prints $0.00, and the flag says the total waits", async () => {
    await inject(p, "feewaiver", { ...base, monthlyHours: "40 a week" });
    assert.equal(await row(p, "6. and Total Income"), "Left blank until every amount in it is a number");
    assert.equal(await row(p, "Wages per month"), "Left blank");
    const why = (await p.evaluate(() => runChecks().filter(f => f.fix === "monthlyHours").map(f => f.why))).join(" ");
    assert.match(why, /Until it is, your Total Income is left blank too\./);
    const text = await pdfText(p);
    assert.doesNotMatch(text, /(?<![\d,])0\.00/, "no $0.00 total or wage");
    assert.match(text, /943\.00/, "the SSI amount still prints");
  });
  test("an amount with three decimals isn't printed or added, and the total waits; \"18.50/hr\" and \"300-400\" too", async () => {
    for (const [k, v] of [["ssi", "943.555"], ["hourlyRate", "18.50/hr"], ["ssi", "300-400"]]) {
      await inject(p, "feewaiver", { ...base, monthlyHours: "160", [k]: v });
      assert.equal(await row(p, "6. and Total Income"), "Left blank until every amount in it is a number", `${k}: ${v}`);
    }
    await inject(p, "feewaiver", { ...base, monthlyHours: "160", ssi: "943.555" });
    assert.doesNotMatch(await pdfText(p), /943\.56/);
  });
  test("TG17: the printed totals are right: wages worked out, every amount added, and blank while one is marked \"I'm not sure\"", async () => {
    await inject(p, "feewaiver", { ...base, monthlyHours: "160" });
    assert.equal(await row(p, "Wages per month"), "$2,960.00");
    assert.equal(await row(p, "6. and Total Income"), "$3,903.00");
    assert.equal(await row(p, "8. and Total Expenses"), "$700.00");
    const text = await pdfText(p);
    assert.match(text, /3,903\.00/); assert.match(text, /2,960\.00/); assert.match(text, /700\.00/);
    await inject(p, "feewaiver", { ...base, monthlyHours: "160", ssi: "" }, { ssi: true });
    assert.match(await row(p, "6. and Total Income"), /Left blank until you answer the questions marked "I'm not sure"/);
    assert.doesNotMatch(await pdfText(p), /3,903\.00|2,960\.00 .*2,960\.00/, "no old total kept");
  });
});

describe("BT72. A second case's calendar file doesn't replace the first case's event", () => {
  const part = (t, k) => t.match(new RegExp(`\\r\\n${k}:(.+)\\r\\n`))[1];
  test("another form for another case gets its own event; the first case again updates its own", async () => {
    await inject(p, "appearance", { caseNumber: "02D01-2611-CC-001234" });
    const day = await p.evaluate(() => { const d = new Date(); d.setDate(d.getDate() + 20); return dayString(d); });
    const ics = () => p.evaluate(d => courtDateIcs(d), day);
    const first = await ics(), again = await ics();
    assert.equal(part(again, "UID"), part(first, "UID"));
    assert.equal(part(again, "SEQUENCE"), "1");
    // "Choose a different form" keeps this page's events: here, a continuance for another case.
    await p.evaluate(() => { sitKey = "continuance"; steps = SITUATIONS[sitKey].steps(); answers.caseNumber = "49D02-2609-EV-004321"; });
    const other = await ics();
    assert.notEqual(part(other, "UID"), part(first, "UID"));
    assert.equal(part(other, "SEQUENCE"), "0");
    await p.evaluate(() => { sitKey = "appearance"; steps = SITUATIONS[sitKey].steps(); answers.caseNumber = "02D01-2611-CC-001234"; });
    const back = await ics();
    assert.equal(part(back, "UID"), part(first, "UID"));
    assert.equal(part(back, "SEQUENCE"), "2");
  });
});

describe("BT71. Choosing the same form again keeps its sorting answers", () => {
  test("eviction, Notice of Claim, Appearance; then Choose a different form and the same Appearance: \"Change these answers\" stays, and no Answer deadline", async () => {
    const q = await fresh();
    await q.click('.pick[data-kind="eviction"]');
    for (const v of ["notice", "yes"]) { await q.locator(`input[name=ans][value="${v}"]`).check({ force: true }); await q.click("#next"); }
    await q.click('[data-start="appearance"]');
    await walk(q, "summary", { caseNumber: "02D01-2611-EV-001234" });
    assert.equal(await q.locator("#editTriage").count(), 1, "from the sorting questions");
    const before = await q.evaluate(() => nextSteps(sitKey, visibleAnswers()).map(s => s.title));
    assert.ok(!before.includes("Check whether an Answer is due"), before.join(" | "));
    await q.click("#changeForm");
    await pick(q, "appearance");
    assert.equal(await q.evaluate(() => [mode, sitKey, fromTriage, triage.kind].join()), "summary,appearance,true,eviction");
    assert.equal(await q.locator("#editTriage").count(), 1);
    assert.deepEqual(await q.evaluate(() => nextSteps(sitKey, visibleAnswers()).map(s => s.title)), before);
    await q.context().close();
  });
  test("edge: a form first chosen from the list, chosen again, is as before", async () => {
    const q = await fresh();
    await pick(q, "appearance");
    await walk(q, "summary");
    await q.click("#changeForm");
    await pick(q, "appearance");
    assert.equal(await q.evaluate(() => [mode, fromTriage].join()), "summary,false");
    assert.equal(await q.locator("#editTriage").count(), 0);
    await q.context().close();
  });
});

describe("BT69. Cancel on a case number change keeps the county and court confirmed for the number", () => {
  const state = q => q.evaluate(() => [answers.caseNumber, answers.caseConfirm, caseConfirmFor, visible().some(s => s.id === "county")].join("|"));
  const CONFIRMED = "02D01-2611-CC-001234|yes|Allen County, Superior Court|false";
  test("another county's number typed, \"I'm not sure\" asked and dismissed, then Cancel", async () => {
    const q = await fresh();
    await inject(q, "respond", { caseConfirm: "yes" });
    await editAnswer(q, "caseNumber");
    await q.fill("#ans", "49D02-2609-EV-004321");
    q.removeAllListeners("dialog"); q.once("dialog", d => d.dismiss());
    await q.click("#unsure");
    await q.click("#back");
    assert.equal(await state(q), CONFIRMED);
    assert.ok(!(await q.evaluate(() => runChecks().some(f => ["county", "courtType"].includes(f.fix)))), "County and Court aren't missing");
    await q.context().close();
  });
  test("another county's number typed with saving on, a reload, then Cancel", async () => {
    const q = await fresh();
    await q.click("#savePref");
    await inject(q, "respond", { caseConfirm: "yes" });
    await q.evaluate(() => saveProgress());
    await editAnswer(q, "caseNumber");
    await q.fill("#ans", "49D02-2609-EV-004321");
    await q.reload(); await q.waitForSelector("#app h1");
    if (await q.locator("#resume").count()) await q.click("#resume");
    await q.waitForSelector("#back");
    await q.click("#back");
    assert.equal(await state(q), CONFIRMED);
    await q.context().close();
  });
});

describe("BT70. Every way out of a box with a change that isn't saved asks first", () => {
  const TYPED = "I paid this debt in full in 2023, and I have the receipt.";
  const asked = async (q, leave, answer) => {
    q.removeAllListeners("dialog");
    let message = null;
    q.once("dialog", d => { message = d.message(); return answer ? d.accept() : d.dismiss(); });
    await leave(q);
    await q.waitForTimeout(150);
    return message;
  };
  for (const [how, leave] of [
    ["Back to questions", q => q.click("#toQuestions")],
    ["Choose a different form", q => q.click("#changeForm")],
    ["the logo", q => q.click("#homeBtn")],
    ["the browser's Back", q => q.goBack()],
  ]) test(`on the summary, ${how}: asked; No keeps the box and the text, Yes leaves`, async () => {
    const q = await fresh();
    await inject(q, "respond");
    await editHere(q, "defenses");
    await q.fill("#inEdit", TYPED);
    assert.match(await asked(q, leave, false), /Discard your change to "Your defenses"\?/);
    assert.equal(await q.evaluate(() => [mode, document.getElementById("inEdit")?.value].join("|")), `summary|${TYPED}`);
    await asked(q, leave, true);
    assert.equal(await q.evaluate(() => inlineEdit), null);
    await q.context().close();
  });
  for (const [how, leave] of [["Close", q => q.click("#pvClose")], ["the browser's Back", q => q.goBack()]]) test(`on a page shown large, ${how}: asked; No keeps the box`, async () => {
    const q = await fresh();
    await inject(q, "respond");
    await openPage(q, 1);
    await tap(q, "plaintiff");
    await q.fill("#inEdit", "Acme Credit Holdings LLC");
    assert.match(await asked(q, leave, false), /Discard your change to "Plaintiff"\?/);
    assert.equal(await q.evaluate(() => [!!document.querySelector("dialog.pageview[open]"), document.getElementById("inEdit")?.value].join("|")), "true|Acme Credit Holdings LLC");
    await asked(q, leave, true);
    await q.waitForFunction(() => !document.querySelector("dialog.pageview"));
    await q.context().close();
  });
  test("edge: with nothing changed, nothing is asked", async () => {
    const q = await fresh();
    await inject(q, "respond");
    await editHere(q, "defenses");
    assert.equal(await asked(q, q2 => q2.click("#toQuestions"), true), null);
    assert.equal(await q.evaluate(() => mode), "step");
    await q.context().close();
  });
});

describe("BT75. The time asked for on the continuance is checked, as \"How this tool checks\" says", () => {
  const flagged = async v => { await inject(p, "continuance", { timeNeeded: v }); return p.evaluate(() => runChecks().filter(f => f.fix === "timeNeeded").map(f => f.why).join(" ")); };
  test("a date, a bare number and words with no amount of time are flagged", async () => {
    for (const v of ["2027-01-12", "1/12/2027"]) assert.match(await flagged(v), /This looks like a date/, v);
    for (const v of ["2", "as soon as possible", "yes", "a few weeks"]) assert.match(await flagged(v), /This doesn't say a number of days or weeks/, v);
  });
  test("edge: amounts of time aren't", async () => {
    for (const v of ["2 weeks", "14 days", "30-45 days", "two weeks", "a week", "1 month", "10 more days", "3 weeks to find a lawyer", "fourteen (14) days", "at least 10 business days"]) assert.equal(await flagged(v), "", v);
  });
});

describe("BT67. A quick double tap on Continue on a touch screen doesn't skip or answer the next question", () => {
  test("two taps 130 ms apart on Continue, question after question: each moves on by one, with nothing marked or chosen", async () => {
    const q = await fresh({ viewport: { width: 375, height: 667 }, hasTouch: true });
    await q.evaluate(() => startSituation("respond"));
    for (let i = 0; i < 12; i++) {
      const s = await q.evaluate(() => (mode === "step" ? { id: visible()[cur].id, type: visible()[cur].type, cur } : null));
      if (!s) break;
      if (["text", "textarea", "email", "tel"].includes(s.type)) await q.fill("#ans", VALUES[s.id] ?? "x");
      else if (s.type === "choice") await q.locator("input[name=ans]").first().check({ force: true });
      await q.locator("#next").scrollIntoViewIfNeeded();
      const b = await q.locator("#next").boundingBox(), x = b.x + b.width / 2, y = b.y + b.height / 2;
      await q.touchscreen.tap(x, y); await q.waitForTimeout(130); await q.touchscreen.tap(x, y); await q.waitForTimeout(300);
      const now = await q.evaluate(() => ({ cur, id: mode === "step" ? visible()[cur].id : mode, marked: Object.keys(unsure).filter(k => unsure[k]) }));
      assert.equal(now.cur, s.cur + 1, `${s.id}: moved on by one`);
      assert.deepEqual(now.marked, [], `${s.id}: nothing marked "I'm not sure"`);
      assert.equal(await q.evaluate(id => answers[id], now.id), undefined, `${now.id}: not answered by the second tap`);
    }
    await q.context().close();
  });
  test("edge: a mouse click right after a double tap still works", async () => {
    const q = await fresh({ viewport: { width: 375, height: 667 }, hasTouch: true });
    await q.evaluate(() => startSituation("respond"));
    await q.fill("#ans", VALUES.caseNumber);
    await q.locator("#next").scrollIntoViewIfNeeded();
    const b = await q.locator("#next").boundingBox();
    await q.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); await q.waitForTimeout(130); await q.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
    await q.locator("input[name=ans]").first().check({ force: true });
    assert.equal(await q.locator("input[name=ans]").first().isChecked(), true);
    await q.context().close();
  });
});

describe("BT68. With a mouse, a \"More\" opened by resting on it doesn't close and move the answers as the pointer goes down", () => {
  test("continuance, court type: rest on More, then click Superior Court where it is: Superior Court is chosen", async () => {
    const q = await fresh({ viewport: { width: 1280, height: 900 } });
    await inject(q, "continuance", { caseConfirm: "" });
    await q.evaluate(() => { cur = visible().findIndex(s => s.id === "courtType"); mode = "step"; returnToSummary = false; render(); });
    const more = q.locator("details.more:not(.nohover) > summary").first();
    assert.ok(await more.count(), "the question has a More");
    const m = await more.boundingBox();
    await q.mouse.move(m.x + 10, m.y + m.height / 2);
    await q.waitForTimeout(600);
    assert.equal(await q.$eval("details.more:not(.nohover)", d => d.open), true, "it opened on resting");
    const target = await q.locator('input[name=ans][value="SUPERIOR"]').locator("xpath=..").boundingBox();
    await q.mouse.move(target.x + 20, target.y + target.height / 2, { steps: 8 });
    await q.mouse.down(); await q.mouse.up();
    assert.equal(await q.$eval('input[name=ans]:checked', i => i.value), "SUPERIOR");
    await q.context().close();
  });
  test("Escape closes it; moving back up above it closes it too", async () => {
    const q = await fresh({ viewport: { width: 1280, height: 900 } });
    await inject(q, "continuance", { caseConfirm: "" });
    await q.evaluate(() => { cur = visible().findIndex(s => s.id === "courtType"); mode = "step"; returnToSummary = false; render(); });
    const m = await q.locator("details.more:not(.nohover) > summary").first().boundingBox();
    await q.mouse.move(m.x + 10, m.y + m.height / 2); await q.waitForTimeout(600);
    await q.keyboard.press("Escape");
    assert.equal(await q.$eval("details.more:not(.nohover)", d => d.open), false, "Escape");
    await q.mouse.move(m.x + 10, m.y + m.height + 200); await q.mouse.move(m.x + 10, m.y + m.height / 2); await q.waitForTimeout(600);
    assert.equal(await q.$eval("details.more:not(.nohover)", d => d.open), true);
    await q.mouse.move(m.x + 10, m.y - 40, { steps: 4 });
    assert.equal(await q.$eval("details.more:not(.nohover)", d => d.open), false, "moved up and away");
    await q.context().close();
  });
});

describe("BT74. Sentences about a password aren't flagged, and more ways of typing private numbers are", () => {
  const kind = t => p.evaluate(t => privateKind(t), t);
  test("sentences about a password: no flag", async () => {
    for (const t of ["My password was used without my permission", "My password was given to someone at the store", "The password is no longer valid", "I changed the password 3 times", "The password was reset by the bank"])
      assert.equal(await kind(t), null, t);
  });
  test("\"123 45-6789\", \"123--45--6789\", \"my PIN (4421)\" and \"password - hunter2\" are flagged; so is a number after a foreign phone number", async () => {
    for (const [t, k] of [["My SSN is 123 45-6789", "ssn"], ["123--45--6789", "ssn"], ["my PIN (4421)", "pin"], ["password - hunter2", "pin"]]) assert.equal(await kind(t), k, t);
    await inject(p, "appearance", { phone: "+44 20 7946 0958, SSN 123-45-6789" });
    assert.ok(await p.evaluate(() => runChecks().some(f => f.fix === "phone" && /^Private information/.test(f.title))));
  });
  test("edge: a password, and a foreign phone number alone, read as before", async () => {
    for (const t of ["my password is fluffy", "password: Tr0ub4dor&3", "password 12345678", "My password is hunter2"]) assert.equal(await kind(t), "pin", t);
    await inject(p, "appearance", { phone: "+44 20 7946 0958" });
    assert.ok(!(await p.evaluate(() => runChecks().some(f => /^Private information/.test(f.title)))));
  });
});

describe("BT76. If the PDF viewer can't load, the pages can be tried again", () => {
  const openPages = q => q.evaluate(() => { const d = document.querySelector('details[data-more="preview"]'); d.open = false; d.open = true; });
  // The viewer is served by this site (BT77): the page is served over http, where its file can be blocked.
  test("blocked: it says so with Try again; unblocked, Try again (or opening the section again) shows the pages", async () => {
    const q = await (await site()).open();
    q.allowErrors = true; // the blocked viewer is reported in the console on purpose
    await q.route("**/pdf.min.js*", r => r.abort());
    await inject(q, "respond");
    await ready(q);
    await openPages(q);
    await q.waitForSelector("#preview [data-retry-preview]", { timeout: 60000 });
    assert.match(await q.textContent("#preview"), /couldn't be shown.*try again/);
    await q.unroute("**/pdf.min.js*");
    await q.click("#preview [data-retry-preview]");
    await q.waitForSelector("#preview canvas", { timeout: 60000 });
    await q.context().close();
  });
  test("closing and opening the section after a failure tries again; while loading, it says so", async () => {
    const q = await (await site()).open();
    q.allowErrors = true;
    await q.route("**/pdf.min.js*", r => r.abort());
    await inject(q, "respond");
    await ready(q);
    await openPages(q);
    await q.waitForSelector("#preview [data-retry-preview]", { timeout: 60000 });
    await q.unroute("**/pdf.min.js*");
    let release;
    await q.route("**/pdf.min.js*", async r => { await new Promise(res => { release = res; }); await r.fallback(); });
    await openPages(q);
    await q.waitForSelector("#preview [data-loading]", { timeout: 5000 });
    assert.equal(await q.textContent("#preview [data-loading]"), "Loading the pages…");
    while (!release) await q.waitForTimeout(50);
    release();
    await q.waitForSelector("#preview canvas", { timeout: 60000 });
    assert.equal(await q.locator("#preview [data-loading]").count(), 0);
    await q.context().close();
  });
});

describe("BT78. A keyboard can scroll a page shown large that has nothing on it to change", () => {
  test("the fee waiver's page 2: the page can be focused, and Page Down scrolls it", async () => {
    const q = await fresh({ viewport: { width: 1000, height: 600 } });
    await inject(q, "feewaiver");
    await openPage(q, 2);
    assert.equal(await q.$eval("dialog.pageview .pvbody", b => [b.tabIndex, b.getAttribute("role")].join()), "0,region");
    await q.focus("dialog.pageview .pvbody");
    const top = await q.$eval("dialog.pageview .pvbody", b => b.scrollTop);
    await q.keyboard.press("PageDown");
    await q.waitForFunction(t => document.querySelector("dialog.pageview .pvbody").scrollTop > t, top, { timeout: 3000 }).catch(() => {});
    assert.ok(await q.$eval("dialog.pageview .pvbody", b => b.scrollTop) > top);
    await q.context().close();
  });
});

describe("BT79. Turning the phone or zooming keeps an open box on a page shown large on the screen", () => {
  test("opened sideways at 844x390, then turned upright: the box is within the screen's width, near its answer", async () => {
    const q = await fresh({ viewport: { width: 844, height: 390 } });
    await inject(q, "respond");
    await openPage(q, 1);
    await tap(q, "address");
    await q.setViewportSize({ width: 390, height: 844 });
    await q.waitForTimeout(300);
    const [box, spot] = await q.evaluate(() => [document.getElementById("pvEdit"), document.querySelector(".pvspot.on")].map(e => { const r = e.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; }));
    assert.ok(box.left >= 0 && box.right <= 390, JSON.stringify(box));
    assert.ok(Math.abs(box.top - spot.bottom) < 40 || Math.abs(spot.top - box.bottom) < 40, `${JSON.stringify(box)} ${JSON.stringify(spot)}`);
    await q.context().close();
  });
});

describe("BT80. Printing the page prints a note saying to print the PDF instead", () => {
  test("in print, from the summary and from a page shown large, only the note shows", async () => {
    const q = await fresh();
    await inject(q, "respond");
    await openPage(q, 1);
    await q.emulateMedia({ media: "print" });
    const shown = await q.evaluate(() => [...document.querySelectorAll("body *")].filter(e => e.getClientRects().length && getComputedStyle(e).visibility !== "hidden" && !e.querySelector(".printnote")).map(e => e.className || e.tagName));
    assert.deepEqual(shown, ["printnote"]);
    assert.match(await q.textContent(".printnote"), /Download all forms \(PDF\)/);
    await q.emulateMedia({ media: "screen" });
    assert.equal(await q.$eval(".printnote", e => e.getClientRects().length), 0, "not on the screen");
    await q.context().close();
  });
});

describe("BT81. When answers vanish, the first screen says why", () => {
  const note = q => q.evaluate(() => document.getElementById("goneNote")?.textContent || "");
  test("Clear my data in another tab: this tab's first screen says the answers were deleted there", async () => {
    const ctx = await site();
    const a = await ctx.open();
    await a.click("#saveToggle");
    await pick(a, "appearance");
    await walk(a, "name");
    await a.fill("#ans", "Pat Keeper"); await a.click("#next");
    const b = await ctx.open();
    await b.click("#clearData");
    await a.waitForFunction(() => mode === "pick", null, { timeout: 5000 });
    assert.match(await note(a), /were deleted in another tab\./);
    await pick(a, "appearance");
    assert.equal(await a.evaluate(() => document.getElementById("goneNote")), null, "gone once the person moves on");
    await ctx.close();
  });
  test("Back to the page after leaving, with saving off: it says the answers were cleared because saving is off", async () => {
    const q = await fresh();
    await inject(q, "appearance");
    await q.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
    assert.match(await note(q), /cleared because saving is off/);
    await q.context().close();
  });
  test("a saved copy more than 30 days old: it says it was deleted and saving is off", async () => {
    const q = await fresh();
    await q.evaluate(k => { localStorage.setItem("icfh-save-pref", "on"); localStorage.setItem(k, JSON.stringify({ v: 1, sitKey: "appearance", answers: { name: "Pat Example" }, unsure: {}, savedAt: Date.now() - 31 * 864e5 })); }, SAVED);
    await q.reload(); await q.waitForSelector("#app h1");
    assert.match(await note(q), /more than 30 days old, so they were deleted, and saving is off/);
    await q.context().close();
  });
});

describe("BT84. Typing in a box on the summary while saving fails says so, as the question does", () => {
  test("storage full: the header stops saying it's saved, and screen readers are told", async () => {
    const q = await fresh();
    await q.click("#saveToggle");
    await inject(q, "respond");
    await q.evaluate(() => saveProgress());
    assert.match(await q.textContent("#privacy"), /^Saved/);
    await q.waitForFunction(() => pdfState.result && !pdfState.busy, null, { timeout: 120000 });
    await editHere(q, "defenses");
    // Every announcement, since a later one (the form made again) can replace it before it's read.
    await q.evaluate(() => { window.__said = []; new MutationObserver(() => __said.push(document.getElementById("announce").textContent)).observe(document.getElementById("announce"), { childList: true, characterData: true, subtree: true }); });
    await q.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException("full", "QuotaExceededError"); }; });
    await q.type("#inEdit", " More.");
    await q.waitForFunction(() => __said.some(t => /can't be saved on this device right now/.test(t)), null, { timeout: 5000 });
    assert.doesNotMatch(await q.textContent("#privacy"), /^Saved/);
    await q.context().close();
  });
});

describe("BT82. The saving note says Safari can delete saved answers sooner than 30 days", () => {
  test("the first screen's note about saving names Safari's 7 days", async () => {
    await reset(p);
    const text = await p.evaluate(() => document.getElementById("app").textContent);
    assert.match(text, /If you don't change your answers for 30 days, they are deleted.*Safari on an iPhone, iPad or Mac can delete them sooner, after 7 days of using Safari without using this page\./);
  });
});

describe("BT66. The phone question has a button for no phone number, since a phone's number pad can't type None", () => {
  test("\"I don't have a phone number\" puts None in the box; Continue saves it, and it isn't flagged", async () => {
    for (const form of ["appearance", "feewaiver"]) {
      await inject(p, form, { phone: "" });
      await p.evaluate(() => { cur = visible().findIndex(s => s.id === "phone"); mode = "step"; returnToSummary = false; render(); });
      assert.equal(await p.$eval("#ans", b => b.type), "tel");
      await p.click("#noPhone");
      assert.equal(await p.$eval("#ans", b => b.value), "None");
      assert.equal(await p.evaluate(() => document.activeElement.id), "next");
      await p.click("#next");
      assert.equal(await p.evaluate(() => answers.phone), "None", form);
      assert.deepEqual(await p.evaluate(() => runChecks().filter(f => f.fix === "phone").map(f => f.title)), [], form);
    }
  });
  test("edge: the fax question has no such button", async () => {
    await inject(p, "appearance");
    await p.evaluate(() => { cur = visible().findIndex(s => s.id === "fax"); mode = "step"; render(); });
    assert.equal(await p.locator("#noPhone").count(), 0);
  });
});

describe("BT92. The fee waiver's next steps don't give $157 as the fee for every kind of case", () => {
  test("the $157 is Indiana Legal Help's civil figure, and the step says fees differ by kind of case and county", async () => {
    await inject(p, "feewaiver", { fwCaseType: "SC" });
    const step = await p.evaluate(() => nextSteps(sitKey, visibleAnswers()).find(s => s.title === "File these with the forms that start your case"));
    assert.match(step.short, /fees differ by kind of case and county/);
    assert.match(step.body, /small claims and eviction cases, for example, have fees of their own\. The clerk's office can tell you the fee for your case\./);
  });
});

describe("BT88. A township, town or city court case isn't sent to the county clerk", () => {
  const filing = () => p.evaluate(() => nextSteps(sitKey, visibleAnswers()).find(s => /courthouse/.test(s.title)));
  test("49K01, 06I02 and 20H01: the step names the kind of court and points to the directory, not the clerk's address", async () => {
    for (const [cn, county, kind] of [["49K01-2611-SC-001234", "Marion", "township small claims court"], ["06I02-2611-SC-001234", "Boone", "town court"], ["20H01-2611-SC-001234", "Elkhart", "city court"]]) {
      await inject(p, "appearance", { caseNumber: cn, county, fileMethod: "paper" });
      const step = await filing();
      assert.match(step.body, new RegExp(`means a ${kind}\\. Its office isn't the ${county} County Clerk's Office`), cn);
      assert.doesNotMatch(step.short + step.body, /lists the \w+ County Clerk's Office at/, cn);
    }
    assert.match((await filing()).body, /city court/);
  });
  test("edge: a circuit or superior court case still gets the county clerk", async () => {
    await inject(p, "appearance", { caseNumber: "02D01-2611-CC-001234", county: "Allen", fileMethod: "paper" });
    assert.match((await filing()).short, /Allen County Clerk's Office/);
  });
});

describe("TG11. Every tick and choice on the forms matches the answers", () => {
  // What the made form ticks and chooses, read from the form-filling library's own calls while the form is made.
  const marks = q => q.evaluate(async () => {
    const P = PDFLib, rec = [];
    const wrap = (proto, name, f) => { const orig = proto[name]; proto[name] = function (...a) { rec.push(f(this, a)); return orig.apply(this, a); }; return () => { proto[name] = orig; }; };
    const undo = [wrap(P.PDFCheckBox.prototype, "check", t => `${t.getName()}=on`), wrap(P.PDFCheckBox.prototype, "uncheck", t => `${t.getName()}=off`), wrap(P.PDFRadioGroup.prototype, "select", (t, a) => `${t.getName()}=${a[0]}`), wrap(P.PDFDropdown.prototype, "select", (t, a) => `${t.getName()}=${a[0]}`)];
    try { await buildPdf(sitKey, visibleAnswers()); } finally { undo.forEach(u => u()); }
    return rec.sort();
  });
  const made = async (form, over) => { await inject(p, form, over); await p.waitForFunction(() => pdfState.result && !pdfState.busy, null, { timeout: 120000 }); return marks(p); };
  test("the fee waiver: email, confidential address, related Yes or No, and the court", async () => {
    assert.deepEqual(await made("feewaiver", { acceptEmail: "yes", agConfidential: "no", related: "no", fwCourtType: "CIRCUIT" }),
      ["Check Box1=on", "Check Box2=off", "Check Box3=off", "Check Box4=on", "CourtType=CIRCUIT"]);
    assert.deepEqual(await made("feewaiver", { acceptEmail: "no", agConfidential: "yes", related: "yes", relatedNumbers: "02D01-2601-CC-000001", fwCourtType: "SUPERIOR" }),
      ["Check Box2=on", "Check Box3=on", "Check Box4=off", "CourtType=SUPERIOR"]); // with the Attorney General's address, the email question (and its box) isn't on the form
  });
  test("the Appearance, Answer and continuance: where papers go, related cases and local rules (and the continuance's agreement)", async () => {
    for (const form of ["appearance", "respond", "continuance"]) {
      const want = ["Case Information=Choice2", "Local Rules=Choice1", "Related Cases=Choice2", ...(form === "continuance" ? ["Request Agreement/Disagreement=Choice2"] : [])].sort();
      assert.deepEqual(await made(form, { receiveAt: "Choice2", related: "no", localRule: "none", otherAgreed: "Choice2" }), want, form);
      const yes = await made(form, { receiveAt: "Choice1", related: "yes", rel1Caption: "A v. B", rel1Number: "02D01-2601-CC-000001", relMore1: "no", localRule: "yes", localRuleText: "Rule 1" });
      assert.ok(yes.includes("Case Information=Choice1") && yes.includes("Related Cases=Choice1") && yes.includes("Local Rules=Choice2"), `${form}: ${yes}`);
    }
  });
});

describe("TG12 and TG13. Protected contact details don't come back or stay on the device", () => {
  test("TG12: the confidentiality program marked \"I'm not sure\" after Yes: the home address typed before is gone from the form and the copy", async () => {
    const q = await fresh();
    await q.click("#saveToggle");
    await inject(q, "appearance", { acp: "yes", acpAddress: "PO Box 1, Indianapolis, IN 46204", address: "77 Hidden Lane, Fort Wayne, IN 46802" });
    await q.evaluate(() => { cur = visible().findIndex(s => s.id === "acp"); mode = "step"; returnToSummary = false; render(); });
    await q.click("#unsure");
    assert.equal(await q.evaluate(() => answers.address), undefined);
    await q.evaluate(() => { mode = "summary"; render(); });
    assert.doesNotMatch(await pdfText(q), /Hidden Lane/);
    assert.doesNotMatch(await copy(q), /Hidden Lane/);
    await q.context().close();
  });
  test("TG13: on the fee waiver, choosing the Attorney General address takes the home address out of the copy before Continue; and with storage full, the copy that held it is deleted", async () => {
    const q = await fresh();
    await q.click("#saveToggle");
    await inject(q, "feewaiver", { address: "77 Hidden Lane, Fort Wayne, IN 46802", agConfidential: "no" });
    await q.evaluate(() => saveProgress());
    assert.match(await copy(q), /Hidden Lane/);
    await q.evaluate(() => { cur = visible().findIndex(s => s.id === "agConfidential"); mode = "step"; returnToSummary = false; render(); });
    await q.locator('input[name=ans][value="yes"]').check({ force: true });
    assert.doesNotMatch(await copy(q), /Hidden Lane/, "out of the copy at once");
    const r = await fresh();
    await r.click("#saveToggle");
    await inject(r, "feewaiver", { address: "77 Hidden Lane, Fort Wayne, IN 46802", agConfidential: "no" });
    await r.evaluate(() => saveProgress());
    await r.evaluate(() => { cur = visible().findIndex(s => s.id === "agConfidential"); mode = "step"; returnToSummary = false; render(); Storage.prototype.setItem = () => { throw new DOMException("full", "QuotaExceededError"); }; });
    await r.locator('input[name=ans][value="yes"]').check({ force: true });
    assert.doesNotMatch(await copy(r), /Hidden Lane/, "storage full: the copy that held it is gone");
    await q.context().close(); await r.context().close();
  });
});

// The libraries were on cdnjs, checked by integrity hashes. They're on this site now (BT77), checked against those
// hashes by tests/loading.test.mjs, so what's left to refuse is a file cut short on its way.
describe("TG15. A library that didn't arrive whole isn't used", () => {
  test("pdf-lib cut short on its way: the form isn't made with it, and the page says so", async () => {
    const q = await (await site({ change: (rel, read) => (rel.startsWith("vendor/pdf-lib/") ? read().slice(0, 200000) : null) })).open();
    q.allowErrors = true; // the broken library is reported in the console on purpose
    await inject(q, "respond");
    await q.waitForFunction(() => pdfState.error || pdfState.result, null, { timeout: 120000 });
    assert.equal(await q.evaluate(() => [pdfState.error, !!pdfState.result, typeof window.PDFLib].join()), "load,false,undefined");
    await q.context().close();
  });
  test("every library the page loads comes from this site", async () => {
    assert.equal(await p.evaluate(() => Object.values(LIBS).every(l => /^vendor\//.test(l.src))), true);
  });
});

describe("BT83. Box text and a county-and-court choice aren't lost in a few saving cases", () => {
  const warns = q => q.evaluate(() => { const e = new Event("beforeunload", { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented; });
  test("a choice on \"Is this your county and court?\", made but not continued, is still chosen after a reload", async () => {
    const q = await fresh();
    await q.click("#saveToggle");
    await pick(q, "respond");
    await walk(q, "caseConfirm");
    await q.locator('input[name=ans][value="yes"]').check({ force: true });
    await q.reload(); await q.waitForSelector("#app h1");
    if (await q.locator("#resume").count()) await q.click("#resume");
    await q.waitForSelector("input[name=ans]");
    assert.equal(await q.evaluate(() => [visible()[cur].id, document.querySelector("input[name=ans]:checked")?.value].join()), "caseConfirm,yes");
    await q.context().close();
  });
  test("text in a box on the summary counts between tabs: another tab asks before replacing it", async () => {
    const ctx = await site();
    const a = await ctx.open();
    await a.click("#saveToggle");
    await inject(a, "respond");
    await a.evaluate(() => saveProgress());
    const b = await ctx.open();
    if (await b.locator("#resume").count()) await b.click("#resume");
    await editHere(a, "defenses");
    await a.type("#inEdit", " And I have the receipt.");
    await b.bringToFront(); // a tab in the background waits to ask until it's in front
    b.removeAllListeners("dialog");
    let asked = null;
    b.once("dialog", d => { asked = d.message(); d.dismiss(); });
    await b.evaluate(() => saveProgress());
    assert.match(asked || "", /Another tab saved different answers/, "it asks before replacing");
    assert.match(await copy(a), /And I have the receipt\./, "No keeps it");
    await ctx.close();
  });
  test("with no answer yet, text in a box on the summary is saved, and closing warns while it isn't", async () => {
    const q = await fresh();
    await inject(q, "appearance");
    await q.evaluate(() => { answers = {}; unsure = {}; render(); });
    await editHere(q, "name");
    await q.type("#inEdit", "Pat Keeper");
    assert.equal(await warns(q), true, "saving off: closing warns");
    await q.click("#saveToggle");
    assert.match(await copy(q), /Pat Keeper/);
    await q.context().close();
  });
  test("a half-typed date in a box on the summary warns before closing", { skip: BROWSER === "webkit" && "Playwright's WebKit date box takes no typed dates" }, async () => {
    const q = await fresh();
    await q.click("#saveToggle");
    await inject(q, "continuance");
    await q.evaluate(() => saveProgress());
    await editHere(q, "hearingDate");
    await q.evaluate(() => { document.getElementById("inEdit").value = ""; });
    await q.focus("#inEdit");
    await q.keyboard.type("02");
    assert.equal(await q.evaluate(() => document.getElementById("inEdit").validity.badInput), true);
    assert.equal(await warns(q), true);
    await q.context().close();
  });
});

describe("BT95 and BT96. The privacy check marks only the private number, and is quick on long answers", () => {
  const marked = s => p.evaluate(s => privateSpans(s, privateKind).map(([a, b]) => s.slice(a, b)), s);
  test("BT95: \"Fix\" marks the routing number and the Social Security number, not a case or invoice number after them", async () => {
    assert.deepEqual(await marked("routing 071000013. The case is 02D01-2611-CC-001234."), ["071000013"]);
    assert.deepEqual(await marked("SSN 123-45-6789, invoice 100234567"), ["123-45-6789"]);
  });
  test("BT96: a Social Security number above a column of 4,900 amounts: marked in well under a second, and only it", async () => {
    const col = Array.from({ length: 4900 }, (_, i) => `${(i * 37) % 900 + 100}.${String(i % 100).padStart(2, "0")}`).join("\n");
    const [ms, spans] = await p.evaluate(s => { const t = performance.now(); const sp = privateSpans(s, privateKind); return [performance.now() - t, sp.map(([a, b]) => s.slice(a, b))]; }, `ssn 123-45-6789\n${col}`);
    assert.deepEqual(spans, ["123-45-6789"]);
    assert.ok(ms < 1000, `${Math.round(ms)} ms`);
  });
  test("edge: marks as before: an SSN next to a number, a PIN among numbers, a password, and a card number split by spaces", async () => {
    assert.deepEqual(await marked("123-45-6789 2"), ["123-45-6789"]);
    assert.deepEqual(await marked("my pin is 4421 and I owe 300"), ["4421"]);
    assert.deepEqual(await marked("my password is fluffy"), ["password is fluffy"]);
    assert.deepEqual(await marked("card 4111 1111 1111 1111"), ["4111 1111 1111 1111"]);
  });
});

describe("BT93. Case number and case type oddities", () => {
  const caseFlags = async (over, id = "caseNumber") => { await inject(p, "appearance", over); return p.evaluate(id => runChecks().filter(f => f.fix === id).map(f => f.why), id); };
  test("a 13th month and a year that hasn't come are flagged; an old number with five digits at the end isn't", async () => {
    assert.match((await caseFlags({ caseNumber: "02D01-2613-CC-001234" })).join(), /13 isn't a month/);
    assert.match((await caseFlags({ caseNumber: "02D01-6211-CC-001234" })).join(), /2062 hasn't come yet/);
    assert.deepEqual(await caseFlags({ caseNumber: "49D10-0608-CC-01729", county: "Marion" }), []);
  });
  test("case type \"I don't know\" gets one message, which doesn't say to leave it blank", async () => {
    await inject(p, "continuance", { caseNumber: "", caseTypeLetters: "I don't know" });
    const why = await p.evaluate(() => runChecks().filter(f => f.fix === "caseTypeLetters").map(f => f.why));
    assert.equal(why.length, 1, why.join(" | "));
    assert.match(why[0], /choose "I'm not sure"/);
    assert.doesNotMatch(why[0], /Leave it blank/);
  });
  test("edge: a usual case number and case type get no flag", async () => {
    assert.deepEqual(await caseFlags({ caseNumber: "02D01-2611-CC-001234" }), []);
  });
});
describe("BT93 edge", () => {
  test("a newer case number with five digits at the end is still a digit left out", async () => {
    await inject(p, "appearance", { caseNumber: "02D01-2611-CC-00123" });
    assert.match((await p.evaluate(() => runChecks().filter(f => f.fix === "caseNumber").map(f => f.why))).join(), /doesn't look like an Indiana case number/);
  });
});

describe("BT98. An address typed on lines ending in commas doesn't print two commas", () => {
  test("the Answer, Appearance and continuance print \"123 Main Street, Apt 4, Fort Wayne\"", async () => {
    for (const form of ["respond", "appearance", "continuance"]) {
      await inject(p, form, { address: "123 Main Street,\nApt 4,\nFort Wayne, IN 46802" });
      const text = await pdfText(p);
      assert.doesNotMatch(text, /,\s*,/, form);
      assert.match(text, /123 Main Street, Apt 4, Fort Wayne, IN 46802/, form);
    }
  });
});

describe("BT99. Characters the font lacks print as their plain form, or \"?\", never as something else", () => {
  const safe = (t) => p.evaluate(async t => { await loadPdfTools(OFFICIAL[SITUATIONS.respond.official.packet].file); const d = await PDFLib.PDFDocument.create(), f = await d.embedFont(PDFLib.StandardFonts.Helvetica); const seen = []; return [makeSafe(f, (c, o) => seen.push(`${c}>${o}`))(t), seen.join(" ")]; }, t);
  test("\"≠\" prints \"!=\", not \"=\"; ligatures, full-width digits, U+02BC and primes print plain", async () => {
    assert.equal((await safe("Amount owed ≠ $5,000"))[0], "Amount owed != $5,000");
    assert.equal((await safe("Certiﬁed"))[0], "Certified");
    assert.equal((await safe("OʼBrien"))[0], "O'Brien");
    assert.equal((await safe("１２３"))[0], "123");
    assert.equal((await safe("5′ 10″"))[0], "5' 10\"");
  });
  test("a defense in another alphabet makes a short flag", async () => {
    await inject(p, "respond", { defenses: "我没有欠这笔钱。我每个月都按时付款，房东从来没有修理任何东西。他们说的数字是错的，我有收据可以证明。".repeat(3) });
    await p.waitForFunction(() => pdfState.result && !pdfState.busy, null, { timeout: 120000 });
    const why = await p.evaluate(() => pdfFlags().filter(f => f.fix === "defenses" && /can't print/.test(f.why)).map(f => f.why).join(""));
    assert.ok(why.length > 0 && why.length < 400, `${why.length} characters`);
    assert.match(why, /and \d+ more/);
  });
});

describe("BT100. The flag for a signature too small or too long opens the name", () => {
  test("fee waiver, e-file, a 71-character name: the signature flag's Fix is the name", async () => {
    await inject(p, "feewaiver", { fileMethod: "efile", name: "Maximiliana Alexandrovna Konstantinopoulou-Vanderbilt-Rothschild Jr." });
    await p.waitForFunction(() => pdfState.result && !pdfState.busy, null, { timeout: 120000 });
    const sig = await p.evaluate(() => pdfFlags().filter(f => /^Signature/.test(f.title)).map(f => f.fix));
    assert.ok(sig.length, "flagged");
    assert.deepEqual([...new Set(sig)], ["name"]);
  });
});

describe("BT101. A blank answer can be tapped on a page shown large", () => {
  test("the Answer with the name blank: page 1 has a spot for the name", async () => {
    const q = await fresh();
    await inject(q, "respond", { name: "" });
    await openPage(q, 1);
    assert.ok(await q.locator('dialog.pageview .pvspot[data-id="name"]').count() > 0);
    await tap(q, "name");
    assert.equal(await q.$eval("#inEdit", b => b.value), "");
    await q.context().close();
  });
});

describe("BT102. Small problems with the page shown large", () => {
  const slow = q => q.evaluate(() => { window.__realBuild ||= buildPdf; globalThis.eval("buildPdf = (...a) => new Promise(r => setTimeout(r, 1500)).then(() => window.__realBuild(...a))"); });
  test("no tap spot reaches over the answer above it (the fee waiver's page 5)", async () => {
    const q = await fresh();
    await inject(q, "feewaiver");
    await openPage(q, 5);
    const boxes = await q.evaluate(() => [...document.querySelectorAll(".pvspot")].map(s => { const r = s.getBoundingClientRect(); return { id: s.dataset.id, l: r.left, r: r.right, t: r.top, b: r.bottom }; }));
    for (const a of boxes) for (const b of boxes) if (a !== b && a.id !== b.id && a.l < b.r && b.l < a.r)
      assert.ok(a.b <= b.t + 1 || b.b <= a.t + 1, `${a.id} and ${b.id} overlap`);
    await q.context().close();
  });
  test("while the page is made again: the hint says so, Escape closes the page, and a closed page stays closed", async () => {
    const q = await fresh();
    await inject(q, "respond");
    await openPage(q, 1);
    await slow(q);
    await tap(q, "plaintiff");
    await q.fill("#inEdit", "Acme Credit Holdings LLC");
    await q.keyboard.press("Enter");
    await q.waitForSelector("#pvSaving");
    assert.match(await q.textContent("dialog.pageview .pvhint"), /Making the page again/);
    await q.keyboard.press("Escape");
    await q.waitForFunction(() => !document.querySelector("dialog.pageview"));
    await q.waitForFunction(() => pdfState.result && !pdfState.busy, null, { timeout: 120000 });
    await q.waitForTimeout(800);
    assert.equal(await q.locator("dialog.pageview").count(), 0, "it doesn't open itself again");
    assert.notEqual(await q.evaluate(() => document.activeElement === document.body), true, "focus isn't dropped");
    await q.context().close();
  });
  test("the dashed outline is at least 3 to 1 on the white page, and the title bar is one row at 400% zoom", async () => {
    const q = await fresh({ viewport: { width: 320, height: 256 } });
    await inject(q, "respond");
    await q.waitForFunction(() => pdfState.result && !pdfState.busy, null, { timeout: 120000 });
    await q.evaluate(() => { document.querySelector('details[data-more="preview"]').open = true; });
    await q.waitForSelector('#preview [data-page="1"]', { timeout: 60000 });
    await q.evaluate(() => document.querySelector('#preview [data-page="1"]').click());
    await q.waitForSelector("dialog.pageview .pvspot", { timeout: 60000 });
    const [rgb, bar] = await q.evaluate(() => [getComputedStyle(document.querySelector(".pvspot")).outlineColor, document.querySelector(".pvbar").getBoundingClientRect().height]);
    const lum = c => { const [r, g, b] = c.match(/\d+/g).slice(0, 3).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    assert.ok(1.05 / (lum(rgb) + 0.05) >= 3, rgb);
    assert.ok(bar <= 60, `${bar}px`);
    await q.context().close();
  });
});

describe("BT103. Small saving problems", () => {
  test("a device clock more than a day behind keeps the saved answers", async () => {
    const q = await fresh();
    await q.click("#saveToggle");
    await inject(q, "appearance");
    await q.evaluate(() => saveProgress());
    await q.evaluate(k => { const d = JSON.parse(localStorage.getItem(k)); d.savedAt = Date.now() + 2 * 864e5; localStorage.setItem(k, JSON.stringify(d)); }, SAVED);
    await q.reload(); await q.waitForSelector("#app h1");
    assert.equal(await q.locator("#resume").count(), 1);
    await q.context().close();
  });
  test("the fee waiver's kinds of income, all unticked in an edit, come back with a reload and Cancel", async () => {
    const q = await fresh();
    await q.click("#saveToggle");
    await inject(q, "feewaiver", { incomeKinds: "wages,ssi" });
    await q.evaluate(() => saveProgress());
    await editAnswer(q, "incomeKinds");
    for (const v of ["wages", "ssi"]) await q.locator(`input[name=ans][value="${v}"]`).uncheck({ force: true });
    await q.reload(); await q.waitForSelector("#app h1");
    if (await q.locator("#resume").count()) await q.click("#resume");
    await q.waitForSelector("#back");
    await q.click("#back");
    assert.equal(await q.evaluate(() => answers.incomeKinds), "wages,ssi");
    await q.context().close();
  });
  test("a damaged copy with a choice that isn't an option opens, without that choice, and the form is made", async () => {
    const q = await fresh();
    await q.click("#saveToggle");
    await inject(q, "appearance");
    await q.evaluate(() => saveProgress());
    await q.evaluate(k => { const d = JSON.parse(localStorage.getItem(k)); d.answers.receiveAt = "Choice9"; d.answers.county = "Atlantis"; localStorage.setItem(k, JSON.stringify(d)); }, SAVED);
    await q.reload(); await q.waitForSelector("#app h1");
    await q.click("#resume");
    assert.equal(await q.evaluate(() => [answers.receiveAt, answers.county].join("|")), "|");
    await q.evaluate(() => { mode = "summary"; render(); });
    await q.waitForFunction(() => (pdfState.result || pdfState.error) && !pdfState.busy, null, { timeout: 120000 });
    assert.equal(await q.evaluate(() => [!!pdfState.result, pdfState.error].join()), "true,false");
    await q.context().close();
  });
});

describe("BT104. Enter pressed twice, or held, right after a save doesn't reopen what was saved", () => {
  test("Edit a choice, Enter Enter: back on the summary, not on the question again", async () => {
    await inject(p, "respond");
    await editAnswer(p, "receiveAt");
    await p.focus("input[name=ans]:checked");
    await p.keyboard.press("Enter"); await p.keyboard.press("Enter");
    await p.waitForTimeout(200);
    assert.equal(await p.evaluate(() => mode), "summary");
  });
  test("a box on the summary: Save held down with Enter saves once, and doesn't reopen it or add blank lines", async () => {
    const q = await fresh();
    await inject(q, "respond");
    await editHere(q, "defenses");
    await q.fill("#inEdit", "I paid it.");
    await q.focus("#ieSave");
    await q.keyboard.down("Enter");
    for (let i = 0; i < 6; i++) await q.keyboard.down("Enter"); // the key held: repeats
    await q.keyboard.up("Enter");
    await q.waitForTimeout(200);
    assert.equal(await q.evaluate(() => [mode, !!document.getElementById("inEdit"), answers.defenses].join("|")), "summary|false|I paid it.");
    await q.context().close();
  });
});

describe("BT105. Small phone and first-screen points", () => {
  test("at 375px the header's top row is one line, and the saving button has a name in the page itself", async () => {
    const q = await fresh({ viewport: { width: 375, height: 667 } });
    const [brand, help] = await q.evaluate(() => ["homeBtn", "helpBtn"].map(id => Math.round(document.getElementById(id).getBoundingClientRect().top)));
    assert.ok(Math.abs(brand - help) < 12, `${brand} ${help}`);
    const h = await q.evaluate(() => document.querySelector("header.top").getBoundingClientRect().height);
    assert.ok(h < 140, `${h}px (159 before)`);
    await q.context().close();
    const html = (await import("node:fs")).readFileSync(new URL("../../form-builder-mvp.html", import.meta.url), "utf8");
    assert.match(html, /id="saveToggle" type="button">Turn on saving</);
  });
  test("a double click on Get help or Aa leaves it open; the tab's title follows the screen", async () => {
    const q = await fresh();
    await q.dblclick("#helpBtn");
    assert.equal(await q.$eval("#helpBtn", b => b.getAttribute("aria-expanded")), "true");
    await q.click("#helpClose");
    await q.dblclick("#readBtn");
    assert.equal(await q.$eval("#readBtn", b => b.getAttribute("aria-expanded")), "true");
    await inject(q, "respond");
    assert.equal(await q.title(), "Your Respond to a Complaint forms · Indiana Court Form Helper".replace("Respond to a Complaint", await q.evaluate(() => SITUATIONS.respond.title)));
    await q.evaluate(() => { cur = 0; mode = "step"; render(); });
    assert.match(await q.title(), /^Question 1 of \d+: .+ · Indiana Court Form Helper$/);
    await q.context().close();
  });
  test("the links under the sorting facts are at least 24 pixels tall", async () => {
    const q = await fresh({ viewport: { width: 375, height: 667 } });
    await q.click('.pick[data-kind="debt"]');
    await q.locator('input[name=ans][value="complaint"]').check({ force: true }); await q.click("#next");
    const heights = await q.$$eval("p.srcs a", as => as.map(a => a.getBoundingClientRect().height));
    assert.ok(heights.length && heights.every(h => h >= 24), heights.join());
    await q.context().close();
  });
});

describe("BT106. Screen readers hear changes on a page shown large, and a PDF error once", () => {
  test("a change saved on a page shown large is announced inside the page", async () => {
    const q = await fresh();
    await inject(q, "respond");
    await openPage(q, 1);
    await tap(q, "plaintiff");
    await q.fill("#inEdit", "Acme Credit Holdings LLC");
    await q.keyboard.press("Enter");
    await q.waitForFunction(() => /The page shows your change/.test(document.querySelector("dialog.pageview[open] .pvannounce")?.textContent || ""), null, { timeout: 120000 });
    await q.context().close();
  });
  test("when the PDF can't be made, it's said once, not again with every redraw", async () => {
    const q = await fresh();
    q.allowErrors = true; // the failed build is reported in the console on purpose
    await q.evaluate(() => { window.__said = []; new MutationObserver(() => __said.push(document.getElementById("announce").textContent)).observe(document.getElementById("announce"), { childList: true, characterData: true, subtree: true }); });
    await q.evaluate(() => globalThis.eval("buildPdf = async () => { throw new Error('test'); }"));
    await inject(q, "respond");
    await q.waitForFunction(() => pdfState.error && !pdfState.busy, null, { timeout: 60000 });
    await editHere(q, "plaintiff"); await q.click("#ieCancel");
    await editHere(q, "email"); await q.click("#ieCancel");
    await q.waitForTimeout(300);
    assert.equal(await q.locator("#app [role=alert]").count(), 0, "no alert drawn again");
    assert.equal(await q.evaluate(() => __said.filter(t => /couldn't make/.test(t)).length), 1);
    await q.context().close();
  });
});

describe("BT94. Mistakes a clerk would notice are flagged", () => {
  const titled = async (form, over) => { await inject(p, form, over); return p.evaluate(() => runChecks().map(f => `${f.fix}|${f.why}`)); };
  test("your own name as the plaintiff, or as someone sent a copy; the same person twice; this case's number as related", async () => {
    let f = await titled("respond", { plaintiff: "Pat Example" });
    assert.ok(f.some(x => /^plaintiff\|This is your own name/.test(x)));
    f = await titled("respond", { svc1Name: "Acme Credit LLC", svcMore1: "yes", svc2Name: "acme credit llc", svc2Address: "2 Oak St, Fort Wayne, IN 46802", svc2Method: "First Class U.S. mail", svcMore2: "no" });
    assert.ok(f.some(x => /^svc2Name\|This person is listed twice/.test(x)));
    f = await titled("appearance", { related: "yes", relatedNumbers: "02D01-2611-CC-001234" });
    assert.ok(f.some(x => /^relatedNumbers\|This is this case's own number/.test(x)));
  });
  test("a court date on a Sunday or December 25 is flagged; a weekday isn't", async () => {
    const day = (y, m, d) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const next = await p.evaluate(() => { const d = new Date(); d.setDate(d.getDate() + 10); while (d.getDay() !== 0) d.setDate(d.getDate() + 1); return dayString(d); });
    assert.ok((await titled("appearance", { courtDate: next })).some(x => /^courtDate\|.* is a Sunday, when courts are closed/.test(x)));
    const y = new Date().getFullYear() + 1;
    assert.ok((await titled("continuance", { hearingDate: day(y, 12, 25) })).some(x => /^hearingDate\|.* is December 25/.test(x)));
    const weekday = await p.evaluate(() => { const d = new Date(); d.setDate(d.getDate() + 10); while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1); return dayString(d); });
    assert.ok(!(await titled("appearance", { courtDate: weekday })).some(x => /courts are closed/.test(x)));
  });
});

describe("BT97. Small wrong or repeated check messages", () => {
  const fl = async (form, over) => { await inject(p, form, over); return p.evaluate(() => runChecks().map(f => `${f.fix}|${f.why}`)); };
  test("a mistyped signing year gets one flag, not three", async () => {
    const y = await p.evaluate(() => { const d = new Date(); return `${d.getFullYear() + 10}-06-15`; });
    const f = (await fl("continuance", { signDate: y })).filter(x => /^(signDate|svc\dDate)\|/.test(x));
    assert.deepEqual(f.map(x => x.split("|")[0]), ["signDate"], f.join(" || "));
  });
  test("no address and no email: one flag on where court papers go that says what to do", async () => {
    for (const receiveAt of ["Choice1", "Choice2"]) {
      const f = (await fl("appearance", { address: "No fixed address", email: "None", receiveAt })).filter(x => /^receiveAt\|/.test(x));
      assert.equal(f.length, 1, f.join(" || "));
      assert.match(f[0], /no way to send you papers\. Ask the clerk's office/);
    }
  });
  test("\"260-555-0100 after 5pm\" is a whole number; \"Gary, IN ZIP 46401\" has its state", async () => {
    assert.ok(!(await fl("appearance", { phone: "260-555-0100 after 5pm" })).some(x => /^phone\|/.test(x)));
    assert.ok(!(await fl("appearance", { address: "1 Main St, Gary, IN ZIP 46401" })).some(x => /^address\|.*missing the state/.test(x)));
  });
  test("a date exactly 180 days back, across a clock change, isn't called more than 180", async () => {
    const back = await p.evaluate(() => { const d = new Date(`${todayDay()}T12:00:00`); d.setDate(d.getDate() - 180); return dayString(d); });
    assert.ok(!(await fl("continuance", { spokeDate: back })).some(x => /more than 180 days/.test(x)));
  });
});

describe("BT109. The step linking a page that says there's no Answer form says which Answer this tool fills in", () => {
  test("\"Check whether an Answer is due\" names the form from the Answer instructions", async () => {
    await inject(p, "appearance");
    const step = await p.evaluate(() => nextSteps(sitKey, visibleAnswers()).find(s => s.title === "Check whether an Answer is due"));
    assert.match(step.body, /its website doesn't have an Answer form, but its Answer instructions come with one, form CCA-GF-0626-6008/);
  });
});

describe("TG16, TG18 and TG20. Tests for what the test round couldn't see", () => {
  test("TG16: a long defense continues on added pages, each numbered, and a name too long for its box is flagged", async () => {
    const long = Array.from({ length: 260 }, (_, i) => `Line ${i + 1}: I paid every month and have the receipts for each payment.`).join("\n");
    await inject(p, "respond", { defenses: long.slice(0, 9000) });
    await p.waitForFunction(() => pdfState.result && !pdfState.busy, null, { timeout: 120000 });
    const [pages, form] = await p.evaluate(async () => { const d = await PDFLib.PDFDocument.load(pdfState.result.each.find(x => x.key === "answer").bytes); return [d.getPageCount(), OFFICIAL[SITUATIONS.respond.official.packet].docs.answer.pages.length]; });
    assert.ok(pages >= form + 2, `${pages} pages, ${form} of them the form`);
    assert.match(await pdfText(p), /attachment page 2 of \d+ to the Answer/);
    await inject(p, "respond", { plaintiff: "Acme Credit Holdings and Consolidated Receivables Management Services of North America, Incorporated, as assignee of Original Creditor Bank, National Association, and its successors and assigns".repeat(2) });
    await p.waitForFunction(() => pdfState.result && !pdfState.busy, null, { timeout: 120000 });
    assert.ok(await p.evaluate(() => pdfFlags().some(f => f.fix === "plaintiff" && /too long for the space/.test(f.why))));
  });
  test("TG18: an answer emptied in its box stays off the device through \"Open the full question\"", async () => {
    const q = await fresh();
    await q.click("#saveToggle");
    await inject(q, "respond");
    await q.evaluate(() => saveProgress());
    await editHere(q, "plaintiff");
    await q.fill("#inEdit", "");
    await q.click("#ieFull");
    await q.waitForSelector("#ans");
    await q.fill("#ans", "Midland Funding"); // typed again on the question: the erased answer still stays off
    const d = JSON.parse(await copy(q));
    assert.equal(d.edit?.original?.value, undefined, "the erased answer isn't kept for Cancel");
    assert.doesNotMatch(JSON.stringify(d.answers.plaintiff ?? ""), /Acme/);
    await q.context().close();
  });
  test("TG20: a half-typed date on a question warns before closing; invisible characters print as nothing, not \"?\"; storage cleared outside the page is noticed", { skip: BROWSER === "webkit" && "Playwright's WebKit date box takes no typed dates" }, async () => {
    const q = await fresh();
    await inject(q, "continuance");
    await q.evaluate(() => { cur = visible().findIndex(s => s.id === "hearingDate"); mode = "step"; returnToSummary = false; render(); document.getElementById("ans").value = ""; });
    await q.focus("#ans"); await q.keyboard.type("02");
    assert.equal(await q.evaluate(() => { const e = new Event("beforeunload", { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented; }), true);
    await inject(q, "respond", { name: "Pat​Exa­mple" });
    const text = await pdfText(q);
    assert.match(text, /PatExample/); assert.doesNotMatch(text, /Pat\?/);
    await q.click("#saveToggle");
    await q.evaluate(() => saveProgress());
    assert.match(await q.textContent("#privacy"), /^Saved/);
    await q.evaluate(k => { localStorage.removeItem(k); window.dispatchEvent(new Event("focus")); }, SAVED);
    assert.doesNotMatch(await q.textContent("#privacy"), /^Saved/);
    await q.context().close();
  });
});

describe("BT77. The PDF tools come from this site, and when they can't load the note says what to do instead", () => {
  test("blocked: the note links the blank forms, and its button opens the list of answers", async () => {
    const q = await (await site({ change: rel => (rel.startsWith("vendor/pdf-lib/") ? "abort" : null) })).open();
    q.allowErrors = true; // the blocked library is reported in the console on purpose
    await inject(q, "respond");
    await q.waitForSelector("#retryPdf", { timeout: 120000 });
    const note = await q.textContent("#retryPdf >> xpath=..");
    assert.match(note, /check your internet connection\. If it keeps failing, you can fill in the blank official forms \(PDF\)( \(opens in a new tab\))? by hand, copying from the list of your answers\. Try again$/);
    assert.equal(await q.getAttribute("#retryPdf >> xpath=.. >> a", "href"), await q.evaluate(() => OFFICIAL[SITUATIONS.respond.official.packet].source));
    assert.equal(await q.evaluate(() => document.querySelector('details[data-more="answers"]').open), false);
    await q.click("#showAnswers");
    assert.equal(await q.evaluate(() => document.querySelector('details[data-more="answers"]').open), true);
    assert.equal(await q.evaluate(() => document.activeElement === document.querySelector('details[data-more="answers"] > summary')), true);
    await q.context().close();
  });
  test("edge: a form too long to build says to shorten answers, without the by-hand note", async () => {
    const q = await fresh();
    await inject(q, "respond");
    await q.waitForFunction(() => pdfState.result && !pdfState.busy, null, { timeout: 120000 });
    await q.evaluate(() => { pdfState = { key: pdfState.key, result: null, error: "build", busy: false }; renderSummary(true); });
    assert.match(await q.textContent("#retryPdf >> xpath=.."), /Check any very long answers/);
    assert.equal(await q.locator("#showAnswers").count(), 0);
    await q.context().close();
  });
});

describe("TG20, the rest. Clear my data with storage failing, Try again after a damaged form, and appearance streams", () => {
  test("Clear my data in a tab that can't write to storage still clears another open tab", async () => {
    const ctx = await site();
    const a = await ctx.open(), b = await ctx.open();
    await inject(a, "respond"); await inject(b, "respond");
    // Writing fails in the first tab, as when storage is full: the signal through storage can't go, so the channel carries it.
    await a.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException("full", "QuotaExceededError"); }; });
    await a.click("#clearData");
    await b.waitForFunction(() => mode === "pick" && !hasAnswers(), null, { timeout: 10000 });
    assert.equal(await b.evaluate(() => gonePageNote), "Your answers were deleted in another tab.");
    await ctx.close();
  });
  test("Try again after a damaged official form downloads it again, and the PDF is made", async () => {
    let damaged = true;
    const ctx = await site({ change: (rel, read) => {
      if (rel !== "forms/data/answerPacket.js" || !damaged) return null;
      damaged = false;
      return read().replace(/(window\.OFFICIAL_PDFS\.answerPacket = )"[^"]+"/, '$1"AAAA"');
    } });
    const q = await ctx.open();
    q.allowErrors = true; // the damaged form is reported in the console on purpose
    await inject(q, "respond");
    await q.waitForSelector("#retryPdf", { timeout: 120000 });
    assert.equal(await q.evaluate(() => pdfState.error), "form");
    await q.click("#retryPdf");
    await ready(q);
    assert.equal(await q.evaluate(() => !!pdfState.result && !pdfState.error), true);
    await ctx.close();
  });
  test("every form drawn into the filled PDF says it's a form, which some viewers need to show it", async () => {
    for (const key of ["respond", "feewaiver", "continuance"]) {
      await inject(p, key);
      await ready(p);
      const [forms, without] = await p.evaluate(async () => {
        const { PDFDocument, PDFName, PDFDict, PDFRef } = PDFLib;
        const d = await PDFDocument.load(pdfState.result.all);
        let n = 0, missing = 0;
        for (const page of d.getPages()) {
          const x = page.node.Resources()?.lookupMaybe(PDFName.of("XObject"), PDFDict);
          for (const [, ref] of x ? x.entries() : []) {
            const s = ref instanceof PDFRef ? d.context.lookup(ref) : ref;
            if (!s?.dict?.has(PDFName.of("BBox"))) continue; // an image, not a drawn form
            n++;
            if (!s.dict.has(PDFName.of("Subtype"))) missing++;
          }
        }
        return [n, missing];
      });
      assert.ok(forms > 0, `${key}: the filled answers are drawn as forms`);
      assert.equal(without, 0, `${key}: ${without} of ${forms} drawn forms don't say what they are`);
    }
  });
});

describe("BT110. Back from a downloaded PDF shown in the same tab, as iPhone Safari does, keeps the answers", () => {
  // iPhone Safari shows the PDF in the page's own tab. Back brings the page back from memory, where, with saving off,
  // every answer was cleared (seen on iOS 26.1 in the simulator).
  const away = q => q.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true })));
  const back = q => q.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
  const kept = q => q.evaluate(() => mode === "summary" && hasAnswers() && !document.getElementById("goneNote"));
  test("saving off: download, the PDF takes the tab, Back: the answers are still there", async () => {
    const q = await fresh();
    await inject(q, "appearance");
    await ready(q);
    const dl = q.waitForEvent("download"); await q.click("#dlAll"); await dl;
    await away(q); await back(q);
    assert.equal(await kept(q), true);
    await q.context().close();
  });
  test("edge: a touch on the page after the download means the person moved on, so leaving clears them as before", async () => {
    const q = await fresh();
    await inject(q, "appearance");
    await ready(q);
    const dl = q.waitForEvent("download"); await q.click("#dlAll"); await dl;
    await q.click("h1");
    await away(q); await back(q);
    assert.equal(await kept(q), false);
    assert.match(await q.textContent("#goneNote"), /cleared because saving is off/);
    await q.context().close();
  });
  test("edge: the page going more than 30 seconds after the download clears them, and so does a second leave", async () => {
    const q = await fresh();
    await inject(q, "appearance");
    await ready(q);
    const dl = q.waitForEvent("download"); await q.click("#dlAll"); await dl;
    await q.evaluate(() => { downloadAt = performance.now() - 31000; });
    await away(q); await back(q);
    assert.equal(await kept(q), false);
    await inject(q, "appearance");
    await ready(q);
    const dl2 = q.waitForEvent("download"); await q.click("#dlAll"); await dl2;
    await away(q); await back(q);
    assert.equal(await kept(q), true, "back from the PDF");
    await away(q); await back(q);
    assert.equal(await kept(q), false, "a second leave, with no new download");
    await q.context().close();
  });
});
