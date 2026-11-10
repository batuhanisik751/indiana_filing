// The checks behind the summary's flags, called directly on the real page.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fresh, close } from "./lib.mjs";

let p;
before(async () => { p = await fresh(); });
after(close);
const call = (fn, ...args) => p.evaluate(([fn, args]) => JSON.parse(JSON.stringify(globalThis.eval(fn)(...args) ?? null)), [fn, args]);

test("amounts: a comma or space only counts where it groups thousands", async () => {
  for (const v of ["1200", "1,200", "$1,200.50", "1,200,000", "12.50", "$12", ".50", "12.", "0"]) assert.equal(await call("v => validNum({ type: 'money' }, v)", v), true, v);
  for (const v of ["12,50", "12 50", "500 300", "1 200", "0,500", "1,2", ",500", "1200,", "1.200,50", "1$2"]) assert.equal(await call("v => validNum({ type: 'money' }, v)", v), false, v);
  assert.equal(await call("toNum", "1,200"), 1200);
  assert.equal(await call("toNum", ".50"), 0.5);
  assert.equal(await call("toNum", "12,50"), 0);
});

test("email: likely typos name the fix", async () => {
  for (const [v, want] of [["gmial.com", "gmail.com"], ["gmai.com", "gmail.com"], ["gamil.com", "gmail.com"], ["gnail.com", "gmail.com"], ["gmail.con", "gmail.com"], ["gmail.co", "gmail.com"],
    ["yaho.com", "yahoo.com"], ["hotmial.com", "hotmail.com"], ["outlok.com", "outlook.com"], ["icoud.com", "icloud.com"], ["comcast.ne", "comcast.net"], ["att.con", "att.net"],
    ["acme.con", "acme.com"], ["gmail.com.com", "gmail.com"], ["www.gmail.com", "gmail.com"], ["gmail.come", "gmail.com"], ["hot-mail.com", "hotmail.com"]]) {
    const r = await call("emailShape", `pat@${v}`);
    assert.deepEqual([r.kind, r.target], ["typo", want], v);
  }
});

test("email: real addresses get no alarm", async () => {
  for (const d of ["gmail.com", "ymail.com", "mail.com", "hotmail.ca", "yahoo.co.uk", "comcast.com", "verizon.com", "att.net", "pcloud.com", "wahoo.com", "chapter.net", "carter.net",
    "acme.co", "iu.edu", "in.gov", "münchen.de", "indy.rr.com", "proton.me"]) assert.equal((await call("emailShape", `pat@${d}`)).kind, "", d);
  for (const v of ["first.last+tag@gmail.com", "o'brien@gmail.com", "PAT@GMAIL.COM"]) assert.equal((await call("emailShape", v)).kind, "", v);
});

test("email: other shapes get the right message", async () => {
  for (const [v, kind] of [["patgmail.com", "noat"], ["pat@gmail", "noend"], ["pat @gmail.com", "space"], ["a@b.co, c@d.co", "two"], ["I don't have one", "noemail"], ["pat at gmail dot com", "spelled"], ["pat@gmail.com,", "extra"]])
    assert.equal((await call("emailShape", v)).kind, kind, v);
});

test("phone: good numbers pass, bad ones say why", async () => {
  for (const v of ["317-555-0100", "(317) 555-0100", "3175550100", "+1 317 555 0100", "317-555-0100 ext 12", "Cell # 317-555-0100", "Cell 2: 317-555-0100"]) assert.equal(await call("phoneShape", v), "", v);
  for (const [v, kind] of [["555-0100", "short"], ["017-555-0100", "impossible"], ["1-800-FLOWERS", "letters"], ["+44 20 7946 0958", "foreign"]]) assert.equal(await call("phoneShape", v), kind, v);
});

test("address: complete ones pass, gaps are named", async () => {
  for (const v of ["123 Main St, Indianapolis, IN 46204", "123 Main St\nIndianapolis, IN 46204", "PO Box 9, Indianapolis, IN 46206", "123 Main St, Apt 4 Indianapolis, IN 46204", "8901 N 300 W, Anderson, IN 46040", "RR 2 Box 15, Salem, IN 47167"])
    assert.deepEqual((await call("addressGaps", v)).missing, [], v);
  for (const [v, gap] of [["123 Main St, IN 46204", "city"], ["Main St, Indianapolis, IN 46204", "street number"], ["123 Main St, Indianapolis, IN", "ZIP code"], ["PO Box, Muncie, IN 47308", "box number"], ["123 Main St Apt, Indianapolis, IN 46204", "unit number"]])
    assert.ok((await call("addressGaps", v)).missing.includes(gap), `${v}: ${gap}`);
});

test("private numbers: caught, and ordinary numbers left alone", async () => {
  for (const [v, kind] of [["My SSN is 123-45-6789", "ssn"], ["SSN 123456789", "ssn"], ["Account number 1234567890", "account"], ["Card 4111 1111 1111 1111", "account"], ["PIN 1234", "pin"], ["password: hunter2", "pin"]])
    assert.equal(await call("privateKind", v), kind, v);
  for (const v of ["Case 49D01-2610-CC-001234", "Call 317-555-0100", "I paid $1,200 on 3/15/2024", "ZIP 46204-1234", "Paragraphs 1 through 12"]) assert.equal(await call("privateKind", v), null, v);
});

test("paragraph lists: numbers and catch-alls count, sentences don't", async () => {
  for (const [v, n] of [["1-3, 7", 4], ["1 through 5", 5], ["1 up to 5", 5], ["$500", 0], ["3/15/2024", 0], ["All except 3", 0]]) assert.equal((await call("v => [...paragraphNumbers(v)].length", v)), n, v);
  for (const v of ["1, 2", "All of them", "the rest", "one and two", "I deny all allegations"]) assert.equal(await call("namesParagraphs", v), true, v);
  for (const v of ["The other side is lying", "I paid this in 2019", "see attached", "x"]) assert.equal(await call("namesParagraphs", v), false, v);
});

test("case numbers: Indiana's shape, including F1 to F6", async () => {
  for (const v of ["49D01-2610-CC-001234", "02D01-2611-F3-001234"]) assert.ok(await call("caseMatch", v), v);
  for (const v of ["49D01-2610-CC-12", "CC-001234", ""]) assert.equal(await call("caseMatch", v), null, v);
});

test("no check freezes on long or odd text", async () => {
  const slow = await p.evaluate(() => {
    const fns = { phoneShape, addressGaps, privateKind, paragraphNumbers, namesParagraphs, emailShape, notAmounts, cleanText, looksLikeDate };
    const inputs = ["-".repeat(19999) + "1", "1,".repeat(10000), "a ".repeat(10000), "@".repeat(20000), "a@" + "b.".repeat(9999), "x1".repeat(10000), "\n".repeat(20000), "1-".repeat(10000), "page ".repeat(4000)];
    const out = [];
    for (const [name, fn] of Object.entries(fns)) for (const v of inputs) { const t0 = performance.now(); fn(v); const ms = performance.now() - t0; if (ms > 250) out.push(`${name} on ${JSON.stringify(v.slice(0, 8))}: ${Math.round(ms)} ms`); }
    return out;
  });
  assert.deepEqual(slow, []);
});
