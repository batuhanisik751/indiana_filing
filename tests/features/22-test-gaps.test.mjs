// Tests for behavior that mutation testing in the verification round (November 2026) showed no test checked:
// TG1 to TG10 on the Issue Map. Each was written to fail on the deliberate break that first went unnoticed.
import { describe, test, after } from "node:test";
import assert from "node:assert/strict";
import { fresh, close, pick, walk, inject, SAVED, SAVING, fieldRows, flagsFor, pdfText, jump, step } from "../lib.mjs";

after(close);
const stored = (p, key = SAVED) => p.evaluate(k => localStorage.getItem(k), key);
const reopen = async p => { await p.reload(); await p.waitForSelector("#app h1"); };
// A page with saving on and a saved copy of the Appearance.
async function savedCopy() {
  const p = await fresh();
  await p.click("#saveToggle"); await pick(p, "appearance"); await walk(p, "name");
  await p.fill("#ans", "Pat Keeper"); await p.click("#next");
  assert.match(await stored(p), /Pat Keeper/);
  return p;
}
const age = (p, ms) => p.evaluate(([k, ms]) => { const d = JSON.parse(localStorage.getItem(k)); d.savedAt = Date.now() - ms; localStorage.setItem(k, JSON.stringify(d)); }, [SAVED, ms]);

describe("TG1: saving keeps its privacy rules", () => {
  test("a copy older than 30 days is deleted, and saving turns off too, for the next person", async () => {
    const p = await savedCopy();
    await age(p, 31 * 864e5); await reopen(p);
    assert.equal(await stored(p), null);
    assert.equal(await stored(p, SAVING), null);
    assert.equal(await p.textContent("#saveToggle"), "Turn on saving");
    await p.context().close();
  });
  test("edge: the limit is 30 days exactly: 30 days and an hour is too old", async () => {
    const p = await savedCopy();
    await age(p, 30 * 864e5 + 3600e3); await reopen(p);
    assert.equal(await stored(p), null);
    assert.equal(await p.locator("#resume").count(), 0);
    await p.context().close();
  });
  test("edge: Start over deletes this form's copy only: another tab's copy of another form stays, with saving on", async () => {
    const p = await fresh();
    await p.click("#saveToggle");
    await inject(p, "feewaiver", { incomeKinds: "none", expenseKinds: "none" });
    // Another tab saves the continuance over it, as only one copy is kept.
    await p.evaluate(k => { const d = JSON.parse(localStorage.getItem(k)); d.sitKey = "continuance"; d.answers = { name: "Other Tab Person", county: "Allen" }; localStorage.setItem(k, JSON.stringify(d)); }, SAVED);
    await p.click("#restart");
    assert.match(p.dialogs.at(-1).message, /^Start over\?/);
    assert.doesNotMatch(p.dialogs.at(-1).message, /turns saving off/);
    assert.match(await stored(p), /"sitKey":"continuance"/);
    assert.equal(await stored(p, SAVING), "on");
    await p.context().close();
  });
  test("edge: a copy found on the device while saving is off is deleted when the page opens", async () => {
    const p = await savedCopy();
    await p.evaluate(k => localStorage.removeItem(k), SAVING); // saving off, but a copy left behind
    await reopen(p);
    assert.equal(await stored(p), null);
    assert.equal(await p.locator("#resume").count(), 0);
    await p.context().close();
  });
  test("edge: with nothing saved, closing the page warns first; with the answers saved, it doesn't", async () => {
    const unsaved = await fresh();
    await pick(unsaved, "appearance"); await walk(unsaved, "name");
    await unsaved.close({ runBeforeUnload: true });
    await unsaved.waitForEvent("close");
    assert.ok(unsaved.dialogs.some(d => d.type === "beforeunload"), "warned");
    await unsaved.context().close();
    const saved = await savedCopy();
    await saved.close({ runBeforeUnload: true });
    await saved.waitForEvent("close").catch(() => {});
    assert.ok(!saved.dialogs.some(d => d.type === "beforeunload"), "no warning: it's saved");
    await saved.context().close();
  });
  test("edge: turning saving off asks first, naming what it deletes", async () => {
    const p = await savedCopy();
    await p.click("#saveToggle");
    assert.match(p.dialogs.at(-1).message, /^Turn off saving\? This deletes the answers saved on this device/);
    assert.equal(await stored(p), null);
    await p.context().close();
  });
});

