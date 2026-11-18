// Item 17 on the MVP list, part 1: in "Show every answer", Edit changes a typed answer right on the summary, checked the
// same way as on its question. Choices, and changes that bring up another question, are made on the question itself.
import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fresh, close, inject, editHere, flagsFor, SAVED } from "../lib.mjs";

let p;
before(async () => { p = await fresh(); });
after(close);
const box = () => p.$eval("#inEdit", b => b.value);
const shown = (id, nth = 0) => p.$eval(`dl.vals [data-row="${id}:${nth}"] dd`, d => d.textContent.trim());
const focusedIs = sel => p.evaluate(sel => document.activeElement === document.querySelector(sel), sel);
const changeHere = async (id, value, nth = 0) => { await editHere(p, id, nth); await p.fill("#inEdit", value); await p.click("#ieSave"); };
const local = days => p.evaluate(n => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }, days);

describe("17. Quick edit: change an answer in place on the summary", () => {
  test("Edit opens a box in that row with the answer, focused, and the summary stays", async () => {
    await inject(p, "respond");
    await editHere(p, "email");
    assert.equal(await box(), "pat@example.com");
    assert.equal(await focusedIs("#inEdit"), true);
    assert.equal(await p.evaluate(() => mode), "summary");
    assert.match(await p.$eval("#inEdit", b => b.getAttribute("aria-label")), /^Email address \(Appearance/);
    assert.equal(await p.locator(`dl.vals [data-row="email:0"] [data-fix]`).count(), 0, "no Edit link in the row being changed");
  });

  test("Save changes it everywhere it shows, updates the flags and the PDF, and goes back to Edit", async () => {
    await inject(p, "respond", { email: "pat@gmial.com" });
    assert.equal((await flagsFor(p, "email")).length, 1);
    const key = await p.evaluate(() => pdfState.key);
    await changeHere("email", "pat@gmail.com");
    assert.equal(await p.locator("#inEdit").count(), 0);
    assert.equal(await p.evaluate(() => answers.email), "pat@gmail.com");
    assert.equal(await shown("email"), "pat@gmail.com");
    assert.deepEqual(await flagsFor(p, "email"), []);
    assert.ok(!(await p.$$eval("ul.flags .ftitle", t => t.map(x => x.textContent))).some(t => /email/i.test(t)), "the flag is gone from the page");
    assert.notEqual(await p.evaluate(() => pdfState.key), key, "the filled form is made again");
    assert.equal(await focusedIs('dl.vals [data-row="email:0"] [data-fix]'), true);
    assert.match(await p.textContent("#announce"), /Saved/);
  });

  test("an answer on two forms: the second row's box, and both rows change", async () => {
    await inject(p, "respond");
    await changeHere("name", "Pat Changed", 1);
    assert.equal(await shown("name", 0), "Pat Changed");
    assert.equal(await shown("name", 1), "Pat Changed");
    assert.equal(await focusedIs('dl.vals [data-row="name:1"] [data-fix]'), true);
  });

  test("the same checks as the question: refused with its words, and nothing changes", async () => {
    await inject(p, "respond");
    for (const [id, typed, words] of [["email", "pat@", null], ["phone", "x".repeat(20001), /too long/]]) {
      await editHere(p, id);
      await p.fill("#inEdit", typed);
      await p.click("#ieSave");
      const want = words || await p.evaluate(([id, v]) => answerProblem(steps.find(s => s.id === id), v, true), [id, typed]);
      assert.ok(want, `${id} has a reason`);
      if (words) assert.match(await p.textContent("#ieErr"), words); else assert.equal(await p.textContent("#ieErr"), want);
      assert.equal(await p.$eval("#inEdit", b => b.getAttribute("aria-invalid")), "true");
      assert.equal(await focusedIs("#inEdit"), true);
      assert.notEqual(await p.evaluate(id => answers[id], id), typed.trim());
      await p.click("#ieCancel");
    }
    await inject(p, "feewaiver", { incomeKinds: "wages" });
    await editHere(p, "hourlyRate");
    await p.fill("#inEdit", "12,50");
    await p.click("#ieSave");
    assert.equal(await p.textContent("#ieErr"), "Use numbers only, like 1200 or 12.50.");
    assert.equal(await p.evaluate(() => answers.hourlyRate), "12.50");
  });

  test("edge: a date after the court date is refused, saying to Cancel and edit that one", async () => {
    await inject(p, "respond", { courtDate: await local(10) });
    await editHere(p, "svc1Date");
    assert.match(await p.textContent("#ieNeed"), /can't be later than your court date/);
    await p.fill("#inEdit", await local(20));
    await p.click("#ieSave");
    assert.match(await p.textContent("#ieErr"), /This is after your court date .* press Cancel and edit it on the summary\./);
  });

  test("Cancel and Escape leave the answer as it was, and go back to Edit", async () => {
    await inject(p, "respond");
    await editHere(p, "plaintiff");
    await p.fill("#inEdit", "Someone Else");
    await p.click("#ieCancel");
    assert.equal(await p.evaluate(() => answers.plaintiff), "Acme Credit LLC");
    assert.equal(await focusedIs('dl.vals [data-row="plaintiff:0"] [data-fix]'), true);
    await editHere(p, "plaintiff");
    await p.fill("#inEdit", "Someone Else");
    await p.keyboard.press("Escape");
    assert.equal(await p.locator("#inEdit").count(), 0);
    assert.equal(await p.evaluate(() => answers.plaintiff), "Acme Credit LLC");
  });

  test("Enter saves a one-line answer; in a paragraph it starts a new line", async () => {
    await inject(p, "respond");
    await editHere(p, "plaintiff");
    await p.fill("#inEdit", "Acme Credit Inc");
    await p.keyboard.press("Enter");
    assert.equal(await p.evaluate(() => answers.plaintiff), "Acme Credit Inc");
    await editHere(p, "defenses");
    await p.keyboard.press("Enter");
    await p.keyboard.type("Second line.");
    assert.ok((await p.locator("#inEdit").count()) > 0, "still open");
    await p.click("#ieSave");
    assert.equal(await p.evaluate(() => answers.defenses), "I paid this debt in full.\nSecond line.");
  });

  test("an amount is kept the way the question keeps it, and \"I'm not sure\" is cleared by an answer", async () => {
    await inject(p, "feewaiver", { incomeKinds: "wages", bank: "" }, { bank: true });
    assert.ok((await flagsFor(p, "bank")).some(f => /not sure/i.test(f)));
    await changeHere("bank", "$1,200");
    assert.equal(await p.evaluate(() => answers.bank), "1200");
    assert.equal(await p.evaluate(() => !!unsure.bank), false);
    assert.equal(await shown("bank"), "$1,200.00");
  });

  test("edge: a choice, and the county and court, still open their question", async () => {
    await inject(p, "respond");
    await p.evaluate(() => { document.querySelector('details[data-more="answers"]').open = true; });
    for (const id of ["receiveAt", "county"]) {
      assert.equal(await p.locator(`dl.vals [data-fix="${id}"][data-inline]`).count(), 0, id);
      await p.click(`dl.vals [data-fix="${id}"]`);
      assert.equal(await p.evaluate(() => mode), "step");
      await p.click("#back"); // Cancel
    }
  });

  test("edge: a case number for another county or court opens its question, which asks for the confirmation", async () => {
    await inject(p, "respond", { caseConfirm: "yes" });
    await changeHere("caseNumber", "49d01-2611-cc-001234");
    assert.equal(await p.evaluate(() => mode), "step");
    assert.equal(await p.evaluate(() => visible()[cur].id), "caseNumber");
    assert.equal(await p.$eval("#ans", b => b.value), "49d01-2611-cc-001234", "what was typed is in the box");
    assert.match(await p.textContent("#inlineNote"), /brings up another question/);
    await p.click("#back"); // Cancel there puts it all back
    assert.equal(await p.evaluate(() => mode), "summary");
    assert.deepEqual(await p.evaluate(() => [answers.caseNumber, answers.caseConfirm]), ["02D01-2611-CC-001234", "yes"]);
    await changeHere("caseNumber", "49D01-2611-CC-001234");
    await p.click("#next"); // Save and review: the confirmation is asked next
    assert.equal(await p.evaluate(() => visible()[cur].id), "caseConfirm");
  });

  test("edge: \"Open the full question\" takes what was typed there, and Cancel there keeps the old answer", async () => {
    await inject(p, "respond");
    await editHere(p, "address");
    await p.fill("#inEdit", "9 Elm St, Fort Wayne, IN 46802");
    await p.click("#ieFull");
    assert.equal(await p.evaluate(() => [mode, visible()[cur].id].join()), "step,address");
    assert.equal(await p.$eval("#ans", b => b.value), "9 Elm St, Fort Wayne, IN 46802");
    await p.click("#back");
    assert.equal(await p.evaluate(() => answers.address), "1 Main St, Fort Wayne, IN 46802");
  });

  test("edge: with saving on, emptying the box takes the old answer off the device at once; Cancel puts it back", async () => {
    const q = await fresh();
    await q.click("#savePref");
    await inject(q, "respond", { defenses: "My SSN is 123-45-6789." });
    await q.evaluate(() => saveProgress());
    const copy = () => q.evaluate(k => JSON.parse(localStorage.getItem(k)).answers.defenses, SAVED);
    assert.match(await copy(), /6789/);
    await editHere(q, "defenses");
    await q.fill("#inEdit", "");
    assert.equal(await copy(), "", "gone from the saved copy before Save");
    await q.fill("#inEdit", "New text");
    assert.equal(await copy(), "", "still gone while new text is typed");
    await q.click("#ieCancel");
    assert.match(await copy(), /6789/);
    assert.match(await q.evaluate(() => answers.defenses), /6789/);
  });

  test("edge: the box keeps what's typed and its cursor while the filled form finishes", async () => {
    await inject(p, "respond");
    // The PDF is made again, and held until the box is open with the cursor placed.
    await p.evaluate(() => { const make = buildPdf; window.__go = null; const held = new Promise(r => { window.__go = r; }); window.buildPdf = async (...a) => { await held; return make(...a); }; pdfState = { key: null }; renderSummary(true); });
    await editHere(p, "plaintiff");
    await p.fill("#inEdit", "Acme Credit LLC and Co");
    await p.$eval("#inEdit", b => b.setSelectionRange(4, 4));
    assert.equal(await p.evaluate(() => pdfState.busy), true, "still being made");
    await p.evaluate(() => window.__go());
    await p.waitForFunction(() => pdfState.result || pdfState.error, null, { timeout: 120000 });
    assert.equal(await box(), "Acme Credit LLC and Co");
    assert.equal(await focusedIs("#inEdit"), true);
    assert.deepEqual(await p.$eval("#inEdit", b => [b.selectionStart, b.selectionEnd]), [4, 4]);
  });

  test("edge: opening another box with a change not saved asks first; No keeps the first", async () => {
    await inject(p, "respond");
    await editHere(p, "plaintiff");
    await p.fill("#inEdit", "Changed");
    await p.evaluate(() => { window.confirm = () => false; });
    await p.click('dl.vals [data-fix="email"][data-nth="0"]');
    assert.equal(await box(), "Changed");
    assert.match(await p.$eval("#inEdit", b => b.getAttribute("aria-label")), /^Plaintiff \(/);
    await p.evaluate(() => { window.confirm = () => true; });
    await p.click('dl.vals [data-fix="email"][data-nth="0"]');
    assert.equal(await box(), "pat@example.com");
    assert.equal(await p.evaluate(() => answers.plaintiff), "Acme Credit LLC", "the change wasn't saved");
  });

  test("edge: the browser's Back closes the box as Cancel does; leaving the summary closes it too", async () => {
    await inject(p, "respond");
    await editHere(p, "plaintiff");
    await p.fill("#inEdit", "Changed");
    await p.goBack();
    await p.waitForFunction(() => !document.getElementById("inEdit"));
    assert.equal(await p.evaluate(() => [mode, answers.plaintiff].join()), "summary,Acme Credit LLC");
    await editHere(p, "plaintiff");
    await p.fill("#inEdit", "Changed");
    await p.click("#toQuestions");
    await p.evaluate(() => { mode = "summary"; render(); });
    assert.equal(await p.locator("#inEdit").count(), 0, "not left open for later");
    assert.equal(await p.evaluate(() => answers.plaintiff), "Acme Credit LLC");
  });

  test("the box takes its row's full width, with its buttons on one line under it", async () => {
    await inject(p, "respond");
    await editHere(p, "address");
    const m = await p.evaluate(() => {
      const row = document.querySelector('dl.vals [data-row="address:0"]').getBoundingClientRect(), box = document.getElementById("inEdit").getBoundingClientRect();
      const b = ["ieSave", "ieCancel", "ieFull"].map(id => document.getElementById(id).getBoundingClientRect());
      return { share: box.width / row.width, oneLine: b.every(r => Math.abs(r.top - b[0].top) < 12), below: b[0].top > box.bottom };
    });
    assert.ok(m.share > 0.9, `the box is ${Math.round(m.share * 100)}% of the row`);
    assert.equal(m.oneLine, true);
    assert.equal(m.below, true);
  });

  test("edge: at 320px the box and its buttons fit, with nothing off the side", async () => {
    const q = await fresh({ viewport: { width: 320, height: 640 } });
    await inject(q, "respond");
    await editHere(q, "address");
    const r = await q.evaluate(() => ({ page: document.documentElement.scrollWidth, wide: [...document.querySelectorAll(".inedit, .inedit *")].map(e => e.getBoundingClientRect().right).filter(x => x > innerWidth + 0.5).length }));
    assert.deepEqual(r, { page: 320, wide: 0 });
    for (const id of ["ieSave", "ieCancel", "ieFull"]) assert.ok((await q.$eval(`#${id}`, b => b.getBoundingClientRect().height)) >= 24, id);
  });
});
