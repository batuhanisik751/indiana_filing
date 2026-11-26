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
    p.allowErrors = true; // a cut-off file is a syntax error, on purpose
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
  p.allowErrors = true; // the other script's errors are the point of this test
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

// Safari before 16.4 (iPhones that stop at iOS 15, like the 6s, 7 and first SE) can't read regex lookbehind, and one
// use stops the whole page at "didn't finish loading" (BT50, and V12 before it).
test("no app file uses regex lookbehind, which older iPhones can't read", () => {
  for (const f of ["form-builder-mvp.html", ...FILES]) {
    const text = fs.readFileSync(path.join(ROOT, f), "utf8"), at = text.search(/\(\?<[=!]/);
    assert.equal(at, -1, `${f} uses lookbehind: ${text.slice(Math.max(0, at - 30), at + 30)}`);
  }
});

test("the app starts and checks answers in a browser without lookbehind, like Safari before 16.4", async () => {
  const ctx = await (await launch()).newContext();
  const p = await ctx.newPage(), errors = [];
  p.on("pageerror", e => errors.push(e.message));
  await p.addInitScript(() => {
    const Real = RegExp, lookbehind = s => /\(\?<[=!]/.test(String(s instanceof Real ? s.source : s));
    const refuse = () => { throw new SyntaxError("Invalid regular expression: invalid group specifier name"); };
    window.RegExp = new Proxy(Real, { construct: (t, a, n) => (lookbehind(a[0]) ? refuse() : Reflect.construct(t, a, n)), apply: (t, th, a) => (lookbehind(a[0]) ? refuse() : Reflect.apply(t, th, a)) });
  });
  await p.goto(APP);
  await p.waitForSelector("#app h1");
  assert.equal(await broken(p), false);
  assert.deepEqual(await p.evaluate(() => [window.appParts, window.appPartsNeeded]), [FILES.length, FILES.length]);
  assert.ok(await p.locator(".pick").count() > 5);
  // The patterns that used it still work: a password after "my pass" (not a bus pass), each password marked without
  // the word before it, and "all 12" read as all of them.
  assert.equal(await p.evaluate(() => privateKind("my pass is ab12!")), "pin");
  assert.equal(await p.evaluate(() => privateKind("my bus pass is $45/mo")), null);
  assert.deepEqual(await p.evaluate(() => privateSpans("my pass is ab12! and wifi pass is cd34!", privateKind)), [[3, 16], [26, 39]]);
  assert.equal(await p.evaluate(() => saysAll("all 12") && namesParagraphs("all 12 paragraphs")), true);
  assert.deepEqual(errors, []);
  await ctx.close();
});
