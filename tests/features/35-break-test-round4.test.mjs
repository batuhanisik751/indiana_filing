// Break-test round 4 (BT50-BT110, TG11-TG20): problems seven independent testers found across the whole app, fixed most
// important first. BT50's tests are in ../loading.test.mjs.
import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fresh, close, inject, SAVED } from "../lib.mjs";

let p;
before(async () => { p = await fresh(); });
after(close);
const listFlags = async (admitted, denied, notEnough = "") => { await inject(p, "respond", { admitted, denied, notEnough }); return p.evaluate(() => runChecks().filter(f => ["admitted", "denied", "notEnough"].includes(f.fix)).map(f => `${f.level}|${f.title}`)); };
const MISSING = "missing|Your answer";
const ready = q => q.waitForFunction(() => pdfState.result && !pdfState.busy, null, { timeout: 120000 });
// Opens page n of the filled form large, from "Show the pages" on the summary.
async function openPage(q, n) {
  await ready(q);
  await q.evaluate(() => { const d = document.querySelector('details[data-more="preview"]'); if (d) d.open = true; });
  await q.waitForSelector(`#preview [data-page="${n}"]`, { timeout: 60000 });
  await q.click(`#preview [data-page="${n}"]`);
  await q.waitForSelector("dialog.pageview .pvpage canvas", { timeout: 60000 });
}
const tap = async (q, id, k = 0) => { await q.locator(`dialog.pageview .pvspot[data-id="${id}"]`).nth(k).click(); await q.waitForSelector("#pvEdit"); };
const copy = q => q.evaluate(k => localStorage.getItem(k) || "", SAVED);
// A page of its own with saving on, so what's on the device can be read back.
async function savingPage() {
  const q = await fresh();
  await q.click("#savePref");
  return q;
}

describe("BT51. A sentence with \"all\" or \"every\" in it, or one starting \"First,\", isn't a list of paragraphs", () => {
  test("each of these, alone in Denied, is flagged Missing, as before last week", async () => {
    for (const s of ["I paid every month on time and never missed one", "I paid it all back", "I never missed a payment, I paid each one", "They are lying about everything",
      "The whole thing is a scam", "I paid the entire bill", "All of my payments were on time", "My ex husband is responsible for all of it", "I gave them everything they asked for",
      "I called every week and nobody answered", "First, this is not my debt", "First, I never signed. Second, I paid", "We all moved out in June", "I had the car the whole time"]) {
      assert.deepEqual(await listFlags("", s), [MISSING], s);
      assert.equal(await p.evaluate(() => { const s = completeness(); return s.filled < s.total; }), true, `${s}: not a full score`);
    }
  });
  test("\"all of them\" in other words still counts: alone it's a list, next to a named paragraph it's \"different things\"", async () => {
    for (const t of ["I agree with all of it", "I admit all of it because the store said so", "I deny all allegations", "Every single one", "Yes, all", "The whole complaint is false", "I deny everything", "I deny each and every allegation"]) {
      assert.deepEqual(await listFlags(t, ""), [], t);
      assert.deepEqual(await listFlags(t, "3"), ["check|Your lists say different things"], `${t} / 3`);
    }
  });
  test("next to \"1, 3\", \"The whole amount is wrong\" isn't read as all of them", async () => {
    assert.ok(!(await listFlags("1, 3", "The whole amount is wrong")).includes("check|Your lists say different things"));
  });
  test("edge: ordinals in a list are still paragraphs: \"first and second\", \"First, second and third\", \"First, 2\", \"Paragraph first,\"", async () => {
    assert.deepEqual(await p.evaluate(() => ["first and second", "First, second and third", "First, 2", "First.", "Paragraph first, I deny", "the first five", "First, I never signed"].map(t => [...paragraphNumbers(t)].join(","))),
      ["1,2", "1,2,3", "1,2", "1", "1", "1,2,3,4,5", ""]);
  });
});

