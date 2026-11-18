// Feature: bigger text and high contrast, from the header on every screen. Kept on the device only while saving is
// on. (An idea from other teams' projects: Teams 9 and 11, praised again and again in the class feedback.)
import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fresh, close, reset, pick, inject, ROOT } from "../lib.mjs";

let p;
before(async () => { p = await fresh(); });
after(close);
const KEY = "icfh-display-v1";
const bodySize = q => q.evaluate(() => parseFloat(getComputedStyle(document.body).fontSize));
const stored = q => q.evaluate(k => localStorage.getItem(k), KEY);
const said = q => q.waitForFunction(() => document.getElementById("announce").textContent).then(h => h.jsonValue());
async function clean(q) { await q.evaluate(() => localStorage.clear()); await q.reload(); await q.waitForSelector("#app h1"); }
const savingOnNow = q => q.evaluate(() => savingOn());

describe("Bigger text and high contrast", () => {
  test("the header has them on every screen, and they start at the usual look", async () => {
    await clean(p);
    const seen = [await p.isVisible("#readTools")];
    await pick(p, "respond"); seen.push(await p.isVisible("#readTools"));
    await inject(p, "respond"); seen.push(await p.isVisible("#readTools"));
    assert.deepEqual(seen, [true, true, true]);
    assert.equal(await p.isDisabled("#textSmaller"), true);
    assert.equal(await p.isDisabled("#textBigger"), false);
    assert.equal(await p.getAttribute("#contrastBtn", "aria-pressed"), "false");
  });

  test("A+ makes all the text bigger, in steps, up to one and a half times; A- brings it back", async () => {
    await clean(p);
    const base = await bodySize(p), sizes = [];
    for (let i = 0; i < 3; i++) { await p.click("#textBigger"); sizes.push(Math.round(await bodySize(p) / base * 100)); }
    assert.deepEqual(sizes, [115, 130, 150]);
    assert.equal(await p.isDisabled("#textBigger"), true);
    assert.equal(await p.evaluate(() => document.activeElement.id), "textSmaller", "focus moves to the button that still works");
    assert.equal(await said(p), "Text size 150 percent.");
    for (let i = 0; i < 3; i++) await p.click("#textSmaller");
    assert.equal(await bodySize(p), base);
    assert.equal(await p.evaluate(() => document.activeElement.id), "textBigger");
  });

  test("High contrast turns text and borders black, and says it's on", async () => {
    await clean(p);
    await p.click("#contrastBtn");
    assert.equal(await p.getAttribute("#contrastBtn", "aria-pressed"), "true");
    assert.equal(await p.evaluate(() => getComputedStyle(document.body).color), "rgb(0, 0, 0)");
    assert.equal(await p.evaluate(() => getComputedStyle(document.querySelector(".privacy")).color), "rgb(255, 255, 255)");
    assert.equal(await said(p), "High contrast is on.");
    await p.click("#contrastBtn");
    assert.equal(await p.getAttribute("#contrastBtn", "aria-pressed"), "false");
    assert.equal(await p.evaluate(() => document.documentElement.dataset.contrast), undefined);
  });

  test("with saving off, nothing is kept: a reload brings back the usual look", async () => {
    await clean(p);
    assert.equal(await savingOnNow(p), false);
    await p.click("#textBigger"); await p.click("#contrastBtn");
    assert.equal(await stored(p), null);
    await p.reload(); await p.waitForSelector("#app h1");
    assert.equal(await p.isDisabled("#textSmaller"), true);
    assert.equal(await p.getAttribute("#contrastBtn", "aria-pressed"), "false");
  });

  test("with saving on, they're kept after a reload", async () => {
    await clean(p);
    await p.click("#saveToggle"); assert.equal(await savingOnNow(p), true);
    await p.click("#textBigger"); await p.click("#textBigger"); await p.click("#contrastBtn");
    assert.deepEqual(JSON.parse(await stored(p)), { size: 2, contrast: true });
    await p.reload(); await p.waitForSelector("#app h1");
    assert.equal(await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--text-scale").trim()), "1.3");
    assert.equal(await p.getAttribute("#contrastBtn", "aria-pressed"), "true");
  });

  test("edge: set first, then saving turned on: kept from then on", async () => {
    await clean(p);
    await p.click("#textBigger");
    assert.equal(await stored(p), null);
    await p.click("#saveToggle");
    assert.deepEqual(JSON.parse(await stored(p)), { size: 1, contrast: false });
  });

  test("edge: turning saving off deletes them from the device, but the page keeps its look", async () => {
    await clean(p);
    await p.click("#saveToggle"); await p.click("#textBigger");
    assert.notEqual(await stored(p), null);
    await p.click("#saveToggle"); assert.equal(await savingOnNow(p), false);
    assert.equal(await stored(p), null);
    assert.equal(await p.isDisabled("#textSmaller"), false, "still bigger on this page");
  });

  test("edge: Clear my data deletes them from the device too", async () => {
    await clean(p);
    await p.click("#saveToggle"); await p.click("#contrastBtn");
    assert.notEqual(await stored(p), null);
    await p.click("#clearData");
    assert.equal(await stored(p), null);
    assert.deepEqual(await p.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith("icfh-"))), []);
  });

  test("edge: back to the usual look, nothing is kept even with saving on", async () => {
    await clean(p);
    await p.click("#saveToggle"); await p.click("#textBigger"); await p.click("#textSmaller");
    assert.equal(await stored(p), null);
  });

  test("edge: a kept setting that can't be used is ignored", async () => {
    for (const bad of ["{not json", JSON.stringify({ size: 9, contrast: "yes" }), JSON.stringify({ size: -1 }), JSON.stringify({ size: 1.5 })]) {
      await p.evaluate(([k, v]) => { localStorage.setItem("icfh-save-pref", "on"); localStorage.setItem(k, v); }, [KEY, bad]);
      await p.reload(); await p.waitForSelector("#app h1");
      assert.equal(await p.isDisabled("#textSmaller"), true, bad);
      assert.equal(await p.getAttribute("#contrastBtn", "aria-pressed"), "false", bad);
    }
    await clean(p);
  });

  test("edge: the buttons' names start with what they show, so speech control can find them", async () => {
    await clean(p);
    const names = await p.$$eval("#readTools button", bs => bs.map(b => b.textContent));
    assert.deepEqual(names, ["A− smaller text", "A+ bigger text", "High contrast"]);
    assert.equal(await p.getAttribute("#readTools", "role"), "group");
  });

  test("edge: at the biggest size, nothing runs off the side of a phone", async () => {
    const ph = await fresh({ viewport: { width: 375, height: 667 } });
    for (let i = 0; i < 3; i++) await ph.click("#textBigger");
    await ph.click("#contrastBtn");
    const fits = () => ph.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    const seen = [await fits()];
    await pick(ph, "respond"); seen.push(await fits());
    await ph.evaluate(() => { cur = visible().findIndex(s => s.id === "admitted"); render(); }); seen.push(await fits());
    await inject(ph, "feewaiver"); seen.push(await fits());
    await ph.click("#helpBtn"); seen.push(await fits());
    assert.deepEqual(seen, [true, true, true, true, true]);
    await ph.context().close();
  });

  test("edge: in high contrast, plain and muted text are at least 7:1 on their background", async () => {
    await clean(p); await p.click("#contrastBtn");
    const ratios = await p.evaluate(() => {
      const lum = c => { const [r, g, b] = c.match(/\d+/g).slice(0, 3).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
      const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
      const bg = getComputedStyle(document.body).backgroundColor, v = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
      const tmp = document.createElement("span"); document.body.append(tmp);
      const rgb = c => { tmp.style.color = c; return getComputedStyle(tmp).color; };
      const out = { ink: ratio(rgb(v("--ink")), bg), muted: ratio(rgb(v("--muted")), bg), accent: ratio(rgb(v("--accent")), bg), header: ratio(rgb(v("--hdr-muted")), rgb(v("--hdr-bg"))) };
      tmp.remove(); return out;
    });
    for (const [k, r] of Object.entries(ratios)) assert.ok(r >= 7, `${k}: ${r.toFixed(2)}`);
  });

  test("edge: in high contrast, the progress bar on the first question still looks empty", async () => {
    await clean(p); await p.click("#contrastBtn"); await pick(p, "respond");
    assert.equal(await p.$eval(".bar", b => getComputedStyle(b).backgroundColor), "rgb(255, 255, 255)", "a white track, outlined");
    assert.match(await p.$eval(".bar", b => getComputedStyle(b).boxShadow), /rgb\(0, 0, 0\)/);
    assert.equal(await p.$eval(".bar > span", s => s.style.width), "0%");
  });

  test("edge: on phones they share Get help's row, so the header is no taller; on the smallest, \"Contrast\" is short", async () => {
    for (const [w, h, label] of [[375, 667, "High contrast"], [320, 568, "Contrast"]]) {
      const ph = await fresh({ viewport: { width: w, height: h } });
      const [tools, help] = await ph.$$eval("#readTools, #helpBtn", els => els.map(e => e.getBoundingClientRect()).map(r => ({ top: r.top, bottom: r.bottom })));
      assert.ok(tools.top < help.bottom && help.top < tools.bottom, `${w}px: on the same row`);
      assert.equal(await ph.$eval("#contrastBtn", b => b.innerText), label);
      for (const b of await ph.$$eval("#readTools button", bs => bs.map(x => { const r = x.getBoundingClientRect(); return [r.width, r.height]; })))
        assert.ok(b[0] >= 24 && b[1] >= 24, `${w}px: ${b}`);
      await ph.context().close();
    }
  });

  test("edge: with JavaScript off they don't show, since they'd do nothing", async () => {
    const html = fs.readFileSync(path.join(ROOT, "form-builder-mvp.html"), "utf8");
    assert.match(html.match(/<noscript><style>([^<]*)<\/style><\/noscript>/)[1], /#readTools/);
  });
});
