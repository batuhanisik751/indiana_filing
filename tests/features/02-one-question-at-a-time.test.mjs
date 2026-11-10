// Feature 2: one question per screen, and each answer fills its own spot on the official form.
import { describe, test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { fresh, close, reset, pick, walk, step, jump, answer, fieldRows, pdfText } from "../lib.mjs";

let p;
before(async () => { p = await fresh(); });
beforeEach(() => reset(p));
after(close);
const value = async label => (await fieldRows(p)).find(([l]) => l === label)?.[1];

describe("2. One question at a time", () => {
  test("each screen shows one question and one place to answer", async () => {
    await pick(p, "appearance");
    for (let i = 0; i < 6; i++) {
      assert.equal(await p.locator("h1#q").count(), 1);
      assert.equal(await p.locator("#ans, .choices").count(), 1);
      await p.click("#next");
    }
  });
  test("Continue moves to the next question", async () => {
    await pick(p, "appearance");
    const first = await step(p);
    await answer(p, "Allen");
    assert.notEqual(await step(p), first);
    assert.match(await p.textContent(".barlabel"), /2 of \d+/);
  });
  test("an answer fills its own spot on the form", async () => {
    await pick(p, "appearance"); await walk(p, "name");
    await answer(p, "Pat Example");
    assert.equal(await value("1. My name is"), "Pat Example");
  });
  test("the answers print in their spots on the official PDF", async () => {
    await pick(p, "appearance"); await walk(p, "summary", { name: "Pat Placement", phone: "260-555-0177" });
    const text = await pdfText(p);
    assert.ok(text.includes("Pat Placement") && text.includes("260-555-0177"));
  });
  test("edge: Enter moves on, like Continue", async () => {
    await pick(p, "appearance"); await walk(p, "name");
    await p.fill("#ans", "Pat Example"); await p.press("#ans", "Enter");
    assert.notEqual(await step(p), "name");
  });
  test("edge: Back keeps what was typed", async () => {
    await pick(p, "appearance"); await walk(p, "name");
    await p.fill("#ans", "Half typed"); await p.click("#back"); await p.click("#next");
    assert.equal(await p.inputValue("#ans"), "Half typed");
  });
  test("edge: a follow-up question appears only when it applies", async () => {
    await pick(p, "appearance"); await walk(p, "related");
    await answer(p, "yes");
    assert.equal(await step(p), "relatedNumbers");
    await jump(p, "related"); await answer(p, "no");
    assert.notEqual(await step(p), "relatedNumbers");
  });
  test("edge: an answer that a later choice hides doesn't print", async () => {
    await pick(p, "appearance"); await walk(p, "summary", { address: "1 Secret Home St, Fort Wayne, IN 46802", acp: "no" });
    await jump(p, "acp"); await answer(p, "yes");
    assert.ok(!(await fieldRows(p)).some(([, v]) => v.includes("Secret Home")));
  });
  test("edge: an answer far too long is refused, with the reason", async () => {
    await pick(p, "appearance"); await walk(p, "name");
    await p.fill("#ans", "x".repeat(20001)); await p.click("#next");
    assert.equal(await step(p), "name");
    assert.match(await p.textContent("#err"), /too long/);
  });
  test("edge: Enter on a choice with nothing picked says how to skip, instead of skipping by accident", async () => {
    await pick(p, "appearance"); await walk(p, "acp");
    await p.locator("input[name=ans]").first().focus(); await p.keyboard.press("Enter");
    assert.equal(await step(p), "acp");
    assert.match(await p.textContent("#err"), /Choose one/);
  });
});
