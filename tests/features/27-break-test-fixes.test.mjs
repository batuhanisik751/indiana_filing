// Fixes from the break-test of the four features taken from other teams' projects (BT1 to BT22 on the Issue Map),
// one section per ticket, in the order they were fixed.
import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fresh, close, reset, pick, walk, inject, jump } from "../lib.mjs";

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
    assert.deepEqual(await p.$$eval("details.ready li a", a => a.map(x => x.textContent.replace(/\s*\(opens in a new tab\)/, "")).filter(t => /item/.test(t))),
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
