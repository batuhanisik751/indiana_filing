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
