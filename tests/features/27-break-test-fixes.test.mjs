// Fixes from the break-test of the four features taken from other teams' projects (BT1 to BT22 on the Issue Map),
// one section per ticket, in the order they were fixed.
import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fresh, close, reset, pick, walk, inject, jump, site, flagsFor } from "../lib.mjs";

let p;
before(async () => { p = await fresh(); });
after(close);
// The words termify makes into buttons for a text, a form and answers, each with the text right after it.
const termsIn = (text, key, a = {}) => p.evaluate(([t, k, a]) => {
  const d = document.createElement("div"); d.innerHTML = termify(t, k, a);
  return [...d.querySelectorAll("button.term")].map(b => ({ word: b.textContent, after: (b.nextSibling?.textContent || "").slice(0, 14) }));
}, [text, key, a]);
const ALL = "plaintiff, defendant, Complaint, Answer, defenses, Appearance, continuance, related cases, Certificate of Service, perjury";

describe("BT1: \"Answer\" in a document's name isn't defined, and only words that fit the form are", () => {
  test("fee waiver: \"Answer instructions\" in the related-cases explanation is plain text", async () => {
    await reset(p); await pick(p, "feewaiver"); await walk(p, "related");
    const help = await p.evaluate(() => visible()[cur].help);
    assert.match(help, /Answer instructions/);
    assert.ok((await p.textContent("#qhelp")).startsWith(help), "the explanation reads the same");
    assert.deepEqual(await p.$$eval("#qhelp button.term", bs => bs.map(b => b.textContent)), ["related cases"]);
  });
  test("a word that names a guide isn't a button, and the same word later as the form is", async () => {
    assert.deepEqual(await termsIn("Indiana Legal Help's Answer instructions say the Answer is due.", "respond"), [{ word: "Answer", after: " is due." }]);
    assert.deepEqual(await termsIn("The continuance instructions say a continuance needs a reason.", "continuance"), [{ word: "continuance", after: " needs a reaso" }]);
    assert.deepEqual(await termsIn("See the Answer packet.", "respond"), []);
  });
  test("each form gets only the words whose definition fits it", async () => {
    const words = async (key, a) => (await termsIn(ALL, key, a)).map(t => t.word);
    assert.deepEqual(await words("respond"), ALL.split(", ").filter(w => w !== "continuance"));
    assert.deepEqual(await words("appearance"), ALL.split(", ").filter(w => w !== "defenses" && w !== "continuance"));
    assert.deepEqual(await words("feewaiver"), ["Appearance", "related cases", "perjury"]);
    // The continuance: "suing you" fits only someone the other side sued.
    assert.deepEqual(await words("continuance", { role: "other" }), ["plaintiff", "defendant", "Complaint", "Answer", "Appearance", "continuance", "related cases", "Certificate of Service", "perjury"]);
    assert.deepEqual(await words("continuance", { role: "me" }), ["defendant", "Appearance", "continuance", "related cases", "Certificate of Service", "perjury"]);
  });
  test("edge: on the continuance before \"Who started this case?\" is answered, the \"suing you\" words aren't defined", async () => {
    assert.deepEqual((await termsIn(ALL, "continuance", {})).map(t => t.word), ["defendant", "Appearance", "continuance", "related cases", "Certificate of Service", "perjury"]);
  });
  test("edge: across every question of the fee waiver and a continuance the person started, no word opens a definition that doesn't fit", async () => {
    const wrong = [];
    for (const [form, over] of [["feewaiver", { incomeKinds: "wages,other", expenseKinds: "housing,other", related: "yes", acp: "yes" }], ["continuance", { role: "me", related: "yes", acp: "yes" }]]) {
      await inject(p, form, over);
      for (const id of await p.evaluate(() => visible().map(s => s.id))) {
        await jump(p, id);
        await p.evaluate(() => { const m = document.querySelector('details[data-more^="q:"]'); if (m) m.open = true; });
        for (const t of await p.$$eval("button.term", bs => bs.map(b => GLOSSARY[+b.dataset.term].term)))
          if (await p.evaluate(t => !GLOSSARY.find(g => g.term === t).fits(sitKey, answers), t)) wrong.push(`${form} ${id}: ${t}`);
        if (form === "feewaiver") for (const t of await p.$$eval("button.term", bs => bs.map(b => b.textContent))) if (/^(?:plaintiff|complaint|answer|defenses?|certificate of service)$/i.test(t)) wrong.push(`${form} ${id}: ${t}`);
      }
    }
    assert.deepEqual(wrong, []);
  });
});

