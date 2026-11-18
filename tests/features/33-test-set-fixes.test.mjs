// Fixes for what the item 18 test set (tests/quality) found: I18a to I18d on the Issue Map.
import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fresh, close, inject, flagsFor } from "../lib.mjs";

let p;
before(async () => { p = await fresh(); });
after(close);
const titles = () => p.evaluate(() => runChecks().map(f => `${f.fix}|${f.title}`));

describe("I18a: a list that says \"all\" next to another list that names paragraphs", () => {
  const SAYS = "check|Your lists say different things";
  test("\"all of them\" admitted with paragraph 3 denied is flagged on the \"all\" list, saying what to write", async () => {
    await inject(p, "respond", { admitted: "all of them", denied: "3", notEnough: "" });
    const f = await flagsFor(p, "admitted");
    assert.equal(f.length, 1);
    assert.match(f[0], /^check\|Your lists say different things\|Your list of paragraphs you admit says "all of them", but your list of paragraphs you deny names paragraph 3\. A paragraph can only be in one list\. If you mean all the others, you could write "all except 3"\.$/);
  });
  test("the other way round, and with more than one paragraph", async () => {
    await inject(p, "respond", { admitted: "1, 4", denied: "everything", notEnough: "" });
    const f = await flagsFor(p, "denied");
    assert.equal(f.length, 1);
    assert.match(f[0], /names paragraphs 1 and 4\. .*"all except 1 and 4"\.$/);
  });
  test("edge: \"all except 3\", \"the rest\", \"everything else\" and \"all\" on its own aren't flagged", async () => {
    for (const [admitted, denied] of [["all except 3", "3"], ["all the rest", "3"], ["everything else", "2, 3"], ["all but paragraph 3", "3"], ["all", ""]]) {
      await inject(p, "respond", { admitted, denied, notEnough: "" });
      assert.ok(!(await titles()).some(t => t.endsWith("Your lists say different things")), `${admitted} / ${denied}`);
    }
  });
  test("edge: a list with a number in it isn't an \"all\" list, and a sentence isn't quoted", async () => {
    for (const admitted of ["all of 1 to 3", "I admit all of it because the store said so"]) {
      await inject(p, "respond", { admitted, denied: "4", notEnough: "" });
      assert.ok(!(await flagsFor(p, "admitted")).some(f => f.startsWith(SAYS)), admitted);
    }
  });
  test("edge: it waits while a list is flagged for private information, so no number is repeated", async () => {
    await inject(p, "respond", { admitted: "all of them", denied: "123-45-6789", notEnough: "" });
    const all = (await p.evaluate(() => runChecks().map(f => `${f.title} ${f.why}`))).join(" ");
    assert.doesNotMatch(all, /6789/);
    assert.ok(!(await titles()).some(t => t.endsWith("Your lists say different things")));
  });
  test("edge: \"How this tool checks your answers\" says so", async () => {
    await inject(p, "respond");
    assert.match(await p.$eval("ul.howchecks li:has(strong:text-is('Your answer to the Complaint.'))", li => li.textContent), /a list saying "all" isn't next to another list naming paragraphs/);
  });
});

describe("I18b: paragraph numbers written as words", () => {
  const lines = () => p.evaluate(() => runChecks().map(f => `${f.title}|${f.why}`));
  test("\"one, two\" admitted and \"four\" denied: paragraph 3 is flagged as left out", async () => {
    await inject(p, "respond", { admitted: "one, two", denied: "four", notEnough: "" });
    assert.ok((await lines()).some(l => /^Paragraphs not in any list\|Paragraph 3 isn't in any of your lists\./.test(l)));
  });
  test("\"one, 2\" admitted and \"3\" denied is read as 1, 2 and 3: nothing to flag", async () => {
    await inject(p, "respond", { admitted: "one, 2", denied: "3", notEnough: "" });
    assert.deepEqual(await lines(), []);
  });
  test("a paragraph written as a word in two lists is flagged as in two lists", async () => {
    await inject(p, "respond", { admitted: "paragraphs two and three", denied: "two", notEnough: "" });
    assert.ok((await lines()).some(l => /^Paragraphs listed in more than one list\|Paragraph 2 is in more than one of your lists\./.test(l)));
  });
  test("edge: \"every one of them\" is an \"all\" list, and \"the first three\" still counts as naming paragraphs", async () => {
    await inject(p, "respond", { admitted: "every one of them", denied: "3", notEnough: "" });
    assert.ok((await flagsFor(p, "admitted")).some(f => f.startsWith("check|Your lists say different things")));
    await inject(p, "respond", { admitted: "the first three", denied: "5", notEnough: "" });
    assert.ok(!(await lines()).some(l => /^Paragraphs (?:not in any list|listed in more than one list)/.test(l)), "no paragraph is read from it");
  });
  test("edge: a sentence starting with a number word isn't read as a paragraph", async () => {
    await inject(p, "respond", { admitted: "1, 2", denied: "3", notEnough: "One paragraph is about a different debt." });
    assert.deepEqual(await p.evaluate(() => [...paragraphNumbers(answers.notEnough)]), []);
    assert.ok((await flagsFor(p, "notEnough")).some(f => /doesn't seem to name any paragraph numbers/.test(f)));
  });
});

describe("I18c: a password written as \"my pass is ...\"", () => {
  const privacy = () => p.evaluate(() => runChecks().filter(f => /^Private information/.test(f.title)).map(f => f.fix));
  test("\"My pass is hunter2\" and \"pw is Hunter!x\" are flagged, and the flag doesn't repeat them", async () => {
    for (const defenses of ["My pass is hunter2 and they changed it.", "The pw is Hunter!x, and someone used it."]) {
      await inject(p, "respond", { defenses });
      assert.deepEqual(await privacy(), ["defenses"], defenses);
      assert.doesNotMatch((await p.evaluate(() => runChecks().map(f => `${f.title} ${f.why}`))).join(" "), /hunter2|Hunter!x/i);
    }
  });
  test("Fix selects the password part", async () => {
    await inject(p, "respond", { defenses: "My pass is hunter2 and they changed it." });
    await p.click('ul.flags button[data-fix="defenses"][data-hit]');
    assert.equal(await p.evaluate(() => { const el = document.getElementById("ans"); return el.value.slice(el.selectionStart, el.selectionEnd); }), "pass is hunter2");
  });
  test("edge: ordinary uses of \"pass\" aren't flagged", async () => {
    for (const defenses of ["My bus pass is expired.", "The pass was 10am-2pm only.", "My pass is valid until May.", "My parking pass is #A12.", "A monthly pass is $45.", "I didn't pass, so I was charged."]) {
      await inject(p, "respond", { defenses });
      assert.deepEqual(await privacy(), [], defenses);
    }
  });
});
