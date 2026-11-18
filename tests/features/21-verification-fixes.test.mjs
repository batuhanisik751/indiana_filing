// Fixes from the verification round (November 2026): problems found by independent exploratory testing, VF1 to VF16
// on the Issue Map. Each section reproduces its problem first.
import { describe, test, after } from "node:test";
import assert from "node:assert/strict";
import { fresh, site, close, pick, walk, step, editAnswer, flagsFor, SAVED, launch, APP, inject, scoreMatchesFlags, jump, fieldRows, pdfText } from "../lib.mjs";

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

describe("VF2: fee waiver flags agree with each other when a checked kind has no amount", () => {
  const incomeFlags = p => p.evaluate(() => runChecks().filter(f => f.title === "Income" || /^(hourlyRate|unemployment|tanf|ssi|childSupportIn|otherIncome)$/.test(f.fix)).map(f => `${f.level}|${f.fix}|${f.why}`));
  test("wages checked with no wage: one flag, asking for the hourly wage, and no Income flag suggesting None of these", async () => {
    const p = await fresh();
    await inject(p, "feewaiver", { incomeKinds: "wages", hourlyRate: "", monthlyHours: "", expenseKinds: "none" });
    const f = await incomeFlags(p);
    assert.equal(f.length, 1, f.join("\n"));
    assert.match(f[0], /^missing\|hourlyRate\|You said your household gets wages, but no hourly wage is entered, so wages aren't counted in Total Income on this sworn form\. Enter the hourly wage, or uncheck Wages from work in the list of kinds of income\.$/);
    assert.equal(await scoreMatchesFlags(p), true);
    await p.context().close();
  });
  test("edge: two kinds checked and both blank: one flag each, nothing contradicting them, and the score agrees", async () => {
    const p = await fresh();
    await inject(p, "feewaiver", { incomeKinds: "wages,unemployment", hourlyRate: "", monthlyHours: "", unemployment: "", expenseKinds: "none" });
    const f = await incomeFlags(p);
    assert.deepEqual(f.map(x => x.split("|")[1]), ["hourlyRate", "unemployment"]);
    assert.ok(!f.some(x => /stay blank|None of these/.test(x)), f.join("\n"));
    assert.match(f[1], /isn't counted in Total Income on this sworn form\. Enter the monthly amount, or uncheck it in the list of kinds of income\./);
    assert.equal(await scoreMatchesFlags(p), true);
    await p.context().close();
  });
  test("edge: with the list skipped and nothing entered, the Income flag is as before", async () => {
    const p = await fresh();
    await inject(p, "feewaiver", { incomeKinds: "", hourlyRate: "", monthlyHours: "", expenseKinds: "none" });
    const f = await incomeFlags(p);
    assert.equal(f.length, 1);
    assert.match(f[0], /^missing\|incomeKinds\|No income is entered .* choose "None of these"/);
    assert.equal(await scoreMatchesFlags(p), true);
    await p.context().close();
  });
  test("edge: an expense checked with no amount says it isn't counted in Total Expenses", async () => {
    const p = await fresh();
    await inject(p, "feewaiver", { incomeKinds: "none", expenseKinds: "housing", housing: "" });
    const f = await p.evaluate(() => runChecks().filter(f => f.title === "Expenses" || f.fix === "housing").map(f => `${f.level}|${f.fix}|${f.why}`));
    assert.deepEqual(f, ["missing|housing|You said your household pays this, but no amount is entered, so it isn't counted in Total Expenses on this sworn form. Enter the monthly amount, or uncheck it in the list of expenses."]);
    await p.context().close();
  });
});

describe("VF12: amounts that can't be right are refused or flagged, and a card number can't print", () => {
  const onAmount = async (p, id, value) => { await inject(p, "feewaiver", { incomeKinds: "", expenseKinds: "" }); await jump(p, id); await p.fill("#ans", value); await p.click("#next"); };
  test("an amount of a billion dollars or more is refused on the question, with the reason", async () => {
    const p = await fresh();
    await onAmount(p, "housing", "99999999999999999.99");
    assert.equal(await step(p), "housing");
    assert.match(await p.textContent("#err"), /too large to be right for this form/);
    await p.context().close();
  });
  test("a card number typed as the bank balance is refused, so it can't print on the sworn form", async () => {
    const p = await fresh();
    await onAmount(p, "bank", "4111111111111111");
    assert.equal(await step(p), "bank");
    await p.context().close();
  });
  test("an amount of $100,000 or more is flagged to check", async () => {
    const p = await fresh();
    await inject(p, "feewaiver", { expenseKinds: "housing", housing: "150000", incomeKinds: "none" });
    assert.match((await flagsFor(p, "housing"))[0] || "", /^check\|.*\|\$150,000\.00 is unusually high for this sworn form\. Check the number, including the decimal point\./);
    await p.context().close();
  });
  test("edge: a 9-digit number in an amount box is flagged as possibly private", async () => {
    const p = await fresh();
    await inject(p, "feewaiver", { bank: "123456789", incomeKinds: "none", expenseKinds: "none" });
    assert.ok((await flagsFor(p, "bank")).some(f => /^check\|Private information: Money in the bank\|/.test(f)));
    await p.context().close();
  });
  test("edge: a too-large amount that got in another way prints blank and is Missing, and the score agrees", async () => {
    const p = await fresh();
    await inject(p, "feewaiver", { expenseKinds: "housing", housing: "99999999999999999.99", incomeKinds: "none" });
    assert.equal((await fieldRows(p)).find(([l]) => /^Housing/.test(l))[1], "Left blank");
    const f = await flagsFor(p, "housing");
    assert.ok(f.some(x => /^missing\|.*too large to be right for this form/.test(x)), f.join("\n"));
    assert.ok(!f.some(x => /It will print on the form/.test(x)), "no flag says it prints, since it doesn't");
    assert.equal(await scoreMatchesFlags(p), true);
    await p.context().close();
  });
  test("edge: ordinary amounts are untouched", async () => {
    const p = await fresh();
    for (const v of ["1,200", "12.50", "0", "99,999.99", "999,999,999.99"]) {
      await onAmount(p, "housing", v);
      assert.notEqual(await step(p), "housing", v);
    }
    await p.context().close();
  });
});

describe("VF3: a character the form can't print is flagged once per answer", () => {
  const ready = p => p.waitForFunction(() => pdfState.result && pdfState.key === pdfKey() && !pdfState.busy, null, { timeout: 120000 });
  const charFlags = (p, id) => p.evaluate(id => pdfFlags().filter(f => f.fix === id && /can't print some characters/.test(f.why)).map(f => `${f.title}|${f.why}`), id);
  test("a name printed in two places on the continuance gets one flag, titled with its question", async () => {
    const p = await fresh();
    await inject(p, "continuance", { name: "Zo\u00eb \u0141ukasz", role: "other" }); await ready(p);
    const f = await charFlags(p, "name");
    assert.equal(f.length, 1, f.join("\n"));
    assert.match(f[0], /^Your full name\|.*"\u0141" \(printed as "L"\)/);
    await p.context().close();
  });
  test("edge: the same on the fee waiver, and for the other party's name on the continuance", async () => {
    const p = await fresh();
    await inject(p, "feewaiver", { name: "Zo\u00eb \u0141ukasz", incomeKinds: "none", expenseKinds: "none" }); await ready(p);
    assert.equal((await charFlags(p, "name")).length, 1);
    await inject(p, "continuance", { otherParty: "\u0141ukasz Holdings", role: "other" }); await ready(p);
    assert.equal((await charFlags(p, "otherParty")).length, 1);
    await p.context().close();
  });
  test("edge: the review count goes up by one for it, not two", async () => {
    const p = await fresh();
    await inject(p, "continuance", { role: "other" }); await ready(p);
    const before = await p.evaluate(() => [...runChecks(), ...pdfFlags()].length);
    await inject(p, "continuance", { name: "Zo\u00eb \u0141ukasz", role: "other" }); await ready(p);
    assert.equal(await p.evaluate(() => [...runChecks(), ...pdfFlags()].length), before + 1);
    await p.context().close();
  });
});

describe("VF4: an emoji prints as one question mark, and the flag shows the emoji itself", () => {
  const ready = p => p.waitForFunction(() => pdfState.result && pdfState.key === pdfKey() && !pdfState.busy, null, { timeout: 120000 });
  const nameFlag = p => p.evaluate(() => pdfFlags().filter(f => f.fix === "name" && /can't print/.test(f.why)).map(f => f.why).join(" "));
  const printed = async (p, name) => { await inject(p, "appearance", { name }); await ready(p); return pdfText(p); };
  test("a heart with its invisible variation selector prints as one ?, and the flag lists the heart", async () => {
    const p = await fresh();
    const text = await printed(p, "Pat Example \u2764\ufe0f");
    assert.ok(text.includes("Pat Example ?") && !text.includes("Pat Example ??"), "one question mark");
    const why = await nameFlag(p);
    assert.ok(why.includes('"\u2764\ufe0f" (printed as "?")'), why);
    assert.ok(!why.includes('"\ufe0f"'), "no invisible character listed on its own");
    await p.context().close();
  });
  test("a skin tone and a family emoji each print as one ?", async () => {
    const p = await fresh();
    const text = await printed(p, "Pat Example \ud83d\udc4d\ud83c\udffd \ud83d\udc68\u200d\ud83d\udc69\u200d\ud83d\udc67");
    assert.ok(text.includes("Pat Example ? ?") && !text.includes("??"), text.match(/Pat Example[^A-Za-z]{0,8}/)?.[0]);
    await p.context().close();
  });
  test("edge: symbols the font can print, like the copyright and registered signs, still print, with no flag", async () => {
    const p = await fresh();
    const text = await printed(p, "Acme\u00a9\ufe0f Credit\u00ae LLC");
    assert.ok(text.includes("Acme\u00a9 Credit\u00ae LLC"), "printed as written, without the selector");
    assert.equal(await nameFlag(p), "");
    await p.context().close();
  });
  test("edge: accented letters still print, and a letter it can't print is still named", async () => {
    const p = await fresh();
    const text = await printed(p, "Zo\u00eb \u0141ukasz");
    assert.ok(text.includes("Zo\u00eb Lukasz"));
    assert.ok((await nameFlag(p)).includes('"\u0141" (printed as "L")'));
    await p.context().close();
  });
});