describe("BT10: the court date countdown keeps up with the day when the page stays open", () => {
  // A page in Indianapolis opened at 11:58 pm on December 17, with the court date the next day.
  async function nightBefore() {
    const q = await fresh({ timezoneId: "America/Indiana/Indianapolis" });
    await q.clock.install({ time: new Date("2026-12-18T04:58:00Z") });
    await q.reload(); await q.waitForSelector("#app h1");
    await inject(q, "respond", { courtDate: "2026-12-18" });
    await pdfDone(q); // so the PDF's own redraws can't be what updates the line
    return q;
  }
  const pdfDone = async q => { for (let i = 0; i < 200 && !(await q.evaluate(() => !!pdfState.result && !pdfState.busy)); i++) await new Promise(r => setTimeout(r, 100)); };
  const dateLine = q => q.$eval("[data-ics]", b => b.closest("li").querySelector(":scope > p").textContent).catch(() => null);
  const stepText = q => q.$$eval("ol.steps > li > p", ps => ps.map(x => x.textContent).find(t => /court date/.test(t)));

  test("left open past midnight, \"tomorrow\" becomes \"today\", with focus kept where it was", async () => {
    const q = await nightBefore();
    assert.match(await dateLine(q), /^Your next court date: 12\/18\/2026, tomorrow\./);
    await q.evaluate(() => document.querySelector("[data-ics]").closest("li").querySelector("details.more > summary").focus());
    await q.clock.fastForward("07:00");
    assert.match(await dateLine(q), /^Your next court date: 12\/18\/2026, today\./);
    assert.equal(await q.evaluate(() => document.activeElement.closest("li")?.querySelector("strong")?.textContent), "Go to every court date", "focus stays on that step's More");
    await q.context().close();
  });
  test("the day after, the date has passed: no countdown and no calendar file", async () => {
    const q = await nightBefore();
    await q.clock.fastForward("24:07:00");
    assert.equal(await q.$("[data-ics]"), null);
    assert.match(await stepText(q), /The court date you entered, 12\/18\/2026, has already passed\./);
    await q.context().close();
  });
  test("edge: a phone bringing the tab back the next morning redraws it as soon as it's shown", async () => {
    const q = await nightBefore();
    await q.clock.setFixedTime(new Date("2026-12-18T13:00:00Z")); // 8 am, with no timers run
    assert.match(await dateLine(q), /, tomorrow\./, "nothing has run yet");
    await q.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    assert.match(await dateLine(q), /, today\./);
    await q.context().close();
  });
  test("edge: on the same day it isn't redrawn, so nothing moves while someone reads", async () => {
    const q = await fresh({ timezoneId: "America/Indiana/Indianapolis" });
    await q.clock.install({ time: new Date("2026-12-17T17:00:00Z") }); // noon
    await q.reload(); await q.waitForSelector("#app h1");
    await inject(q, "respond", { courtDate: "2026-12-18" });
    await pdfDone(q);
    await q.evaluate(() => { window.__steps = document.querySelector("ol.steps"); });
    await q.clock.fastForward("10:00");
    await q.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    assert.equal(await q.evaluate(() => window.__steps.isConnected), true);
    await q.context().close();
  });
});

describe("BT2: Get help's word list has the words that fit the form being filled", () => {
  const listed = async () => { await p.click("#helpBtn"); return p.$$eval("#helpWords dt", d => d.map(x => x.textContent)); };
  const note = () => p.textContent("#helpWords p.need");
  test("a continuance the person started: no \"suing you\" words", async () => {
    await inject(p, "continuance", { role: "me" });
    assert.deepEqual(await listed(), ["Defendant", "Appearance", "Continuance", "Related cases", "Certificate of Service", "Perjury"]);
    assert.match(await note(), /These are the ones that fit your form\.$/);
  });
  test("the fee waiver: no Plaintiff, Complaint, Answer, Defenses or Certificate of Service", async () => {
    await inject(p, "feewaiver");
    assert.deepEqual(await listed(), ["Appearance", "Related cases", "Perjury"]);
  });
  test("the Appearance and Answer: everything but Continuance", async () => {
    await inject(p, "respond");
    assert.deepEqual(await listed(), ["Plaintiff", "Defendant", "Complaint", "Answer", "Defenses", "Appearance", "Related cases", "Certificate of Service", "Perjury"]);
  });
  test("edge: before a form is chosen, every word, saying some are written for the person being sued", async () => {
    await reset(p);
    assert.equal((await listed()).length, 10);
    assert.match(await note(), /Some are written for the person being sued, like the instructions they come from\.$/);
  });
  test("edge: changing who started the case changes the list the next time Get help opens", async () => {
    await inject(p, "continuance", { role: "other" });
    assert.ok((await listed()).includes("Plaintiff"));
    await p.click("#helpClose");
    await p.evaluate(() => { answers.role = "me"; render(); });
    assert.ok(!(await listed()).includes("Plaintiff"));
    assert.equal(await p.$$eval("#helpWords a", a => a.every(x => x.target === "_blank" && /opens in a new tab/.test(x.textContent))), true);
  });
});

