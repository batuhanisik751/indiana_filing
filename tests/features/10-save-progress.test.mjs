// Feature 10: saving on this device, in the browser's storage, with no account. Off until turned on.
import { describe, test, after } from "node:test";
import assert from "node:assert/strict";
import { fresh, site, close, pick, walk, SAVED, SAVING } from "../lib.mjs";

after(close);
const stored = (p, key = SAVED) => p.evaluate(k => localStorage.getItem(k), key);
async function started(name = "Pat Keeper", p) {
  p ||= await fresh();
  await p.click("#saveToggle"); await pick(p, "appearance"); await walk(p, "name");
  await p.fill("#ans", name); await p.click("#next");
  return p;
}
const reopen = async p => { await p.reload(); await p.waitForSelector("#app h1"); };

describe("10. Save progress", () => {
  test("saving is off at first, and the page says nothing is saved or sent", async () => {
    const p = await fresh();
    assert.equal(await p.textContent("#saveToggle"), "Turn on saving");
    assert.equal(await p.textContent("#privacy"), "Not saved on this device. Nothing is sent.");
    await pick(p, "appearance"); await walk(p, "summary");
    assert.equal(await stored(p), null);
    await p.context().close();
  });
  test("turning it on saves each answer on this device", async () => {
    const p = await started();
    assert.equal(await stored(p, SAVING), "on");
    assert.match(await stored(p), /Pat Keeper/);
    await p.context().close();
  });
  test("after a reload, Continue brings the answers back", async () => {
    const p = await started(); await reopen(p);
    await p.click("#resume");
    assert.equal(await p.evaluate(() => answers.name), "Pat Keeper");
    await p.context().close();
  });
  test("closing the tab and opening the tool again offers the saved answers", async () => {
    const ctx = await site(); const a = await ctx.open();
    await started("Pat Return", a); await a.close();
    const b = await ctx.open();
    assert.equal(await b.locator("#resume").count(), 1);
    await ctx.close();
  });
  test("no account: nothing saved leaves the browser", async () => {
    const p = await fresh(), sent = [];
    p.on("request", r => sent.push(r.url() + " " + (r.postData() || "")));
    await started("Pat Private", p);
    assert.ok(!sent.some(x => /Pat|Private/.test(decodeURIComponent(x))), sent.join("\n"));
    await p.context().close();
  });
  test("edge: Delete saved answers on the first screen removes the copy", async () => {
    const p = await started(); await reopen(p);
    await p.click("#discard");
    assert.equal(await stored(p), null);
    assert.equal(await p.locator("#resume").count(), 0);
    await p.context().close();
  });
  test("edge: a copy saved 29 days ago is still offered (only after 30 days is it deleted)", async () => {
    const p = await started();
    await p.evaluate(k => { const d = JSON.parse(localStorage.getItem(k)); d.savedAt = Date.now() - 29 * 864e5; localStorage.setItem(k, JSON.stringify(d)); }, SAVED);
    await reopen(p);
    assert.equal(await p.locator("#resume").count(), 1);
    await p.context().close();
  });
  test("edge: turning saving off asks first, and then deletes the copy", async () => {
    const p = await started();
    p.removeAllListeners("dialog"); let asked = ""; p.on("dialog", d => { asked = d.message(); d.accept(); });
    await p.click("#saveToggle");
    assert.match(asked, /^Turn off saving\? This deletes the answers saved on this device/);
    assert.equal(await stored(p), null);
    assert.equal(await p.textContent("#saveToggle"), "Turn on saving");
    await p.context().close();
  });
  test("edge: choosing Cancel when turning it off keeps the copy and keeps saving on", async () => {
    const p = await started();
    p.removeAllListeners("dialog"); p.on("dialog", d => d.dismiss());
    await p.click("#saveToggle");
    assert.match(await stored(p), /Pat Keeper/);
    assert.equal(await stored(p, SAVING), "on");
    await p.context().close();
  });
  test("edge: if the browser won't let the page save, it says so instead of claiming it saved", async () => {
    const p = await fresh();
    await p.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException("blocked", "SecurityError"); }; });
    await p.click("#saveToggle");
    await p.waitForFunction(() => /couldn't be turned on/.test(document.getElementById("announce").textContent));
    assert.equal(await stored(p, SAVING), null);
    assert.doesNotMatch(await p.textContent("#privacy"), /^Saved/);
    await p.context().close();
  });
});
