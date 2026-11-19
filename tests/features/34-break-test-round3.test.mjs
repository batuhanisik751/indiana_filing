// Break-test round 3 (BT31-BT48): problems two independent testers found in the new quick edit (item 17), the progress
// bar (item 21), the test set (item 18) and the checks fixed after it (I18a-I18d).
import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fresh, close, inject, editHere, flagsFor, SAVED } from "../lib.mjs";

let p;
before(async () => { p = await fresh(); });
after(close);
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
const saved = (q, id) => q.evaluate(([k, id]) => JSON.parse(localStorage.getItem(k)).answers[id], [SAVED, id]);
// A page of its own with saving on, so what's on the device can be read back.
async function savingPage() {
  const q = await fresh();
  await q.click("#savePref");
  return q;
}

describe("BT31. An answer emptied in its box goes back on the device when the box is let go", () => {
  test("emptied on the summary, then given up for an answer on a page shown large: the old answer is saved again", async () => {
    const q = await savingPage();
    await inject(q, "respond");
    await q.evaluate(() => saveProgress());
    await editHere(q, "plaintiff");
    await q.fill("#inEdit", "");
    assert.equal(await saved(q, "plaintiff"), "", "off the device while the box is empty");
    await openPage(q, 1);
    await tap(q, "email"); // "Discard your change to Plaintiff?" OK
    assert.match(q.dialogs.at(-1).message, /Discard your change to "Plaintiff"/);
    assert.equal(await saved(q, "plaintiff"), "Acme Credit LLC");
    await q.click("#ieCancel");
    await q.click("#pvClose");
    await q.reload(); await q.waitForSelector("#app h1");
    if (await q.locator("#resume").count()) await q.click("#resume");
    assert.equal(await q.evaluate(() => answers.plaintiff), "Acme Credit LLC");
  });

  test("emptied on a page shown large, then given up for another answer there: the old answer is saved again", async () => {
    const q = await savingPage();
    await inject(q, "respond");
    await q.evaluate(() => saveProgress());
    await openPage(q, 1);
    await tap(q, "plaintiff");
    await q.fill("#inEdit", "");
    assert.equal(await saved(q, "plaintiff"), "");
    await tap(q, "email");
    assert.equal(await saved(q, "plaintiff"), "Acme Credit LLC");
    assert.equal(await q.evaluate(() => inlineEdit && inlineEdit.id), "email");
  });

  test("edge: emptied, then its row goes away (another answer hides it): the old answer is saved again", async () => {
    const q = await savingPage();
    await inject(q, "respond", { related: "yes", relatedNumbers: "02D01-2401-CC-000111" });
    await q.evaluate(() => saveProgress());
    await editHere(q, "relatedNumbers");
    await q.fill("#inEdit", "");
    assert.equal(await saved(q, "relatedNumbers"), "");
    await q.evaluate(() => { answers.related = "no"; keepFocus(() => renderSummary(true)); });
    assert.equal(await q.evaluate(() => inlineEdit), null);
    assert.equal(await saved(q, "related"), "no");
    assert.notEqual(await saved(q, "relatedNumbers"), "", "not kept off as if erased");
  });
});

describe("BT41. A bus, boarding or parking pass isn't taken for a password", () => {
  const privacy = async (form, id, text, more = {}) => { await inject(p, form, { ...more, [id]: text }); return (await flagsFor(p, id)).filter(f => /Private information/.test(f)); };
  const FEE = { incomeKinds: "wages", expenseKinds: "otherCosts", otherCosts: "45" };
  test("expenses, reasons and defenses with a pass in them get no privacy flag", async () => {
    for (const t of ["Bus pass is $45/mo", "IndyGo pass: $60/month", "Gym pass is 30/mo", "My kids' pool season pass is $99/yr", "Hospital parking pass is $25/wk while my son is in the NICU", "Monthly bus pass = 2x$20", "Water bill to PWD is $40/mo", "Water bill to PWD: $40/mo"])
      assert.deepEqual(await privacy("feewaiver", "otherCostsDesc", t, FEE), [], t);
    for (const t of ["I will be out of state for my mother's surgery. My boarding pass is DL1452 for that morning.", "I can't get in without my building pass, and my building pass is B2-114.", "The jail visit pass was noon-4pm.", "My bus pass was 11/30-only."])
      assert.deepEqual(await privacy("continuance", "reason", t), [], t);
    for (const t of ["I bought it on a sale and the pass was 2-for-1.", "Pass: 7-day", "My pass was 10.30am"])
      assert.deepEqual(await privacy("respond", "defenses", t), [], t);
  });
  test("a password after \"pass\" is still flagged, and Fix still selects it", async () => {
    for (const t of ["My pass is hunter2", "PASS IS HUNTER22", "pass: Hunter22", "Login pass: Hunter22", "my wifi pass is Blue1234", "user pat and pass is Hunter22", "pw=abc123", "pwd: S3cret!"])
      assert.equal((await privacy("respond", "defenses", `I paid in full. ${t}`)).length, 1, t);
    await inject(p, "respond", { defenses: "I paid. My pass is hunter2 if the court needs it." });
    const hit = await p.evaluate(() => runChecks().find(f => f.fix === "defenses" && /Private/.test(f.title)).hit);
    assert.deepEqual(hit.map(([s, e]) => "I paid. My pass is hunter2 if the court needs it.".slice(s, e)), ["pass is hunter2"]);
  });
});

