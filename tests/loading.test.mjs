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
  for (const f of ["form-builder-mvp.html", ...FILES, ...fs.readdirSync(path.join(ROOT, "boot")).map(b => `boot/${b}`)]) {
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

// BT107: the live site sends a Content-Security-Policy and other headers (vercel.json). The page is served here with
// exactly those headers, and a whole form, its PDF, its pages and a download must work with nothing refused.
local("with the live site's security headers, a form, its PDF, its pages and a download work, with nothing refused", async () => {
  const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"));
  const headers = Object.fromEntries(vercel.headers[0].headers.map(h => [h.key, h.value]));
  assert.match(headers["Content-Security-Policy"], /script-src 'self';/);
  assert.doesNotMatch(headers["Content-Security-Policy"], /https?:/, "nothing from another site (BT77)");
  assert.doesNotMatch(fs.readFileSync(path.join(ROOT, "form-builder-mvp.html"), "utf8"), /<script>/, "no inline scripts for the policy to refuse");
  const types = { html: "text/html", js: "text/javascript", css: "text/css", svg: "image/svg+xml", png: "image/png", ico: "image/x-icon", json: "application/json" };
  const ctx = await (await launch()).newContext({ acceptDownloads: true });
  // Every other site is blocked, as on a network that blocks CDNs (BT77): nothing should be asked of one.
  const elsewhere = [];
  // (Only web addresses: Playwright's WebKit routes the worker's blob: address too.)
  await ctx.route(url => /^https?:$/.test(url.protocol) && url.host !== "app.test", route => { elsewhere.push(route.request().url()); return route.abort(); });
  await ctx.route("http://app.test/**", route => {
    const rel = decodeURIComponent(new URL(route.request().url()).pathname.slice(1)) || "form-builder-mvp.html", file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT + path.sep) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: "" });
    return route.fulfill({ status: 200, body: fs.readFileSync(file), headers: { ...headers, "Content-Type": types[rel.split(".").pop()] || "application/octet-stream" } });
  });
  const p = await ctx.newPage(), refused = [], errors = [];
  await p.addInitScript(() => document.addEventListener("securitypolicyviolation", e => (window.__refused ||= []).push(`${e.violatedDirective} ${e.blockedURI}`)));
  p.on("pageerror", e => errors.push(e.message));
  await p.goto("http://app.test/form-builder-mvp.html");
  await p.waitForSelector("#app h1");
  await pick(p, "appearance");
  await walk(p, "summary");
  await p.waitForFunction(() => pdfState.result && !pdfState.busy, null, { timeout: 120000 });
  await p.evaluate(() => { document.querySelector('details[data-more="preview"]').open = true; });
  await p.waitForSelector("#preview canvas", { timeout: 60000 });
  await p.click('#preview [data-page="1"]');
  await p.waitForSelector("dialog.pageview .pvpage canvas", { timeout: 60000 });
  await p.click("#pvClose");
  const dl = p.waitForEvent("download");
  await p.click("#dlAll");
  assert.match((await dl).suggestedFilename(), /\.pdf$/);
  refused.push(...(await p.evaluate(() => window.__refused || [])));
  assert.deepEqual(refused, []);
  assert.deepEqual(elsewhere, []);
  assert.deepEqual(errors, []);
  await ctx.close();
});

// BT77: the PDF tools are served from vendor/, and they must be cdnjs's files byte for byte, the hashes cdnjs publishes
// (the ones the page checked when it loaded them from there). To update one, replace the file and its hash together.
test("the PDF tools in vendor/ are exactly the files cdnjs serves", async () => {
  const { createHash } = await import("node:crypto");
  const pinned = {
    "vendor/pdf-lib/1.17.1/pdf-lib.min.js": "sha384-weMABwrltA6jWR8DDe9Jp5blk+tZQh7ugpCsF3JwSA53WZM9/14PjS5LAJNHNjAI",
    "vendor/pdf.js/3.11.174/pdf.min.js": "sha384-/1qUCSGwTur9vjf/z9lmu/eCUYbpOTgSjmpbMQZ1/CtX2v/WcAIKqRv+U1DUCG6e",
    "vendor/pdf.js/3.11.174/pdf.worker.min.js": "sha384-SnzOobpRMLXZ52iJvZm/C0fYw0OQemTXzTjIsdsfMcrCtCEe9qgzxTd3RSklO5x2",
  };
  for (const [file, hash] of Object.entries(pinned))
    assert.equal(`sha384-${createHash("sha384").update(fs.readFileSync(path.join(ROOT, file))).digest("base64")}`, hash, file);
  // And the page loads exactly these, each with its license beside it.
  const libs = fs.readFileSync(path.join(ROOT, "app/official-forms.js"), "utf8").match(/const LIBS = \{[\s\S]*?\n\};/)[0];
  assert.deepEqual([...libs.matchAll(/src: "([^"]+)"/g)].map(m => m[1]).sort(), Object.keys(pinned).sort());
  for (const dir of ["vendor/pdf-lib/1.17.1", "vendor/pdf.js/3.11.174"])
    assert.ok(fs.readdirSync(path.join(ROOT, dir)).some(f => /^LICENSE/.test(f)), `${dir} has its license`);
});
