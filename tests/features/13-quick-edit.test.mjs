// Feature 13: small fixes from the summary, where every answer is listed by form with an Edit link, and checked again after.
// (Edits open the question itself, then return to the summary. Nothing is typed onto the PDF directly.)
import { describe, test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { fresh, close, reset, step, inject, flagsFor, fieldRows, pdfText } from "../lib.mjs";

let p;
before(async () => { p = await fresh(); });
beforeEach(() => reset(p));
after(close);
const edit = id => p.click(`dl.vals [data-fix="${id}"]`);
const change = async (id, value) => { await edit(id); await p.fill("#ans", value); await p.click("#next"); };
const score = async () => (await p.textContent(".barlabel")).match(/(\d+) of (\d+)/).slice(1).map(Number);

describe("13. Quick edit", () => {
  test("every answer is listed under its form, and every question has an Edit link", async () => {
    await inject(p, "appearance");
    assert.ok((await p.$$eval(".formcard h3", h => h.map(x => x.textContent))).some(t => /Appearance/.test(t)));
    const missingEdit = await p.evaluate(() => visible().filter(s => !document.querySelector(`dl.vals [data-fix="${s.id}"]`)).map(s => s.id));
    assert.deepEqual(missingEdit, []);
  });
  test("an edit shows on the summary right away", async () => {
    await inject(p, "appearance");
    await change("name", "Pat Changed");
    assert.ok((await p.$$eval("dl.vals dd", d => d.map(x => x.textContent))).includes("Pat Changed"));
  });
  test("fixing a flagged answer clears the flag", async () => {
    await inject(p, "appearance", { email: "pat@gmial.com" });
    await change("email", "pat@gmail.com");
    assert.deepEqual(await flagsFor(p, "email"), []);
  });
  test("an edit that adds a mistake is checked again and flagged", async () => {
    await inject(p, "appearance");
    await change("email", "pat@gmial.com");
    assert.match((await flagsFor(p, "email"))[0], /typo for gmail\.com/);
  });
  test("edge: the filled PDF is made again with the edit", async () => {
    await inject(p, "appearance");
    await change("name", "Pat Rebuilt");
    await p.waitForFunction(() => pdfState.result && pdfState.key === pdfKey() && !pdfState.busy, null, { timeout: 120000 });
    assert.ok((await pdfText(p)).includes("Pat Rebuilt"));
  });
  test("edge: the count of needed answers updates after an edit", async () => {
    await inject(p, "appearance", { name: "" });
    const [before, of] = await score();
    await change("name", "Pat Example");
    assert.deepEqual(await score(), [before + 1, of]);
  });
  test("edge: an answer can be changed to I'm not sure from the summary, and is flagged", async () => {
    await inject(p, "appearance");
    await edit("phone"); await p.click("#unsure");
    assert.equal(await step(p), "summary");
    assert.ok((await flagsFor(p, "phone")).some(f => /^missing\|.*You marked this "I'm not sure\."/.test(f)));
  });
  test("edge: an edit that isn't a valid answer is refused, and the old answer is kept", async () => {
    await inject(p, "feewaiver", { housing: "500" });
    await edit("hourlyRate"); await p.fill("#ans", "twelve"); await p.click("#next");
    assert.equal(await step(p), "hourlyRate");
    assert.match(await p.textContent("#err"), /Use numbers only/);
    await p.click("#back");
    assert.equal(await p.evaluate(() => answers.hourlyRate), "12.50");
  });
  test("edge: Cancel after changing a choice puts the old choice back", async () => {
    await inject(p, "appearance");
    await edit("acp"); await p.locator('input[name=ans][value="yes"]').check({ force: true });
    await p.click("#back");
    assert.equal(await p.evaluate(() => answers.acp), "no");
    assert.ok((await fieldRows(p)).some(([, v]) => v.includes("1 Main St")), "the address prints again");
  });
  test("edge: a changed name changes everywhere it prints, e-filing signature included", async () => {
    await inject(p, "appearance", { fileMethod: "efile" });
    await change("name", "Pat Everywhere");
    const rows = await fieldRows(p);
    assert.ok(rows.some(([l, v]) => /Signature/.test(l) && v === "/s/ Pat Everywhere"));
    assert.ok(!rows.some(([, v]) => v.includes("Pat Example")));
  });
});
