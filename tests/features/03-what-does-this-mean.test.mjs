// Feature 3: every question explains itself in plain words, and the tool never says what to write.
// (There is no separate glossary: each question explains its own terms, and some link to the official definitions.)
import { describe, test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { fresh, close, reset, pick, walk, jump } from "../lib.mjs";

let p;
before(async () => { p = await fresh(); });
beforeEach(() => reset(p));
after(close);
const FORMS = ["respond", "appearance", "feewaiver", "continuance"];
const allQuestions = () => p.evaluate(forms => forms.flatMap(f => SITUATIONS[f].steps().map(s => ({ form: f, id: s.id, help: s.help || "", q: s.q || "", link: s.link || null }))), FORMS);

describe("3. What does this mean?", () => {
  test("every question on every form has a plain explanation", async () => {
    const short = (await allQuestions()).filter(s => s.help.trim().length < 25);
    assert.deepEqual(short, []);
  });
  test("the explanation shows under the question", async () => {
    await pick(p, "appearance");
    const help = await p.evaluate(() => visible()[cur].help);
    assert.equal(await p.textContent("#qhelp"), help);
  });
  test("each question says whether it's needed or optional", async () => {
    await pick(p, "appearance"); await walk(p, "fax");
    assert.match(await p.textContent("#qneed"), /^Optional/);
    await jump(p, "name");
    assert.match(await p.textContent("#qneed"), /Needed for your form/);
  });
  test("a question about the Answer links to the official definitions", async () => {
    await pick(p, "respond"); await walk(p, "svc1Method");
    const link = p.locator("#qhelp a");
    assert.match(await link.textContent(), /definitions/);
    assert.equal(await link.getAttribute("target"), "_blank");
  });
  test("edge: no question starts with an answer already filled in", async () => {
    await pick(p, "respond");
    for (let i = 0; i < 10; i++) {
      assert.equal(await p.locator("input[name=ans]:checked").count(), 0, await p.textContent("#q"));
      if (await p.locator("#ans").count() && await p.evaluate(() => document.getElementById("ans").tagName !== "SELECT")) assert.equal(await p.inputValue("#ans"), "", await p.textContent("#q"));
      await p.click("#next");
    }
  });
  test("edge: no box shows example text that could be copied as an answer", async () => {
    await pick(p, "respond");
    for (let i = 0; i < 12; i++) { assert.equal(await p.locator("#ans[placeholder]").count(), 0); await p.click("#next"); }
  });
  test("edge: no explanation tells the person what to answer", async () => {
    const bad = (await allQuestions()).filter(s => /\b(?:we recommend|you should (?:choose|answer|write|say|pick)|the best answer|most people (?:choose|answer))\b/i.test(s.help + " " + s.q));
    assert.deepEqual(bad, []);
  });
  test("edge: every link in an explanation opens in a new tab, so answers stay on the page", async () => {
    const links = (await allQuestions()).filter(s => s.link);
    assert.ok(links.length > 0);
    await pick(p, "respond"); await walk(p, "svc1Method");
    assert.equal(await p.locator("#qhelp a").getAttribute("rel"), "noopener");
  });
  test("edge: marking a question I'm not sure says where to find that answer", async () => {
    await pick(p, "appearance"); await walk(p, "caseNumber");
    await p.click("#unsure"); await jump(p, "caseNumber");
    assert.match(await p.textContent("#unsureHelp"), /mycase\.in\.gov|papers/);
  });
  test("edge: Get help lists the same free help on the first screen, a question and the summary", async () => {
    const lists = [];
    lists.push(await p.textContent("#helpList"));
    await pick(p, "appearance"); lists.push(await p.textContent("#helpList"));
    await walk(p, "summary"); lists.push(await p.textContent("#helpList"));
    for (const l of lists) for (const t of ["Legal Help Desk", "free and low-cost legal help", "Ask a legal question online", "court staff", "Self-Service"]) assert.ok(l.includes(t), t);
  });
});
