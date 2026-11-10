// Feature 9: the phone number is required and checked, and the case number is checked against Indiana's format.
import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fresh, close, inject, flagsFor, fieldRows } from "../lib.mjs";

let p;
before(async () => { p = await fresh(); });
after(close);
const flagsWith = async (id, value, more = {}) => { await inject(p, "appearance", { [id]: value, ...more }); return flagsFor(p, id); };

describe("9. Phone and case number check", () => {
  test("a full phone number gets no flag, written any usual way", async () => {
    for (const v of ["260-555-0100", "(260) 555-0100", "1-260-555-0100", "260-555-0100 ext 12", "Cell # 260-555-0100"]) assert.deepEqual(await flagsWith("phone", v), [], v);
  });
  test("a blank phone is Missing, because the Appearance requires one", async () => {
    assert.match((await flagsWith("phone", ""))[0], /^missing\|Phone number\|The official form says a phone number is required/);
  });
  test("None is accepted from someone with no phone", async () => {
    assert.deepEqual(await flagsWith("phone", "None"), []);
  });
  test("a number without its area code is flagged", async () => {
    assert.match((await flagsWith("phone", "555-0100"))[0], /10-digit phone number, including the area code/);
  });
  test("a correct case number gets no flag", async () => {
    assert.deepEqual(await flagsWith("caseNumber", "02D01-2611-CC-001234"), []);
  });
  test("edge: impossible numbers, letters and numbers outside the U.S. are each explained", async () => {
    assert.match((await flagsWith("phone", "000-555-0100"))[0], /doesn't look like a real U\.S\. phone number/);
    assert.match((await flagsWith("phone", "260-555-CALL"))[0], /has letters in it/);
    assert.match((await flagsWith("phone", "+44 20 7946 0958"))[0], /outside the U\.S\./);
  });
  test("edge: the fax number is checked the same way", async () => {
    assert.match((await flagsWith("fax", "555"))[0], /^check\|Fax number\|.*full fax number/);
  });
  test("edge: a case number that isn't Indiana's format is flagged, with an example", async () => {
    assert.match((await flagsWith("caseNumber", "12345"))[0], /doesn't look like an Indiana case number \(for example 49D01-2610-CC-001234\)/);
  });
  test("edge: a case number from another county, or for the other court, is pointed out", async () => {
    assert.match((await flagsWith("caseNumber", "02D01-2611-CC-001234", { county: "Marion" }))[0], /first two digits \(02\) don't match Marion County's number \(49\)/);
    assert.match((await flagsWith("caseNumber", "02C01-2611-CC-001234", { courtType: "SUPERIOR" }))[0], /"C" in your case number means Circuit Court, but you chose Superior Court/);
  });
  test("edge: a valid case number fills in the case type letters, and an unknown case type is flagged", async () => {
    await inject(p, "appearance");
    assert.equal((await fieldRows(p)).find(([l]) => l === "5. Case type letters")[1], "CC");
    assert.ok((await flagsWith("caseNumber", "02D01-2611-ZZ-001234")).some(f => /ZZ isn't one of the case type codes in Administrative Rule 8/.test(f)));
  });
});