describe("TG2: the full next-steps text never overstates what missing a hearing means", () => {
  // Every situation's steps, line and full text: form x filing method x county x role x case type x court date.
  const allText = p => p.evaluate(() => {
    const out = [];
    for (const form of ["respond", "appearance", "continuance", "feewaiver"]) for (const fileMethod of ["", "efile", "paper"]) for (const county of ["", "Allen", "Marion"])
      for (const role of ["me", "other"]) for (const caseNumber of ["", "02D01-2611-SC-001234", "02D01-2611-EV-001234", "02D01-2611-CC-001234", "02D01-2611-CM-001234"])
        for (const courtDate of ["", "2020-01-02", "2099-01-02"]) {
          sitKey = form;
          for (const s of nextSteps(form, { fileMethod, county, role, caseNumber, courtDate, hearingDate: courtDate, name: "Pat" })) out.push({ form, caseNumber, role, title: s.title, text: `${s.short || ""} ${s.body}` });
        }
    return out;
  });
  test("no step says the court will, must or shall rule against you, enter a default or dismiss", async () => {
    const p = await fresh();
    const bad = (await allText(p)).filter(s => /\b(will|must|shall) (rule against|enter (a |an )?(default|judgment)|dismiss)|\bwill lose\b|\blose automatically\b/i.test(s.text)).map(s => `${s.form} ${s.caseNumber}: ${s.title}`);
    assert.deepEqual([...new Set(bad)], []);
    await p.context().close();
  });
  test("edge: an eviction's full text gives the Eviction FAQ's words exactly", async () => {
    const p = await fresh();
    const s = (await allText(p)).find(x => x.form === "appearance" && x.caseNumber.includes("-EV-") && x.title === "Go to every court date");
    assert.ok(s.text.includes("Indiana Legal Help's Eviction FAQ says that if you don't show up to your hearing, the court can rule against you without hearing your side of the story (a default judgment)."), s.text);
    await p.context().close();
  });
  test("edge: small claims gives Small Claims Rule 10's words exactly, for both sides", async () => {
    const p = await fresh();
    const all = await allText(p);
    const defendant = all.find(x => x.form === "appearance" && x.caseNumber.includes("-SC-") && x.title === "Go to every court date");
    assert.ok(defendant.text.includes('"the court may enter a default judgment against him."'), defendant.text);
    const starter = all.find(x => x.form === "continuance" && x.role === "me" && x.caseNumber.includes("-SC-") && x.title === "If you don't go to court");
    assert.ok(starter.text.includes("the court may dismiss the claim without prejudice"), starter.text);
    await p.context().close();
  });
});

describe("TG3: the fee waiver's sworn totals add up every amount, on the summary and in the PDF", () => {
  const ready = p => p.waitForFunction(() => pdfState.result && pdfState.key === pdfKey() && !pdfState.busy, null, { timeout: 120000 });
  const total = (p, label) => p.evaluate(label => { const r = SITUATIONS.feewaiver.fields(visibleAnswers()).find(r => r.label.startsWith(label)); return [String(r.value), r.pdf.map(o => o.value)]; }, label);
  const EXPENSES = { housing: "500", utilities: "100.50", food: "300", childCare: "50", medical: "25.25", transportation: "60", insurance: "40", childSupportOut: "0", otherCosts: "10", otherCostsDesc: "Phone" };
  const INCOME = { hourlyRate: "12.50", monthlyHours: "80", unemployment: "200", tanf: "100.25", ssi: "300", childSupportIn: "50", otherIncome: "25", otherIncomeDesc: "Gifts" };
  test("every expense counts in Total Expenses: $1,085.75 on the summary and in the PDF's box", async () => {
    const p = await fresh();
    await inject(p, "feewaiver", { incomeKinds: "", expenseKinds: "", ...INCOME, ...EXPENSES }); await ready(p);
    assert.deepEqual(await total(p, "8. and Total Expenses"), ["$1,085.75", ["1,085.75"]]);
    assert.ok((await pdfText(p)).includes("1,085.75"), "printed");
    await p.context().close();
  });
  test("every kind of income counts in Total Income: wages of $12.50 for 80 hours plus the rest is $1,675.25", async () => {
    const p = await fresh();
    await inject(p, "feewaiver", { incomeKinds: "", expenseKinds: "", ...INCOME, ...EXPENSES }); await ready(p);
    const [shown, boxes] = await total(p, "6. and Total Income");
    assert.equal(shown, "$1,675.25"); assert.deepEqual([...new Set(boxes)], ["1,675.25"]);
    assert.ok((await pdfText(p)).includes("1,675.25"), "printed");
    await p.context().close();
  });
  test("edge: the wage flag starts at $100 an hour: 99.99 isn't flagged, 100 and 125 are", async () => {
    const p = await fresh();
    for (const [rate, flagged] of [["99.99", false], ["100", true], ["125", true]]) {
      await inject(p, "feewaiver", { incomeKinds: "", expenseKinds: "none", hourlyRate: rate, monthlyHours: "10" });
      assert.equal((await flagsFor(p, "hourlyRate")).some(f => /an hour is unusually high/.test(f)), flagged, rate);
    }
    await p.context().close();
  });
});

