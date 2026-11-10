// The four forms, walked through the real screens to a filled official PDF.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { fresh, close, pick, walk, step, pdfText, flags, scoreMatchesFlags, VALUES } from "./lib.mjs";

after(close);

for (const form of ["respond", "appearance", "feewaiver", "continuance"]) {
  test(`${form}: answers reach the official PDF`, async () => {
    const p = await fresh();
    await pick(p, form);
    assert.equal(await walk(p), "summary");
    const text = await pdfText(p);
    assert.ok(text, "the PDF was made");
    assert.ok(text.includes(VALUES.name), "the name prints");
    if (form !== "feewaiver") assert.ok(text.includes(VALUES.caseNumber), "the case number prints");
    assert.ok(await scoreMatchesFlags(p), "the score and the Missing flags agree");
    assert.ok(await p.locator("#dlAll").count() === 1, "the download is offered");
    assert.ok(/What to do next/.test(await p.textContent("#app")), "next steps show");
    assert.deepEqual(p.errors, []);
    await p.context().close();
  });
}

test("a mistake is flagged, Fix opens its question, and the PDF prints what was typed", async () => {
  const p = await fresh();
  await pick(p, "appearance");
  await walk(p, "summary", { email: "pat@gmial.com" });
  assert.ok((await flags(p)).some(f => /may be a typo for gmail\.com/.test(f)));
  assert.ok((await pdfText(p)).includes("pat@gmial.com"), "nothing is corrected behind the person's back");
  await p.click('ul.flags [data-fix="email"]');
  assert.equal(await step(p), "email");
  await p.fill("#ans", "pat@gmail.com");
  await p.click("#next");
  assert.ok(!(await flags(p)).some(f => /may be a typo/.test(f)), "fixing it clears the flag");
  await p.context().close();
});

test("blank answers are flagged, and the score always matches the Missing flags", async () => {
  const p = await fresh();
  for (const form of ["respond", "appearance", "feewaiver", "continuance"]) {
    // Every answer, then the same with answers removed in many different combinations.
    const bad = await p.evaluate(form => {
      let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
      resetAnswers(); sitKey = form; steps = SITUATIONS[form].steps();
      const ids = steps.map(s => s.id); const out = [];
      for (let i = 0; i < 40; i++) {
        answers = {}; unsure = {};
        for (const s of steps) if (rnd() < 0.6) answers[s.id] = s.type === "choice" ? s.options[Math.floor(rnd() * s.options.length)][0] : s.type === "select" ? s.options[0] : s.type === "date" ? todayDay() : s.type === "money" || s.type === "number" ? "5" : "Sample";
        for (const id of ids) if (rnd() < 0.1) { delete answers[id]; unsure[id] = true; }
        mode = "summary"; render();
        const sc = completeness(), missing = runChecks().filter(f => f.level === "missing").length;
        if (sc.total - sc.filled !== missing) out.push({ answers: { ...answers }, sc, missing });
      }
      return out;
    }, form);
    assert.deepEqual(bad.slice(0, 2), [], `${form}: score and flags disagree`);
  }
  await p.context().close();
});

test("Back after Choose a different form returns to the answers", async () => {
  const p = await fresh();
  await pick(p, "appearance");
  await walk(p, "name");
  await p.fill("#ans", "Pat Example");
  await p.click("#next");
  const at = await step(p);
  await p.click("#changeForm");
  assert.equal(await p.evaluate(() => mode), "pick");
  await p.goBack();
  await p.waitForTimeout(200);
  assert.equal(await step(p), at);
  assert.equal(await p.evaluate(() => answers.name), "Pat Example");
  await p.context().close();
});

test("Get help closes when the person moves on", async () => {
  const p = await fresh({ viewport: { width: 375, height: 667 } });
  await pick(p, "appearance");
  await p.click("#helpBtn");
  assert.ok(await p.locator("#helpPanel").isVisible());
  await p.selectOption("#ans", "Allen");
  await p.click("#next");
  assert.ok(!(await p.locator("#helpPanel").isVisible()));
  await p.context().close();
});

test("phone width: no sideways scrolling on a question or the summary", async () => {
  const p = await fresh({ viewport: { width: 320, height: 640 }, isMobile: true, hasTouch: true });
  await pick(p, "respond");
  const wide = () => p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  assert.equal(await wide(), false, "a question");
  await walk(p);
  assert.equal(await wide(), false, "the summary");
  await p.context().close();
});
