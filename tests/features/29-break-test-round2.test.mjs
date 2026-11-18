// Fixes from the second break-test, of the features added after looking at other teams' projects (BT23 on).
import { describe, test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { fresh, close, inject, editAnswer } from "../lib.mjs";

let p;
before(async () => { p = await fresh(); });
after(close);
const marks = () => p.$$eval("dl.vals mark", m => m.map(x => x.textContent));
const selected = () => p.evaluate(() => { const el = document.getElementById("ans"); return el.value.slice(el.selectionStart, el.selectionEnd); });
// The privacy flag's Fix for one question (the one that knows the part it's about).
const fixPrivate = id => p.click(`ul.flags button[data-fix="${id}"][data-hit]`);
// What the privacy check picks out of one answer: what's marked, and what Fix selects.
async function part(form, id, value) {
  await inject(p, form, { [id]: value });
  const marked = await marks();
  await fixPrivate(id);
  return { marked, selected: await selected() };
}

describe("BT23: the part is only the private number, not the numbers next to it", () => {
  test("an amount before it, then a comma: Backspace leaves the amount", async () => {
    assert.deepEqual(await part("respond", "defenses", "I paid $500, 123-45-6789 is my SSN."), { marked: ["123-45-6789"], selected: "123-45-6789" });
    await p.keyboard.press("Backspace");
    assert.equal(await p.inputValue("#ans"), "I paid $500,  is my SSN.");
  });
  test("a number after it, after a comma", async () => {
    assert.deepEqual(await part("respond", "defenses", "My SSN is 123-45-6789, 2 kids live with me."), { marked: ["123-45-6789"], selected: "123-45-6789" });
  });
  test("a card number with its date and code after it: just the card number", async () => {
    assert.deepEqual(await part("respond", "defenses", "Card 4111 1111 1111 1111, 12/28, 123 was charged."), { marked: ["4111 1111 1111 1111"], selected: "4111 1111 1111 1111" });
  });
  test("in a case number box, the real case number before it is left out", async () => {
    assert.equal((await part("respond", "caseNumber", "02D01-2611-CC-001234 123-45-6789")).selected, "123-45-6789");
    assert.equal((await part("respond", "caseNumber", "02D01-2611-CC-001234 4111111111111111")).selected, "4111111111111111");
  });
  test("edge: with no comma, a Social Security number or PIN is still just its own digits", async () => {
    assert.equal((await part("respond", "defenses", "My SSN is 123-45-6789 2 kids live with me.")).selected, "123-45-6789");
    assert.equal((await part("respond", "defenses", "Before that 2 123-45-6789 was it.")).selected, "123-45-6789");
    assert.equal((await part("respond", "defenses", "My PIN 1234 5 times.")).selected, "1234");
  });
  test("edge: two card numbers with only a space between are both in the part, whole", async () => {
    assert.deepEqual(await part("respond", "defenses", "Cards 4111 1111 1111 1111 5500 0000 0000 0004 were charged."),
      { marked: ["4111 1111 1111 1111 5500 0000 0000 0004"], selected: "4111 1111 1111 1111 5500 0000 0000 0004" });
    await p.keyboard.press("Backspace"); await p.click("#next");
    assert.ok(!(await p.$$eval(".ftitle", t => t.map(x => x.textContent))).some(t => /^Private information/.test(t)), "both gone");
  });
  test("edge: a number written with spaces or dots is still kept whole", async () => {
    assert.equal((await part("respond", "defenses", "SSN: 123 45 6789, thanks")).selected, "123 45 6789");
    assert.equal((await part("respond", "defenses", "It is 123.45.6789.")).selected, "123.45.6789");
    assert.equal((await part("respond", "defenses", "account 1234 5678 9012, 3 times")).selected, "1234 5678 9012");
  });
});

describe("BT24: \"Show every answer\" marks the flagged part where it is, not every copy", () => {
  const shown = id => p.$eval(`dl.vals dd:has(mark)`, dd => dd.innerHTML);
  test("a PIN and the same digits in a street address: only the PIN", async () => {
    await inject(p, "respond", { defenses: "PIN 1234. I live at 1234 Main St." });
    assert.equal(await shown(), "PIN <mark>1234</mark>. I live at 1234 Main St.");
  });
  test("a year and the same digits as a PIN after it: only the PIN", async () => {
    await inject(p, "respond", { defenses: "In 2024 my pin was 2024." });
    assert.equal(await shown(), "In 2024 my pin was <mark>2024</mark>.");
    await p.click(`ul.flags button[data-fix="defenses"][data-hit]`);
    assert.deepEqual(await p.evaluate(() => [document.getElementById("ans").selectionStart, document.getElementById("ans").selectionEnd]), [19, 23]);
  });
  test("edge: a card number and a PIN that's part of it: two marks, neither inside the other", async () => {
    await inject(p, "respond", { defenses: "card 4111 1111 1111 1111 and PIN 1111" });
    assert.equal(await shown(), "card <mark>4111 1111 1111 1111</mark> and PIN <mark>1111</mark>");
    assert.equal(await p.$("dl.vals mark mark"), null);
  });
  test("edge: characters that need escaping are marked and shown as typed", async () => {
    await inject(p, "respond", { defenses: "<b>&</b> SSN 123-45-6789 & \"done\"" });
    assert.equal(await p.$eval("dl.vals dd:has(mark)", dd => dd.textContent), "<b>&</b> SSN 123-45-6789 & \"done\"");
    assert.deepEqual(await marks(), ["123-45-6789"]);
  });
});

describe("BT25: every password in an answer is part of it, not just the first", () => {
  test("two passwords: both marked, the first selected", async () => {
    assert.deepEqual(await part("respond", "defenses", "password: a1b2c3 and password: z9y8x7"), { marked: ["password: a1b2c3", "password: z9y8x7"], selected: "password: a1b2c3" });
  });
  test("edge: two ways of writing it, in the order they're in", async () => {
    assert.deepEqual((await part("respond", "defenses", "My old password is Hunter2!x. The new password: Abc123.")).marked, ["password is Hunter2!x.", "password: Abc123."]);
  });
});

describe("BT26: a number and a password in one answer are both part of it", () => {
  test("a Social Security number and a password: the number is selected, and both are marked", async () => {
    assert.deepEqual(await part("respond", "defenses", "My SSN is 123-45-6789 and the portal password: abc."), { marked: ["123-45-6789", "password: abc."], selected: "123-45-6789" });
  });
  test("edge: a password first, then a card number", async () => {
    assert.deepEqual(await part("respond", "defenses", "pw: x9 and card 4111 1111 1111 1111"), { marked: ["pw: x9", "4111 1111 1111 1111"], selected: "pw: x9" });
  });
  test("edge: a number that is the password is one part, with its label", async () => {
    assert.deepEqual(await part("respond", "defenses", "My password: 123456789 for the site."), { marked: ["password: 123456789"], selected: "password: 123456789" });
  });
  test("edge: a number that isn't private next to a password isn't part of it", async () => {
    assert.deepEqual((await part("respond", "defenses", "I paid $500 and my password: abc.")).marked, ["password: abc."]);
  });
});

describe("BT27: the selected part is in sight", () => {
  const SSN = "My SSN is 123-45-6789.";
  const lines = (n, at) => Array.from({ length: n }, (_, i) => (i === at ? SSN : `Line ${i + 1}.`)).join("\n");
  // Whether line i shows in the box. Lines this short don't wrap, so each takes the same share of the box's height.
  const lineShown = i => p.evaluate(([i]) => {
    const el = document.getElementById("ans"), cs = getComputedStyle(el), pad = parseFloat(cs.paddingTop);
    const lh = (el.scrollHeight - pad - parseFloat(cs.paddingBottom)) / el.value.split("\n").length, top = pad + i * lh;
    return top >= el.scrollTop - 1 && top + lh <= el.scrollTop + el.clientHeight + 1;
  }, [i]);
  const onScreen = () => p.evaluate(() => { const box = document.getElementById("ans").getBoundingClientRect(), note = document.getElementById("hitnote").getBoundingClientRect(); return box.top >= 0 && note.bottom <= window.innerHeight; });
  const size = n => p.evaluate(n => { look.size = n; applyDisplay(); }, n);
  const usual = async () => { await size(0); await p.setViewportSize({ width: 1000, height: 900 }); };
  beforeEach(usual); after(usual);

  test("at the end of a long answer: the box is scrolled to it", async () => {
    await inject(p, "respond", { defenses: lines(31, 30) });
    await fixPrivate("defenses");
    assert.equal(await selected(), "123-45-6789");
    assert.equal(await lineShown(30), true);
    assert.equal(await onScreen(), true);
  });
  test("in the middle of a long answer: the box is scrolled to it, not to the end", async () => {
    await inject(p, "respond", { defenses: lines(31, 15) });
    await fixPrivate("defenses");
    assert.equal(await lineShown(15), true);
    assert.equal(await lineShown(30), false);
  });
  test("on a phone, at the usual and the biggest text size: the page is moved so the box and the note show", async () => {
    await p.setViewportSize({ width: 375, height: 667 });
    for (const n of [0, 3]) {
      await size(n);
      await inject(p, "respond", { defenses: lines(31, 30) });
      await fixPrivate("defenses");
      assert.equal(await onScreen(), true, `size ${n}`);
      assert.equal(await lineShown(30), true, `size ${n}`);
    }
  });
  test("edge: with bigger text, Fix and Edit start a question past the header, as Continue does", async () => {
    await p.setViewportSize({ width: 375, height: 667 });
    await size(2);
    await inject(p, "respond", { defenses: "I paid this off." });
    await editAnswer(p, "defenses");
    assert.equal(await p.evaluate(() => Math.round(app.getBoundingClientRect().top)), 8);
  });
  test("edge: at the usual size a short answer moves nothing: the page stays at the top", async () => {
    await inject(p, "respond", { defenses: SSN });
    await fixPrivate("defenses");
    assert.equal(await p.evaluate(() => [window.scrollY, document.getElementById("ans").scrollTop].join()), "0,0");
    await inject(p, "respond", { defenses: "I paid this off." });
    await editAnswer(p, "defenses");
    assert.equal(await p.evaluate(() => window.scrollY), 0);
  });
});