describe("BT32. A box on a page shown large isn't lost when the page changes", () => {
  // Answers the next confirm() with Cancel instead of OK.
  const cancelNext = q => { q.removeAllListeners("dialog"); q.once("dialog", d => { q.dialogs.push({ type: d.type(), message: d.message() }); d.dismiss(); q.on("dialog", d2 => { q.dialogs.push({ type: d2.type(), message: d2.message() }); d2.accept(); }); }); };
  const pageNo = q => q.$eval("#pvTitle", h => +h.textContent.match(/Page (\d+)/)[1]);
  test("Next page with a changed box asks first; OK lets the box go, and later taps open at once", async () => {
    await inject(p, "respond");
    await openPage(p, 1);
    await tap(p, "plaintiff");
    await p.fill("#inEdit", "Acme Credit Holdings LLC");
    const asked = p.dialogs.length;
    await p.click("#pvNext");
    assert.equal(p.dialogs.length, asked + 1);
    assert.match(p.dialogs.at(-1).message, /Discard your change to "Plaintiff"/);
    await p.waitForFunction(() => /Page 2 /.test(document.getElementById("pvTitle").textContent) && document.querySelector("dialog.pageview .pvpage canvas"));
    assert.equal(await p.evaluate(() => inlineEdit), null);
    assert.equal(await p.evaluate(() => answers.plaintiff), "Acme Credit LLC");
    await p.click("#pvPrev");
    await p.waitForSelector("dialog.pageview .pvspot");
    await tap(p, "plaintiff");
    assert.equal(p.dialogs.length, asked + 1, "no question about a box that's gone");
    assert.equal(await p.$eval("#inEdit", b => b.value), "Acme Credit LLC");
    await p.keyboard.press("Escape");
    await p.keyboard.press("Escape");
  });

  test("Cancel on that question stays on the page with the box and what was typed", async () => {
    await inject(p, "respond");
    await openPage(p, 1);
    await tap(p, "plaintiff");
    await p.fill("#inEdit", "Acme Credit Holdings LLC");
    cancelNext(p);
    await p.click("#pvNext");
    assert.equal(await pageNo(p), 1);
    assert.equal(await p.$eval("#inEdit", b => b.value), "Acme Credit Holdings LLC");
    assert.equal(await p.evaluate(() => document.activeElement.id), "inEdit");
    await p.keyboard.press("Escape");
    await p.keyboard.press("Escape");
  });

  test("an unchanged box closes with the page turn without a question", async () => {
    await inject(p, "respond");
    await openPage(p, 1);
    await tap(p, "plaintiff");
    const asked = p.dialogs.length;
    await p.click("#pvNext");
    assert.equal(p.dialogs.length, asked);
    assert.equal(await p.evaluate(() => inlineEdit), null);
    await p.keyboard.press("Escape");
  });

  test("while the page is made again after a Save, its answers can't be tapped; then they can", async () => {
    await inject(p, "respond");
    await openPage(p, 1);
    await p.evaluate(() => { window.__realBuild = buildPdf; globalThis.eval("buildPdf = (...a) => new Promise(r => setTimeout(r, 1500)).then(() => window.__realBuild(...a))"); });
    await tap(p, "plaintiff");
    await p.fill("#inEdit", "Acme Credit Holdings LLC");
    await p.click("#ieSave");
    assert.equal(await p.locator("dialog.pageview .pvspot:not([disabled])").count(), 0);
    assert.ok(await p.locator("dialog.pageview .pvspot[disabled]").count() > 0);
    await p.locator('dialog.pageview .pvspot[data-id="email"]').first().click({ force: true });
    assert.equal(await p.evaluate(() => inlineEdit), null, "no box opened");
    // Turning the page while waiting shows that page held too.
    await p.click("#pvNext");
    await p.waitForFunction(() => /Page 2 /.test(document.getElementById("pvTitle").textContent) && document.querySelector("dialog.pageview .pvhint"));
    assert.match(await p.textContent("dialog.pageview .pvhint"), /Making the page again/);
    await p.waitForFunction(() => !pdfState.busy && document.querySelector("dialog.pageview .pvspot:not([disabled])"), null, { timeout: 120000 });
    assert.equal(await p.evaluate(() => answers.plaintiff), "Acme Credit Holdings LLC");
    await p.evaluate(() => globalThis.eval("buildPdf = window.__realBuild"));
    await p.keyboard.press("Escape");
  });
});

