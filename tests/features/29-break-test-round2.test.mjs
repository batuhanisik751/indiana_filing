// Fixes from the second break-test, of the features added after looking at other teams' projects (BT23 on).
import { describe, test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { fresh, close, inject, editAnswer, settle } from "../lib.mjs";

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
      await settle(p); // and still in sight a frame later (BT59)
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

describe("BT28: no flag repeats private information typed into a box", () => {
  test("the street-address flag names only how the address starts", async () => {
    await inject(p, "appearance", { address: "None, my password is sunshine", receiveAt: "Choice1", acp: "no" });
    const t = await p.$eval('ul.flags li:has(.ftitle:text-is("Where you want court papers"))', li => li.textContent);
    assert.match(t, /street address, but your address starts with "None"\./);
    assert.doesNotMatch(t, /sunshine/);
  });
  test("edge: an address that isn't private is still quoted whole", async () => {
    await inject(p, "appearance", { address: "No fixed address", receiveAt: "Choice1", acp: "no" });
    assert.match(await p.$eval('ul.flags li:has(.ftitle:text-is("Where you want court papers"))', li => li.textContent), /you typed "No fixed address" as your address\./);
  });
  test("the paragraph checks wait while a list has a private number, and come back once it's out", async () => {
    await inject(p, "respond", { admitted: "1-3, 5", denied: "4, 5, my SSN 123-45-6789", notEnough: "" });
    const titles = () => p.evaluate(() => runChecks().map(f => f.title));
    assert.ok((await titles()).includes("Private information: Paragraphs you deny"));
    assert.ok(!(await titles()).some(t => /^Paragraphs (?:listed|not)/.test(t)));
    await inject(p, "respond", { admitted: "1-3, 5", denied: "4, 5", notEnough: "" });
    assert.ok((await titles()).includes("Paragraphs listed in more than one list"));
  });
  test("edge: in every box of every form at once, no flag repeats a password or a Social Security number", async () => {
    for (const form of ["respond", "appearance", "continuance", "feewaiver"])
      for (const typed of ["None, my password is sunshine", "None, my SSN is 123-45-6789"]) {
        const boxes = await p.evaluate(f => SITUATIONS[f].steps().filter(s => ["text", "textarea", "email", "tel", "money"].includes(s.type)).map(s => s.id), form);
        await inject(p, form, { ...Object.fromEntries(boxes.map(id => [id, typed])), receiveAt: "Choice1", acp: "no" });
        const said = await p.evaluate(() => runChecks().map(f => `${f.title} ${f.why}`).join("\n"));
        assert.doesNotMatch(said, /sunshine|6789/, `${form}: ${typed}`);
      }
  });
});

describe("BT29: \"How this tool checks your answers\" says only what the checks do", () => {
  const FORMS = ["respond", "appearance", "continuance", "feewaiver"];
  const line = title => p.$eval(`ul.howchecks li:has(strong:text-is("${title}."))`, li => li.textContent);
  const titles = () => p.evaluate(() => runChecks().map(f => f.title));
  test("Dates names only the dates the form asks for", async () => {
    for (const form of FORMS) {
      await inject(p, form);
      const has = await p.evaluate(f => { const ids = SITUATIONS[f].steps().map(s => s.id); return { conversation: ids.includes("spokeDate"), "hearing date": ids.includes("hearingDate"), "court date": ids.includes("courtDate"), service: ids.some(id => /^svc\dDate$/.test(id)) }; }, form);
      const says = await line("Dates");
      for (const [words, asked] of Object.entries(has)) assert.equal(says.includes(words), asked, `${form}: ${words}`);
    }
  });
  test("a conversation date in the future is in the continuance's Dates, and it is flagged", async () => {
    const d = new Date(); d.setDate(d.getDate() + 10);
    await inject(p, "continuance", { spokeDate: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` });
    assert.match(await line("Dates"), /a conversation date in the future/);
    assert.ok((await titles()).includes("Date you spoke to the other party"));
  });
  test("where court papers go: each example the line gives is flagged", async () => {
    await inject(p, "respond");
    assert.match(await line("Where court papers go"), /email chosen with no email address, the street address chosen with an address like "None," or the Attorney General confidential address/);
    for (const over of [{ receiveAt: "Choice2", email: "" }, { receiveAt: "Choice1", address: "None", acp: "no" }, { receiveAt: "Choice3", acp: "no" }]) {
      await inject(p, "respond", over);
      assert.ok((await titles()).includes("Where you want court papers"), JSON.stringify(over));
    }
  });
  test("the fee waiver, which doesn't ask where papers go, has its own line, and its example is flagged", async () => {
    await inject(p, "feewaiver");
    assert.equal(await p.$("ul.howchecks li:has(strong:text-is('Where court papers go.'))"), null);
    assert.doesNotMatch(await line("Confidential address"), /email/);
    await inject(p, "feewaiver", { agConfidential: "yes", related: "no" });
    assert.ok((await titles()).includes("Attorney General confidential address"));
  });
  test("the Notice of Claim check is in the case number line, and it is flagged as the line says", async () => {
    for (const form of ["respond", "appearance", "continuance"]) { await inject(p, form); assert.match(await line("Case number"), /If you said your main paper is a Notice of Claim, also that the case type is small claims \(SC\) or eviction \(EV\)/, form); }
    await inject(p, "appearance", { caseNumber: "02D01-2611-CC-001234" });
    const noc = () => p.evaluate(() => { globalThis.eval("fromTriage = true; triage = { paper: 'notice' };"); return runChecks().some(f => /Notice of Claim/.test(f.why)); });
    assert.equal(await noc(), true);
    await inject(p, "appearance", { caseNumber: "02D01-2611-SC-001234" });
    assert.equal(await noc(), false);
  });
});

describe("BT30: on the narrowest phones, bigger text doesn't make the header taller", () => {
  const size = n => p.evaluate(n => { look.size = n; applyDisplay(); }, n);
  const header = () => p.evaluate(() => Math.round(document.querySelector("header.top").getBoundingClientRect().height));
  const heights = async () => { const h = []; for (const n of [0, 1, 2, 3]) { await size(n); h.push(await header()); } await size(0); return h; };
  after(async () => { await size(0); await p.setViewportSize({ width: 1000, height: 900 }); });
  test("320 to 339px wide: the same height at every text size", async () => {
    await p.goto(p.url().split("#")[0]); await p.waitForSelector("#app h1");
    for (const w of [320, 339]) {
      await p.setViewportSize({ width: w, height: 700 });
      const h = await heights();
      assert.ok(h.every(x => x === h[0]), `${w}px: ${h.join(", ")}`);
    }
  });
  test("340px and wider: it grows no more than one row, as at 360px", async () => {
    for (const w of [340, 360, 390]) {
      await p.setViewportSize({ width: w, height: 700 });
      const h = await heights();
      assert.ok(Math.max(...h) - h[0] <= 60, `${w}px: ${h.join(", ")}`);
    }
  });
  test("edge: the side gutters stay the usual size, and the text inside still grows", async () => {
    await p.setViewportSize({ width: 375, height: 700 });
    const at = async n => { await size(n); return p.evaluate(() => [getComputedStyle(document.querySelector(".wrap")).paddingLeft, parseFloat(getComputedStyle(document.querySelector("#app h1")).fontSize)]); };
    const [usual, big] = [await at(0), await at(3)];
    assert.equal(big[0], usual[0]);
    assert.ok(big[1] > usual[1] * 1.4, `${usual[1]} to ${big[1]}`);
    await size(0);
  });
});
