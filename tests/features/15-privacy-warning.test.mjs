// Feature 15: private numbers (Social Security, account or card numbers, PINs and passwords) typed into any box are flagged,
// citing Access to Court Records Rule 5.
import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fresh, close, inject, flagsFor, fieldRows } from "../lib.mjs";

let p;
before(async () => { p = await fresh(); });
after(close);
const privateFlags = async (id, value, form = "respond") => { await inject(p, form, { [id]: value }); return (await flagsFor(p, id)).filter(f => /\|Private information: /.test(f)); };

describe("15. Privacy warning", () => {
  test("a Social Security number is flagged, with a link to Rule 5", async () => {
    const f = await privateFlags("defenses", "My SSN is 123-45-6789 and I paid.");
    assert.match(f[0], /^check\|Private information: Your defenses\|This may be a complete Social Security number\./);
    assert.equal(await p.locator('ul.flags a[href*="rules.incourts.gov/Content/records/rule5"]').count(), 1);
  });
  test("the warning doesn't repeat the number itself", async () => {
    const f = await privateFlags("defenses", "My SSN is 123-45-6789 and I paid.");
    assert.doesNotMatch(f[0], /6789/);
    assert.doesNotMatch(await p.textContent("ul.flags"), /123-45-6789/);
  });
  test("an account number is flagged", async () => {
    assert.match((await privateFlags("defenses", "I paid from account number 12345678."))[0], /complete account or card number/);
  });
  test("a card number, a PIN and a password are flagged", async () => {
    assert.match((await privateFlags("defenses", "Card 4111 1111 1111 1111"))[0], /account or card number/);
    assert.match((await privateFlags("defenses", "my PIN is 1234"))[0], /PIN or password/);
    assert.match((await privateFlags("defenses", "password: hunter2"))[0], /PIN or password/);
  });
  test("the warning says what the rule asks for if the case does need the number", async () => {
    assert.match((await privateFlags("defenses", "SSN 123-45-6789"))[0], /green paper .* ACR Form/);
  });
  test("edge: it's caught in an email or address box too", async () => {
    assert.equal((await privateFlags("email", "pat123456789@gmail.com", "appearance")).length, 1);
    assert.equal((await privateFlags("address", "1 Main St, Fort Wayne, IN 46802, SSN 123-45-6789", "appearance")).length, 1);
  });
  test("edge: case numbers and phone numbers aren't taken for private numbers", async () => {
    await inject(p, "appearance", { caseNumber: "02D01-2611-CC-001234", phone: "260-555-0100", related: "yes", relatedNumbers: "49D01-2401-PL-012345" });
    assert.deepEqual(await p.evaluate(() => runChecks().filter(f => /^Private information/.test(f.title)).map(f => f.title)), []);
  });
  test("edge: ZIP+4 codes, dates and amounts aren't flagged", async () => {
    assert.deepEqual(await privateFlags("address", "1 Main St, Fort Wayne, IN 46802-1234", "appearance"), []);
    assert.deepEqual(await privateFlags("defenses", "I paid $1,234.56 on 01/15/2026, and $12,345,678 is not what I owe."), []);
  });
  test("edge: other ways of writing an SSN are caught, like dots or no dashes after SSN", async () => {
    assert.equal((await privateFlags("defenses", "123.45.6789")).length, 1);
    assert.equal((await privateFlags("defenses", "SSN 123456789")).length, 1);
  });
  test("edge: it's only a warning: the number prints until it's removed, and the warning goes once it is", async () => {
    const f = await privateFlags("defenses", "SSN 123-45-6789");
    assert.match(f[0], /It will print on the form until you remove it\./);
    assert.ok((await fieldRows(p)).some(([, v]) => v.includes("123-45-6789")));
    await p.click('dl.vals [data-fix="defenses"]'); await p.fill("#ans", "I paid this debt in full."); await p.click("#next");
    assert.deepEqual((await flagsFor(p, "defenses")).filter(f => /Private information/.test(f)), []);
  });
});
