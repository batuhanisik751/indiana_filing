// Feature: phone-friendly, designed for phones first, since many people using it don't have a computer.
// Every check runs in a phone-sized Chromium with touch. Real iPhones and Android phones aren't tested.
import { describe, test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fresh, close, pick, inject, jump, ROOT } from "../lib.mjs";

after(close);
const PHONE = { viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
const phone = (opts = {}) => fresh({ ...PHONE, ...opts });
const wide = q => q.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
// One question of each kind: a list, a choice, a checklist, a short box, a long box, a date, an amount, phone, email.
const KINDS = [["respond", "county"], ["respond", "acp"], ["feewaiver", "incomeKinds"], ["respond", "name"], ["respond", "address"],
  ["respond", "courtDate"], ["feewaiver", "hourlyRate"], ["respond", "phone"], ["respond", "email"], ["respond", "admitted"]];
async function onQuestion(q, form, id) { await inject(q, form, { caseConfirm: "" }); await jump(q, id); }
// Buttons and links smaller than 24 by 24 pixels, the WCAG 2.2 minimum. A link inside a sentence is exempt, as WCAG allows.
const smallTargets = q => q.evaluate(() => [...document.querySelectorAll("button, a, summary, select, label.choice")].filter(e => {
  const r = e.getBoundingClientRect();
  if (!r.width || e.closest("[hidden], details:not([open]) > :not(summary)")) return false;
  const inSentence = e.tagName === "A" && getComputedStyle(e).display === "inline" && e.parentElement.textContent.trim().length > e.textContent.trim().length + 3;
  return !inSentence && (r.width < 24 || r.height < 24);
}).map(e => `${e.tagName} "${e.textContent.trim().slice(0, 30)}" ${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`));

describe("Phone-friendly", () => {
  test("nothing scrolls sideways at 320 pixels wide, on every kind of screen", async () => {
    const q = await phone(), bad = [];
    if (await wide(q)) bad.push("first screen");
    await q.click("#moreToggle"); if (await wide(q)) bad.push("more choices");
    await q.click('.pick[data-kind="debt"]'); if (await wide(q)) bad.push("sorting");
    for (const [form, id] of KINDS) { await onQuestion(q, form, id); if (await wide(q)) bad.push(id); }
    await inject(q, "respond");
    await q.evaluate(() => document.querySelectorAll("details.more").forEach(d => { d.open = true; }));
    if (await wide(q)) bad.push("summary");
    assert.deepEqual(bad, []);
    await q.context().close();
  });
  test("every answer box is 16 pixels or more, so an iPhone doesn't zoom in when it's tapped", async () => {
    const q = await phone(), bad = [];
    for (const [form, id] of KINDS) {
      await onQuestion(q, form, id);
      bad.push(...await q.$$eval("#ans", els => els.map(e => [e.id, parseFloat(getComputedStyle(e).fontSize)]).filter(([, s]) => s < 16).map(([i, s]) => `${i} ${s}px`)));
    }
    assert.deepEqual(bad, []);
    await q.context().close();
  });
  test("buttons and links are at least 24 by 24 pixels to tap, except links inside a sentence", async () => {
    const q = await phone(), bad = [];
    await q.click("#moreToggle"); bad.push(...await smallTargets(q));
    await q.click("#helpBtn"); bad.push(...await smallTargets(q)); await q.click("#helpClose");
    await q.evaluate(() => { document.getElementById("footHelp").open = true; }); bad.push(...await smallTargets(q));
    for (const [form, id] of KINDS.slice(0, 4)) { await onQuestion(q, form, id); bad.push(...await smallTargets(q)); }
    await inject(q, "respond", { phone: "", email: "pat@gmial.com" });
    await q.evaluate(() => document.querySelectorAll("details.more").forEach(d => { d.open = true; }));
    bad.push(...await smallTargets(q));
    assert.deepEqual([...new Set(bad)], []);
    await q.context().close();
  });
  test("phone, email and amount boxes bring up the right keyboard", async () => {
    const q = await phone();
    const box = async (form, id) => { await onQuestion(q, form, id); return q.$eval("#ans", e => `${e.type}/${e.inputMode}`); };
    assert.equal(await box("respond", "phone"), "tel/");
    assert.equal(await box("respond", "email"), "text/email");
    assert.equal(await box("feewaiver", "hourlyRate"), "text/decimal");
    await q.context().close();
  });
  test("the person's own name, phone, email and mailing address offer the phone's saved details", async () => {
    const q = await phone(), got = {};
    for (const id of ["name", "phone", "email", "address"]) { await onQuestion(q, "respond", id); got[id] = await q.getAttribute("#ans", "autocomplete"); }
    assert.deepEqual(got, { name: "name", phone: "tel", email: "email", address: "street-address" });
    await q.context().close();
  });
  test("edge: someone else's address, the substitute address and the fax box don't offer the phone's own details", async () => {
    const q = await phone(), got = {};
    for (const [id, more] of [["svc1Address", {}], ["acpAddress", { acp: "yes" }], ["fax", {}]]) {
      await inject(q, "respond", { caseConfirm: "", ...more }); await jump(q, id);
      got[id] = await q.getAttribute("#ans", "autocomplete");
    }
    assert.deepEqual(got, { svc1Address: "off", acpAddress: "off", fax: "off" });
    await q.context().close();
  });
  test("edge: on a small phone, every question's answer box starts on the first screen, with full-size buttons", async () => {
    // 375 x 667 is the iPhone SE (2nd and 3rd generation): every question. 320 x 568, the first iPhone SE: nearly all,
    // since a few questions have long instructions and warnings that stay on screen.
    for (const [w, h, need] of [[375, 667, 1], [320, 568, 0.9]]) {
      const q = await phone({ viewport: { width: w, height: h } });
      let n = 0, fit = 0;
      for (const form of ["respond", "continuance", "feewaiver"]) {
        await inject(q, form, { caseConfirm: "", acp: "yes", related: "yes", localRule: "yes", hourlyRate: "10", otherIncome: "5" });
        for (const id of await q.evaluate(() => visible().map(s => s.id))) {
          await jump(q, id); n++;
          if (await q.evaluate(h => document.querySelector("#ans, .choices").getBoundingClientRect().top < h - 40, h)) fit++;
        }
        for (const b of ["#next", "#back"]) assert.ok((await q.$eval(b, e => e.getBoundingClientRect().height)) >= 44, b);
      }
      assert.ok(fit / n >= need, `${w}x${h}: ${fit} of ${n} fit`);
      await q.context().close();
    }
  });
  test("edge: reading text is at least 18 pixels, and pinch-zoom isn't turned off", async () => {
    const q = await phone();
    assert.ok(await q.evaluate(() => parseFloat(getComputedStyle(document.body).fontSize)) >= 18);
    const meta = fs.readFileSync(`${ROOT}/form-builder-mvp.html`, "utf8").match(/<meta name="viewport" content="([^"]+)"/)[1];
    assert.match(meta, /width=device-width/);
    assert.doesNotMatch(meta, /user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*1(\.0)?\b/);
    await q.context().close();
  });
  test("edge: turned sideways, nothing scrolls sideways either", async () => {
    const q = await phone({ viewport: { width: 568, height: 320 } });
    const bad = [];
    for (const [form, id] of KINDS.slice(0, 5)) { await onQuestion(q, form, id); if (await wide(q)) bad.push(id); }
    await inject(q, "respond"); if (await wide(q)) bad.push("summary");
    assert.deepEqual(bad, []);
    await q.context().close();
  });
  test("edge: nothing needs a mouse: a flag's reason, More and the pages all open with a tap", async () => {
    const q = await phone();
    await inject(q, "respond", { phone: "" });
    await q.waitForFunction(() => pdfState.result && !pdfState.busy, null, { timeout: 120000 });
    for (const sel of ['ul.flags li:has([data-fix="phone"]) summary', "ol.steps details.more > summary", 'details[data-more="preview"] > summary']) {
      // A person's taps are a moment apart: two taps on one spot of the screen within milliseconds are a double tap.
      await q.waitForTimeout(600);
      await q.locator(sel).first().tap(); // a tap becomes a click a moment later
      await q.waitForFunction(sel => document.querySelector(sel).parentElement.open, sel, { timeout: 5000 });
    }
    await q.waitForSelector("#preview canvas", { timeout: 120000 });
    await q.context().close();
  });
  test("edge: with nothing to fix, the Download button is on the first screens of the summary, before the long sections", async () => {
    const q = await phone();
    await inject(q, "appearance");
    await q.waitForSelector("#dlAll", { timeout: 120000 });
    const [dl, next] = await q.evaluate(() => [document.getElementById("dlAll"), [...document.querySelectorAll("h2.sub")].find(h => /What to do next/.test(h.textContent))].map(e => e.getBoundingClientRect().top + scrollY));
    assert.ok(dl < next, "before What to do next");
    assert.ok(dl < 568 * 2, `${Math.round(dl)} pixels down`);
    await q.context().close();
  });
});
