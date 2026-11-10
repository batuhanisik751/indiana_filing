// Feature 14: before filing, the summary flags what's missing (signature, county, case number, certificate of service,
// attachments) and says why each one matters.
import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fresh, close, inject, flagsFor, fieldRows } from "../lib.mjs";

let p;
before(async () => { p = await fresh(); });
after(close);
const status = () => p.textContent(".status strong");
const pdfDone = () => p.waitForFunction(() => pdfState.result && pdfState.key === pdfKey() && !pdfState.busy, null, { timeout: 120000 });

describe("14. Final check", () => {
  test("with every answer in place, it says there's nothing to review", async () => {
    await inject(p, "appearance"); await pdfDone();
    await p.waitForFunction(() => /Nothing to review/.test(document.querySelector(".status strong").textContent));
    assert.equal(await status(), "Nothing to review.");
  });
  test("a blank county is Missing, and says why the top of the form matters", async () => {
    await inject(p, "appearance", { county: "" });
    assert.match((await flagsFor(p, "county"))[0], /^missing\|County\|The official form says to fill out its top section to match the other court forms/);
  });
  test("a blank case number is Missing on the Appearance, but not on the continuance, where court staff fill it in", async () => {
    await inject(p, "appearance", { caseNumber: "" });
    assert.match((await flagsFor(p, "caseNumber"))[0], /^missing\|Case number/);
    await inject(p, "continuance", { caseNumber: "" });
    assert.deepEqual(await flagsFor(p, "caseNumber"), []);
  });
  test("each blank part of the Certificate of Service is Missing, citing Trial Rule 5", async () => {
    await inject(p, "appearance", { svc1Name: "", svc1Method: "", svc1Date: "" });
    for (const id of ["svc1Name", "svc1Method", "svc1Date"]) assert.match((await flagsFor(p, id))[0], /^missing\|Certificate of Service: .*\|Trial Rule 5 says/, id);
  });
  test("a blank signing date is Missing, because it prints next to the signature", async () => {
    await inject(p, "appearance", { signDate: "" });
    assert.match((await flagsFor(p, "signDate"))[0], /^missing\|.*\|The official form prints this date next to your signature\./);
  });
  test("edge: e-filing signs as /s/ and the name; filing on paper leaves the lines to sign by hand", async () => {
    await inject(p, "appearance", { fileMethod: "efile" });
    assert.equal((await fieldRows(p)).find(([l]) => /^Signature/.test(l))[1], "/s/ Pat Example");
    await inject(p, "appearance", { fileMethod: "paper" });
    assert.equal((await fieldRows(p)).find(([l]) => /^Signature/.test(l))[1], "Left blank. Sign by hand after you print.");
  });
  test("edge: an answer too long for its space goes on an attached page, and that's flagged", async () => {
    await inject(p, "respond", { defenses: "I paid this debt in full and have the receipts to show it. ".repeat(80) });
    await pdfDone();
    assert.match((await p.evaluate(() => pdfFlags().filter(f => f.fix === "defenses").map(f => f.why)))[0] || "", /continues on a page added at the end of the/);
  });
  test("edge: every flag says why, for many kinds of gaps on each form", async () => {
    const blanks = { appearance: ["county", "name", "address", "email", "phone", "receiveAt", "svc1Name", "signDate"], respond: ["plaintiff", "admitted", "denied", "defenses", "signDate"],
      continuance: ["otherParty", "hearingDate", "reason", "timeNeeded", "svc1Address"], feewaiver: ["name", "hourlyRate", "monthlyHours", "bank"] };
    for (const [form, ids] of Object.entries(blanks)) {
      await inject(p, form, Object.fromEntries(ids.map(id => [id, ""])), { [ids[0]]: true });
      const weak = await p.evaluate(() => runChecks().filter(f => !f.why || f.why.trim().length < 20).map(f => f.title));
      assert.deepEqual(weak, [], form);
    }
  });
  test("edge: flags don't block the download: the filled PDF can still be saved", async () => {
    await inject(p, "appearance", { county: "", phone: "" }); await pdfDone();
    assert.match(await status(), /items? to review before filing/);
    assert.equal(await p.locator("#dlAll").isEnabled(), true);
  });
  test("edge: an Answer with no paragraph numbers in any list is Missing, saying the court takes skipped parts as true", async () => {
    await inject(p, "respond", { admitted: "", denied: "", notEnough: "" });
    assert.ok((await p.evaluate(() => runChecks().map(f => `${f.level}|${f.title}|${f.why}`))).some(f => /^missing\|Your answer\|.*the court will take it as true/.test(f)));
  });
});
