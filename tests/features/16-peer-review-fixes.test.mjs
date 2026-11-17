// Fixes from the class's peer review (November 2026), one section per fix, in the order they were made.
import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fresh, close, inject } from "../lib.mjs";

let p;
before(async () => { p = await fresh(); });
after(close);
const FORMS = ["respond", "appearance", "continuance", "feewaiver"];
const visibleWords = sel => p.evaluate(sel => document.querySelector(sel).innerText.split(/\s+/).filter(Boolean).length, sel);

describe("Fix 1: \"What to do next\" is one line per step, with the rest behind More", () => {
  test("each step shows one plain line, and a long one keeps its text and sources behind a closed More", async () => {
    for (const form of FORMS) {
      await inject(p, form);
      const steps = await p.$$eval("ol.steps > li", lis => lis.map(li => ({ lines: li.querySelectorAll(":scope > p:not(.srcs)").length, more: li.querySelector("details.more"), open: !!li.querySelector("details.more[open]"), srcs: li.querySelectorAll("details.more .srcs a, :scope > .srcs a").length })));
      assert.ok(steps.length >= 5, form);
      for (const s of steps) { assert.equal(s.lines, 1, form); assert.equal(s.open, false, form); assert.ok(s.srcs > 0, `${form}: every step still names its sources`); }
    }
  });
  test("the text shown is a fraction of what it was", async () => {
    await inject(p, "respond");
    const shown = await visibleWords("ol.steps"), all = await p.evaluate(() => nextSteps(sitKey, visibleAnswers()).map(s => s.body).join(" ").split(/\s+/).length);
    assert.ok(shown < 300, `${shown} words shown`);
    assert.ok(shown < all / 3, `${shown} shown of ${all}`);
  });
  test("More opens the full text, word for word, with its sources", async () => {
    await inject(p, "respond");
    await p.click("ol.steps > li:first-child details.more > summary");
    const [body, links] = await p.evaluate(() => [nextSteps(sitKey, visibleAnswers())[0].body, nextSteps(sitKey, visibleAnswers())[0].links.length]);
    assert.equal(await p.textContent("ol.steps > li:first-child .morebody > p:first-child"), body);
    assert.equal(await p.locator("ol.steps > li:first-child .morebody .srcs a").count(), links);
  });
  test("edge: an opened More stays open, with focus on it, when the summary redraws after the PDF check", async () => {
    await inject(p, "respond");
    await p.evaluate(() => document.querySelectorAll("details.more").forEach(d => { d.open = false; }));
    await p.click("ol.steps > li:first-child details.more > summary");
    await p.evaluate(() => keepFocus(() => renderSummary(true)));
    assert.equal(await p.locator("ol.steps > li:first-child details.more").getAttribute("open"), "");
    assert.equal(await p.evaluate(() => document.activeElement.matches("ol.steps > li:first-child details.more > summary")), true);
    await p.click("ol.steps > li:first-child details.more > summary"); // closed again, it stays closed
    await p.evaluate(() => renderSummary(true));
    assert.equal(await p.locator("ol.steps > li:first-child details.more[open]").count(), 0);
  });
  test("edge: in every situation, a long step has a line shorter than its text, and nothing reads \"undefined\"", async () => {
    const bad = await p.evaluate(() => {
      const out = [];
      for (const form of ["respond", "appearance", "continuance", "feewaiver"]) for (const fileMethod of ["", "efile", "paper"]) for (const county of ["", "Allen", "Marion", "Martin", "Greene"])
        for (const role of ["me", "other"]) for (const caseNumber of ["", "02D01-2611-SC-001234", "02D01-2611-EV-001234", "02D01-2611-DC-001234"]) {
          sitKey = form; // nextSteps reads the form's packet from here, as on the summary
          for (const s of nextSteps(form, { fileMethod, county, role, caseNumber, courtDate: "2020-01-02", hearingDate: "", name: "Pat" })) {
            if (s.body.length > 220 && !s.short) out.push(`${form}/${s.title}: no line`);
            if (s.short && (s.short.length >= s.body.length || s.short.length > 260)) out.push(`${form}/${s.title}: line ${s.short.length} of ${s.body.length}`);
            if (/undefined|null|NaN/.test(s.short || "")) out.push(`${form}/${s.title}: ${s.short}`);
          }
        }
      return [...new Set(out)];
    });
    assert.deepEqual(bad, []);
  });
  test("edge: the line carries the person's own facts: the court date, and the clerk's office when filing on paper", async () => {
    await inject(p, "respond", { fileMethod: "paper", county: "Allen" });
    const text = await p.textContent("ol.steps"), date = await p.evaluate(() => formDate(answers.courtDate));
    assert.ok(text.includes(`Your next court date: ${date}.`));
    assert.ok(text.includes("715 South Calhoun Street, # 201, Fort Wayne, IN 46802, phone 260-449-7245"));
  });
  test("edge: a court date that has passed, and a small claims case type, are said in the line itself", async () => {
    await inject(p, "respond", { courtDate: "2020-01-02", caseNumber: "02D01-2611-SC-001234" });
    const shown = await p.evaluate(() => document.querySelector("ol.steps").innerText);
    assert.match(shown, /The court date you entered, 01\/02\/2020, has already passed/);
    assert.match(shown, /Your case type is SC \(small claims\), where Answers are not usually filed\./);
  });
});
