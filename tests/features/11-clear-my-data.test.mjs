// Feature 11: one button deletes every answer, here, in other tabs and on this device.
import { describe, test, after } from "node:test";
import assert from "node:assert/strict";
import { fresh, site, close, pick, walk, SAVED, SAVING } from "../lib.mjs";

after(close);
const stored = (p, key = SAVED) => p.evaluate(k => localStorage.getItem(k), key);
const answered = p => p.evaluate(() => hasAnswers());
// Announcements are set a moment later, so two at once don't talk over each other.
const announced = async p => { await p.waitForFunction(() => document.getElementById("announce").textContent !== ""); return p.textContent("#announce"); };
async function filled(p, { saving = false } = {}) {
  p ||= await fresh();
  if (saving) await p.click("#saveToggle");
  await pick(p, "appearance"); await walk(p, "summary");
  return p;
}

describe("11. Clear my data", () => {
  test("the button is there on every screen", async () => {
    const p = await fresh();
    const seen = [];
    seen.push(await p.locator("#clearData").isVisible());
    await p.click('.pick[data-kind="debt"]'); seen.push(await p.locator("#clearData").isVisible());
    await p.goto(p.url()); await p.waitForSelector("#app h1");
    await pick(p, "appearance"); seen.push(await p.locator("#clearData").isVisible());
    await walk(p, "summary"); seen.push(await p.locator("#clearData").isVisible());
    assert.deepEqual(seen, [true, true, true, true]);
    await p.context().close();
  });
  test("it asks first, then deletes every answer and goes back to the first screen", async () => {
    const p = await filled();
    p.removeAllListeners("dialog"); let asked = ""; p.on("dialog", d => { asked = d.message(); d.accept(); });
    await p.click("#clearData");
    assert.match(asked, /^Clear my data\? This deletes every answer you have entered/);
    assert.equal(await answered(p), false);
    assert.equal(await p.evaluate(() => mode), "pick");
    await p.context().close();
  });
  test("with saving on, it deletes the saved copy and turns saving off", async () => {
    const p = await filled(null, { saving: true });
    assert.ok(await stored(p));
    await p.click("#clearData");
    assert.equal(await stored(p), null); assert.equal(await stored(p, SAVING), null);
    assert.equal(await p.textContent("#saveToggle"), "Turn on saving");
    await p.context().close();
  });
  test("it tells screen readers what happened", async () => {
    const p = await filled(null, { saving: true });
    await p.click("#clearData");
    assert.equal(await announced(p), "Your answers were deleted, and saving is off.");
    await p.context().close();
  });
  test("edge: Cancel keeps every answer and the saved copy", async () => {
    const p = await filled(null, { saving: true });
    p.removeAllListeners("dialog"); p.on("dialog", d => d.dismiss());
    await p.click("#clearData");
    assert.equal(await answered(p), true); assert.ok(await stored(p));
    assert.equal(await p.evaluate(() => mode), "summary");
    await p.context().close();
  });
  test("edge: it clears the same answers open in another tab", async () => {
    const ctx = await site(); const a = await ctx.open(), b = await ctx.open();
    await filled(a); await filled(b);
    await a.click("#clearData");
    await b.waitForFunction(() => !hasAnswers(), null, { timeout: 5000 });
    assert.equal(await answered(b), false);
    await ctx.close();
  });
  test("edge: with saving off it still clears, and doesn't mention a saved copy", async () => {
    const p = await filled();
    p.removeAllListeners("dialog"); let asked = ""; p.on("dialog", d => { asked = d.message(); d.accept(); });
    await p.click("#clearData");
    assert.doesNotMatch(asked, /saved on this device|turns saving off/);
    assert.equal(await answered(p), false);
    assert.equal(await announced(p), "Your answers were deleted.");
    await p.context().close();
  });
  test("edge: nothing offers the answers back afterwards, not even after a reload", async () => {
    const p = await filled(null, { saving: true });
    await p.click("#clearData");
    assert.equal(await p.locator("#backToWork, #resume").count(), 0);
    await p.reload(); await p.waitForSelector("#app h1");
    assert.equal(await p.locator("#resume").count(), 0);
    assert.equal(await answered(p), false);
    await p.context().close();
  });
  test("edge: from the middle of a question, it clears what was half typed too", async () => {
    const p = await fresh();
    await pick(p, "appearance"); await walk(p, "name"); await p.fill("#ans", "Half Typed");
    await p.click("#clearData");
    assert.equal(await p.evaluate(() => JSON.stringify(answers) + JSON.stringify(draft)), "{}null");
    await p.context().close();
  });
  test("edge: the answers from sorting the papers are cleared too", async () => {
    const p = await fresh();
    await p.click('.pick[data-kind="debt"]');
    await p.locator('input[name=ans][value="complaint"]').check({ force: true }); await p.click("#next");
    await p.click("#clearData");
    assert.equal(await p.evaluate(() => Object.keys(triage).length), 0);
    await p.context().close();
  });
});