describe("BT3: the ready lists include what each form goes on to ask", () => {
  const whats = async form => { await reset(p); await pick(p, form); return p.$$eval("details.ready li strong", s => s.map(x => x.textContent)); };
  test("the Answer: your defenses, which the instructions say you may lose if you don't list them now", async () => {
    const w = await whats("respond");
    assert.ok(w.includes("Your defenses, if you have any."), w.join(" | "));
    assert.match(await p.textContent("details.ready"), /if you do not list them now, you may lose your right to use them later in the case\./);
  });
  test("the continuance: how much time, and talking to the other party first", async () => {
    const w = await whats("continuance");
    assert.ok(w.includes("How many days or weeks you need before a new court date."));
    assert.ok(w.includes("When you talked to the other party about asking for a new date, and whether they agreed."));
    assert.deepEqual(await p.$$eval("details.ready li a", a => a.map(x => x.textContent.replace(/\s*\(opens in a new tab\)/, "")).filter(t => /^Verified Motion/.test(t))),
      ["Verified Motion for Continuance, item 2", "Verified Motion for Continuance, item 4", "Verified Motion for Continuance, item 6"]);
  });
  test("the fee waiver: the other person's name and related cases, like the other forms", async () => {
    const w = await whats("feewaiver");
    assert.ok(w.includes("The name of the other person in your case, if there is one."));
    assert.ok(w.includes("The case numbers of any related cases."));
  });
  test("edge: every question each form asks is covered by something on its list", async () => {
    // Each question id, and the words in the list that cover it. Questions that come from an earlier answer (a
    // confirmation, a choice between options, signing) need nothing ready.
    const COVER = { caseNumber: /case number/, county: /county/, courtType: /court/, plaintiff: /plaintiff/i, name: /./, address: /mailing address/, email: /email/, phone: /phone/,
      admitted: /Complaint/, denied: /Complaint/, notEnough: /Complaint/, defenses: /defenses/, svc1Name: /name and address/, svc1Address: /name and address/, relatedNumbers: /related cases/,
      hearingDate: /hearing date/, reason: /reason/, timeNeeded: /days or weeks/, spokeDate: /talked to the other party/, otherAgreed: /whether they agreed/, otherParty: /other party/,
      otherPartyAddress: /other party/, otherPerson: /other person/, adults: /people you live with/, children: /people you live with/, supported: /which of them you support/,
      hourlyRate: /monthly income/, monthlyHours: /monthly income/, bank: /in the bank/, housing: /monthly expenses/ };
    const missing = [];
    for (const form of ["respond", "continuance", "feewaiver"]) {
      await inject(p, form, { related: "yes", incomeKinds: "wages", expenseKinds: "housing" });
      const ids = await p.evaluate(() => visible().map(s => s.id));
      await reset(p); await pick(p, form);
      const list = await p.textContent("details.ready");
      for (const id of ids) if (COVER[id] && !COVER[id].test(list)) missing.push(`${form}: ${id}`);
    }
    assert.deepEqual(missing, []);
  });
});

describe("BT4: the ready list says what the Appearance says about the email and phone", () => {
  for (const [form, page] of [["respond", 5], ["appearance", 5], ["continuance", 4]]) {
    test(`${form}: required, as item 3 of the Appearance says, linked to that page`, async () => {
      await reset(p); await pick(p, form);
      const li = await p.$$eval("details.ready li", lis => lis.map(l => ({ text: l.textContent, href: l.querySelector("a").getAttribute("href") })).find(l => /email/.test(l.text)));
      assert.match(li.text, /^Your mailing address, email address and 10-digit phone number\. Item 3 of the Appearance says an email address and a 10-digit phone number are required\./);
      assert.doesNotMatch(li.text, /if you have them/);
      assert.match(li.href, new RegExp(`#page=${page}$`));
    });
  }
  test("edge: the fee waiver's Appearance has no such line, so its list keeps \"if you have them\"", async () => {
    await reset(p); await pick(p, "feewaiver");
    assert.match(await p.textContent("details.ready"), /Your mailing address, and your email and phone number if you have them\./);
  });
});

describe("BT11: focus stays on \"Add it to my calendar\" when the summary redraws", () => {
  test("focused while the PDF is being made, still focused after the summary redraws with it", async () => {
    const q = await fresh();
    await q.evaluate(() => { const d = new Date(); d.setDate(d.getDate() + 9); window.__day = dayString(d); });
    await inject(q, "respond", { courtDate: await q.evaluate(() => window.__day) });
    assert.equal(await q.evaluate(() => pdfState.busy || !pdfState.result), true, "the PDF is still being made");
    await q.focus("[data-ics]");
    await q.waitForFunction(() => !!pdfState.result && !pdfState.busy, null, { timeout: 120000 });
    await q.waitForTimeout(100);
    assert.equal(await q.evaluate(() => document.activeElement.dataset.ics), await q.evaluate(() => window.__day));
    await q.context().close();
  });
  test("edge: and when the day changes overnight (BT10's redraw)", async () => {
    const q = await fresh({ timezoneId: "America/Indiana/Indianapolis" });
    await q.clock.install({ time: new Date("2026-12-18T04:58:00Z") });
    await q.reload(); await q.waitForSelector("#app h1");
    await inject(q, "respond", { courtDate: "2026-12-20" });
    for (let i = 0; i < 200 && !(await q.evaluate(() => !!pdfState.result && !pdfState.busy)); i++) await new Promise(r => setTimeout(r, 100));
    await q.focus("[data-ics]");
    await q.clock.fastForward("07:00");
    assert.match(await q.textContent("ol.steps"), /12\/20\/2026, 2 days from today\./);
    assert.equal(await q.evaluate(() => document.activeElement.dataset.ics), "2026-12-20");
    await q.context().close();
  });
});

