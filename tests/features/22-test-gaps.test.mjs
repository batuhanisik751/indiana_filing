// Tests for behavior that mutation testing in the verification round (November 2026) showed no test checked:
// TG1 to TG10 on the Issue Map. Each was written to fail on the deliberate break that first went unnoticed.
import { describe, test, after } from "node:test";
import assert from "node:assert/strict";
import { fresh, close, pick, walk, inject, SAVED, SAVING, fieldRows, flagsFor, pdfText } from "../lib.mjs";

after(close);
const stored = (p, key = SAVED) => p.evaluate(k => localStorage.getItem(k), key);
const reopen = async p => { await p.reload(); await p.waitForSelector("#app h1"); };
// A page with saving on and a saved copy of the Appearance.
async function savedCopy() {
  const p = await fresh();
  await p.click("#saveToggle"); await pick(p, "appearance"); await walk(p, "name");
  await p.fill("#ans", "Pat Keeper"); await p.click("#next");
  assert.match(await stored(p), /Pat Keeper/);
  return p;
}
const age = (p, ms) => p.evaluate(([k, ms]) => { const d = JSON.parse(localStorage.getItem(k)); d.savedAt = Date.now() - ms; localStorage.setItem(k, JSON.stringify(d)); }, [SAVED, ms]);

describe("TG1: saving keeps its privacy rules", () => {
  test("a copy older than 30 days is deleted, and saving turns off too, for the next person", async () => {
    const p = await savedCopy();
    await age(p, 31 * 864e5); await reopen(p);
    assert.equal(await stored(p), null);
    assert.equal(await stored(p, SAVING), null);
    assert.equal(await p.textContent("#saveToggle"), "Turn on saving");
    await p.context().close();
  });
  test("edge: the limit is 30 days exactly: 30 days and an hour is too old", async () => {
    const p = await savedCopy();
    await age(p, 30 * 864e5 + 3600e3); await reopen(p);
    assert.equal(await stored(p), null);
    assert.equal(await p.locator("#resume").count(), 0);
    await p.context().close();
  });
  test("edge: Start over deletes this form's copy only: another tab's copy of another form stays, with saving on", async () => {
    const p = await fresh();
    await p.click("#saveToggle");
    await inject(p, "feewaiver", { incomeKinds: "none", expenseKinds: "none" });
    // Another tab saves the continuance over it, as only one copy is kept.
    await p.evaluate(k => { const d = JSON.parse(localStorage.getItem(k)); d.sitKey = "continuance"; d.answers = { name: "Other Tab Person", county: "Allen" }; localStorage.setItem(k, JSON.stringify(d)); }, SAVED);
    await p.click("#restart");
    assert.match(p.dialogs.at(-1).message, /^Start over\?/);
    assert.doesNotMatch(p.dialogs.at(-1).message, /turns saving off/);
    assert.match(await stored(p), /"sitKey":"continuance"/);
    assert.equal(await stored(p, SAVING), "on");
    await p.context().close();
  });
  test("edge: a copy found on the device while saving is off is deleted when the page opens", async () => {
    const p = await savedCopy();
    await p.evaluate(k => localStorage.removeItem(k), SAVING); // saving off, but a copy left behind
    await reopen(p);
    assert.equal(await stored(p), null);
    assert.equal(await p.locator("#resume").count(), 0);
    await p.context().close();
  });
  test("edge: with nothing saved, closing the page warns first; with the answers saved, it doesn't", async () => {
    const unsaved = await fresh();
    await pick(unsaved, "appearance"); await walk(unsaved, "name");
    await unsaved.close({ runBeforeUnload: true });
    await unsaved.waitForEvent("close");
    assert.ok(unsaved.dialogs.some(d => d.type === "beforeunload"), "warned");
    await unsaved.context().close();
    const saved = await savedCopy();
    await saved.close({ runBeforeUnload: true });
    await saved.waitForEvent("close").catch(() => {});
    assert.ok(!saved.dialogs.some(d => d.type === "beforeunload"), "no warning: it's saved");
    await saved.context().close();
  });
  test("edge: turning saving off asks first, naming what it deletes", async () => {
    const p = await savedCopy();
    await p.click("#saveToggle");
    assert.match(p.dialogs.at(-1).message, /^Turn off saving\? This deletes the answers saved on this device/);
    assert.equal(await stored(p), null);
    await p.context().close();
  });
});

