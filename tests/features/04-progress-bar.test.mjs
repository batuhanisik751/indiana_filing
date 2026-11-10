// Feature 4: the progress bar shows how much is done and how much is left.
import { describe, test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { fresh, close, reset, pick, walk, jump, answer, inject } from "../lib.mjs";

let p;
before(async () => { p = await fresh(); });
beforeEach(() => reset(p));
after(close);
const bar = () => p.evaluate(() => { const b = document.querySelector(".bar[role=progressbar]"); return { now: +b.getAttribute("aria-valuenow"), label: document.querySelector(".barlabel").textContent.replace(/\s+/g, " ").trim(), name: b.getAttribute("aria-label"), text: b.getAttribute("aria-valuetext") }; });
const total = () => p.evaluate(() => visible().length);

describe("4. Progress bar", () => {
  test("the first question starts at 0, question 1 of the total", async () => {
    await pick(p, "appearance");
    const b = await bar();
    assert.equal(b.now, 0);
    assert.match(b.label, new RegExp(`1 of ${await total()}`));
  });
  test("it moves forward with each answer", async () => {
    await pick(p, "appearance");
    const before = (await bar()).now;
    await answer(p, "Allen"); await answer(p, "SUPERIOR");
    assert.ok((await bar()).now > before);
  });
  test("the summary shows how many needed answers are filled in, at 100% when all are", async () => {
    await pick(p, "appearance"); await walk(p, "summary");
    const b = await bar();
    const [, filled, of] = b.label.match(/(\d+) of (\d+) needed answers filled in/);
    assert.equal(filled, of); assert.equal(b.now, 100);
  });
  test("it names the part of the form the question belongs to", async () => {
    await pick(p, "appearance");
    assert.match((await bar()).label, /^Your case/);
  });
  test("edge: a needed answer left blank shows on the summary as not filled", async () => {
    await inject(p, "appearance", { name: "" });
    const [, filled, of] = (await bar()).label.match(/(\d+) of (\d+)/);
    assert.equal(+filled, +of - 1);
  });
  test("edge: going back moves it back, and going forward again brings it back", async () => {
    await pick(p, "appearance"); await walk(p, "name");
    const at = (await bar()).now;
    await p.click("#back");
    assert.ok((await bar()).now <= at);
    await p.click("#next");
    assert.ok((await bar()).now >= at);
  });
  test("edge: a follow-up question adds to the total", async () => {
    await pick(p, "appearance"); await walk(p, "related");
    const before = await total();
    await answer(p, "yes");
    assert.equal(await total(), before + 1);
    assert.match((await bar()).label, new RegExp(`of ${before + 1}`));
  });
  test("edge: an answer marked I'm not sure doesn't count as filled in", async () => {
    await inject(p, "appearance", { phone: "" }, { phone: true });
    const [, filled, of] = (await bar()).label.match(/(\d+) of (\d+)/);
    assert.ok(+filled < +of);
  });
  test("edge: optional questions left blank don't count against it", async () => {
    await inject(p, "appearance", { fax: "" });
    const [, filled, of] = (await bar()).label.match(/(\d+) of (\d+)/);
    assert.equal(filled, of);
  });
  test("edge: screen readers get its name and how far along it is", async () => {
    await pick(p, "appearance");
    assert.equal((await bar()).name, "Progress");
    await walk(p, "summary");
    const b = await bar();
    assert.equal(b.name, "Needed answers filled in");
    assert.match(b.text, /\d+ of \d+ needed answers filled in/);
  });
});
