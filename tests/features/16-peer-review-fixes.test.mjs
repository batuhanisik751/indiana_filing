// Fixes from the class's peer review (November 2026), one section per fix, in the order they were made.
import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fresh, close, inject, step, pick, walk, jump, reset, answer, fieldRows, flagsFor, editAnswer, pdfText, scoreMatchesFlags, launch, APP } from "../lib.mjs";

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
    // Each line also names its source (facts, not advice), so it's a bit over a third of the full text.
    assert.ok(shown < 350, `${shown} words shown`);
    assert.ok(shown < all / 2, `${shown} shown of ${all}`);
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
    assert.match(shown, /Your case type is SC \(small claims\), and Indiana Legal Help says Answers are not usually filed there\./);
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

describe("Fix 3: the two views of the form start closed", () => {
  const pdfDone = () => p.waitForFunction(() => pdfState.result && pdfState.key === pdfKey() && !pdfState.busy, null, { timeout: 120000 });
  const sec = key => p.locator(`details.more.section[data-more="${key}"]`);
  // Each test starts from a summary with every section closed, as a person first sees it.
  const start = async (form, more) => { await inject(p, form, more); await p.evaluate(() => { openMore.clear(); document.querySelectorAll("details.more").forEach(d => { d.open = false; }); }); await p.waitForTimeout(50); };
  test("the pages of the filled form start closed, and aren't drawn until opened", async () => {
    await start("respond"); await pdfDone(); await p.waitForTimeout(500);
    assert.equal(await sec("preview").getAttribute("open"), null);
    assert.equal(await p.locator("#preview canvas").count(), 0, "nothing drawn, and the PDF viewer isn't needed yet");
    await sec("preview").locator("summary").click();
    await p.waitForSelector("#preview canvas", { timeout: 120000 });
  });
  test("the list of every answer starts closed, and opens with an Edit link for every question", async () => {
    await start("appearance");
    assert.equal(await sec("answers").getAttribute("open"), null);
    assert.equal(await p.locator("dl.vals .edit").first().isVisible(), false);
    await sec("answers").locator("summary").click();
    const missing = await p.evaluate(() => visible().filter(s => { const b = document.querySelector(`dl.vals [data-fix="${s.id}"]`); return !b || !b.checkVisibility(); }).map(s => s.id));
    assert.deepEqual(missing, []);
  });
  test("closed, the summary is thousands of pixels shorter", async () => {
    await start("respond"); await pdfDone();
    const closed = await p.evaluate(() => document.documentElement.scrollHeight);
    await p.evaluate(() => document.querySelectorAll("details.more.section").forEach(d => { d.open = true; }));
    await p.waitForSelector("#preview canvas", { timeout: 120000 }); await p.waitForTimeout(1500);
    const open = await p.evaluate(() => document.documentElement.scrollHeight);
    assert.ok(open - closed > 2000, `${closed} closed, ${open} open`);
  });
  test("edge: after an Edit from the list, the list is open again, with focus on that row", async () => {
    await start("appearance");
    await sec("answers").locator("summary").click();
    await p.click('dl.vals [data-fix="phone"]'); await p.fill("#ans", "317-555-0111"); await p.click("#next");
    assert.equal(await sec("answers").getAttribute("open"), "");
    assert.equal(await p.evaluate(() => document.activeElement.matches('dl.vals [data-fix="phone"]')), true);
  });
  test("edge: a section left open stays open when the summary redraws, and its pages are drawn again", async () => {
    await start("respond"); await pdfDone();
    await sec("preview").locator("summary").click();
    await p.waitForSelector("#preview canvas", { timeout: 120000 });
    await p.evaluate(() => keepFocus(() => renderSummary(true)));
    assert.equal(await sec("preview").getAttribute("open"), "");
    await p.waitForSelector("#preview canvas", { timeout: 120000 });
  });
  test("edge: starting over closes them again", async () => {
    await start("respond"); await pdfDone();
    await p.evaluate(() => document.querySelectorAll("details.more.section").forEach(d => { d.open = true; }));
    await p.waitForTimeout(100);
    await p.click("#restart"); // Start over, confirmed
    await inject(p, "appearance");
    assert.equal(await p.locator("details.more.section[open]").count(), 0);
  });
});

