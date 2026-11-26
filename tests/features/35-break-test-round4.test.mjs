// Break-test round 4 (BT50-BT110, TG11-TG20): problems seven independent testers found across the whole app, fixed most
// important first. BT50's tests are in ../loading.test.mjs.
import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fresh, close, inject, editHere, settle, pick, walk, answer, reset, SAVED, BROWSER } from "../lib.mjs";

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