describe("BT13: text size and contrast add no height to the header on phones", () => {
  test("\"Aa\" beside the saving links adds nothing, at every common phone width and on a computer", async () => {
    const taller = [];
    for (const w of [320, 360, 375, 390, 393, 412, 414, 430, 480, 600, 1280]) {
      const q = await fresh({ viewport: { width: w, height: 800 } });
      const hh = () => q.evaluate(() => document.querySelector("header").getBoundingClientRect().height);
      const withAa = await hh();
      await q.evaluate(() => { document.getElementById("readBtn").style.display = "none"; });
      if (withAa - await hh() > 0.5) taller.push(`${w}px: ${withAa} vs ${await hh()}`);
      await q.context().close();
    }
    assert.deepEqual(taller, []);
  });
  test("\"Aa\" opens and closes the row, and says so; Escape closes it and goes back to \"Aa\"", async () => {
    await reset(p);
    assert.equal(await p.getAttribute("#readBtn", "aria-expanded"), "false");
    await p.click("#readBtn");
    assert.equal(await p.getAttribute("#readBtn", "aria-expanded"), "true");
    assert.equal(await p.isVisible("#textBigger"), true);
    await p.focus("#textBigger"); await p.keyboard.press("Escape");
    assert.equal(await p.isHidden("#readTools"), true);
    assert.equal(await p.evaluate(() => document.activeElement.id), "readBtn");
    await p.click("#readBtn"); await p.click("#readBtn");
    assert.equal(await p.isHidden("#readTools"), true);
  });
  test("edge: the open row stays open across screens, so several steps can be taken", async () => {
    await reset(p); await p.click("#readBtn");
    await pick(p, "appearance");
    assert.equal(await p.isVisible("#readTools"), true);
    await p.click("#textBigger"); await p.click("#textBigger");
    assert.equal(await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--text-scale").trim()), "1.3");
  });
});

describe("BT12: with bigger text, the header stays small and the question comes first", () => {
  const biggest = async q => { await q.click("#readBtn"); for (let i = 0; i < 3; i++) await q.click("#textBigger"); await q.click("#readBtn"); };
  const headerH = q => q.evaluate(() => document.querySelector("header").getBoundingClientRect().height);
  test("at 150%, the header takes at most half of the smallest phone, under a third of a 375px one", async () => {
    for (const [w, h, most] of [[320, 568, 0.5], [375, 667, 0.3], [667, 375, 0.35]]) {
      const q = await fresh({ viewport: { width: w, height: h } });
      await biggest(q);
      assert.ok(await headerH(q) / h <= most, `${w}x${h}: ${await headerH(q)}px`);
      await q.context().close();
    }
  });
  test("after Continue at 150%, the next question starts near the top of the screen, past the header", async () => {
    for (const [w, h] of [[320, 568], [375, 667], [667, 375]]) {
      const q = await fresh({ viewport: { width: w, height: h } });
      await biggest(q);
      await pick(q, "respond"); await q.fill("#ans", "02D01-2611-CC-001234"); await q.click("#next");
      const top = await q.evaluate(() => document.getElementById("q").getBoundingClientRect().top);
      assert.ok(top >= 0 && top <= 150, `${w}x${h}: the question starts at ${top}px`);
      await q.context().close();
    }
  });
  test("edge: at the usual size, nothing changes: each question starts at the top, header and all", async () => {
    const q = await fresh({ viewport: { width: 375, height: 667 } });
    await pick(q, "respond"); await q.fill("#ans", "02D01-2611-CC-001234"); await q.click("#next");
    assert.equal(await q.evaluate(() => window.scrollY), 0);
    await q.context().close();
  });
  test("edge: at the usual size the header is exactly as tall as before", async () => {
    for (const [w, h] of [[320, 159], [375, 159], [390, 128], [412, 137], [1280, 109]]) {
      const q = await fresh({ viewport: { width: w, height: 800 } });
      assert.ok(Math.abs(await headerH(q) - h) <= 1, `${w}px: ${await headerH(q)} vs ${h}`);
      await q.context().close();
    }
  });
});

describe("BT5: on the continuance, definitions cite the continuance's own instructions", () => {
  const sources = () => p.$$eval("#helpWords dd", ds => ds.map(d => d.closest("dl") && d.previousElementSibling.textContent + ": " + d.querySelector("a").textContent.replace(/\s*\(opens in a new tab\)/, "")));
  test("Get help's list on the continuance: Appearance from page 2, Related cases, Certificate of Service and Perjury from page 3", async () => {
    await inject(p, "continuance", { role: "me" }); await p.click("#helpBtn");
    assert.deepEqual(await sources(), ["Defendant: Answer instructions, page 3", "Appearance: Continuance instructions, page 2", "Continuance: Continuance instructions, page 3",
      "Related cases: Continuance instructions, page 3", "Certificate of Service: Continuance instructions, page 3", "Perjury: Continuance instructions, page 3"]);
    assert.match(await p.textContent("#helpWords"), /“This is the form that tells the court how to contact you if they need to\.”/);
  });
  test("a word tapped in a continuance question cites the continuance instructions too", async () => {
    await inject(p, "continuance", { role: "me", related: "yes" }); await jump(p, "related");
    const b = p.locator("#qhelp button.term", { hasText: /related cases/i });
    await b.click();
    assert.match(await p.textContent("#termbox"), /Source: Continuance instructions, page 3/);
  });
  test("edge: the Appearance and Answer still cites its own (Answer) instructions", async () => {
    await inject(p, "respond"); await p.click("#helpBtn");
    for (const s of await sources()) assert.match(s, /Answer instructions/);
  });
});

describe("BT6: closing More closes a definition opened from it", () => {
  // No question's More has a word to tap today (BT1 made "continuance instructions" plain text), so one is given one.
  async function openFromMore() {
    await inject(p, "continuance", { role: "other" }); await jump(p, "hearingDate");
    await p.evaluate(() => { visible()[cur].more = "The defendant can ask for this."; render(); });
    await p.click('details[data-more^="q:"] > summary');
    const b = p.locator("#qmore button.term").first();
    await b.click();
    assert.equal(await p.isVisible("#termbox"), true);
    return b;
  }
  test("the definition goes, and its word no longer says it's open", async () => {
    const b = await openFromMore();
    await p.click('details[data-more^="q:"] > summary');
    await p.waitForFunction(() => document.getElementById("termbox").hidden);
    assert.equal(await b.getAttribute("aria-expanded"), "false");
  });
  test("edge: a definition opened from the explanation itself stays when More closes", async () => {
    await inject(p, "continuance", { role: "other" }); await jump(p, "hearingDate");
    await p.evaluate(() => { visible()[cur].more = "The defendant can ask for this."; visible()[cur].help = "The plaintiff set this date."; render(); });
    await p.click('details[data-more^="q:"] > summary');
    await p.locator("#qhelp button.term").first().click();
    await p.click('details[data-more^="q:"] > summary');
    await p.waitForTimeout(100);
    assert.equal(await p.isVisible("#termbox"), true);
  });
});

describe("BT7: screen readers hear a definition, and learn of the ready list", () => {
  const said = () => p.waitForFunction(() => document.getElementById("announce").textContent).then(h => h.jsonValue());
  test("tapping a word says its definition", async () => {
    await reset(p); await pick(p, "respond"); await walk(p, "defenses");
    await p.locator("#qhelp button.term").first().click();
    assert.match(await said(), /^Defenses: These are legal reasons why you should win the case/);
  });
  test("the first question's answer box is described by the ready list's title too, and only the first", async () => {
    await reset(p); await pick(p, "feewaiver");
    const described = () => p.evaluate(() => { const el = document.querySelector("#ans, .choices"); return (el.getAttribute("aria-describedby") || "").split(" ").map(id => document.getElementById(id)?.textContent || `(${id} missing)`); });
    assert.ok((await described()).includes("Before you start: what to have ready"), (await described()).join(" | "));
    await p.evaluate(() => { cur = 1; render(); });
    assert.ok(!(await described()).some(t => /Before you start/.test(t)));
    assert.ok(!(await described()).some(t => /missing/.test(t)), "every description it names is there");
  });
});

describe("BT8: the ready list and the word list open only when tapped or clicked", () => {
  test("on a computer, resting the pointer on the ready list doesn't open it, so the answer box stays put", async () => {
    const q = await fresh({ viewport: { width: 1280, height: 800 } });
    await pick(q, "feewaiver");
    const top = () => q.$eval("#ans, .choices", e => e.getBoundingClientRect().top);
    const before = await top();
    await q.hover("details.ready > summary"); await q.waitForTimeout(600);
    assert.equal(await q.$eval("details.ready", d => d.open), false);
    assert.equal(await top(), before);
    await q.click("details.ready > summary");
    assert.equal(await q.$eval("details.ready", d => d.open), true, "a click still opens it");
    await q.context().close();
  });
  test("the word list doesn't open on hover either, and stays open while the pointer moves away", async () => {
    const q = await fresh({ viewport: { width: 1280, height: 800 } });
    await q.click("#helpBtn");
    await q.hover("#helpWords summary"); await q.waitForTimeout(600);
    assert.equal(await q.$eval("#helpWords details", d => d.open), false);
    await q.click("#helpWords summary");
    await q.mouse.move(5, 700); await q.waitForTimeout(300);
    assert.equal(await q.$eval("#helpWords details", d => d.open), true);
    await q.context().close();
  });
  test("edge: a small More still opens on hover, as before", async () => {
    const q = await fresh({ viewport: { width: 1280, height: 800 } });
    await pick(q, "continuance");
    await q.hover('details[data-more^="q:"] > summary'); await q.waitForTimeout(600);
    assert.equal(await q.$eval('details[data-more^="q:"]', d => d.open), true);
    await q.context().close();
  });
});

describe("BT9: tests for three breaks that went unnoticed", () => {
  test("a word in a question's More text is a button too", async () => {
    await inject(p, "continuance", { role: "other" }); await jump(p, "hearingDate");
    await p.evaluate(() => { visible()[cur].more = "The defendant can ask for this."; render(); });
    assert.deepEqual(await p.$$eval("#qmore button.term", bs => bs.map(b => b.textContent)), ["defendant"]);
  });
  test("Start over deletes the kept text size and contrast with everything else", async () => {
    await reset(p); await p.evaluate(() => localStorage.clear()); await reset(p);
    await p.click("#saveToggle");
    await p.click("#readBtn"); await p.click("#textBigger"); await p.click("#readBtn");
    assert.notEqual(await p.evaluate(() => localStorage.getItem("icfh-display-v1")), null);
    await inject(p, "appearance");
    await p.click("#restart");
    assert.equal(await p.evaluate(() => localStorage.getItem("icfh-display-v1")), null);
  });
  test("a kept look found while saving is off is deleted when the page opens", async () => {
    await p.evaluate(() => { localStorage.clear(); localStorage.setItem("icfh-display-v1", JSON.stringify({ size: 2, contrast: true })); });
    await reset(p);
    assert.equal(await p.evaluate(() => localStorage.getItem("icfh-display-v1")), null);
    assert.equal(await p.isDisabled("#textSmaller"), true, "and it isn't applied");
  });
});

describe("BT14: one Enter too many at the end of the range does nothing", () => {
  const scale = () => p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--text-scale").trim() || "1");
  const lastSaid = () => p.evaluate(() => new Promise(r => setTimeout(() => r(document.getElementById("announce").textContent), 120)));
  test("A+ pressed four times from the keyboard stays at 150%, keeps focus, and says it's at its biggest", async () => {
    await p.evaluate(() => localStorage.clear()); await reset(p);
    await p.click("#readBtn"); await p.focus("#textBigger");
    for (let i = 0; i < 4; i++) await p.keyboard.press("Enter");
    assert.equal(await scale(), "1.5");
    assert.equal(await p.evaluate(() => document.activeElement.id), "textBigger");
    assert.equal(await p.getAttribute("#textBigger", "aria-disabled"), "true");
    assert.equal(await lastSaid(), "Text size is already at its biggest, 150 percent.");
  });
  test("A- at the usual size stays there, keeps focus, and says so", async () => {
    await p.evaluate(() => localStorage.clear()); await reset(p);
    await p.click("#readBtn"); await p.focus("#textSmaller");
    await p.keyboard.press("Enter");
    assert.equal(await scale(), "1");
    assert.equal(await p.evaluate(() => document.activeElement.id), "textSmaller");
    assert.equal(await lastSaid(), "Text size is already the usual size.");
  });
  test("edge: holding Enter on A+ only ever goes up", async () => {
    await p.evaluate(() => localStorage.clear()); await reset(p);
    await p.click("#readBtn"); await p.focus("#textBigger");
    const seen = [];
    for (let i = 0; i < 8; i++) { await p.keyboard.press("Enter"); seen.push(await scale()); }
    assert.deepEqual(seen, ["1.15", "1.3", "1.5", "1.5", "1.5", "1.5", "1.5", "1.5"]);
  });
});

describe("BT15: an expired saved copy doesn't bring back its text size and contrast", () => {
  const keep = (days) => p.evaluate(days => {
    localStorage.clear();
    localStorage.setItem("icfh-save-pref", "on");
    localStorage.setItem("icfh-display-v1", JSON.stringify({ size: 2, contrast: true }));
    localStorage.setItem("icfh-progress-v1", JSON.stringify({ v: 1, sitKey: "appearance", answers: { name: "Pat Example" }, unsure: {}, savedAt: Date.now() - days * 864e5 }));
  }, days);
  test("31 days old: the page opens at the usual size and colors, and nothing is left on the device", async () => {
    await keep(31); await reset(p);
    assert.equal(await p.getAttribute("#textSmaller", "aria-disabled"), "true");
    assert.equal(await p.getAttribute("#contrastBtn", "aria-pressed"), "false");
    assert.deepEqual(await p.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith("icfh-"))), []);
  });
  test("edge: 2 days old: the look is still kept and applied", async () => {
    await keep(2); await reset(p);
    assert.equal(await p.getAttribute("#contrastBtn", "aria-pressed"), "true");
    assert.equal(await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--text-scale").trim()), "1.3");
    await p.evaluate(() => localStorage.clear());
  });
});

