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
    assert.doesNotMatch(await p.textContent("#app"), /Private information/);
    assert.equal(await p.$("dl.vals mark"), null);
  });
});