describe("TG2: the full next-steps text never overstates what missing a hearing means", () => {
  // Every situation's steps, line and full text: form x filing method x county x role x case type x court date.
  const allText = p => p.evaluate(() => {
    const out = [];
    for (const form of ["respond", "appearance", "continuance", "feewaiver"]) for (const fileMethod of ["", "efile", "paper"]) for (const county of ["", "Allen", "Marion"])
      for (const role of ["me", "other"]) for (const caseNumber of ["", "02D01-2611-SC-001234", "02D01-2611-EV-001234", "02D01-2611-CC-001234", "02D01-2611-CM-001234"])
        for (const courtDate of ["", "2020-01-02", "2099-01-02"]) {
          sitKey = form;
          for (const s of nextSteps(form, { fileMethod, county, role, caseNumber, courtDate, hearingDate: courtDate, name: "Pat" })) out.push({ form, caseNumber, role, title: s.title, text: `${s.short || ""} ${s.body}` });
        }
    return out;
  });
  test("no step says the court will, must or shall rule against you, enter a default or dismiss", async () => {
    const p = await fresh();
    const bad = (await allText(p)).filter(s => /\b(will|must|shall) (rule against|enter (a |an )?(default|judgment)|dismiss)|\bwill lose\b|\blose automatically\b/i.test(s.text)).map(s => `${s.form} ${s.caseNumber}: ${s.title}`);
    assert.deepEqual([...new Set(bad)], []);
    await p.context().close();
  });
  test("edge: an eviction's full text gives the Eviction FAQ's words exactly", async () => {
    const p = await fresh();
    const s = (await allText(p)).find(x => x.form === "appearance" && x.caseNumber.includes("-EV-") && x.title === "Go to every court date");
    assert.ok(s.text.includes("Indiana Legal Help's Eviction FAQ says that if you don't show up to your hearing, the court can rule against you without hearing your side of the story (a default judgment)."), s.text);
    await p.context().close();
  });
  test("edge: small claims gives Small Claims Rule 10's words exactly, for both sides", async () => {
    const p = await fresh();
    const all = await allText(p);
    const defendant = all.find(x => x.form === "appearance" && x.caseNumber.includes("-SC-") && x.title === "Go to every court date");
    assert.ok(defendant.text.includes('"the court may enter a default judgment against him."'), defendant.text);
    const starter = all.find(x => x.form === "continuance" && x.role === "me" && x.caseNumber.includes("-SC-") && x.title === "If you don't go to court");
    assert.ok(starter.text.includes("the court may dismiss the claim without prejudice"), starter.text);
    await p.context().close();
  });
});

describe("TG3: the fee waiver's sworn totals add up every amount, on the summary and in the PDF", () => {
  const ready = p => p.waitForFunction(() => pdfState.result && pdfState.key === pdfKey() && !pdfState.busy, null, { timeout: 120000 });
  const total = (p, label) => p.evaluate(label => { const r = SITUATIONS.feewaiver.fields(visibleAnswers()).find(r => r.label.startsWith(label)); return [String(r.value), r.pdf.map(o => o.value)]; }, label);
  const EXPENSES = { housing: "500", utilities: "100.50", food: "300", childCare: "50", medical: "25.25", transportation: "60", insurance: "40", childSupportOut: "0", otherCosts: "10", otherCostsDesc: "Phone" };
  const INCOME = { hourlyRate: "12.50", monthlyHours: "80", unemployment: "200", tanf: "100.25", ssi: "300", childSupportIn: "50", otherIncome: "25", otherIncomeDesc: "Gifts" };
  test("every expense counts in Total Expenses: $1,085.75 on the summary and in the PDF's box", async () => {
    const p = await fresh();
    await inject(p, "feewaiver", { incomeKinds: "", expenseKinds: "", ...INCOME, ...EXPENSES }); await ready(p);
    assert.deepEqual(await total(p, "8. and Total Expenses"), ["$1,085.75", ["1,085.75"]]);
    assert.ok((await pdfText(p)).includes("1,085.75"), "printed");
    await p.context().close();
  });
  test("every kind of income counts in Total Income: wages of $12.50 for 80 hours plus the rest is $1,675.25", async () => {
    const p = await fresh();
    await inject(p, "feewaiver", { incomeKinds: "", expenseKinds: "", ...INCOME, ...EXPENSES }); await ready(p);
    const [shown, boxes] = await total(p, "6. and Total Income");
    assert.equal(shown, "$1,675.25"); assert.deepEqual([...new Set(boxes)], ["1,675.25"]);
    assert.ok((await pdfText(p)).includes("1,675.25"), "printed");
    await p.context().close();
  });
  test("edge: the wage flag starts at $100 an hour: 99.99 isn't flagged, 100 and 125 are", async () => {
    const p = await fresh();
    for (const [rate, flagged] of [["99.99", false], ["100", true], ["125", true]]) {
      await inject(p, "feewaiver", { incomeKinds: "", expenseKinds: "none", hourlyRate: rate, monthlyHours: "10" });
      assert.equal((await flagsFor(p, "hourlyRate")).some(f => /an hour is unusually high/.test(f)), flagged, rate);
    }
    await p.context().close();
  });
});