describe("BT16: saving turned on in another tab keeps this tab's text size and contrast", () => {
  const stored = q => q.evaluate(() => JSON.parse(localStorage.getItem("icfh-display-v1") || "null"));
  test("tab B picks 130% and high contrast with saving off; tab A turns saving on; B's look is kept", async () => {
    const ctx = await site();
    const a = await ctx.open(), b = await ctx.open();
    await b.click("#readBtn"); await b.click("#textBigger"); await b.click("#textBigger"); await b.click("#contrastBtn");
    assert.equal(await stored(b), null, "nothing kept with saving off");
    await a.click("#saveToggle");
    await b.waitForFunction(() => localStorage.getItem("icfh-display-v1") !== null);
    assert.deepEqual(await stored(b), { size: 2, contrast: true });
    await b.reload(); await b.waitForSelector("#app h1");
    assert.equal(await b.getAttribute("#contrastBtn", "aria-pressed"), "true");
    await ctx.close();
  });
  test("edge: a tab at the usual look doesn't delete the look another tab kept", async () => {
    const ctx = await site();
    const a = await ctx.open(), b = await ctx.open();
    await a.click("#readBtn"); await a.click("#contrastBtn");
    await a.click("#saveToggle");
    await b.waitForFunction(() => localStorage.getItem("icfh-display-v1") !== null);
    // B hears "saving turned on" after A's look is kept (the browser can deliver it either way round, so it's replayed).
    await b.evaluate(() => { globalThis.eval("lastSavingOn = false"); window.dispatchEvent(new StorageEvent("storage", { key: "icfh-save-pref", newValue: "on" })); });
    assert.deepEqual(await stored(a), { size: 0, contrast: true });
    await ctx.close();
  });
});