describe("BT55. Text typed in a box on a page shown large leaves the device when the box is let go", () => {
  const TYPED = "My SSN is 123-45-6789";
  for (const [how, letGo] of [
    ["Cancel", q => q.click("#ieCancel")],
    ["Escape", q => q.keyboard.press("Escape")],
    ["Close", async q => { await q.keyboard.press("Escape"); await q.click("#pvClose"); }],
    ["Next page", q => q.click("#pvNext")],
    ["tapping another answer", q => tap(q, "email")],
  ]) test(`${how}: the saved copy no longer has what was typed or the open box`, async () => {
    const q = await savingPage();
    await inject(q, "respond");
    await q.evaluate(() => saveProgress());
    await openPage(q, 1);
    await tap(q, "plaintiff");
    await q.fill("#inEdit", TYPED);
    assert.match(await copy(q), /6789/, "kept while the box is open, as on the question");
    await letGo(q);
    assert.doesNotMatch(await copy(q), /6789|"inline"/);
    assert.equal(JSON.parse(await copy(q)).answers.plaintiff, "Acme Credit LLC");
    await q.context().close();
  });
  test("edge: reloaded with the box open, it comes back with what was typed, as on the summary", async () => {
    const q = await savingPage();
    await inject(q, "respond");
    await q.evaluate(() => saveProgress());
    await openPage(q, 1);
    await tap(q, "plaintiff");
    await q.fill("#inEdit", "Acme Credit Holdings LLC");
    await q.reload(); await q.waitForSelector("#app h1");
    if (await q.locator("#resume").count()) await q.click("#resume");
    await q.waitForSelector("#inEdit");
    assert.equal(await q.$eval("#inEdit", b => b.value), "Acme Credit Holdings LLC");
    await q.click("#ieCancel");
    assert.doesNotMatch(await copy(q), /Holdings|"inline"/);
    await q.context().close();
  });
});

describe("BT52. A protection order case says how its contact information and e-filing differ", () => {
  const PO = { caseNumber: "02D01-2611-PO-001234", role: "me", fileMethod: "efile" };
  const flagsAndSteps = (form, over) => inject(p, form, over).then(() => p.evaluate(() => ({
    flags: runChecks().filter(f => f.title === "Protection order case").map(f => `${f.fix}|${f.why}`),
    online: nextSteps(sitKey, visibleAnswers()).filter(s => /File online/.test(s.title)).map(s => `${s.short} ${s.body}`).join(" ") })));
  test("a continuance in a PO case: the contact boxes are flagged with what Rule 5 asks for, and e-filing names its own service", async () => {
    const { flags, online } = await flagsAndSteps("continuance", PO);
    assert.equal(flags.length, 1);
    assert.match(flags[0], /^address\|Your case type is PO, a protection order or workplace violence restraining order case\. If you're a victim or a witness/);
    assert.match(flags[0], /mailing address, email address and phone number out of the public record/);
    assert.match(flags[0], /confidential document \(on green paper if you file on paper\), along with a separate copy that leaves them out and an ACR Form/);
    assert.match(online, /Protection Order Registry's e-filing service/);
    assert.match(online, /every filing in the case/);
    assert.doesNotMatch(online, /you can always e-file at no cost/);
  });
  test("a JQ case and an Appearance: the same; with the Address Confidentiality Program, the mailing address isn't named", async () => {
    let { flags, online } = await flagsAndSteps("appearance", { caseNumber: "02D01-2611-JQ-001234", fileMethod: "efile" });
    assert.match(flags[0], /JQ, a child protection order case/);
    assert.match(online, /JQ cases \(requests for child protection orders\)/);
    ({ flags } = await flagsAndSteps("appearance", { caseNumber: "02D01-2611-PO-001234", acp: "yes", acpAddress: "PO Box 1, Indianapolis, IN 46204" }));
    assert.match(flags[0], /^email\|.*your email address and phone number out/);
  });
  test("the contact questions say so before anything is typed", async () => {
    await inject(p, "continuance", PO);
    for (const id of ["address", "email", "phone"]) {
      await p.evaluate(id => { cur = visible().findIndex(s => s.id === id); mode = "step"; returnToSummary = false; render(); }, id);
      assert.match(await p.textContent("#qneed"), /Your case type is PO.*Access to Court Records Rule 5 keeps this out of the public record/, id);
    }
  });
  test("edge: other case types are as before", async () => {
    const { flags, online } = await flagsAndSteps("continuance", { ...PO, caseNumber: "02D01-2611-CC-001234" });
    assert.deepEqual(flags, []);
    assert.match(online, /efile\.incourts\.gov/);
    await p.evaluate(() => { cur = visible().findIndex(s => s.id === "address"); mode = "step"; render(); });
    assert.doesNotMatch(await p.textContent("#qneed"), /case type/);
  });
});
