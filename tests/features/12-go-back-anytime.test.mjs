// Feature 12: earlier answers can be changed from any step, including the summary, and the person returns to where they were.
import { describe, test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { fresh, close, reset, pick, walk, step, inject, fieldRows } from "../lib.mjs";

let p;
before(async () => { p = await fresh(); });
beforeEach(() => reset(p));
after(close);
const edit = id => p.click(`dl.vals [data-fix="${id}"]`);

describe("12. Go back anytime", () => {
  test("Back goes to the previous question with its answer still there", async () => {
    await pick(p, "appearance"); await walk(p, "caseNumber");
    await p.click("#back");
    assert.equal(await step(p), "courtType");
    assert.equal(await p.locator('input[name=ans][value="SUPERIOR"]').isChecked(), true);
    assert.equal(await p.evaluate(() => answers.county), "Allen");
  });
  test("Back from the first question returns to the first screen", async () => {
    await pick(p, "appearance"); await p.click("#back");
    assert.equal(await step(p), "pick");
  });
  test("Back to questions on the summary opens the last question", async () => {
    await pick(p, "appearance"); await walk(p, "summary");
    await p.click("#toQuestions");
    assert.equal(await step(p), await p.evaluate(() => visible().at(-1).id));
  });
  test("Edit on the summary opens that question, and Save and review returns to the summary", async () => {
    await inject(p, "appearance");
    await edit("phone");
    assert.equal(await step(p), "phone");
    assert.equal(await p.textContent("#next"), "Save and review");
    await p.fill("#ans", "317-555-0111"); await p.click("#next");
    assert.equal(await step(p), "summary");
    assert.equal(await p.evaluate(() => answers.phone), "317-555-0111");
  });
  test("edge: Cancel returns to the summary without changing the answer", async () => {
    await inject(p, "appearance");
    await edit("name"); await p.fill("#ans", "Not Kept");
    assert.equal(await p.textContent("#back"), "Cancel");
    await p.click("#back");
    assert.equal(await step(p), "summary");
    assert.equal(await p.evaluate(() => answers.name), "Pat Example");
  });
  test("edge: an edit that opens a follow-up question asks it before returning", async () => {
    await inject(p, "appearance");
    await edit("related");
    await p.locator('input[name=ans][value="yes"]').check({ force: true }); await p.click("#next");
    assert.equal(await step(p), "relatedNumbers");
    await p.fill("#ans", "02D01-2601-CC-000111"); await p.click("#next");
    assert.equal(await step(p), "summary");
  });
  test("edge: the browser's Back button steps back inside the tool", async () => {
    await pick(p, "appearance"); await walk(p, "caseNumber");
    await p.evaluate(() => history.back());
    await p.waitForFunction(() => mode === "step" && visible()[cur].id === "courtType");
  });
  test("edge: starting from the paper sorting, the summary lets those answers be changed", async () => {
    await p.click('.pick[data-kind="debt"]');
    await p.locator('input[name=ans][value="complaint"]').check({ force: true }); await p.click("#next");
    await p.click('[data-start="respond"]'); await walk(p, "summary");
    await p.click("#editTriage");
    assert.equal(await step(p), "triage");
  });
  test("edge: after an edit, focus goes back to the row that was changed", async () => {
    await inject(p, "appearance");
    await edit("phone"); await p.click("#next");
    assert.equal(await p.evaluate(() => document.activeElement.closest("dl.vals") && document.activeElement.dataset.fix), "phone");
  });
  test("edge: changing a choice hides the questions it opened, and their answers stop printing", async () => {
    await inject(p, "appearance", { related: "yes", relatedNumbers: "02D01-2601-CC-000111" });
    assert.ok((await fieldRows(p)).some(([, v]) => v.includes("02D01-2601-CC-000111")));
    await edit("related");
    await p.locator('input[name=ans][value="no"]').check({ force: true }); await p.click("#next");
    assert.equal(await step(p), "summary");
    assert.ok(!(await fieldRows(p)).some(([, v]) => v.includes("02D01-2601-CC-000111")));
    assert.equal(await p.evaluate(() => "relatedNumbers" in visibleAnswers()), false);
  });
});
