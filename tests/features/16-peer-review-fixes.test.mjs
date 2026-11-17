// Fixes from the class's peer review (November 2026), one section per fix, in the order they were made.
import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fresh, close, inject, step } from "../lib.mjs";

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

describe("Fix 2: each flag is one line, Missing first, with the reason on tap", () => {
  const row = id => p.locator(`ul.flags li:has([data-fix="${id}"])`).first();
  const shown = loc => loc.evaluate(e => e.innerText);
  test("a missing answer is one line, its title, and why it's needed opens on tap", async () => {
    await inject(p, "appearance", { phone: "" });
    const r = row("phone");
    assert.equal((await shown(r)).replace(/\s+/g, " ").trim(), "Missing Phone number Fix");
    await r.locator("summary").click();
    assert.match(await shown(r), /The official form says a phone number is required/);
  });
  test("a check shows its title and the first sentence of its reason, and the rest opens on tap", async () => {
    await inject(p, "appearance", { email: "pat@gmial.com" });
    const r = row("email");
    const before = await shown(r);
    assert.match(before, /The end of this email, gmial\.com, may be a typo for gmail\.com\./);
    assert.doesNotMatch(before, /If it's right/);
    await r.locator("summary").click();
    assert.match(await shown(r), /If it's right, you can leave it\./);
  });
  test("private-information warnings come first, then missing answers, then the rest", async () => {
    await inject(p, "respond", { email: "pat@gmial.com", phone: "", signDate: "", defenses: "My SSN is 123-45-6789." });
    const order = await p.$$eval("ul.flags li", lis => lis.map(li => (/^Private information/.test(li.querySelector(".ftitle").textContent) ? 0 : li.querySelector(".tag.missing") ? 1 : 2)));
    assert.deepEqual(order, [...order].sort((a, b) => a - b));
    assert.deepEqual([order[0], order.includes(1), order.at(-1)], [0, true, 2]);
  });
  test("edge: someone who skipped most questions gets a short list", async () => {
    await inject(p, "respond");
    await p.evaluate(() => { globalThis.eval("answers = { county: 'Allen', name: 'Pat Example', acp: 'no' }; unsure = { caseNumber: true };"); renderSummary(true); });
    const [n, h] = await p.$eval("ul.flags", ul => [ul.children.length, ul.getBoundingClientRect().height]);
    assert.ok(n >= 15, `${n} flags`);
    assert.ok(h / n < 75, `${Math.round(h / n)} pixels a flag`);
  });
  test("edge: the first sentence ends at a real sentence end, not in U.S., St. Joseph, an initial or a quote", async () => {
    const out = await p.evaluate(() => [
      "This doesn't look like a real U.S. phone number. Check it for typos.",
      "The first two digits (02) don't match St. Joseph County's number (71). One of them may be wrong.",
      "You marked this \"I'm not sure.\" Then come back and answer it.",
      "Served on J. Smith by mail. Check the name.",
      "No second sentence here",
    ].map(splitWhy));
    assert.deepEqual(out, [
      ["This doesn't look like a real U.S. phone number.", "Check it for typos."],
      ["The first two digits (02) don't match St. Joseph County's number (71).", "One of them may be wrong."],
      ["You marked this \"I'm not sure.\"", "Then come back and answer it."],
      ["Served on J. Smith by mail.", "Check the name."],
      ["No second sentence here", ""],
    ]);
  });
  test("edge: screen readers still hear the whole reason from each Fix button", async () => {
    await inject(p, "respond", { email: "pat@gmial.com", phone: "", defenses: "My SSN is 123-45-6789." });
    const bad = await p.evaluate(() => {
      const flags = [...runChecks(), ...pdfFlags()];
      return [...document.querySelectorAll("ul.flags button[data-fix]")].filter(b => {
        const said = (b.getAttribute("aria-describedby") || "").split(" ").map(id => document.getElementById(id)?.textContent || "").join(" ").replace(/\s+/g, " ").trim();
        const f = flags.find(x => x.fix === b.dataset.fix && said.startsWith(x.why.split(" ").slice(0, 4).join(" ")));
        return !f || !said.startsWith(f.why.replace(/\s+/g, " ").trim());
      }).map(b => b.dataset.fix);
    });
    assert.deepEqual(bad, []);
  });
  test("edge: an opened reason stays open when the summary redraws, and Fix still opens the question", async () => {
    await inject(p, "appearance", { phone: "" });
    await row("phone").locator("summary").click();
    await p.evaluate(() => keepFocus(() => renderSummary(true)));
    assert.equal(await row("phone").locator("details[open]").count(), 1);
    await row("phone").locator("[data-fix]").click();
    assert.equal(await step(p), "phone");
  });
});