describe("BT17: with storage full, the kept look is used and never deleted", () => {
  test("it's applied when the page opens, and pressing A+ leaves it on the device", async () => {
    const q = await fresh();
    await q.evaluate(() => {
      localStorage.clear();
      localStorage.setItem("icfh-save-pref", "on");
      localStorage.setItem("icfh-display-v1", JSON.stringify({ size: 1, contrast: true }));
      localStorage.setItem("icfh-progress-v1", JSON.stringify({ v: 1, sitKey: "appearance", answers: { name: "Pat Example" }, unsure: {}, savedAt: Date.now() - 864e5 }));
    });
    // From now on the browser refuses to store anything, as when storage is full.
    await q.addInitScript(() => { Storage.prototype.setItem = function () { throw new DOMException("full", "QuotaExceededError"); }; });
    await q.reload(); await q.waitForSelector("#app h1");
    assert.equal(await q.evaluate(() => storageFull), true);
    assert.equal(await q.getAttribute("#contrastBtn", "aria-pressed"), "true");
    assert.equal(await q.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--text-scale").trim()), "1.15");
    await q.click("#readBtn"); await q.click("#textBigger");
    assert.deepEqual(await q.evaluate(() => JSON.parse(localStorage.getItem("icfh-display-v1"))), { size: 1, contrast: true }, "still there");
    assert.equal(await q.evaluate(() => localStorage.getItem("icfh-save-pref")), "on");
    await q.context().close();
  });
});

describe("BT18: a kept look applies before the page has loaded", () => {
  // The app's last script never arrives, as on a very slow connection: only the page itself and its head have run.
  async function stuck(store) {
    let hold = false;
    const ctx = await site({ change: rel => (hold && rel === "app/main.js" ? "hold" : null) });
    const first = await ctx.open();
    await first.evaluate(s => { localStorage.clear(); for (const [k, v] of Object.entries(s)) localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v)); }, store);
    hold = true;
    const q = await ctx.newPage();
    await q.goto("http://app.test/form-builder-mvp.html", { waitUntil: "commit" });
    await q.waitForFunction(() => !!document.getElementById("app")); // the page is drawn up to the scripts, which are stuck
    const look = await q.evaluate(() => ({ scale: document.documentElement.style.getPropertyValue("--text-scale"), contrast: document.documentElement.dataset.contrast || "", loaded: typeof render === "function" }));
    await ctx.close();
    return look;
  }
  test("with saving on, 130% and high contrast show while the app is still loading", async () => {
    assert.deepEqual(await stuck({ "icfh-save-pref": "on", "icfh-display-v1": { size: 2, contrast: true } }), { scale: "1.3", contrast: "high", loaded: false });
  });
  test("edge: not with saving off, not from an expired copy, and not from an unusable setting", async () => {
    const usual = { scale: "", contrast: "", loaded: false };
    assert.deepEqual(await stuck({ "icfh-display-v1": { size: 2, contrast: true } }), usual);
    assert.deepEqual(await stuck({ "icfh-save-pref": "on", "icfh-display-v1": { size: 2, contrast: true }, "icfh-progress-v1": { v: 1, sitKey: "appearance", answers: { name: "Pat" }, savedAt: Date.now() - 31 * 864e5 } }), usual);
    assert.deepEqual(await stuck({ "icfh-save-pref": "on", "icfh-display-v1": "{not json" }), usual);
    assert.deepEqual(await stuck({ "icfh-save-pref": "on", "icfh-display-v1": { size: 9, contrast: "yes" } }), usual);
  });
  test("edge: the page's early copy of the sizes, keys and 30 days matches the app's", async () => {
    await reset(p);
    const html = await p.evaluate(() => [...document.head.querySelectorAll("script")].map(s => s.textContent).join("\n"));
    const app = await p.evaluate(() => ({ sizes: TEXT_SIZES, key: DISPLAY_KEY, pref: PREF_KEY, store: STORE_KEY, days: MAX_AGE_DAYS }));
    assert.ok(html.includes(`sizes = ${JSON.stringify(app.sizes).replace(/,/g, ", ")}`), "sizes");
    for (const k of [app.key, app.pref, app.store]) assert.ok(html.includes(`"${k}"`), k);
    assert.ok(html.includes(`${app.days} * 864e5`), "days");
  });
});