describe("BT33. A case number changed in place asks about the county and court as its question does", () => {
  for (const confirm of ["no", ""]) test(`with the county and court ${confirm ? "chosen by hand" : "not confirmed"}, another county's number goes to its question`, async () => {
    await inject(p, "respond", { caseConfirm: confirm });
    await editHere(p, "caseNumber");
    await p.fill("#inEdit", "49D01-2611-CC-001234");
    await p.click("#ieSave");
    assert.equal(await p.evaluate(() => mode === "step" && visible()[cur].id), "caseNumber");
    assert.equal(await p.$eval("#ans", b => b.value), "49D01-2611-CC-001234");
    assert.match(await p.textContent("#inlineNote"), /brings up another question/);
    assert.equal(await p.evaluate(() => [answers.caseNumber, answers.caseConfirm ?? ""].join("|")), `02D01-2611-CC-001234|${confirm}`, "nothing changed until it's saved there");
    await p.click("#next");
    assert.equal(await p.evaluate(() => mode === "step" && visible()[cur].id), "caseConfirm");
  });
  test("edge: with the county and court confirmed, a number in the same court still saves in place", async () => {
    await inject(p, "respond", { caseConfirm: "yes" });
    await editHere(p, "caseNumber");
    await p.fill("#inEdit", "02D01-2611-CC-001299");
    await p.click("#ieSave");
    assert.equal(await p.evaluate(() => [mode, answers.caseNumber, answers.caseConfirm].join("|")), "summary|02D01-2611-CC-001299|yes");
  });
});

describe("BT34. Tapping an answer on a page shown large opens that answer, not the one next to it", () => {
  // For every answer on the page: what's under the middle of it is that answer, or another one whose own box is there too.
  const middles = q => q.evaluate(async () => {
    const all = [...document.querySelectorAll("dialog.pageview .pvspot")], wrong = [];
    for (const s of all) {
      s.scrollIntoView({ block: "center" }); await new Promise(r => requestAnimationFrame(r));
      const r = s.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, hit = document.elementFromPoint(x, y);
      const box = hit && hit.getBoundingClientRect();
      if (hit !== s && !(hit?.classList.contains("pvspot") && x >= box.left && x <= box.right && y >= box.top && y <= box.bottom)) wrong.push(`${s.getAttribute("aria-label")} -> ${hit?.getAttribute("aria-label") || hit?.tagName}`);
    }
    return { count: all.length, wrong };
  });
  for (const [w, h, form, n, more] of [[320, 568, "respond", 1], [320, 568, "continuance", 1], [375, 667, "feewaiver", 5, { incomeKinds: "wages,ss", expenseKinds: "rent,food" }], [1000, 900, "feewaiver", 5, { incomeKinds: "wages,ss", expenseKinds: "rent,food" }], [1000, 900, "appearance", 1]])
    test(`${w}px, ${form} page ${n}: the middle of every answer is that answer`, async () => {
      const q = await fresh({ viewport: { width: w, height: h }, hasTouch: true });
      await inject(q, form, more || {});
      await openPage(q, n);
      const m = await middles(q);
      assert.ok(m.count > 3, `${m.count} answers`);
      assert.deepEqual(m.wrong, []);
    });
  test("a finger on the email address at 320px opens the email address", async () => {
    const q = await fresh({ viewport: { width: 320, height: 568 }, hasTouch: true });
    await inject(q, "respond");
    await openPage(q, 1);
    const at = await q.evaluate(async () => { const s = document.querySelector('dialog.pageview .pvspot[data-id="email"]'); s.scrollIntoView({ block: "center" }); await new Promise(r => requestAnimationFrame(r)); const r = s.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
    await q.touchscreen.tap(...at);
    await q.waitForSelector("#pvEdit");
    assert.equal(await q.textContent("#pvEditTitle"), "Email address");
  });
  test("edge: the margin around a small answer still opens it where no other answer is", async () => {
    const q = await fresh({ viewport: { width: 320, height: 568 }, hasTouch: true });
    await inject(q, "respond");
    await openPage(q, 1);
    const at = await q.evaluate(async () => {
      const all = [...document.querySelectorAll("dialog.pageview .pvspot")];
      for (const s of all) {
        s.scrollIntoView({ block: "center" }); await new Promise(r => requestAnimationFrame(r));
        const r = s.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top - 4; // 4px above it
        if (document.elementFromPoint(x, y) === s && !all.some(o => o !== s && (b => x >= b.left && x <= b.right && y >= b.top - 6 && y <= b.bottom + 6)(o.getBoundingClientRect()))) return { x, y, label: s.getAttribute("aria-label") };
      }
      return null;
    });
    assert.ok(at, "a small answer with room around it");
    await q.touchscreen.tap(at.x, at.y);
    await q.waitForSelector("#pvEdit");
    assert.equal(`Change: ${await q.textContent("#pvEditTitle")}`, at.label);
  });
});
