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