describe("BT19: a mistyped far-off court date gets a check, and no countdown or calendar file", () => {
  const dayAhead = n => p.evaluate(n => { const d = new Date(); d.setDate(d.getDate() + n); return dayString(d); }, n);
  test("Appearance and Answer, court date in 2062: the summary asks to check the year, with no countdown or file", async () => {
    await inject(p, "respond", { courtDate: "2062-12-18" });
    assert.ok((await flagsFor(p, "courtDate")).some(f => /12\/18\/2062 is more than a year from today\. Check the year\./.test(f)));
    assert.doesNotMatch(await p.textContent("ol.steps"), /days from today/);
    assert.equal(await p.$("[data-ics]"), null);
    assert.match(await p.textContent("ol.steps"), /Your next court date: 12\/18\/2062\./, "the date itself is still shown, as typed");
  });
  test("the continuance already flagged a far hearing date; now it offers no file either", async () => {
    await inject(p, "continuance", { hearingDate: await dayAhead(800) });
    assert.ok((await flagsFor(p, "hearingDate")).length > 0);
    assert.equal(await p.$("[data-ics]"), null);
  });
  test("edge: a year away exactly still counts down; a day more doesn't, and is flagged", async () => {
    await inject(p, "appearance", { courtDate: await dayAhead(365) });
    assert.match(await p.textContent("ol.steps"), /, 365 days from today\./);
    assert.notEqual(await p.$("[data-ics]"), null);
    assert.deepEqual(await flagsFor(p, "courtDate"), []);
    await inject(p, "appearance", { courtDate: await dayAhead(366) });
    assert.equal(await p.$("[data-ics]"), null);
    assert.equal((await flagsFor(p, "courtDate")).length, 1);
  });
});

