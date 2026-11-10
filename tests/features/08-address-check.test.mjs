// Feature 8: addresses are checked for missing parts and typos, on this device only.
// (It can't tell whether an address really exists: it never looks anything up.)
import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fresh, close, inject, flagsFor } from "../lib.mjs";

let p;
before(async () => { p = await fresh(); });
after(close);
const addressFlags = async (address, id = "address") => { await inject(p, "appearance", id === "address" ? { address } : { [id]: address }); return flagsFor(p, id); };
const missing = async (address, part) => assert.match((await addressFlags(address))[0] || "", new RegExp(`may be missing the ${part}\\b`), address);

describe("8. Address check", () => {
  test("a complete address gets no flag", async () => {
    assert.deepEqual(await addressFlags("1 Main St, Fort Wayne, IN 46802"), []);
  });
  test("a missing city is flagged, with an example of a full address", async () => {
    await missing("1 Main St, IN 46802", "city");
    assert.match((await addressFlags("1 Main St, IN 46802"))[0], /A full address looks like 123 Main St, Indianapolis, IN 46204/);
  });
  test("a missing house number is flagged", async () => { await missing("Main St, Fort Wayne, IN 46802", "street number"); });
  test("a missing ZIP code is flagged", async () => { await missing("1 Main St, Fort Wayne, IN", "ZIP code"); });
  test("a missing state is flagged", async () => { await missing("1 Main St, Fort Wayne 46802", "state"); });
  test("edge: Apt with no number is flagged as a missing unit number, and Apt 4 isn't", async () => {
    await missing("1 Main St Apt, Fort Wayne, IN 46802", "unit number");
    assert.deepEqual(await addressFlags("1 Main St Apt 4, Fort Wayne, IN 46802"), []);
  });
  test("edge: a ZIP code from another state is pointed out", async () => {
    assert.match((await addressFlags("1 Main St, Fort Wayne, IN 90210"))[0], /ZIP code doesn't usually go with that state/);
  });
  test("edge: a ZIP code with the wrong number of digits is explained", async () => {
    assert.match((await addressFlags("1 Main St, Fort Wayne, IN 4680"))[0], /should have 5 digits/);
  });
  test("edge: PO boxes, rural roads, military addresses, ZIP+4 and No fixed address aren't flagged", async () => {
    for (const a of ["PO Box 12, Fort Wayne, IN 46802", "8901 N 300 W, Fort Wayne, IN 46818", "Unit 2050 Box 4190, APO, AP 96278", "123 Main St, Fort Wayne, IN 46802-1234", "No fixed address"])
      assert.deepEqual(await addressFlags(a), [], a);
  });
  test("edge: the other person's address on the Certificate of Service is checked too, and no address is ever sent over the network", async () => {
    const sent = [];
    p.on("request", r => sent.push(r.url() + " " + (r.postData() || "")));
    const f = await addressFlags("2 Oak St, IN 46802", "svc1Address");
    assert.match(f[0], /^check\|Certificate of Service: Their address \(person 1\)\|.*missing the city/);
    await p.waitForTimeout(500);
    assert.ok(!sent.some(x => /Oak|Main|46802/.test(decodeURIComponent(x))), sent.join("\n"));
    p.removeAllListeners("request");
  });
});
