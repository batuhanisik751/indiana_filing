// Feature 5: any question can be skipped or marked I'm not sure, and it's flagged at the end.
import { describe, test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { fresh, close, reset, pick, walk, step, jump, flagsFor, inject, fieldRows, SAVED } from "../lib.mjs";

let p;
before(async () => { p = await fresh(); });
beforeEach(() => reset(p));
after(close);

describe("5. I'm not sure and Skip", () => {
  test("every question has an I'm not sure button", async () => {
    await pick(p, "respond");
    for (let i = 0; i < 12; i++) { assert.equal(await p.locator("#unsure").count(), 1, await p.textContent("#q")); await p.click("#next"); }
  });
  test("I'm not sure moves on and is flagged at the end", async () => {
    await pick(p, "appearance"); await walk(p, "caseNumber");
    await p.click("#unsure");
    assert.notEqual(await step(p), "caseNumber");
    await walk(p, "summary");
    assert.ok((await flagsFor(p, "caseNumber")).some(f => /You marked this "I'm not sure."/.test(f)));
  });
  test("skipping with Continue is allowed, and a needed answer is then flagged Missing", async () => {
    await pick(p, "appearance"); await walk(p, "summary", { name: "" });
    assert.ok((await flagsFor(p, "name")).some(f => f.startsWith("missing|")));
  });
  test("Fix on the flag opens that question", async () => {
    await inject(p, "appearance", { phone: "" }, { phone: true });
    await p.click('ul.flags [data-fix="phone"]');
    assert.equal(await step(p), "phone");
  });
  test("edge: answering later clears the flag", async () => {
    await inject(p, "appearance", { phone: "" }, { phone: true });
    await p.click('ul.flags [data-fix="phone"]'); await p.fill("#ans", "260-555-0100"); await p.click("#next");
    assert.deepEqual(await flagsFor(p, "phone"), []);
  });
  test("edge: on a question already answered, it asks before clearing, and Cancel keeps the answer", async () => {
    await pick(p, "appearance"); await walk(p, "name"); await p.fill("#ans", "Pat Example");
    p.removeAllListeners("dialog"); let asked = ""; p.on("dialog", d => { asked = d.message(); d.dismiss(); });
    await p.click("#unsure");
    p.removeAllListeners("dialog"); p.on("dialog", d => d.accept());
    assert.match(asked, /Clear your answer/);
    assert.equal(await step(p), "name");
    assert.equal(await p.inputValue("#ans"), "Pat Example");
  });
  test("edge: on an optional question it's a Check, not Missing", async () => {
    await inject(p, "appearance", { fax: "" }, { fax: true });
    assert.ok((await flagsFor(p, "fax")).every(f => f.startsWith("check|")));
  });
  test("edge: with saving on, a mark survives a reload", async () => {
    const q = await fresh(); await q.click("#saveToggle"); await pick(q, "appearance"); await walk(q, "caseNumber"); await q.click("#unsure");
    await q.reload(); await q.waitForSelector("#app h1"); await q.click("#resume");
    assert.equal(await q.evaluate(() => unsure.caseNumber), true);
    assert.match(await q.evaluate(k => localStorage.getItem(k), SAVED), /caseNumber/);
    await q.context().close();
  });
  test("edge: on the fee waiver, an income line marked I'm not sure leaves the sworn totals blank", async () => {
    await inject(p, "feewaiver", { hourlyRate: "10", monthlyHours: "40", ssi: "" }, { ssi: true });
    const total = (await fieldRows(p)).find(([l]) => /Total Income/.test(l));
    assert.match(total[1], /Left blank until you answer the questions marked/);
  });
  test("edge: skipping the confidentiality question says the address will print", async () => {
    await inject(p, "appearance", { acp: "", address: "1 Main St, Fort Wayne, IN 46802" }, { acp: true });
    assert.ok((await flagsFor(p, "acp")).some(f => /address will print on the form/.test(f)));
  });
});
