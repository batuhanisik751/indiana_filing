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

describe("VF5: a name typed with /s/ isn't signed twice, and is flagged", () => {
  const ready = p => p.waitForFunction(() => pdfState.result && pdfState.key === pdfKey() && !pdfState.busy, null, { timeout: 120000 });
  test("e-filing with \"/s/ Pat Example\" as the name signs \"/s/ Pat Example\", not \"/s/ /s/ Pat Example\"", async () => {
    const p = await fresh();
    await inject(p, "appearance", { name: "/s/ Pat Example", fileMethod: "efile" }); await ready(p);
    const text = await pdfText(p);
    assert.ok(!text.includes("/s/ /s/"), "not doubled");
    assert.ok(text.includes("/s/ Pat Example"));
    await p.context().close();
  });
  test("the name is flagged, saying it prints that way in the name boxes", async () => {
    const p = await fresh();
    for (const fileMethod of ["efile", "paper"]) {
      await inject(p, "appearance", { name: "/s/ Pat Example", fileMethod });
      assert.ok((await flagsFor(p, "name")).some(f => /^check\|Your full name\|Your name starts with "\/s\/"/.test(f)), fileMethod);
    }
    await p.context().close();
  });
  test("edge: the next steps name the signature without the doubled /s/, and an ordinary name isn't flagged", async () => {
    const p = await fresh();
    await inject(p, "appearance", { name: "/S/  Pat Example", fileMethod: "efile" });
    assert.match(await p.textContent("ol.steps"), /signed with "\/s\/ Pat Example"/);
    await inject(p, "appearance", { name: "Pat Example", fileMethod: "efile" });
    assert.deepEqual(await flagsFor(p, "name"), []);
    await p.context().close();
  });
});

describe("VF6: a disabled button looks disabled", () => {
  test("on the first page, Previous page looks disabled and Next page doesn't", async () => {
    const p = await fresh();
    await inject(p, "respond");
    await p.waitForFunction(() => pdfState.result && !pdfState.busy, null, { timeout: 120000 });
    await p.evaluate(() => { document.querySelector('details[data-more="preview"]').open = true; });
    await p.waitForSelector("#preview canvas", { timeout: 120000 });
    await p.click('#preview [data-page="1"]');
    await p.waitForSelector("dialog.pageview[open] .pvpage canvas", { timeout: 60000 });
    const look = id => p.$eval(`#${id}`, b => [b.disabled, +getComputedStyle(b).opacity, getComputedStyle(b).cursor]);
    const [prev, next] = [await look("pvPrev"), await look("pvNext")];
    assert.equal(prev[0], true); assert.ok(prev[1] <= 0.5, `opacity ${prev[1]}`); assert.equal(prev[2], "not-allowed");
    assert.equal(next[0], false); assert.equal(next[1], 1); assert.notEqual(next[2], "not-allowed");
    await p.keyboard.press("Escape");
    await p.context().close();
  });
});

describe("VF7: fee waiver totals always have an Edit link", () => {
  const totalsEdit = p => p.evaluate(() => {
    document.querySelector('details[data-more="answers"]').open = true;
    return [...document.querySelectorAll("dl.vals > div")].filter(d => /Total (Income|Expenses)/.test(d.querySelector("dt").textContent)).map(d => d.querySelector("[data-fix]")?.dataset.fix || "none");
  });
  test("with the questions they point to hidden by the checklists, the totals edit through the checklists", async () => {
    const p = await fresh();
    await inject(p, "feewaiver", { incomeKinds: "ssi", ssi: "100", expenseKinds: "none" });
    assert.deepEqual(await totalsEdit(p), ["incomeKinds", "expenseKinds"]);
    await p.context().close();
  });
  test("edge: with the checklists skipped, they edit the first amount, as before", async () => {
    const p = await fresh();
    await inject(p, "feewaiver", { incomeKinds: "", expenseKinds: "", housing: "500" });
    assert.deepEqual(await totalsEdit(p), ["hourlyRate", "housing"]);
    await p.context().close();
  });
});