describe("BT20: adding the date again updates the same calendar event", () => {
  const dayAhead = n => p.evaluate(n => { const d = new Date(); d.setDate(d.getDate() + n); return dayString(d); }, n);
  const ics = async () => {
    const [d] = await Promise.all([p.waitForEvent("download"), p.click("[data-ics]")]);
    const t = (await import("node:fs")).readFileSync(await d.path(), "utf8");
    return { uid: t.match(/\r\nUID:(.+)\r\n/)[1], seq: +t.match(/\r\nSEQUENCE:(\d+)\r\n/)[1], start: t.match(/DTSTART;VALUE=DATE:(\d+)/)[1] };
  };
  test("twice, then after correcting the date: one event ID, a higher version each time, the new date", async () => {
    await inject(p, "respond", { courtDate: await dayAhead(20) });
    const a = await ics(), b = await ics();
    assert.equal(b.uid, a.uid);
    assert.deepEqual([a.seq, b.seq], [0, 1]);
    const moved = await dayAhead(27);
    await p.evaluate(d => { answers.courtDate = d; render(); }, moved);
    const c = await ics();
    assert.equal(c.uid, a.uid);
    assert.equal(c.seq, 2);
    assert.equal(c.start, moved.replace(/-/g, ""));
  });
  test("edge: Start over begins a new event, and the ID has nothing from the case in it", async () => {
    await inject(p, "respond", { courtDate: await dayAhead(20), caseNumber: "02D01-2611-CC-004321" });
    const a = await ics();
    assert.match(a.uid, /^[a-z0-9]+@court-form-helper$/);
    await p.click("#restart");
    await inject(p, "respond", { courtDate: await dayAhead(20) });
    const b = await ics();
    assert.notEqual(b.uid, a.uid);
    assert.equal(b.seq, 0);
  });
});

describe("BT21: the calendar file is a plain calendar file, without METHOD", () => {
  test("no METHOD (which would call for an ORGANIZER), and the parts a calendar needs are there", async () => {
    const d = new Date(); d.setDate(d.getDate() + 15);
    await inject(p, "appearance", { courtDate: await p.evaluate(() => { const d = new Date(); d.setDate(d.getDate() + 15); return dayString(d); }) });
    const [dl] = await Promise.all([p.waitForEvent("download"), p.click("[data-ics]")]);
    const t = (await import("node:fs")).readFileSync(await dl.path(), "utf8");
    assert.doesNotMatch(t, /\r\nMETHOD:/);
    assert.doesNotMatch(t, /\r\nORGANIZER/);
    for (const part of ["VERSION:2.0", "PRODID:", "UID:", "DTSTAMP:", "DTSTART;VALUE=DATE:", "DTEND;VALUE=DATE:", "SUMMARY:Court date"]) assert.ok(t.includes(`\r\n${part}`), part);
  });
});
