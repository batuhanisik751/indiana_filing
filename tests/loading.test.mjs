// The page is divided into files. If one doesn't arrive whole, the page says so, and nothing saved is lost.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { site, fresh, launch, close, pick, walk, ROOT, APP, BASE_URL, SAVED, SAVING } from "./lib.mjs";

after(close);
const local = BASE_URL ? test.skip : test; // these serve the local files in odd ways
const FILES = [...fs.readFileSync(path.join(ROOT, "form-builder-mvp.html"), "utf8").matchAll(/<script src="(app\/[^"]+)"/g)].map(m => m[1]);
const broken = p => p.evaluate(() => /didn't finish loading/.test(document.getElementById("app").textContent));

local("every app file counts itself in, and the page knows how many there are", async () => {
  const ctx = await site();
  const p = await ctx.open();
  assert.deepEqual(await p.evaluate(() => [window.appParts, window.appPartsNeeded]), [FILES.length, FILES.length]);
  assert.equal(await broken(p), false);
  await ctx.close();
});

local("a missing or cut-off file shows a message and leaves saved answers alone", async () => {
  let fail = null, how = null;
  const ctx = await site({ change: (rel, read) => (rel !== fail ? null : how === "missing" ? "abort" : read().split("\n").slice(0, -12).join("\n")) });
  const first = await ctx.open();
  await first.click("#saveToggle");
  await pick(first, "appearance");
  await walk(first, "name");
  await first.fill("#ans", "Pat Keeper");
  await first.click("#next");
  const copy = await first.evaluate(k => localStorage.getItem(k), SAVED);
  await first.close();
  for (const f of FILES) for (const h of ["missing", "cut off"]) {
    fail = f; how = h;
    const p = await ctx.open(false);
    await p.waitForTimeout(60);
    assert.equal(await broken(p), true, `${f} ${h}: says so`);
    assert.equal(await p.locator("#app .pick").count(), 0, `${f} ${h}: no half-working screen`);
    assert.equal(await p.evaluate(k => localStorage.getItem(k), SAVED), copy, `${f} ${h}: saved answers untouched`);
    assert.equal(await p.evaluate(k => localStorage.getItem(k), SAVING), "on", `${f} ${h}: saving stays on`);
    await p.close();
  }
  fail = null;
  const good = await ctx.open();
  assert.equal(await good.locator("#resume").count(), 1, "a good reload offers Continue");
  await ctx.close();
});

local("another script's errors don't stop the app", async () => {
  const p = await fresh();
  await p.addInitScript(() => { setInterval(() => { throw new Error("someone else's script"); }, 5); });
  await p.reload();
  await p.waitForSelector("#app h1");
  assert.equal(await broken(p), false);
  assert.ok(await p.locator(".pick").count() > 5);
  await p.context().close();
});

test("with JavaScript off, the page says it needs it", async () => {
  const ctx = await (await launch()).newContext({ javaScriptEnabled: false });
  const p = await ctx.newPage();
  await p.goto(APP);
  assert.match(await p.textContent("#app"), /needs JavaScript/);
  await ctx.close();
});
