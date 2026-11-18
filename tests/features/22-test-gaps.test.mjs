// Tests for behavior that mutation testing in the verification round (November 2026) showed no test checked:
// TG1 to TG10 on the Issue Map. Each was written to fail on the deliberate break that first went unnoticed.
import { describe, test, after } from "node:test";
import assert from "node:assert/strict";
import { fresh, close, pick, walk, inject, SAVED, SAVING } from "../lib.mjs";

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
