// Feature 1: people pick a plain description of their case, and the tool picks the court forms. "I'm not sure" leads to help.
import { describe, test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { fresh, close, reset, step } from "../lib.mjs";

let p;
before(async () => { p = await fresh(); });
beforeEach(() => reset(p));
after(close);
const card = k => p.click(`.pick[data-kind="${k}"]`);
const choose = async v => { await p.locator(`input[name=ans][value="${v}"]`).check({ force: true }); await p.click("#next"); };
const offered = () => p.$$eval("[data-start]", b => b.map(x => x.dataset.start));
const heading = () => p.textContent("#app h1");

describe("1. Pick your situation", () => {
  test("the first screen lists five plain kinds of case, by how many were filed", async () => {
    const labels = await p.$$eval(".pick[data-kind]", b => b.map(x => x.querySelector("strong").textContent));
    assert.deepEqual(labels, ["I'm being sued over a debt", "I'm being sued in small claims court", "I got eviction papers", "I'm being sued over an injury or damage", "I'm being sued in another kind of civil case"]);
  });
  test("eviction papers with a Notice of Claim and a court date they can make: the Appearance comes first", async () => {
    await card("eviction"); await choose("notice"); await choose("yes");
    assert.deepEqual(await offered(), ["appearance", "continuance"]);
  });
  test("a debt Complaint: the Appearance and Answer", async () => {
    await card("debt"); await choose("complaint");
    assert.ok((await offered()).includes("respond"));
  });
  test("choosing what's offered opens that form's first question", async () => {
    await card("debt"); await choose("complaint");
    await p.click('[data-start="respond"]');
    assert.equal(await p.evaluate(() => [mode, sitKey].join()), "step,respond");
  });
  test("edge: I'm not sure which one fits leads to help, with a link for each kind of help", async () => {
    await p.click("#moreToggle"); await p.click("#notSure");
    assert.equal(await heading(), "Which one fits?");
    const links = await p.$$eval("#app .facts a", a => a.map(x => x.href));
    for (const re of [/indianalegalhelp\.org/, /get-help/, /in\.gov\/courts/, /mycase\.in\.gov/]) assert.ok(links.some(h => re.test(h)), String(re));
  });
  test("edge: not sure what the paper is called: it shows the titles to look for, and a way back to every choice", async () => {
    await card("debt"); await choose("unsure");
    assert.equal(await p.locator("[data-paper]").count() > 0, true);
    assert.equal(await p.locator("#allChoices").count(), 1);
    assert.deepEqual(await offered(), []);
  });
  test("edge: small claims skips the question about the paper's title", async () => {
    await card("smallclaims");
    assert.match(await p.textContent("#q"), /go to court at the date and time/);
  });
  test("edge: a court date they can't make puts asking for a new date first", async () => {
    await card("eviction"); await choose("notice"); await choose("no");
    assert.equal((await offered())[0], "continuance");
  });
  test("edge: My situation is different opens the four forms and the kinds of case the tool can't fill yet", async () => {
    await p.click("#moreToggle");
    assert.deepEqual(await p.$$eval(".pick[data-k]", b => b.map(x => x.dataset.k)).then(k => k.sort()), ["appearance", "continuance", "feewaiver", "respond"]);
    const text = await p.textContent("#moreChoices");
    for (const t of ["Protection orders", "Divorce", "Paternity", "Expungement"]) assert.ok(text.includes(t), t);
  });
  test("edge: Continue with nothing chosen says to pick one, and Back returns to the first screen", async () => {
    await card("debt"); await p.click("#next");
    assert.equal(await p.textContent("#err"), "Pick one to continue.");
    await p.click("#back");
    assert.equal(await step(p), "pick");
  });
});
