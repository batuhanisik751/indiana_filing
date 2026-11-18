// Fixes from the verification round (November 2026): problems found by independent exploratory testing, VF1 to VF16
// on the Issue Map. Each section reproduces its problem first.
import { describe, test, after } from "node:test";
import assert from "node:assert/strict";
import { fresh, site, close, pick, walk, step, editAnswer, flagsFor, SAVED, launch, APP } from "../lib.mjs";

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

describe("VF11: pressing Enter twice doesn't skip the next question", () => {
  const enterTwice = async (p, gap) => { await p.focus("#ans"); await p.keyboard.press("Enter"); await p.waitForTimeout(gap); await p.keyboard.press("Enter"); };
  test("Enter, then Enter again a moment later, stops at the next question with nothing saved", async () => {
    const p = await fresh();
    await pick(p, "continuance"); await walk(p, "timeNeeded");
    await p.fill("#ans", "2 weeks"); await enterTwice(p, 250);
    assert.equal(await step(p), "spokeDate");
    assert.equal(await p.evaluate(() => "spokeDate" in answers), false, "the next answer wasn't saved blank");
    await p.context().close();
  });
  test("edge: the same on a text box and an email box, with no pause at all", async () => {
    const p = await fresh();
    for (const [at, value, next] of [["plaintiff", "Acme Credit LLC", "name"], ["email", "pat@example.com", "phone"]]) {
      await pick(p, "appearance"); await walk(p, at);
      await p.fill("#ans", value); await enterTwice(p, 0);
      assert.equal(await step(p), next, at);
      await p.goto(p.url()); await p.waitForSelector("#app h1");
    }
    await p.context().close();
  });
  test("edge: one Enter still moves on, and Enter on the new question after a moment still works", async () => {
    const p = await fresh();
    await pick(p, "appearance"); await walk(p, "name");
    await p.fill("#ans", "Pat Example"); await p.focus("#ans"); await p.keyboard.press("Enter");
    assert.equal(await step(p), "acp");
    await walk(p, "phone");
    await p.waitForTimeout(700); await p.focus("#ans"); await p.keyboard.press("Enter");
    assert.notEqual(await step(p), "phone", "a deliberate Enter later skips, as before");
    await p.context().close();
  });
});

describe("VF1: with JavaScript off, no button shows that can't work", () => {
  async function noScript() { const ctx = await (await launch()).newContext({ javaScriptEnabled: false }); const p = await ctx.newPage(); await p.goto(APP); return { ctx, p }; }
  test("Get help, saving, Clear my data and the logo button are hidden, and the name still shows", async () => {
    const { ctx, p } = await noScript();
    for (const id of ["helpBtn", "saveToggle", "clearData", "saveMine", "homeBtn"]) assert.equal(await p.locator(`#${id}`).isVisible(), false, id);
    assert.equal(await p.locator("header span.brand").textContent(), "Indiana Court Form Helper"); // the plain name, in place of the button
    assert.equal(await p.locator("header span.brand").isVisible(), true);
    await ctx.close();
  });
  test("edge: the page says to open More free help, and it opens", async () => {
    const { ctx, p } = await noScript();
    assert.match(await p.textContent("main"), /open "More free help\."/);
    await p.click("#footHelp > summary");
    assert.equal(await p.locator("#footHelp a").first().isVisible(), true);
    await ctx.close();
  });
  test("edge: with JavaScript on, they all show as before, and the plain name isn't doubled", async () => {
    const p = await fresh();
    for (const id of ["helpBtn", "saveToggle", "clearData", "homeBtn"]) assert.equal(await p.locator(`#${id}`).isVisible(), true, id);
    assert.equal(await p.getByText("Indiana Court Form Helper", { exact: true }).count(), 1);
    await p.context().close();
  });
});
