// Item 21 on the MVP list: while answering, the progress bar fills with the needed answers filled in, the same count
// as the summary's. A blank, "I'm not sure" or an optional question leaves it where it is; the words say which
// question this is.
import { describe, test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { fresh, close, reset, pick, walk, answer, jump, inject } from "../lib.mjs";

let p;
before(async () => { p = await fresh(); });
beforeEach(() => reset(p));
after(close);
const bar = () => p.evaluate(() => {
  const b = document.querySelector(".bar[role=progressbar]"), words = sel => document.querySelector(sel)?.textContent.replace(/\s+/g, " ").trim();
  return { now: +b.getAttribute("aria-valuenow"), width: b.firstElementChild.style.width, name: b.getAttribute("aria-label"), text: b.getAttribute("aria-valuetext"), label: words(".barlabel"), count: words(".barcount") };
});
const score = () => p.evaluate(() => completeness());

describe("21. The progress bar fills with needed answers", () => {
  test("it starts empty, and says which question this is and how many needed answers are in", async () => {
    await pick(p, "appearance");
    const b = await bar(), s = await score(), n = await p.evaluate(() => visible().length);
    assert.equal(b.now, 0);
    assert.equal(b.width, "0%");
    assert.match(b.label, new RegExp(`Question 1 of ${n}$`));
    assert.equal(b.count, `0 of ${s.total} needed answers`);
  });

  test("answering a needed question moves it by one answer's share", async () => {
    await pick(p, "appearance");
    await answer(p, "02D01-2611-CC-001234");
    const s = await score(), b = await bar();
    assert.equal(s.filled, 1);
    assert.equal(b.now, Math.round(100 / s.total));
    assert.equal(b.text, `1 of ${s.total} needed answers filled in`);
  });

  test("Continue past a blank needed question leaves it where it is", async () => {
    await pick(p, "appearance");
    await answer(p, "02D01-2611-CC-001234");
    await walk(p, "name");
    const at = await bar();
    await p.click("#next"); // name left blank
    const b = await bar();
    assert.notEqual(await p.evaluate(() => visible()[cur].id), "name", "moved on");
    assert.equal(b.now, at.now);
    assert.match(b.label, /Question \d+ of \d+/);
  });

  test("\"I'm not sure\" leaves it where it is", async () => {
    await pick(p, "appearance");
    await walk(p, "name");
    const at = (await bar()).now;
    await p.click("#unsure");
    assert.equal((await bar()).now, at);
  });

  test("an optional question answered or not leaves it where it is", async () => {
    await pick(p, "appearance");
    await walk(p, "fax");
    const at = (await bar()).now;
    await answer(p, "260-555-0199");
    assert.equal((await bar()).now, at);
  });

  test("going back doesn't empty it: the answers are still in", async () => {
    await pick(p, "appearance");
    await walk(p, "name");
    const at = (await bar()).now;
    assert.ok(at > 0);
    await p.click("#back");
    assert.equal((await bar()).now, at);
    await jump(p, "caseNumber");
    assert.equal((await bar()).now, at);
  });

  test("at the summary it's the same count as the summary's bar", async () => {
    await pick(p, "appearance");
    await walk(p, "phone");
    const last = await bar();
    await walk(p, "summary", { phone: "" });
    const s = await score();
    const sum = await bar();
    assert.equal(sum.text, `${s.filled} of ${s.total} needed answers filled in`);
    assert.ok(last.now <= sum.now);
  });

  test("edge: an answer erased on its question takes it back down", async () => {
    await inject(p, "appearance");
    await jump(p, "plaintiff");
    const at = (await bar()).now;
    await p.fill("#ans", "");
    await p.click("#next");
    assert.ok((await bar()).now < at || (await p.evaluate(() => mode)) === "summary");
    await jump(p, "plaintiff");
    assert.ok((await bar()).now < at);
  });

  test("edge: screen readers get its name and the count, on the questions as on the summary", async () => {
    await pick(p, "continuance");
    const b = await bar(), s = await score();
    assert.equal(b.name, "Needed answers filled in");
    assert.equal(b.text, `0 of ${s.total} needed answers filled in`);
  });

  test("edge: on a 320px phone, at the usual size and at 150%, the count sits beside the bar and nothing goes past the side", async () => {
    const q = await fresh({ viewport: { width: 320, height: 568 } });
    await pick(q, "appearance");
    await walk(q, "address");
    for (const big of [false, true]) {
      if (big) { await q.click("#readBtn"); for (let i = 0; i < 3; i++) await q.click("#textBigger"); await q.click("#readBtn"); } // A+ to 150%
      const m = await q.evaluate(() => {
        const bar = document.querySelector(".bar").getBoundingClientRect(), c = document.querySelector(".barcount").getBoundingClientRect();
        return { same: Math.abs((bar.top + bar.bottom) / 2 - (c.top + c.bottom) / 2) < 3, barWidth: bar.width, right: c.right, wide: document.documentElement.scrollWidth };
      });
      assert.equal(m.same, true, "on the bar's line");
      assert.ok(m.barWidth >= 60, `the bar is ${Math.round(m.barWidth)}px`);
      assert.ok(m.right <= 320, `the count ends at ${Math.round(m.right)}px`);
      assert.equal(m.wide, 320);
    }
  });
});
