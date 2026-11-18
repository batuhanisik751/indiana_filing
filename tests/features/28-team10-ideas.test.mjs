// Two ideas from Team 10's petition checker: show the exact words that set off a flag (PT5), and a list of how the
// tool checks, with sources (PT6).
import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fresh, close, inject, editAnswer } from "../lib.mjs";

let p;
before(async () => { p = await fresh(); });
after(close);
const fixFlag = title => p.click(`ul.flags li:has(.ftitle:text-is("${title}")) button[data-fix]`);
const selected = () => p.evaluate(() => { const el = document.getElementById("ans"); return el.value.slice(el.selectionStart, el.selectionEnd); });

describe("PT5: the part of an answer a flag is about", () => {
  const DEF = "I paid this off in 2024. My SSN is 123-45-6789 if they need it.";
  test("Fix opens the answer with that part selected, and says so", async () => {
    await inject(p, "respond", { defenses: DEF });
    await fixFlag("Private information: Your defenses");
    assert.equal(await selected(), "123-45-6789");
    assert.equal(await p.textContent("#hitnote"), "The part the flag is about is selected.");
    assert.equal(await p.evaluate(() => document.activeElement.id), "ans");
  });
  test("the flag itself still never repeats it", async () => {
    await inject(p, "respond", { defenses: DEF });
    assert.doesNotMatch(await p.textContent("ul.flags"), /6789/);
  });
  test("in \"Show every answer\", it's marked where the answer is already shown", async () => {
    await inject(p, "respond", { defenses: DEF });
    assert.deepEqual(await p.$$eval("dl.vals mark", m => m.map(x => x.textContent)), ["123-45-6789"]);
    assert.match(await p.$eval("dl.vals mark", m => m.closest("dd").textContent), /^I paid this off in 2024\. My SSN is 123-45-6789 if they need it\.$/, "the answer reads the same");
  });
  test("edge: two numbers: both marked, the first selected; the year next to them isn't", async () => {
    await inject(p, "respond", { defenses: "In 2023 they charged card 4111 1111 1111 1111 and my SSN 123-45-6789." });
    assert.deepEqual(await p.$$eval("dl.vals mark", m => m.map(x => x.textContent)), ["4111 1111 1111 1111", "123-45-6789"]);
    await fixFlag("Private information: Your defenses");
    assert.equal(await selected(), "4111 1111 1111 1111");
  });
  test("edge: a password: the label and what follows are the part", async () => {
    await inject(p, "respond", { defenses: "The website password: Hunter2!x was used." });
    await fixFlag("Private information: Your defenses");
    assert.equal(await selected(), "password: Hunter2!x");
  });
  test("edge: an amount box with a 9-digit number selects the whole amount", async () => {
    await inject(p, "feewaiver", { incomeKinds: "wages", bank: "123456789" });
    await fixFlag("Private information: Money in the bank");
    assert.equal(await selected(), "123456789");
  });
  test("edge: Edit from the answers list selects nothing, and nothing is marked without a flag", async () => {
    await inject(p, "respond", { defenses: DEF });
    await editAnswer(p, "defenses");
    assert.equal(await selected(), "");
    assert.equal(await p.$("#hitnote"), null);
    await inject(p, "respond", { defenses: "I paid this off in 2024." });
    assert.equal(await p.$("dl.vals mark"), null);
  });
  test("edge: once fixed, the flag, the mark and the selection are gone", async () => {
    await inject(p, "respond", { defenses: DEF });
    await fixFlag("Private information: Your defenses");
    await p.keyboard.press("Backspace"); // deletes the selected number
    await p.click("#next");
    assert.ok(!(await p.$$eval(".ftitle", t => t.map(x => x.textContent))).some(t => /^Private information/.test(t)), "no flag left");
    assert.equal(await p.$("dl.vals mark"), null);
  });
});

describe("PT6: How this tool checks your answers", () => {
  const lines = () => p.$$eval("ul.howchecks li", lis => lis.map(li => li.querySelector("strong").textContent.replace(/\.$/, "")));
  test("on the summary, closed, with one line per kind of check for this form", async () => {
    await inject(p, "respond");
    assert.equal(await p.textContent('details.howchecks > summary'), "How this tool checks your answers");
    assert.equal(await p.$eval("details.howchecks", d => d.open), false);
    assert.deepEqual(await lines(), ["Blank answers", "Private information", "Case number", "Kind of case", "Your answer to the Complaint", "Certificate of Service", "Email", "Phone and fax", "Addresses", "Dates", "Words that would print", "Where court papers go", "The filled form"]);
  });
  test("each form has its own lines", async () => {
    await inject(p, "feewaiver");
    const fw = await lines();
    assert.ok(fw.includes("Amounts") && fw.includes("Case type"));
    for (const not of ["Case number", "Certificate of Service", "Your answer to the Complaint", "Your request"]) assert.ok(!fw.includes(not), not);
    await inject(p, "continuance");
    const c = await lines();
    assert.ok(c.includes("Your request") && c.includes("Certificate of Service"));
    assert.ok(!c.includes("Amounts") && !c.includes("Kind of case"));
  });
  test("every line names a source, or says it's the tool's own check for typing mistakes", async () => {
    for (const form of ["respond", "appearance", "continuance", "feewaiver"]) {
      await inject(p, form);
      for (const li of await p.$$eval("ul.howchecks li", lis => lis.map(li => ({ text: li.textContent, links: li.querySelectorAll("a").length }))))
        assert.ok(li.links > 0 || /This tool's own check for typing mistakes\.|This tool checks the PDF it made\./.test(li.text), `${form}: ${li.text}`);
    }
  });
  test("edge: every rule a check cites is in the list, linked the same", async () => {
    await inject(p, "respond");
    const listed = new Set(await p.$$eval("ul.howchecks a", a => a.map(x => x.getAttribute("href"))));
    for (const href of await p.evaluate(() => [...Object.values(RULES), RULE8].map(l => l.href))) assert.ok(listed.has(href), href);
  });
  test("edge: the lines that name a number match the checks' own numbers", async () => {
    await inject(p, "feewaiver");
    const amounts = await p.$eval("ul.howchecks li:has(strong:text-is('Amounts.'))", li => li.textContent);
    assert.match(amounts, /\$100,000 or more/); assert.match(amounts, /\$100 an hour or more/); assert.match(amounts, /744 hours a month/);
    // The checks themselves: just under each line passes, at it is flagged.
    const flagged = async over => { await inject(p, "feewaiver", { incomeKinds: "wages,other", ...over }); return p.evaluate(() => runChecks().map(f => f.title)); };
    assert.ok((await flagged({ hourlyRate: "100" })).includes("Wages per hour"));
    assert.ok(!(await flagged({ hourlyRate: "99.99" })).includes("Wages per hour"));
    assert.ok((await flagged({ monthlyHours: "745" })).includes("Hours worked per month"));
    assert.ok(!(await flagged({ monthlyHours: "744" })).includes("Hours worked per month"));
  });
  test("edge: it opens only when tapped or clicked, and its links open in a new tab", async () => {
    await inject(p, "respond");
    await p.click("details.howchecks > summary");
    assert.equal(await p.$eval("details.howchecks", d => d.open), true);
    assert.equal(await p.$$eval("ul.howchecks a", a => a.every(x => x.target === "_blank" && /opens in a new tab/.test(x.textContent))), true);
  });
});
