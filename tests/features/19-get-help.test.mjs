// Feature: "Get help" on every screen, linking to the Indiana Legal Help Desk and its navigators, and legal aid.
import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fresh, close, reset, pick, walk, inject, step } from "../lib.mjs";

let p;
before(async () => { p = await fresh(); });
after(close);
const open = () => p.click("#helpBtn");
const panelLinks = () => p.$$eval("#helpPanel a", a => a.map(x => ({ href: x.href, text: x.textContent.replace(/\s*\(opens in a new tab\)/, ""), target: x.target, rel: x.rel })));

describe("Get help", () => {
  test("the Get help button is on every screen", async () => {
    await reset(p);
    const seen = [await p.locator("#helpBtn").isVisible()];
    await p.click('.pick[data-kind="debt"]'); seen.push(await p.locator("#helpBtn").isVisible()); // sorting questions
    await reset(p); await p.click("#moreToggle"); await p.click("#notSure"); seen.push(await p.locator("#helpBtn").isVisible()); // which one fits
    await reset(p); await pick(p, "appearance"); seen.push(await p.locator("#helpBtn").isVisible()); // a question
    await inject(p, "appearance"); seen.push(await p.locator("#helpBtn").isVisible()); // the summary
    assert.deepEqual(seen, [true, true, true, true, true]);
  });
  test("it lists the Indiana Legal Help Desk and its legal navigators", async () => {
    await reset(p); await open();
    const said = (await p.textContent("#helpPanel")).replace(/\s*\(opens in a new tab\)/g, ""); // screen readers hear that after each link
    assert.match(said, /Indiana Legal Help Desk: weekdays 10am to 2pm ET, call, text, chat or email with housing legal navigators/);
  });
  test("it names legal aid: Indiana Legal Services' online application", async () => {
    await reset(p); await open();
    const ils = (await panelLinks()).find(l => /indianalegalservices\.org/.test(l.href));
    assert.equal(ils.href, "https://www.indianalegalservices.org/applyonline/");
    assert.equal(ils.text, "Apply for free legal aid");
    assert.match(await p.textContent("#helpPanel"), /a nonprofit law firm that gives free civil legal help to eligible low-income residents/);
  });
  test("it also lists help near you, a free online legal question, court staff and the Self-Service Legal Center", async () => {
    await reset(p); await open();
    const hrefs = (await panelLinks()).map(l => l.href);
    for (const h of ["https://indianalegalhelp.org/get-help/", "https://indiana.freelegalanswers.org/", "https://www.in.gov/courts/selfservice/unrepresented/help", "https://www.in.gov/courts/selfservice/"]) assert.ok(hrefs.includes(h), h);
    assert.equal(hrefs.length, 6);
  });
  test("every link opens in a new tab, so the answers stay on the page, and the panel says so", async () => {
    await reset(p); await open();
    for (const l of await panelLinks()) { assert.equal(l.target, "_blank", l.href); assert.match(l.rel, /noopener/, l.href); }
    assert.match(await p.textContent("#helpPanel"), /These open in a new tab, so your answers stay on this page\./);
  });
  test("edge: focus moves into the panel, Close returns it to Get help, and the button says whether it's open", async () => {
    await reset(p); await open();
    assert.equal(await p.evaluate(() => document.activeElement.id), "helpTitle");
    assert.equal(await p.getAttribute("#helpBtn", "aria-expanded"), "true");
    await p.click("#helpClose");
    assert.equal(await p.evaluate(() => document.activeElement.id), "helpBtn");
    assert.equal(await p.getAttribute("#helpBtn", "aria-expanded"), "false");
  });
  test("edge: pressing Get help again closes it", async () => {
    await reset(p); await open(); await open();
    assert.equal(await p.locator("#helpPanel").isHidden(), true);
  });
  test("edge: the browser's Back button closes it and stays on the question", async () => {
    await reset(p); await pick(p, "appearance"); await walk(p, "phone");
    await open();
    await p.evaluate(() => history.back());
    await p.waitForFunction(() => document.getElementById("helpPanel").hidden);
    assert.equal(await step(p), "phone");
  });
  test("edge: opening it on a question keeps what was typed", async () => {
    await reset(p); await pick(p, "appearance"); await walk(p, "name");
    await p.fill("#ans", "Pat Half Typed"); await open(); await p.click("#helpClose");
    assert.equal(await p.inputValue("#ans"), "Pat Half Typed");
  });
  test("edge: the footer lists the same places, so they're there even if the page's code doesn't run", async () => {
    await reset(p);
    const foot = await p.$$eval("#footHelp a", a => a.map(x => x.href)), panel = (await panelLinks()).map(l => l.href);
    assert.deepEqual(foot, panel);
  });
  test("edge: on a phone the button is at the top of every screen, big enough to tap, without scrolling", async () => {
    const q = await fresh({ viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true });
    for (const go of [async () => {}, async () => { await pick(q, "respond"); }, async () => { await inject(q, "respond"); }]) {
      await go();
      const r = await q.$eval("#helpBtn", b => b.getBoundingClientRect().toJSON());
      assert.ok(r.top >= 0 && r.bottom < 120 && r.height >= 44 && r.width >= 44, JSON.stringify(r));
    }
    await q.context().close();
  });
});
