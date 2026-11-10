// Feature 7: an email that can't work (like "@northeastern.") is stopped on the question itself, a likely typo like gmial.com
// is flagged at the end (it may be right), a blank email is flagged because the form requires one, and someone with no email can say so.
import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fresh, close, reset, pick, walk, jump, inject, flagsFor, fieldRows, step } from "../lib.mjs";

let p;
before(async () => { p = await fresh(); });
after(close);
const typeEmail = async (value, key = "click") => { await p.fill("#ans", value); if (key === "Enter") await p.press("#ans", "Enter"); else await p.click("#next"); };
const emailFlags = async (email, form = "appearance", more = {}) => { await inject(p, form, { email, ...more }); return flagsFor(p, "email"); };

describe("7. Email check", () => {
  test("gmial.com is caught as a likely typo for gmail.com, and Fix opens the email question", async () => {
    const f = await emailFlags("pat@gmial.com");
    assert.equal(f.length, 1); assert.match(f[0], /^check\|Email\|The end of this email, gmial\.com, may be a typo for gmail\.com/);
    await p.click('ul.flags [data-fix="email"]');
    assert.equal(await step(p), "email");
  });
  test("a blank email is flagged Missing, citing the form and Trial Rule 11.1", async () => {
    const [f] = await emailFlags("");
    assert.match(f, /^missing\|Email\|The official form says an email address is required, and Trial Rule 11\.1/);
  });
  test("None is accepted from someone with no email", async () => {
    assert.deepEqual(await emailFlags("None"), []);
  });
  test("a correct email gets no flag", async () => {
    assert.deepEqual(await emailFlags("pat.example@gmail.com"), []);
  });
  test("the blank-email reason says what to type with no email", async () => {
    assert.match((await emailFlags(""))[0], /If you don't have one, type None\./);
  });
  test("edge: on the fee waiver, where email isn't required, it can be left blank", async () => {
    assert.deepEqual(await emailFlags("", "feewaiver"), []);
  });
  test("edge: words like \"no email\" print on the form, so it says to type None", async () => {
    assert.match((await emailFlags("I don't have email"))[0], /If you don't have an email address, type None\./);
  });
  test("edge: other look-alike domains are caught too", async () => {
    for (const [typed, meant] of [["yaho.com", "yahoo.com"], ["outlok.com", "outlook.com"], ["hotmial.com", "hotmail.com"]])
      assert.match((await emailFlags(`pat@${typed}`))[0], new RegExp(`may be a typo for ${meant.replace(".", "\\.")}`));
  });
  test("edge: a missing @, two addresses, or a missing .com are each explained", async () => {
    assert.match((await emailFlags("pat.example.com"))[0], /missing the @ sign/);
    assert.match((await emailFlags("a@b.com c@d.com"))[0], /more than one email address/);
    assert.match((await emailFlags("pat@example"))[0], /missing the end of the address/);
  });
  test("edge: a typo is only flagged: it prints exactly as typed, and if papers go by email it says what's at stake", async () => {
    await inject(p, "appearance", { email: "pat@gmial.com", receiveAt: "Choice2" });
    assert.equal((await fieldRows(p)).find(([, , s]) => s === "email")[1], "pat@gmial.com");
    assert.match((await flagsFor(p, "email"))[0], /a typo could mean you miss them/);
  });
  test("the case reported: \"@northeastern.\" is stopped on the email question, with the reason", async () => {
    await reset(p); await pick(p, "appearance"); await walk(p, "email");
    await typeEmail("@northeastern.");
    assert.equal(await step(p), "email", "it doesn't move on");
    assert.match(await p.textContent("#err"), /^This is missing the part before the @\. A full email looks like name@example\.com\. If you don't have an email address, type None\.$/);
    assert.equal(await p.getAttribute("#ans", "aria-invalid"), "true");
  });
  test("edge: every email that can't work is stopped, by Continue or by Enter", async () => {
    await inject(p, "appearance");
    const cant = ["@northeastern.", "@northeastern", "@", "northeastern.", "pat.example.com", "pat@", "pat@northeastern", "pat@northeastern.", "pat@northeastern.e",
      ".pat@northeastern.edu", "pat@@northeastern.edu", "pat@northeastern.edu c@d.com", "pat @northeastern.edu", "pat@northeastern,edu", "pat@northeastern.edu;", "pat at gmail dot com", "a".repeat(250) + "@x.com"];
    for (const [i, v] of cant.entries()) {
      await jump(p, "email"); await typeEmail(v, i % 2 ? "Enter" : "click");
      assert.equal(await step(p), "email", v);
      assert.notEqual(await p.textContent("#err"), "", v);
    }
  });
  test("edge: a likely typo, None and a blank box still go on to the next question", async () => {
    await inject(p, "appearance");
    for (const v of ["pat@gmial.com", "None", "n/a", "", "pat.o'brien+court@northeastern.edu"]) {
      await jump(p, "email"); await typeEmail(v);
      assert.equal(await step(p), "phone", JSON.stringify(v));
    }
  });
  test("edge: on the fee waiver, where email is optional, it says to leave the box blank instead", async () => {
    await reset(p); await pick(p, "feewaiver"); await walk(p, "email");
    await typeEmail("pat@");
    assert.equal(await step(p), "email");
    assert.match(await p.textContent("#err"), /missing the part after the @.*If you don't have an email address, leave this blank\.$/);
  });
  test("edge: an edit from the summary is stopped the same way, and Cancel keeps the address that was there", async () => {
    await inject(p, "appearance");
    await p.click('dl.vals [data-fix="email"]'); await typeEmail("@northeastern.");
    assert.equal(await step(p), "email");
    await p.click("#back");
    assert.equal(await p.evaluate(() => answers.email), "pat@example.com");
  });
  test("edge: an e-filing Certificate of Service email that can't work is flagged too", async () => {
    await inject(p, "appearance", { fileMethod: "efile", svc1Method: "Indiana E-Filing System", svc1Address: "@northeastern." });
    assert.ok((await flagsFor(p, "svc1Address")).some(f => /missing the part before the @.*E-Filing System/.test(f)));
  });
});