describe("Fix 4: More opens on tap, or on hover on a computer, and holds background, not instructions", () => {
  const more = () => p.locator(".qmain details.more").first();
  const openNow = () => more().evaluate(d => d.open);
  test("a long explanation keeps its instructions on screen, and its background is behind More", async () => {
    await inject(p, "continuance"); await jump(p, "caseNumber");
    assert.ok((await p.textContent("#qhelp")).startsWith("Indiana case numbers have four parts, like 49D01-2610-CC-001234. The first two digits are the county number. Copy it exactly from your papers. If you don't have them, you can look up your case online or ask the clerk's office. This question is optional."));
    assert.doesNotMatch(await p.textContent("#qhelp"), /court staff/, "the background is only behind More");
    assert.equal(await openNow(), false);
    assert.match(await p.textContent("#qmore"), /court staff will complete the court information and your case number/);
  });
  test("edge: nothing that tells people what to do, or warns them, is behind More", async () => {
    const bad = await p.evaluate(() => ["respond", "appearance", "continuance", "feewaiver"].flatMap(f => SITUATIONS[f].steps())
      .filter(s => s.more && /\b(?:must|need to|have to|don't|do not|won't|warn|lose|can't|cannot|leave this|type|copy|enter|only)\b/i.test(s.more)).map(s => s.id));
    assert.deepEqual([...new Set(bad)], []);
  });
  test("screen readers hear the background with the question", async () => {
    await inject(p, "appearance"); await jump(p, "related");
    assert.match(await p.getAttribute(".choices[role=radiogroup]", "aria-describedby"), /\bqmore\b/); // a choice's group carries it
    assert.match(await p.textContent("#qmore"), /In a debt case, this might be a case about the same debt/);
  });
  test("on a computer, resting the pointer on More opens it, and moving away closes it", async () => {
    await inject(p, "appearance"); await jump(p, "related");
    await more().locator("summary").hover(); await p.waitForTimeout(600);
    assert.equal(await openNow(), true);
    await p.mouse.move(5, 5); await p.waitForTimeout(100);
    assert.equal(await openNow(), false);
  });
  test("edge: a quick pass of the pointer doesn't open it", async () => {
    await inject(p, "appearance"); await jump(p, "related");
    await more().locator("summary").hover(); await p.waitForTimeout(100); await p.mouse.move(5, 5); await p.waitForTimeout(500);
    assert.equal(await openNow(), false);
  });
  test("edge: a click right after the hover opened it keeps it open, even after the pointer leaves", async () => {
    await inject(p, "appearance"); await jump(p, "related");
    await more().locator("summary").hover(); await p.waitForTimeout(600);
    await more().locator("summary").click(); await p.mouse.move(5, 5); await p.waitForTimeout(100);
    assert.equal(await openNow(), true);
    await more().locator("summary").click(); // a second click closes it
    assert.equal(await openNow(), false);
  });
  test("edge: on a phone nothing opens without a tap, and a tap opens it", async () => {
    const q = await fresh({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await inject(q, "appearance"); await jump(q, "related");
    const m = q.locator(".qmain details.more").first();
    await m.locator("summary").hover().catch(() => {}); await q.waitForTimeout(600);
    assert.equal(await m.evaluate(d => d.open), false);
    await m.locator("summary").tap();
    assert.equal(await m.evaluate(d => d.open), true);
    await q.context().close();
  });
  test("edge: a whole section, like the pages of the form, doesn't open on hover", async () => {
    await inject(p, "respond");
    await p.waitForFunction(() => pdfState.result && !pdfState.busy, null, { timeout: 120000 });
    await p.evaluate(() => { openMore.clear(); document.querySelectorAll("details.more").forEach(d => { d.open = false; }); });
    await p.locator('details[data-more="preview"] > summary').hover(); await p.waitForTimeout(600);
    assert.equal(await p.locator('details[data-more="preview"]').evaluate(d => d.open), false);
  });
});

describe("Fix 5: Enlarge shows a page of the form at full width", () => {
  const dialog = () => p.locator("dialog.pageview[open]");
  const bigCanvas = () => p.waitForSelector("dialog.pageview[open] .pvpage canvas", { timeout: 120000 });
  async function pages(q = p) {
    await inject(q, "respond");
    await q.waitForFunction(() => pdfState.result && !pdfState.busy, null, { timeout: 120000 });
    await q.evaluate(() => { const d = document.querySelector('details[data-more="preview"]'); d.open = true; });
    await q.waitForSelector("#preview canvas", { timeout: 120000 });
  }
  test("each page of the filled form has an Enlarge button that shows it far larger", async () => {
    await pages();
    const small = await p.$eval("#preview canvas", c => c.getBoundingClientRect().width);
    await p.click('#preview [data-page="1"]');
    await bigCanvas();
    const large = await p.$eval("dialog.pageview .pvpage canvas", c => c.getBoundingClientRect().width);
    assert.ok(large > small * 1.8, `${Math.round(small)} to ${Math.round(large)} pixels wide`);
    assert.equal(await p.textContent("#pvTitle"), "Page 1 of 4 of your filled form");
    await p.click("#pvClose");
  });
  test("edge: clearing the answers closes a page shown large, so it doesn't stay on screen", async () => {
    await pages();
    await p.click('#preview [data-page="1"]'); await bigCanvas();
    await p.evaluate(() => { resetAnswers(); mode = "pick"; render(); }); // what Clear my data does, here or from another tab
    assert.equal(await p.locator("dialog.pageview").count(), 0);
  });
  test("Next and Previous move between pages, and Close returns focus to the Enlarge button", async () => {
    await pages();
    await p.click('#preview [data-page="1"]'); await bigCanvas();
    assert.equal(await p.locator("#pvPrev").isDisabled(), true);
    await p.click("#pvNext");
    await p.waitForFunction(() => document.getElementById("pvTitle").textContent.startsWith("Page 2 of"));
    await p.click("#pvClose");
    assert.equal(await dialog().count(), 0);
    assert.equal(await p.evaluate(() => document.activeElement.dataset.page), "1");
  });
  test("edge: at the last page, Next is disabled and focus moves to Previous", async () => {
    await pages();
    await p.click('#preview [data-page="3"]'); await bigCanvas();
    await p.click("#pvNext");
    await p.waitForFunction(() => document.getElementById("pvTitle").textContent.startsWith("Page 4 of"));
    assert.equal(await p.locator("#pvNext").isDisabled(), true);
    assert.equal(await p.evaluate(() => document.activeElement.id), "pvPrev");
    await p.keyboard.press("Escape");
  });
  test("edge: Escape, and the browser's Back button, close it and stay on the summary", async () => {
    await pages();
    await p.click('#preview [data-page="1"]'); await bigCanvas();
    await p.keyboard.press("Escape");
    assert.equal(await dialog().count(), 0);
    await p.click('#preview [data-page="1"]'); await bigCanvas();
    await p.evaluate(() => history.back());
    await p.waitForFunction(() => !document.querySelector("dialog.pageview[open]"));
    assert.equal(await step(p), "summary");
  });
  test("edge: on a phone it fills the screen, drawn sharp enough to pinch in", async () => {
    const q = await fresh({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
    await pages(q);
    await q.click('#preview [data-page="1"]');
    await q.waitForSelector("dialog.pageview[open] .pvpage canvas", { timeout: 120000 });
    const [box, css, px] = await q.evaluate(() => { const d = document.querySelector("dialog.pageview").getBoundingClientRect(), c = document.querySelector(".pvpage canvas"); return [[d.width, d.height], c.getBoundingClientRect().width, c.width]; });
    assert.deepEqual(box, [390, 844]);
    assert.ok(px >= css * 3 * 1.5, `${px} pixels for ${Math.round(css)} wide`);
    await q.context().close();
  });
  test("edge: the picture of where an answer prints can be enlarged too, with the place still highlighted", async () => {
    await inject(p, "appearance"); await jump(p, "name");
    await p.click("#whereToggle");
    await p.waitForSelector("#whereBig", { timeout: 120000 });
    await p.click("#whereBig"); await bigCanvas();
    assert.ok(await p.locator("dialog.pageview .wheremark").count() >= 1);
    assert.match(await p.textContent("#pvTitle"), /Appearance .*page \d+ of \d+, with the place for this answer highlighted/);
    await p.click("#pvClose");
    assert.equal(await p.evaluate(() => document.activeElement.id), "whereBig");
  });
});

describe("Fix 6: it says up front how many questions a form has and what to have with you", () => {
  const counts = () => p.evaluate(() => Object.fromEntries(Object.keys(SITUATIONS).map(k => [k, questionCount(k)])));
  test("the first screen gives the range of questions and says to have any court papers with you", async () => {
    await reset(p);
    const [lo, hi] = await p.evaluate(() => [Math.min(...Object.keys(SITUATIONS).map(questionMin)), Math.max(...Object.keys(SITUATIONS).map(questionCount))]);
    assert.equal(await p.textContent(".hero p.takes"), `Each form is ${lo} to ${hi} questions. Have any court papers you got with you: the court, the case number and the other side's name are on them.`);
  });
  test("each form's card says about how many questions it has and what to have with you", async () => {
    await reset(p); await p.click("#moreToggle");
    const c = await counts(), min = await p.evaluate(() => Object.fromEntries(Object.keys(SITUATIONS).map(k => [k, questionMin(k)])));
    for (const k of Object.keys(c)) {
      const says = min[k] === c[k] ? `About ${c[k]} questions.` : `${min[k]} to ${c[k]} questions, depending on your answers.`;
      assert.ok((await p.textContent(`.pick[data-k="${k}"] .takes`)).startsWith(`${says} Have `), k);
    }
  });
  test("the forms offered after the sorting questions say the same", async () => {
    await reset(p);
    await p.click('.pick[data-kind="debt"]');
    await p.locator('input[name=ans][value="complaint"]').check({ force: true }); await p.click("#next");
    assert.equal(await p.textContent('[data-start="respond"] .takes'), `About ${(await counts()).respond} questions. Have the Complaint you received: the Answer goes through its numbered paragraphs.`);
  });
  test("edge: the count is what each form really starts with", async () => {
    for (const [k, n] of Object.entries(await counts())) {
      await reset(p); await pick(p, k);
      assert.equal((await p.textContent(".barlabel")).match(/of (\d+)/)[1], String(n), k);
    }
  });
  test("edge: the fee waiver asks for income and expenses, not court papers", async () => {
    await reset(p); await p.click("#moreToggle");
    const t = await p.textContent('.pick[data-k="feewaiver"] .takes');
    assert.match(t, /monthly income and expenses/); assert.doesNotMatch(t, /court papers|Complaint/);
  });
  test("edge: the line fits the card's layout on a phone and a laptop", async () => {
    for (const width of [390, 1280]) {
      const q = await fresh({ viewport: { width, height: 900 } });
      await q.click("#moreToggle");
      const [card, line] = await q.evaluate(() => { const b = document.querySelector('.pick[data-k="respond"]'); return [b.getBoundingClientRect(), b.querySelector(".takes").getBoundingClientRect()].map(r => [r.left, r.right]); });
      assert.ok(line[0] >= card[0] && line[1] <= card[1] + 0.5, `${width}: ${line} inside ${card}`);
      assert.equal(await q.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, `${width}: no sideways scroll`);
      await q.context().close();
    }
  });
});

describe("Fix 7A: a full case number fills in the county and court, after one confirmation", () => {
  const caseFirst = async (form, number) => { await reset(p); await pick(p, form); assert.equal(await step(p), "caseNumber"); await answer(p, number); };
  test("the case number comes first, and a full one is confirmed in one question", async () => {
    await caseFirst("appearance", "02D01-2611-CC-001234");
    assert.equal(await step(p), "caseConfirm");
    assert.equal(await p.textContent("#q"), "Your case number says Allen County, Superior Court. Is that right?");
  });
  test("Yes skips the county and court questions, and the form still prints them", async () => {
    await caseFirst("appearance", "02D01-2611-CC-001234"); await answer(p, "yes");
    assert.equal(await step(p), "courtDate");
    await walk(p, "summary");
    const rows = Object.fromEntries((await fieldRows(p)).map(([l, v]) => [l, v]));
    assert.equal(await p.evaluate(() => visibleAnswers().county + "|" + visibleAnswers().courtType), "Allen|SUPERIOR");
    const text = await pdfText(p);
    assert.ok(text.includes("Allen") && text.includes("SUPERIOR"), "printed on the form");
    assert.deepEqual(await flagsFor(p, "county"), []);
    assert.ok(Object.keys(rows).length > 0);
  });
  test("each form with a case number saves a question", async () => {
    for (const form of ["respond", "appearance", "continuance"]) {
      await caseFirst(form, "49C01-2611-PL-000123"); await answer(p, "yes");
      const ids = await p.evaluate(() => visible().map(s => s.id));
      assert.ok(!ids.includes("county") && !ids.includes("courtType") && ids.includes("caseConfirm"), form);
      assert.equal(await p.evaluate(() => visibleAnswers().county + "|" + visibleAnswers().courtType), "Marion|CIRCUIT", form);
    }
  });
  test("edge: No asks the county and court as before, and a mismatch with the number is still flagged", async () => {
    await caseFirst("appearance", "02D01-2611-CC-001234"); await answer(p, "no");
    assert.equal(await step(p), "county");
    await answer(p, "Marion"); await answer(p, "SUPERIOR");
    await walk(p, "summary");
    assert.ok((await flagsFor(p, "caseNumber")).some(f => /don't match Marion County's number \(49\)/.test(f)));
  });
  test("edge: with no case number, or one whose court letter isn't C or D, the county and court are asked", async () => {
    await caseFirst("appearance", ""); assert.equal(await step(p), "county");
    await caseFirst("appearance", "49K01-2611-CC-001234"); assert.equal(await step(p), "county");
    await caseFirst("appearance", "02D01-2611"); assert.equal(await step(p), "county");
  });
  test("edge: changing the case number to another county asks for the confirmation again", async () => {
    await inject(p, "appearance", { caseConfirm: "yes" });
    assert.equal(await p.evaluate(() => visible().some(s => s.id === "county")), false);
    await editAnswer(p, "caseNumber"); await p.fill("#ans", "49D01-2611-CC-001234"); await p.click("#next");
    assert.equal(await step(p), "caseConfirm");
    assert.equal(await p.textContent("#q"), "Your case number says Marion County, Superior Court. Is that right?");
    assert.equal(await p.locator("input[name=ans]:checked").count(), 0, "nothing chosen for the new number");
  });
  test("edge: a change that keeps the same county and court keeps the confirmation", async () => {
    await inject(p, "appearance", { caseConfirm: "yes" });
    await editAnswer(p, "caseNumber"); await p.fill("#ans", "02D01-2611-CC-009999"); await p.click("#next");
    assert.equal(await step(p), "summary");
    assert.equal(await p.evaluate(() => answers.caseConfirm), "yes");
  });
  test("edge: on the summary, the county and court rows edit through the confirmation", async () => {
    await inject(p, "appearance", { caseConfirm: "yes" });
    await p.evaluate(() => { document.querySelector('details[data-more="answers"]').open = true; });
    const targets = await p.$$eval("dl.vals > div", ds => ds.filter(d => /^(County|Court)/.test(d.querySelector("dt").textContent)).map(d => d.querySelector("[data-fix]")?.dataset.fix));
    assert.ok(targets.length >= 1 && targets.every(t => t === "caseConfirm"), JSON.stringify(targets));
  });
  test("edge: Back with a changed case number, without Continue, doesn't keep the old confirmation", async () => {
    await caseFirst("appearance", "02D01-2611-CC-001234"); await answer(p, "yes");
    await p.click("#back"); await p.click("#back");
    assert.equal(await step(p), "caseNumber");
    await p.fill("#ans", "49D01-2611-CC-001234"); await p.click("#back"); // to the first screen, keeping what was typed
    assert.equal(await p.evaluate(() => answers.caseConfirm), undefined);
  });
});

describe("Fix 7B: the fee waiver asks which kinds of income and expenses apply, then only those amounts", () => {
  const INCOME = ["hourlyRate", "unemployment", "tanf", "ssi", "childSupportIn", "otherIncome"];
  const EXPENSES = ["housing", "utilities", "food", "childCare", "medical", "transportation", "insurance", "childSupportOut", "otherCosts"];
  const shownOf = ids => p.evaluate(ids => visible().map(s => s.id).filter(id => ids.includes(id)), ids);
  const row = async label => (await fieldRows(p)).find(([l]) => l.startsWith(label))?.[1];
  test("only the checked kinds of income are asked", async () => {
    await reset(p); await pick(p, "feewaiver"); await walk(p, "incomeKinds");
    await answer(p, "wages,ssi");
    assert.equal(await step(p), "hourlyRate");
    assert.deepEqual(await shownOf(INCOME), ["hourlyRate", "ssi"]);
  });
  test("only the checked expenses are asked", async () => {
    await reset(p); await pick(p, "feewaiver"); await walk(p, "expenseKinds");
    await answer(p, "housing,food");
    assert.equal(await step(p), "housing");
    assert.deepEqual(await shownOf(EXPENSES), ["housing", "food"]);
  });
  test("None of these prints $0.00 as the sworn total, with no Income or Expenses flag", async () => {
    await inject(p, "feewaiver", { incomeKinds: "none", expenseKinds: "none" });
    assert.equal(await row("6. and Total Income"), "$0.00");
    assert.equal(await row("8. and Total Expenses"), "$0.00");
    assert.equal(await p.evaluate(() => runChecks().filter(f => ["Income", "Expenses"].includes(f.title)).length), 0);
    assert.equal(await scoreMatchesFlags(p), true);
  });
  test("edge: skipping the list asks every amount, as before", async () => {
    await reset(p); await pick(p, "feewaiver"); await walk(p, "incomeKinds");
    await p.click("#next");
    assert.deepEqual(await shownOf(INCOME), INCOME);
    await inject(p, "feewaiver", { incomeKinds: "" });
    assert.equal(await row("6. and Total Income"), "$1,000.00", "12.50 an hour for 80 hours, as before");
  });
  test("edge: a checked kind with no amount is flagged Missing, and the score agrees", async () => {
    await inject(p, "feewaiver", { incomeKinds: "wages,ssi", ssi: "", expenseKinds: "housing", housing: "500" });
    assert.match((await flagsFor(p, "ssi"))[0] || "", /^missing\|.*\|You said your household gets this, but no amount is entered, so it's left out of Total Income/);
    assert.equal(await scoreMatchesFlags(p), true);
  });
  test("edge: None of these and the other boxes rule each other out", async () => {
    await reset(p); await pick(p, "feewaiver"); await walk(p, "incomeKinds");
    const box = v => p.locator(`input[name=ans][value="${v}"]`);
    await box("wages").check(); await box("none").check();
    assert.equal(await box("wages").isChecked(), false);
    await box("ssi").check();
    assert.equal(await box("none").isChecked(), false);
    assert.equal(await p.evaluate(() => draft.value), "ssi");
  });
  test("edge: unchecking a kind takes its amount off the form and out of the total", async () => {
    await inject(p, "feewaiver", { incomeKinds: "wages,ssi", ssi: "500" });
    assert.equal(await row("6. and Total Income"), "$1,500.00");
    await editAnswer(p, "incomeKinds"); await answer(p, "wages");
    assert.equal(await step(p), "summary");
    assert.equal(await row("6. and Total Income"), "$1,000.00");
    assert.ok(!(await fieldRows(p)).some(([, v]) => v.includes("500")));
  });
  test("edge: an edit that checks a new kind asks its amount before going back to the summary", async () => {
    await inject(p, "feewaiver", { incomeKinds: "wages" });
    await editAnswer(p, "incomeKinds"); await answer(p, "wages,ssi");
    assert.equal(await step(p), "ssi");
    await p.fill("#ans", "300"); await p.click("#next");
    assert.equal(await step(p), "summary");
    assert.equal(await row("6. and Total Income"), "$1,300.00");
  });
  test("edge: an amount marked I'm not sure still keeps the sworn total blank, and is Missing", async () => {
    await inject(p, "feewaiver", { incomeKinds: "ssi", ssi: "" }, { ssi: true });
    assert.match(await row("6. and Total Income"), /Left blank until you answer the questions marked/);
    assert.match((await flagsFor(p, "ssi"))[0], /^missing\|/);
    assert.equal(await scoreMatchesFlags(p), true);
  });
  test("edge: the summary lists the checked kinds by name, with an Edit link", async () => {
    await inject(p, "feewaiver", { incomeKinds: "wages,ssi", ssi: "200" });
    await p.evaluate(() => { document.querySelector('details[data-more="answers"]').open = true; });
    const r = await p.$$eval("dl.vals > div", ds => ds.filter(d => d.querySelector("dt").textContent === "Kinds of income").map(d => [d.querySelector("dd").textContent, d.querySelector("[data-fix]")?.dataset.fix]));
    assert.deepEqual(r, [["Wages from work, SSI/SSD benefits", "incomeKinds"]]);
  });
});

describe("Fix 8: the case number question says where to look it up", () => {
  const link = () => p.locator("#qhelp a");
  test("the question itself says to look it up at mycase.in.gov or ask the clerk, with a link", async () => {
    await reset(p); await pick(p, "appearance");
    assert.equal(await step(p), "caseNumber");
    assert.match(await p.textContent("#qhelp"), /If you don't have them, you can look up your case online or ask the clerk's office\./);
    assert.equal(await link().getAttribute("href"), "https://mycase.in.gov/");
    assert.equal(await link().getAttribute("target"), "_blank");
  });
  test("edge: it's there before pressing I'm not sure, on every form with a case number", async () => {
    for (const form of ["respond", "appearance", "continuance"]) {
      await reset(p); await pick(p, form);
      assert.equal(await p.evaluate(() => unsure.caseNumber), undefined, form);
      assert.match(await link().textContent(), /^Look up your case at mycase\.in\.gov/, form);
    }
  });
  test("edge: I'm not sure still gives the same advice afterwards", async () => {
    await reset(p); await pick(p, "appearance");
    await p.click("#unsure"); await jump(p, "caseNumber");
    assert.match(await p.textContent("#unsureHelp"), /look up your case at mycase\.in\.gov, or ask the clerk's office/);
  });
});

describe("Fix 9: the logo and name go to the first screen, keeping the answers", () => {
  const home = () => p.click("#homeBtn");
  test("from a question, it goes to the first screen, and Go back returns to that question", async () => {
    await reset(p); await pick(p, "appearance"); await walk(p, "name");
    await home();
    assert.equal(await step(p), "pick");
    await p.click("#backToWork");
    assert.equal(await step(p), "name");
  });
  test("what was typed in the open question is kept", async () => {
    await reset(p); await pick(p, "appearance"); await walk(p, "name");
    await p.fill("#ans", "Pat Typed"); await home();
    assert.equal(await p.evaluate(() => answers.name), "Pat Typed");
    await p.click("#backToWork");
    assert.equal(await p.inputValue("#ans"), "Pat Typed");
  });
  test("its name for screen readers starts with what it shows", async () => {
    await reset(p);
    assert.equal(await p.getByRole("button", { name: "Indiana Court Form Helper: go to the first screen" }).count(), 1);
  });
  test("edge: from the summary, Go back returns to the summary", async () => {
    await inject(p, "appearance"); await home();
    assert.equal(await step(p), "pick");
    await p.click("#backToWork");
    assert.equal(await step(p), "summary");
  });
  test("edge: during an edit from the summary, the edit is cancelled and the old answer kept", async () => {
    await inject(p, "appearance");
    await editAnswer(p, "name"); await p.fill("#ans", "Not Kept"); await home();
    assert.equal(await step(p), "pick");
    assert.equal(await p.evaluate(() => [answers.name, returnToSummary].join("|")), "Pat Example|false");
    await p.click("#backToWork");
    assert.equal(await step(p), "summary");
  });
  test("edge: the browser's Back button from there returns to the answers", async () => {
    await reset(p); await pick(p, "appearance"); await walk(p, "phone");
    await home();
    await p.evaluate(() => history.back());
    await p.waitForFunction(() => mode === "step");
    assert.equal(await step(p), "phone");
  });
  test("edge: on the first screen it stays put, and in the middle of the sorting questions it goes back to the start", async () => {
    await reset(p); await home();
    assert.equal(await step(p), "pick");
    await p.click('.pick[data-kind="debt"]'); assert.equal(await step(p), "triage");
    await home();
    assert.equal(await step(p), "pick");
  });
});

describe("Fix 10: \"More free help\" at the bottom is one line until opened", () => {
  test("it's one line, closed, on every screen", async () => {
    await reset(p);
    const h = await p.$eval("#footHelp", d => [d.open, Math.round(d.getBoundingClientRect().height)]);
    assert.equal(h[0], false); assert.ok(h[1] <= 50, `${h[1]} pixels tall`);
    await pick(p, "appearance"); assert.equal(await p.$eval("#footHelp", d => d.open), false);
  });
  test("opened, it lists the same five places as Get help", async () => {
    await reset(p);
    await p.click("#footHelp > summary");
    const foot = await p.$$eval("#footHelp a", a => a.map(x => x.href)), panel = await p.$$eval("#helpPanel a", a => a.map(x => x.href));
    assert.equal(foot.length, 5);
    assert.deepEqual([...foot].sort(), [...panel].sort());
  });
  test("edge: with JavaScript off, it still opens, and the page says where to find it", async () => {
    const ctx = await (await launch()).newContext({ javaScriptEnabled: false }); // the shared browser, so nothing is left running
    const page = await ctx.newPage();
    await page.goto(APP);
    assert.match(await page.textContent("main"), /open "More free help\."/);
    await page.click("#footHelp > summary");
    assert.equal(await page.locator("#footHelp a").first().isVisible(), true);
    await ctx.close();
  });
});

describe("Fix 11: \"My situation is different\" can be reached from above the cards", () => {
  test("a line above the cards links to the other choices", async () => {
    await reset(p);
    const [link, firstCard] = await p.evaluate(() => [document.getElementById("moreJump").getBoundingClientRect().top, document.querySelector(".pick[data-kind]").getBoundingClientRect().top]);
    assert.ok(link < firstCard);
    assert.equal(await p.textContent("#moreJump"), "See other choices");
  });
  test("it opens the other choices and moves focus to them", async () => {
    await reset(p);
    await p.click("#moreJump");
    assert.equal(await p.locator("#moreChoices").isVisible(), true);
    assert.equal(await p.getAttribute("#moreToggle", "aria-expanded"), "true");
    assert.equal(await p.evaluate(() => document.activeElement.id), "moreTitle");
  });
  test("edge: if they're already open, it doesn't close them", async () => {
    await reset(p);
    await p.click("#moreToggle"); await p.click("#moreJump");
    assert.equal(await p.locator("#moreChoices").isVisible(), true);
  });
  test("edge: on a phone the line shows without scrolling", async () => {
    const q = await fresh({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const [bottom, h] = await q.evaluate(() => [document.getElementById("moreJump").getBoundingClientRect().bottom, window.innerHeight]);
    assert.ok(bottom < h, `${Math.round(bottom)} of ${h}`);
    await q.context().close();
  });
});
