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
