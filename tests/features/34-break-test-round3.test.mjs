// Break-test round 3 (BT31-BT48): problems two independent testers found in the new quick edit (item 17), the progress
// bar (item 21), the test set (item 18) and the checks fixed after it (I18a-I18d).
import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fresh, close, inject, editHere, SAVED } from "../lib.mjs";

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
