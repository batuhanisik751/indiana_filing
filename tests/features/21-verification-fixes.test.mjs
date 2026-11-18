// Fixes from the verification round (November 2026): problems found by independent exploratory testing, VF1 to VF16
// on the Issue Map. Each section reproduces its problem first.
import { describe, test, after } from "node:test";
import assert from "node:assert/strict";
import { fresh, site, close, pick, walk, step, editAnswer, flagsFor, SAVED } from "../lib.mjs";

after(close);

describe("VF10: a changed case number never keeps an old county and court confirmation, even after a reload", () => {
  // Saving on, an Allen County, Superior Court case number confirmed with Yes.
  async function confirmed(form = "appearance") {
    const ctx = await site(), p = await ctx.open();
    await p.check("#savePref"); await pick(p, form);
    await walk(p, "summary", { caseConfirm: "yes" });
    assert.equal(await p.evaluate(() => visibleAnswers().county), "Allen");
    return { ctx, p };
  }
  const reload = async p => { await p.waitForTimeout(300); await p.reload(); await p.waitForSelector("#app h1"); await p.click("#resume"); };
  const asked = async (p, name) => {
    assert.equal(await step(p), "caseConfirm");
    assert.equal(await p.textContent("#q"), `Your case number says ${name}. Is that right?`);
    assert.equal(await p.locator("input[name=ans]:checked").count(), 0, "nothing chosen for the new number");
  };
  test("an edit from the summary, reloaded before Save and review, asks again", async () => {
    const { ctx, p } = await confirmed();
    await editAnswer(p, "caseNumber"); await p.fill("#ans", "49C01-2611-CC-001234");
    await reload(p); await p.click("#next");
    await asked(p, "Marion County, Circuit Court");
    await ctx.close();
  });
  test("the same on the continuance", async () => {
    const { ctx, p } = await confirmed("continuance");
    await editAnswer(p, "caseNumber"); await p.fill("#ans", "45C01-2611-CC-001234");
    await reload(p); await p.click("#next");
    await asked(p, "Lake County, Circuit Court");
    await ctx.close();
  });
  test("going back to the case number, typing another and reloading, the question comes back with nothing chosen", async () => {
    const { ctx, p } = await confirmed();
    await p.click("#toQuestions");
    while (await step(p) !== "caseNumber") await p.click("#back");
    await p.fill("#ans", "49C01-2611-CC-001234");
    await reload(p);
    assert.equal(await step(p), "caseNumber");
    await p.click("#next");
    await asked(p, "Marion County, Circuit Court");
    await ctx.close();
  });
  test("after a reload, jumping ahead from the section list doesn't skip it: the county and court are asked", async () => {
    const ctx = await site(), p = await ctx.open({ viewport: { width: 1280, height: 900 } });
    await p.setViewportSize({ width: 1280, height: 900 });
    await p.check("#savePref"); await pick(p, "appearance");
    await walk(p, "summary", { caseConfirm: "yes" });
    await p.click("#toQuestions");
    while (await step(p) !== "caseNumber") await p.click("#back");
    await p.fill("#ans", "49C01-2611-CC-001234");
    await reload(p);
    await p.click('.rail [data-sec="1"]');
    const shown = await p.evaluate(() => visible().map(s => s.id));
    assert.ok(shown.includes("county") && shown.includes("courtType"), "asked, not taken from an old confirmation");
    assert.notEqual(await p.evaluate(() => answers.caseConfirm), "yes");
    await ctx.close();
  });
});
