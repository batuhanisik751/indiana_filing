// Break-test round 4 (BT50-BT110, TG11-TG20): problems seven independent testers found across the whole app, fixed most
// important first. BT50's tests are in ../loading.test.mjs.
import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fresh, close, inject } from "../lib.mjs";

let p;
before(async () => { p = await fresh(); });
after(close);
const listFlags = async (admitted, denied, notEnough = "") => { await inject(p, "respond", { admitted, denied, notEnough }); return p.evaluate(() => runChecks().filter(f => ["admitted", "denied", "notEnough"].includes(f.fix)).map(f => `${f.level}|${f.title}`)); };
const MISSING = "missing|Your answer";

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