describe("TG4: dates on the day itself", () => {
  // A day counted from today, as the page counts it (its own time zone).
  const dayFrom = (p, n) => p.evaluate(n => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }, n);
  const tryDate = async (p, id, value) => { await jump(p, id); await p.fill("#ans", value); await p.click("#next"); return step(p); };
  test("a signing or service date on the hearing day itself is accepted; the day after is refused", async () => {
    const p = await fresh();
    const hearing = await dayFrom(p, 10), after = await dayFrom(p, 11);
    await inject(p, "continuance", { hearingDate: hearing });
    for (const id of ["signDate", "svc1Date"]) {
      assert.notEqual(await tryDate(p, id, hearing), id, `${id} on the hearing day`);
      assert.equal(await tryDate(p, id, after), id, `${id} the day after`);
      assert.match(await p.textContent("#err"), /This is after your hearing date/);
    }
    await p.context().close();
  });
  test("edge: a court date of today hasn't passed; yesterday has", async () => {
    const p = await fresh();
    const today = await dayFrom(p, 0), yesterday = await dayFrom(p, -1);
    await inject(p, "appearance", { courtDate: today });
    assert.ok(!(await flagsFor(p, "courtDate")).some(f => /has already passed/.test(f)), "today");
    assert.match(await p.textContent("ol.steps"), /Your next court date: /);
    await inject(p, "appearance", { courtDate: yesterday });
    assert.ok((await flagsFor(p, "courtDate")).some(f => /has already passed/.test(f)), "yesterday");
    await p.context().close();
  });
  test("edge: the same for a continuance hearing date of today", async () => {
    const p = await fresh();
    await inject(p, "continuance", { hearingDate: await dayFrom(p, 0) });
    assert.ok(!(await flagsFor(p, "hearingDate")).some(f => /has already passed/.test(f)));
    assert.match(await p.textContent("ol.steps"), /Your hearing is still set for /);
    await p.context().close();
  });
});

