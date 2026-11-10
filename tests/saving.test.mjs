// Saving on this device: off unless turned on, kept across a reload, and never keeping what it shouldn't.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { fresh, site, close, pick, walk, step, SAVED, SAVING } from "./lib.mjs";

after(close);
const stored = (p, key = SAVED) => p.evaluate(k => localStorage.getItem(k), key);

test("saving is off until the person turns it on", async () => {
  const p = await fresh();
  await pick(p, "appearance");
  await walk(p, "summary");
  assert.equal(await stored(p), null, "nothing is kept");
  assert.equal(await stored(p, SAVING), null);
  await p.context().close();
});

test("with saving on, a reload offers to continue with the same answers", async () => {
  const p = await fresh();
  await p.click("#saveToggle");
  assert.equal(await stored(p, SAVING), "on");
  await pick(p, "appearance");
  await walk(p, "name");
  await p.fill("#ans", "Pat Keeper");
  await p.click("#next");
  await p.reload();
  await p.waitForSelector("#app h1");
  assert.equal(await p.locator("#resume").count(), 1, "Continue is offered");
  await p.click("#resume");
  assert.equal(await p.evaluate(() => answers.name), "Pat Keeper");
  await p.context().close();
});

test("choosing the Address Confidentiality Program takes the home address out of the saved copy at once", async () => {
  const p = await fresh();
  await p.click("#saveToggle");
  await pick(p, "appearance");
  await walk(p, "summary", { address: "1 Secret Home St, Fort Wayne, IN 46802" });
  assert.match(await stored(p), /Secret Home/);
  await p.click('dl.vals [data-fix="acp"]');
  await p.locator('input[name=ans][value="yes"]').check({ force: true });
  assert.doesNotMatch(await stored(p), /Secret Home/, "before Continue is even pressed");
  await p.context().close();
});

test("Clear my data erases the answers and the saved copy, and turns saving off", async () => {
  const p = await fresh();
  await p.click("#saveToggle");
  await pick(p, "appearance");
  await walk(p, "summary");
  assert.ok(await stored(p));
  await p.click("#clearData");
  await p.waitForTimeout(100);
  assert.equal(await stored(p), null);
  assert.equal(await stored(p, SAVING), null);
  assert.equal(await p.evaluate(() => hasAnswers()), false);
  await p.context().close();
});

test("saved answers not changed for 30 days are deleted when the page opens", async () => {
  const p = await fresh();
  await p.click("#saveToggle");
  await pick(p, "appearance");
  await walk(p, "name");
  await p.fill("#ans", "Pat Old");
  await p.click("#next");
  await p.evaluate(k => { const d = JSON.parse(localStorage.getItem(k)); d.savedAt = Date.now() - 31 * 864e5; localStorage.setItem(k, JSON.stringify(d)); }, SAVED);
  await p.reload();
  await p.waitForSelector("#app h1");
  assert.equal(await p.locator("#resume").count(), 0);
  assert.equal(await stored(p), null);
  await p.context().close();
});

test("two tabs: turning saving on in one doesn't make the other claim it's saved", async () => {
  const ctx = await site();
  const a = await ctx.open(), b = await ctx.open();
  await pick(b, "appearance");
  await walk(b, "name");
  await b.fill("#ans", "Bea Tab");
  await b.click("#next");
  await b.evaluate(() => Object.defineProperty(document, "hidden", { get: () => true }));
  await pick(a, "appearance");
  await walk(a, "name");
  await a.fill("#ans", "Ann Tab");
  await a.click("#next");
  await a.click("#saveToggle");
  await a.waitForTimeout(300);
  assert.match(await stored(a), /Ann Tab/, "the tab that turned it on holds the copy");
  assert.equal(await b.evaluate(() => savedHere), false, "the other tab knows it isn't saved");
  await b.evaluate(() => { otherTab = false; updatePrivacyNote(); });
  assert.doesNotMatch(await b.textContent("#privacy"), /^Saved/, "and doesn't say it is");
  await ctx.close();
});