describe("VF8: a service date before the signing date is flagged to check", () => {
  const day = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  test("a copy sent before the form is signed is flagged, with both dates", async () => {
    const p = await fresh();
    await inject(p, "appearance", { svc1Date: day(-5), signDate: day(2) });
    const f = await flagsFor(p, "svc1Date");
    assert.ok(f.some(x => /^check\|Certificate of Service: Date of service \(person 1\)\|.* is before the date you'll sign the form \(.*\)\. The certificate says a copy was sent on this date\. Check both dates\./.test(x)), f.join("\n"));
    await p.context().close();
  });
  test("edge: the same day, or after signing, isn't flagged", async () => {
    const p = await fresh();
    for (const svc1Date of [day(2), day(4)]) {
      await inject(p, "appearance", { svc1Date, signDate: day(2) });
      assert.ok(!(await flagsFor(p, "svc1Date")).some(x => /before the date you'll sign/.test(x)), svc1Date);
    }
    await p.context().close();
  });
  test("edge: every person on the certificate is checked, on the Answer too", async () => {
    const p = await fresh();
    await inject(p, "respond", { svcMore1: "yes", svc2Name: "Lawyer Two", svc2Address: "3 Elm St, Fort Wayne, IN 46802", svc2Method: "First Class U.S. mail", svc2Date: day(-3), svcMore2: "no", signDate: day(1) });
    assert.ok((await flagsFor(p, "svc2Date")).some(x => /before the date you'll sign/.test(x)));
    await p.context().close();
  });
});

describe("VF9: form card headings read with a pause before the form number", () => {
  test("screen readers get \"..., Form CCA-...\", not two words run together, and the card looks the same", async () => {
    const p = await fresh();
    for (const form of ["respond", "continuance", "feewaiver"]) {
      await inject(p, form, { incomeKinds: "none", expenseKinds: "none" });
      const heads = await p.$$eval(".formcard h3", hs => hs.filter(h => h.querySelector("small")).map(h => h.textContent));
      assert.ok(heads.length > 0, form);
      for (const h of heads) assert.match(h, /[a-z)], Form CCA-GF-\d{4}-\d{4}$/, h);
      assert.equal(await p.$eval(".formcard h3 small", s => getComputedStyle(s).display), "block");
    }
    await p.context().close();
  });
});

describe("VF13: the browser's Back stays in the tool while answers are waiting to go back to", () => {
  const back = p => p.evaluate(() => history.back());
  // Watches for the page trying to leave (the browser's "Leave site?" check), and stays.
  const leaving = p => { p.removeAllListeners("dialog"); const seen = { left: false }; p.on("dialog", d => { if (d.type() === "beforeunload") seen.left = true; d.dismiss(); }); return seen; };
  test("Choose a different form, a case card, Back, Back: back to the summary", async () => {
    const p = await fresh();
    await pick(p, "appearance"); await walk(p, "summary");
    await p.click("#changeForm"); await p.click('.pick[data-kind="debt"]');
    await back(p); await p.waitForFunction(() => mode === "pick");
    assert.equal(await p.locator("#backToWork").count(), 1);
    const seen = leaving(p);
    await back(p); await p.waitForFunction(() => mode === "summary", null, { timeout: 5000 });
    assert.equal(seen.left, false);
    await p.context().close();
  });
  test("edge: the same through Which one fits", async () => {
    const p = await fresh();
    await pick(p, "appearance"); await walk(p, "summary");
    await p.click("#changeForm");
    if (!(await p.locator("#notSure").isVisible())) await p.click("#moreToggle"); // it stays open from before
    await p.click("#notSure");
    await back(p); await p.waitForFunction(() => mode === "pick");
    const seen = leaving(p);
    await back(p); await p.waitForFunction(() => mode === "summary", null, { timeout: 5000 });
    assert.equal(seen.left, false);
    await p.context().close();
  });
  test("edge: back in the form, Back goes back through the questions as usual, with no loop to the first screen", async () => {
    const p = await fresh();
    await pick(p, "appearance"); await walk(p, "summary");
    await p.click("#changeForm"); await p.click('.pick[data-kind="debt"]');
    await back(p); await p.waitForFunction(() => mode === "pick");
    await back(p); await p.waitForFunction(() => mode === "summary");
    await back(p); await p.waitForFunction(() => mode === "step");
    assert.equal(await p.evaluate(() => visible()[cur].id), await p.evaluate(() => visible().at(-1).id), "the last question, as Back to questions");
    await p.context().close();
  });
});

describe("VF14: an answer over the length limit is flagged, however it got in", () => {
  test("a 25,000-character answer kept by leaving through the section list is flagged with its length", async () => {
    const p = await fresh({ viewport: { width: 1280, height: 900 } });
    await pick(p, "appearance"); await walk(p, "plaintiff");
    await p.fill("#ans", "X".repeat(25000)); await p.click("#next");
    assert.equal(await step(p), "plaintiff", "refused on Continue, as before");
    await p.click('.rail [data-sec="1"]'); await walk(p, "summary");
    assert.ok((await flagsFor(p, "plaintiff")).some(f => /^check\|Plaintiff\|This answer is 25,000 characters, more than the 20,000 a question takes\. Shorten it\./.test(f)));
    await p.context().close();
  });
  test("edge: exactly 20,000 characters isn't flagged for length", async () => {
    const p = await fresh();
    await inject(p, "respond", { defenses: "A".repeat(20000) });
    assert.ok(!(await flagsFor(p, "defenses")).some(f => /more than the 20,000/.test(f)));
    await p.context().close();
  });
  test("edge: Fix opens the question, and it still can't be saved until it's shorter", async () => {
    const p = await fresh();
    await inject(p, "respond", { defenses: "A".repeat(20001) });
    await p.click('ul.flags li:has([data-fix="defenses"]) [data-fix]');
    assert.equal(await step(p), "defenses");
    await p.click("#next");
    assert.match(await p.textContent("#err"), /too long/);
    await p.fill("#ans", "I paid this debt in full."); await p.click("#next");
    assert.equal(await step(p), "summary");
    await p.context().close();
  });
});

describe("VF15: on the fee waiver, \"None\" as the email leaves the box blank, as its instructions say", () => {
  const emailRow = p => p.evaluate(() => { const r = SITUATIONS.feewaiver.fields(visibleAnswers()).find(r => r.label === "Email address"); return [String(r.value), r.pdf.map(o => o.value).join("|")]; });
  const asksAccept = p => p.evaluate(() => visible().some(s => s.id === "acceptEmail"));
  test("None and n/a print nothing in the email box, and the summary says why", async () => {
    const p = await fresh();
    for (const email of ["None", "n/a"]) {
      await inject(p, "feewaiver", { email, incomeKinds: "none", expenseKinds: "none" });
      assert.deepEqual(await emailRow(p), ["Left blank (no email)", ""], email);
      assert.equal(await asksAccept(p), false, email);
    }
    await p.context().close();
  });
  test("edge: words like \"no email\" don't print either, aren't asked about court papers, and aren't flagged", async () => {
    const p = await fresh();
    await inject(p, "feewaiver", { email: "I don't have email", incomeKinds: "none", expenseKinds: "none" });
    assert.deepEqual(await emailRow(p), ["Left blank (no email)", ""]);
    assert.equal(await asksAccept(p), false);
    assert.deepEqual(await flagsFor(p, "email"), []);
    await p.context().close();
  });
  test("edge: a real email still prints, and asks about court papers", async () => {
    const p = await fresh();
    await inject(p, "feewaiver", { email: "pat@example.com", incomeKinds: "none", expenseKinds: "none" });
    assert.deepEqual(await emailRow(p), ["pat@example.com", "pat@example.com"]);
    assert.equal(await asksAccept(p), true);
    await p.context().close();
  });
  test("edge: on the Appearance, None still prints, since that form says to type it", async () => {
    const p = await fresh();
    await inject(p, "appearance", { email: "None" });
    assert.equal(await p.evaluate(() => SITUATIONS.appearance.fields(visibleAnswers()).find(r => r.label === "Email address").pdf[0].value), "None");
    await p.context().close();
  });
});

describe("VF16: two more email shapes that can't work are refused", () => {
  const onEmail = async (p, value) => { await inject(p, "appearance"); await jump(p, "email"); await p.fill("#ans", value); await p.click("#next"); };
  test("a part after the @ that starts or ends with a hyphen is refused, with the reason", async () => {
    const p = await fresh();
    for (const e of ["pat@example-.com", "pat@-example.com", "pat@mail.-example.com"]) {
      await onEmail(p, e);
      assert.equal(await step(p), "email", e);
      assert.match(await p.textContent("#err"), /starts or ends with a hyphen/, e);
    }
    await p.context().close();
  });
  test("a part before the @ longer than 64 characters is refused, with the reason", async () => {
    const p = await fresh();
    await onEmail(p, "a".repeat(65) + "@example.com");
    assert.equal(await step(p), "email");
    assert.match(await p.textContent("#err"), /longer than an email address allows/);
    await p.context().close();
  });
  test("edge: hyphens inside a part, and exactly 64 characters, are fine", async () => {
    const p = await fresh();
    for (const e of ["pat@my-mail.example.com", "a".repeat(64) + "@example.com"]) {
      await onEmail(p, e);
      assert.equal(await step(p), "phone", e);
    }
    await p.context().close();
  });
});