describe("TG5: two checks that had no test", () => {
  test("a phone number whose middle three digits start with 0 or 1, or are like 911, is impossible, and flagged", async () => {
    const p = await fresh();
    for (const phone of ["317-055-0100", "317-155-0100", "317-911-0100", "317-411-0100"]) {
      await inject(p, "appearance", { phone });
      assert.ok((await flagsFor(p, "phone")).some(f => /doesn't look like a real U\.S\. phone number/.test(f)), phone);
    }
    await p.context().close();
  });
  test("edge: middle digits that are fine aren't flagged", async () => {
    const p = await fresh();
    for (const phone of ["317-255-0100", "317-910-0100", "317-555-0100"]) {
      await inject(p, "appearance", { phone });
      assert.deepEqual(await flagsFor(p, "phone"), [], phone);
    }
    await p.context().close();
  });
  test("choosing to get court papers by email, with the email \"None\", is flagged", async () => {
    const p = await fresh();
    for (const email of ["None", "n/a", ""]) {
      await inject(p, "appearance", { receiveAt: "Choice2", email });
      assert.ok((await flagsFor(p, "receiveAt")).some(f => /You chose to receive court papers at your email address, but no email address is entered/.test(f)), JSON.stringify(email));
    }
    await inject(p, "appearance", { receiveAt: "Choice2", email: "pat@example.com" });
    assert.ok(!(await flagsFor(p, "receiveAt")).some(f => /no email address is entered/.test(f)), "a real email isn't flagged");
    await p.context().close();
  });
});

describe("TG6: Cancel keeps an I'm not sure mark, and flags are Missing or Check as they should be", () => {
  test("Cancel on an edit of a question marked I'm not sure keeps the mark and its flag", async () => {
    const p = await fresh();
    await inject(p, "appearance", { phone: "" }, { phone: true });
    await p.click('ul.flags li:has([data-fix="phone"]) [data-fix]');
    await p.fill("#ans", "317-555-0111"); await p.click("#back"); // Cancel
    assert.equal(await step(p), "summary");
    assert.equal(await p.evaluate(() => [unsure.phone === true, answers.phone].join("|")), "true|");
    assert.ok((await flagsFor(p, "phone")).some(f => /^missing\|.*\|You marked this "I'm not sure\."/.test(f)));
    await p.context().close();
  });
  test("edge: a needed question marked I'm not sure is Missing; an optional one is a Check", async () => {
    const p = await fresh();
    await inject(p, "appearance", { phone: "", fax: "" }, { phone: true, fax: true });
    assert.ok((await flagsFor(p, "phone")).every(f => f.startsWith("missing|")));
    assert.ok((await flagsFor(p, "fax")).length > 0 && (await flagsFor(p, "fax")).every(f => f.startsWith("check|")));
    await p.context().close();
  });
  test("edge: a needed blank answer is Missing; an optional blank one isn't flagged at all", async () => {
    const p = await fresh();
    await inject(p, "appearance", { name: "", fax: "" });
    assert.ok((await flagsFor(p, "name")).some(f => f.startsWith("missing|")));
    assert.deepEqual(await flagsFor(p, "fax"), []);
    await p.context().close();
  });
});

describe("TG7: the fee waiver keeps contact details off the PDF with the Attorney General confidential address, on its own", () => {
  // The form's field map is called directly, with the details given: the questions that would hide them are the first
  // safety net (tested elsewhere); this is the second one, which must hold by itself.
  const printed = (p, a) => p.evaluate(a => SITUATIONS.feewaiver.fields(a).flatMap(r => r.pdf.map(o => String(o.value ?? ""))).join(" | "), a);
  const DETAILS = { name: "Pat Example", address: "123 Secret Home St, Indianapolis, IN 46204", email: "pat.secret@example.com", phone: "317-555-0199", fax: "317-555-0198", acceptEmail: "yes" };
  test("with it chosen, the address, email, phone and fax print nowhere, even if they were answered", async () => {
    const p = await fresh();
    const out = await printed(p, { ...DETAILS, agConfidential: "yes" });
    for (const v of ["123 Secret Home St", "pat.secret@example.com", "317-555-0199", "317-555-0198"]) assert.ok(!out.includes(v), v);
    assert.ok(out.includes("Pat Example"), "the name still prints");
    await p.context().close();
  });
  test("edge: without it, they all print, so the test above isn't passing by printing nothing", async () => {
    const p = await fresh();
    const out = await printed(p, { ...DETAILS, agConfidential: "no" });
    for (const v of ["123 Secret Home St", "pat.secret@example.com", "317-555-0199", "317-555-0198"]) assert.ok(out.includes(v), v);
    await p.context().close();
  });
});

describe("TG8: each answer prints in its own place on the official form", () => {
  const ready = p => p.waitForFunction(() => pdfState.result && pdfState.key === pdfKey() && !pdfState.busy, null, { timeout: 120000 });
  // Answers that are easy to find in the PDF's text, one word each at least 4 letters long and found nowhere else.
  const UNIQUE = { name: "Pat Placewell", plaintiff: "Acme Plaintiffco LLC", address: "1 Uniqueaddr St, Fort Wayne, IN 46802", email: "pat.placewell@example.com",
    phone: "260-555-0177", fax: "260-555-0166", svc1Name: "Lawyer Servicename", svc1Address: "9 Serviceaddr Ave, Fort Wayne, IN 46802", defenses: "Defensetext about the debt.",
    otherParty: "Otherparty Holdings", otherPartyAddress: "7 Otheraddr Rd, Fort Wayne, IN 46802", reason: "Reasontext for the new date.", timeNeeded: "Fourteenish days",
    adults: "Adultname Person", children: "Childname Person", supported: "Supportedname Person", otherPerson: "Respondentname Co" };
  // For each typed answer: does its text sit inside one of the boxes the tool says it fills (where it highlights it)?
  const placement = p => p.evaluate(async () => {
    await loadPreviewTools();
    const { official } = SITUATIONS[sitKey], off = OFFICIAL[official.packet], pages = official.docs.flatMap(k => off.docs[k].pages);
    const blank = await whereDoc(off.file), filled = await pdfjsLib.getDocument({ data: pdfState.result.all.slice() }).promise;
    const cache = {}, itemsOn = async i => (cache[i] ||= (await (await filled.getPage(i + 1)).getTextContent()).items);
    const out = { checked: [], misplaced: [] };
    for (const s of visible()) {
      if (!["text", "textarea", "email", "tel", "select", "date"].includes(s.type) || empty(answers[s.id])) continue;
      const shown = s.type === "date" ? formDate(answers[s.id]) : String(answers[s.id]);
      const token = shown.split(/[\s,]+/).find(w => w.length >= 4);
      const spots = token ? await whereSpots(s, blank) : [];
      if (!spots.length) continue;
      let inside = false;
      for (const { page, rects } of spots) {
        const at = pages.indexOf(page);
        if (at < 0) continue;
        for (const it of await itemsOn(at)) {
          if (!it.str.includes(token)) continue;
          const [x, y] = [it.transform[4], it.transform[5]];
          if (rects.some(r => x >= Math.min(r[0], r[2]) - 6 && x <= Math.max(r[0], r[2]) + 6 && y >= Math.min(r[1], r[3]) - 8 && y <= Math.max(r[1], r[3]) + 8)) inside = true;
        }
      }
      out.checked.push(s.id);
      if (!inside) out.misplaced.push(`${s.id} (${token})`);
    }
    return out;
  });
  for (const form of ["respond", "appearance", "continuance", "feewaiver"]) {
    test(`${form}: every typed answer prints inside the box it fills`, async () => {
      const p = await fresh();
      await inject(p, form, { ...UNIQUE, role: "other", incomeKinds: "none", expenseKinds: "none" }); await ready(p);
      const { checked, misplaced } = await placement(p);
      assert.ok(checked.length >= 8, `${checked.length} answers checked: ${checked.join(", ")}`);
      assert.deepEqual(misplaced, []);
      await p.context().close();
    });
  }
  test("edge: on the Appearance, each answer sits on the same line as its printed label, so no two boxes are swapped", async () => {
    const p = await fresh();
    await inject(p, "appearance", UNIQUE); await ready(p);
    const LABELS = { "My name is": "Placewell", "Email Address": "pat.placewell@example.com", "Phone Number": "260-555-0177", "Fax Number": "260-555-0166", "CASE NUMBER": "02D01-2611-CC-001234" };
    const off = await p.evaluate(async labels => {
      await loadPreviewTools();
      const doc = await pdfjsLib.getDocument({ data: pdfState.result.all.slice() }).promise, items = [];
      for (let i = 1; i <= 2; i++) for (const it of (await (await doc.getPage(i)).getTextContent()).items) items.push({ page: i, str: it.str, x: it.transform[4], y: it.transform[5] });
      return Object.entries(labels).filter(([label, value]) => {
        // The answer can print in more than one place (the name is in the caption too): any copy on the label's line counts.
        const l = items.find(it => it.str.includes(label));
        return !l || !items.some(v => v.str.includes(value) && v.page === l.page && Math.abs(l.y - v.y) <= 5 && v.x > l.x);
      }).map(([label]) => label);
    }, LABELS);
    assert.deepEqual(off, []);
    await p.context().close();
  });
});

