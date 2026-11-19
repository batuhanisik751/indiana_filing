// Break-test round 3 (BT31-BT48): problems two independent testers found in the new quick edit (item 17), the progress
// bar (item 21), the test set (item 18) and the checks fixed after it (I18a-I18d).
import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fresh, close, inject, editHere, flagsFor, pick, walk, answer, reset, SAVED, BROWSER } from "../lib.mjs";

let p;
before(async () => { p = await fresh(); });
after(close);
const ready = q => q.waitForFunction(() => pdfState.result && !pdfState.busy, null, { timeout: 120000 });
// Opens page n of the filled form large, from "Show the pages" on the summary.
async function openPage(q, n) {
  await ready(q);
  await q.evaluate(() => { const d = document.querySelector('details[data-more="preview"]'); if (d) d.open = true; });
  await q.waitForSelector(`#preview [data-page="${n}"]`, { timeout: 60000 });
  await q.click(`#preview [data-page="${n}"]`);
  await q.waitForSelector("dialog.pageview .pvpage canvas", { timeout: 60000 });
}
const tap = async (q, id, k = 0) => { await q.locator(`dialog.pageview .pvspot[data-id="${id}"]`).nth(k).click(); await q.waitForSelector("#pvEdit"); };
const saved = (q, id) => q.evaluate(([k, id]) => JSON.parse(localStorage.getItem(k)).answers[id], [SAVED, id]);
// A page of its own with saving on, so what's on the device can be read back.
async function savingPage() {
  const q = await fresh();
  await q.click("#savePref");
  return q;
}

describe("BT31. An answer emptied in its box goes back on the device when the box is let go", () => {
  test("emptied on the summary, then given up for an answer on a page shown large: the old answer is saved again", async () => {
    const q = await savingPage();
    await inject(q, "respond");
    await q.evaluate(() => saveProgress());
    await editHere(q, "plaintiff");
    await q.fill("#inEdit", "");
    assert.equal(await saved(q, "plaintiff"), "", "off the device while the box is empty");
    await openPage(q, 1);
    await tap(q, "email"); // "Discard your change to Plaintiff?" OK
    assert.match(q.dialogs.at(-1).message, /Discard your change to "Plaintiff"/);
    assert.equal(await saved(q, "plaintiff"), "Acme Credit LLC");
    await q.click("#ieCancel");
    await q.click("#pvClose");
    await q.reload(); await q.waitForSelector("#app h1");
    if (await q.locator("#resume").count()) await q.click("#resume");
    assert.equal(await q.evaluate(() => answers.plaintiff), "Acme Credit LLC");
  });

  test("emptied on a page shown large, then given up for another answer there: the old answer is saved again", async () => {
    const q = await savingPage();
    await inject(q, "respond");
    await q.evaluate(() => saveProgress());
    await openPage(q, 1);
    await tap(q, "plaintiff");
    await q.fill("#inEdit", "");
    assert.equal(await saved(q, "plaintiff"), "");
    await tap(q, "email");
    assert.equal(await saved(q, "plaintiff"), "Acme Credit LLC");
    assert.equal(await q.evaluate(() => inlineEdit && inlineEdit.id), "email");
  });

  test("edge: emptied, then its row goes away (another answer hides it): the old answer is saved again", async () => {
    const q = await savingPage();
    await inject(q, "respond", { related: "yes", relatedNumbers: "02D01-2401-CC-000111" });
    await q.evaluate(() => saveProgress());
    await editHere(q, "relatedNumbers");
    await q.fill("#inEdit", "");
    assert.equal(await saved(q, "relatedNumbers"), "");
    await q.evaluate(() => { answers.related = "no"; keepFocus(() => renderSummary(true)); });
    assert.equal(await q.evaluate(() => inlineEdit), null);
    assert.equal(await saved(q, "related"), "no");
    assert.notEqual(await saved(q, "relatedNumbers"), "", "not kept off as if erased");
  });
});

describe("BT41. A bus, boarding or parking pass isn't taken for a password", () => {
  const privacy = async (form, id, text, more = {}) => { await inject(p, form, { ...more, [id]: text }); return (await flagsFor(p, id)).filter(f => /Private information/.test(f)); };
  const FEE = { incomeKinds: "wages", expenseKinds: "otherCosts", otherCosts: "45" };
  test("expenses, reasons and defenses with a pass in them get no privacy flag", async () => {
    for (const t of ["Bus pass is $45/mo", "IndyGo pass: $60/month", "Gym pass is 30/mo", "My kids' pool season pass is $99/yr", "Hospital parking pass is $25/wk while my son is in the NICU", "Monthly bus pass = 2x$20", "Water bill to PWD is $40/mo", "Water bill to PWD: $40/mo"])
      assert.deepEqual(await privacy("feewaiver", "otherCostsDesc", t, FEE), [], t);
    for (const t of ["I will be out of state for my mother's surgery. My boarding pass is DL1452 for that morning.", "I can't get in without my building pass, and my building pass is B2-114.", "The jail visit pass was noon-4pm.", "My bus pass was 11/30-only."])
      assert.deepEqual(await privacy("continuance", "reason", t), [], t);
    for (const t of ["I bought it on a sale and the pass was 2-for-1.", "Pass: 7-day", "My pass was 10.30am"])
      assert.deepEqual(await privacy("respond", "defenses", t), [], t);
  });
  test("a password after \"pass\" is still flagged, and Fix still selects it", async () => {
    for (const t of ["My pass is hunter2", "PASS IS HUNTER22", "pass: Hunter22", "Login pass: Hunter22", "my wifi pass is Blue1234", "user pat and pass is Hunter22", "pw=abc123", "pwd: S3cret!"])
      assert.equal((await privacy("respond", "defenses", `I paid in full. ${t}`)).length, 1, t);
    await inject(p, "respond", { defenses: "I paid. My pass is hunter2 if the court needs it." });
    const hit = await p.evaluate(() => runChecks().find(f => f.fix === "defenses" && /Private/.test(f.title)).hit);
    assert.deepEqual(hit.map(([s, e]) => "I paid. My pass is hunter2 if the court needs it.".slice(s, e)), ["pass is hunter2"]);
  });
});

describe("BT32. A box on a page shown large isn't lost when the page changes", () => {
  // Answers the next confirm() with Cancel instead of OK.
  const cancelNext = q => { q.removeAllListeners("dialog"); q.once("dialog", d => { q.dialogs.push({ type: d.type(), message: d.message() }); d.dismiss(); q.on("dialog", d2 => { q.dialogs.push({ type: d2.type(), message: d2.message() }); d2.accept(); }); }); };
  const pageNo = q => q.$eval("#pvTitle", h => +h.textContent.match(/Page (\d+)/)[1]);
  test("Next page with a changed box asks first; OK lets the box go, and later taps open at once", async () => {
    await inject(p, "respond");
    await openPage(p, 1);
    await tap(p, "plaintiff");
    await p.fill("#inEdit", "Acme Credit Holdings LLC");
    const asked = p.dialogs.length;
    await p.click("#pvNext");
    assert.equal(p.dialogs.length, asked + 1);
    assert.match(p.dialogs.at(-1).message, /Discard your change to "Plaintiff"/);
    await p.waitForFunction(() => /Page 2 /.test(document.getElementById("pvTitle").textContent) && document.querySelector("dialog.pageview .pvpage canvas"));
    assert.equal(await p.evaluate(() => inlineEdit), null);
    assert.equal(await p.evaluate(() => answers.plaintiff), "Acme Credit LLC");
    await p.click("#pvPrev");
    await p.waitForSelector("dialog.pageview .pvspot");
    await tap(p, "plaintiff");
    assert.equal(p.dialogs.length, asked + 1, "no question about a box that's gone");
    assert.equal(await p.$eval("#inEdit", b => b.value), "Acme Credit LLC");
    await p.keyboard.press("Escape");
    await p.keyboard.press("Escape");
  });

  test("Cancel on that question stays on the page with the box and what was typed", async () => {
    await inject(p, "respond");
    await openPage(p, 1);
    await tap(p, "plaintiff");
    await p.fill("#inEdit", "Acme Credit Holdings LLC");
    cancelNext(p);
    await p.click("#pvNext");
    assert.equal(await pageNo(p), 1);
    assert.equal(await p.$eval("#inEdit", b => b.value), "Acme Credit Holdings LLC");
    assert.equal(await p.evaluate(() => document.activeElement.id), "inEdit");
    await p.keyboard.press("Escape");
    await p.keyboard.press("Escape");
  });

  test("an unchanged box closes with the page turn without a question", async () => {
    await inject(p, "respond");
    await openPage(p, 1);
    await tap(p, "plaintiff");
    const asked = p.dialogs.length;
    await p.click("#pvNext");
    assert.equal(p.dialogs.length, asked);
    assert.equal(await p.evaluate(() => inlineEdit), null);
    await p.keyboard.press("Escape");
  });

  test("while the page is made again after a Save, its answers can't be tapped; then they can", async () => {
    await inject(p, "respond");
    await openPage(p, 1);
    await p.evaluate(() => { window.__realBuild = buildPdf; globalThis.eval("buildPdf = (...a) => new Promise(r => setTimeout(r, 1500)).then(() => window.__realBuild(...a))"); });
    await tap(p, "plaintiff");
    await p.fill("#inEdit", "Acme Credit Holdings LLC");
    await p.click("#ieSave");
    assert.equal(await p.locator("dialog.pageview .pvspot:not([disabled])").count(), 0);
    assert.ok(await p.locator("dialog.pageview .pvspot[disabled]").count() > 0);
    await p.locator('dialog.pageview .pvspot[data-id="email"]').first().click({ force: true });
    assert.equal(await p.evaluate(() => inlineEdit), null, "no box opened");
    // Turning the page while waiting shows that page held too.
    await p.click("#pvNext");
    await p.waitForFunction(() => /Page 2 /.test(document.getElementById("pvTitle").textContent) && document.querySelector("dialog.pageview .pvhint"));
    assert.match(await p.textContent("dialog.pageview .pvhint"), /Making the page again/);
    await p.waitForFunction(() => !pdfState.busy && document.querySelector("dialog.pageview .pvspot:not([disabled])"), null, { timeout: 120000 });
    assert.equal(await p.evaluate(() => answers.plaintiff), "Acme Credit Holdings LLC");
    await p.evaluate(() => globalThis.eval("buildPdf = window.__realBuild"));
    await p.keyboard.press("Escape");
  });
});

describe("BT33. A case number changed in place asks about the county and court as its question does", () => {
  for (const confirm of ["no", ""]) test(`with the county and court ${confirm ? "chosen by hand" : "not confirmed"}, another county's number goes to its question`, async () => {
    await inject(p, "respond", { caseConfirm: confirm });
    await editHere(p, "caseNumber");
    await p.fill("#inEdit", "49D01-2611-CC-001234");
    await p.click("#ieSave");
    assert.equal(await p.evaluate(() => mode === "step" && visible()[cur].id), "caseNumber");
    assert.equal(await p.$eval("#ans", b => b.value), "49D01-2611-CC-001234");
    assert.match(await p.textContent("#inlineNote"), /brings up another question/);
    assert.equal(await p.evaluate(() => [answers.caseNumber, answers.caseConfirm ?? ""].join("|")), `02D01-2611-CC-001234|${confirm}`, "nothing changed until it's saved there");
    await p.click("#next");
    assert.equal(await p.evaluate(() => mode === "step" && visible()[cur].id), "caseConfirm");
  });
  test("edge: with the county and court confirmed, a number in the same court still saves in place", async () => {
    await inject(p, "respond", { caseConfirm: "yes" });
    await editHere(p, "caseNumber");
    await p.fill("#inEdit", "02D01-2611-CC-001299");
    await p.click("#ieSave");
    assert.equal(await p.evaluate(() => [mode, answers.caseNumber, answers.caseConfirm].join("|")), "summary|02D01-2611-CC-001299|yes");
  });
});

describe("BT34. Tapping an answer on a page shown large opens that answer, not the one next to it", () => {
  // For every answer on the page: what's under the middle of it is that answer, or another one whose own box is there too.
  const middles = q => q.evaluate(async () => {
    const all = [...document.querySelectorAll("dialog.pageview .pvspot")], wrong = [];
    for (const s of all) {
      s.scrollIntoView({ block: "center" }); await new Promise(r => requestAnimationFrame(r));
      const r = s.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, hit = document.elementFromPoint(x, y);
      const box = hit && hit.getBoundingClientRect();
      if (hit !== s && !(hit?.classList.contains("pvspot") && x >= box.left && x <= box.right && y >= box.top && y <= box.bottom)) wrong.push(`${s.getAttribute("aria-label")} -> ${hit?.getAttribute("aria-label") || hit?.tagName}`);
    }
    return { count: all.length, wrong };
  });
  for (const [w, h, form, n, more] of [[320, 568, "respond", 1], [320, 568, "continuance", 1], [375, 667, "feewaiver", 5, { incomeKinds: "wages,ss", expenseKinds: "rent,food" }], [1000, 900, "feewaiver", 5, { incomeKinds: "wages,ss", expenseKinds: "rent,food" }], [1000, 900, "appearance", 1]])
    test(`${w}px, ${form} page ${n}: the middle of every answer is that answer`, async () => {
      const q = await fresh({ viewport: { width: w, height: h }, hasTouch: true });
      await inject(q, form, more || {});
      await openPage(q, n);
      const m = await middles(q);
      assert.ok(m.count > 3, `${m.count} answers`);
      assert.deepEqual(m.wrong, []);
    });
  test("a finger on the email address at 320px opens the email address", async () => {
    const q = await fresh({ viewport: { width: 320, height: 568 }, hasTouch: true });
    await inject(q, "respond");
    await openPage(q, 1);
    const at = await q.evaluate(async () => { const s = document.querySelector('dialog.pageview .pvspot[data-id="email"]'); s.scrollIntoView({ block: "center" }); await new Promise(r => requestAnimationFrame(r)); const r = s.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
    await q.touchscreen.tap(...at);
    await q.waitForSelector("#pvEdit");
    assert.equal(await q.textContent("#pvEditTitle"), "Email address");
  });
  test("edge: the margin around a small answer still opens it where no other answer is", async () => {
    const q = await fresh({ viewport: { width: 320, height: 568 }, hasTouch: true });
    await inject(q, "respond");
    await openPage(q, 1);
    const at = await q.evaluate(async () => {
      const all = [...document.querySelectorAll("dialog.pageview .pvspot")];
      for (const s of all) {
        s.scrollIntoView({ block: "center" }); await new Promise(r => requestAnimationFrame(r));
        const r = s.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top - 4; // 4px above it
        if (document.elementFromPoint(x, y) === s && !all.some(o => o !== s && (b => x >= b.left && x <= b.right && y >= b.top - 6 && y <= b.bottom + 6)(o.getBoundingClientRect()))) return { x, y, label: s.getAttribute("aria-label") };
      }
      return null;
    });
    assert.ok(at, "a small answer with room around it");
    await q.touchscreen.tap(at.x, at.y);
    await q.waitForSelector("#pvEdit");
    assert.equal(`Change: ${await q.textContent("#pvEditTitle")}`, at.label);
  });
});

describe("BT35. What's typed in a box on the summary comes back after a reload", () => {
  const reload = async q => { await q.reload(); await q.waitForSelector("#app h1"); if (await q.locator("#resume").count()) await q.click("#resume"); await q.waitForSelector("#inEdit"); };
  test("typed and not saved: after a reload the box is open with it, focused, and Cancel keeps the old answer", async () => {
    const q = await savingPage();
    await inject(q, "respond");
    await q.evaluate(() => saveProgress());
    await editHere(q, "plaintiff");
    await q.fill("#inEdit", "Acme Credit Holdings LLC");
    await reload(q);
    assert.equal(await q.$eval("#inEdit", b => b.value), "Acme Credit Holdings LLC");
    assert.equal(await q.evaluate(() => document.activeElement.id), "inEdit");
    assert.equal(await q.evaluate(() => [mode, answers.plaintiff].join("|")), "summary|Acme Credit LLC");
    await q.click("#ieCancel");
    assert.equal(await q.evaluate(() => answers.plaintiff), "Acme Credit LLC");
    assert.equal(await saved(q, "plaintiff"), "Acme Credit LLC");
  });
  test("Save after the reload saves what was typed", async () => {
    const q = await savingPage();
    await inject(q, "respond");
    await q.evaluate(() => saveProgress());
    await editHere(q, "email");
    await q.fill("#inEdit", "pat.new@example.com");
    await reload(q);
    await q.click("#ieSave");
    assert.equal(await q.evaluate(() => [mode, answers.email, inlineEdit].join("|")), "summary|pat.new@example.com|");
    assert.equal(await saved(q, "email"), "pat.new@example.com");
  });
  test("emptied, then typed: after a reload the box says the erased answer isn't kept, and Cancel leaves it blank", async () => {
    const q = await savingPage();
    await inject(q, "respond");
    await q.evaluate(() => saveProgress());
    await editHere(q, "plaintiff");
    await q.fill("#inEdit", "");
    await q.fill("#inEdit", "Acme");
    assert.equal(await saved(q, "plaintiff"), "", "the old answer stays off the device");
    await reload(q);
    assert.equal(await q.$eval("#inEdit", b => b.value), "Acme");
    assert.match(await q.textContent("#ieNeed"), /The answer you erased before reloading isn't kept\. Cancel leaves this blank\./);
    await q.click("#ieCancel");
    assert.equal(await q.evaluate(() => answers.plaintiff), "");
  });
  test("edge: with saving off nothing typed is kept anywhere", async () => {
    await inject(p, "respond");
    await editHere(p, "plaintiff");
    await p.fill("#inEdit", "Acme Credit Holdings LLC");
    assert.equal(await p.evaluate(k => localStorage.getItem(k), SAVED), null);
    await p.click("#ieCancel");
  });
});

describe("BT36. After Save in a box on a page shown large, focus doesn't fall to the page", () => {
  const focused = q => q.evaluate(() => { const a = document.activeElement; return a === document.body ? "BODY" : a.id || a.className; });
  test("it goes to the line saying the page is being made again, then to the answer", async () => {
    await inject(p, "respond");
    await openPage(p, 1);
    await p.evaluate(() => { window.__realBuild = buildPdf; globalThis.eval("buildPdf = (...a) => new Promise(r => setTimeout(r, 1200)).then(() => window.__realBuild(...a))"); });
    await tap(p, "plaintiff");
    await p.fill("#inEdit", "Acme Credit Holdings LLC");
    await p.click("#ieSave");
    assert.equal(await focused(p), "pvSaving");
    assert.match(await p.textContent("#pvSaving"), /Making the page again/);
    await p.waitForFunction(() => document.activeElement?.classList.contains("pvspot"), null, { timeout: 120000 });
    assert.equal(await p.evaluate(() => document.activeElement.dataset.id), "plaintiff");
    await p.evaluate(() => globalThis.eval("buildPdf = window.__realBuild"));
    await p.keyboard.press("Escape");
  });
  test("edge: if the form can't be made again, focus goes to Close, beside the message", async () => {
    await inject(p, "respond");
    await openPage(p, 1);
    await p.evaluate(() => { window.__realBuild = buildPdf; globalThis.eval("buildPdf = () => new Promise((r, no) => setTimeout(() => no(new Error('test: no form')), 300))"); });
    await tap(p, "plaintiff");
    await p.fill("#inEdit", "Acme Credit Holdings LLC");
    await p.click("#ieSave");
    await p.waitForFunction(() => /couldn't be made again/.test(document.querySelector("dialog.pageview .pvbody")?.textContent || ""), null, { timeout: 60000 });
    assert.equal(await focused(p), "pvClose");
    await p.evaluate(() => globalThis.eval("buildPdf = window.__realBuild"));
    await p.keyboard.press("Escape");
  });
});

describe("BT37. Escape closes the box on the summary from its buttons too", () => {
  for (const button of ["ieSave", "ieCancel", "ieFull"]) test(`Escape on ${button === "ieSave" ? "Save" : button === "ieCancel" ? "Cancel" : "Open the full question"}`, async () => {
    await inject(p, "respond");
    await editHere(p, "plaintiff");
    await p.fill("#inEdit", "Acme Credit Holdings LLC");
    await p.focus(`#${button}`);
    await p.keyboard.press("Escape");
    assert.equal(await p.locator("#inEdit").count(), 0);
    assert.equal(await p.evaluate(() => [mode, answers.plaintiff, inlineEdit].join("|")), "summary|Acme Credit LLC|");
    assert.equal(await p.evaluate(() => document.activeElement.matches('dl.vals [data-fix="plaintiff"]')), true);
  });
  test("edge: Tab from the box to Save, then Escape; and Escape on a page shown large still closes only its box", async () => {
    await inject(p, "respond");
    await editHere(p, "plaintiff");
    // Safari's Tab skips buttons unless the person turns that on, so there Save is focused directly.
    if (BROWSER === "webkit") await p.focus("#ieSave"); else await p.keyboard.press("Tab");
    assert.equal(await p.evaluate(() => document.activeElement.id), "ieSave");
    await p.keyboard.press("Escape");
    assert.equal(await p.locator("#inEdit").count(), 0);
    await openPage(p, 1);
    await tap(p, "plaintiff");
    await p.focus("#ieSave");
    await p.keyboard.press("Escape");
    assert.equal(await p.locator("#pvEdit").count(), 0);
    assert.equal(await p.locator("dialog.pageview[open]").count(), 1);
    await p.keyboard.press("Escape");
  });
});

describe("BT38. On a 320px phone, a box opened on the summary fits the screen", () => {
  test("every typed answer of every form, at the usual size and at 150%: nothing goes past the side", async () => {
    const q = await fresh({ viewport: { width: 320, height: 640 } });
    const over = [];
    for (const big of [false, true]) {
      if (big) { await q.click("#readBtn"); for (let i = 0; i < 3; i++) await q.click("#textBigger"); await q.click("#readBtn"); } // A+ to 150%
      for (const [form, more] of [["respond"], ["appearance"], ["continuance"], ["feewaiver", { incomeKinds: "wages", expenseKinds: "otherCosts", otherCosts: "45", otherCostsDesc: "Bus fare" }]]) {
        await inject(q, form, more || {});
        await q.evaluate(() => { document.querySelector('details[data-more="answers"]').open = true; });
        const ids = await q.$$eval("dl.vals [data-inline]", b => [...new Set(b.map(x => x.dataset.fix))]);
        for (const id of ids) {
          await q.click(`dl.vals [data-inline][data-fix="${id}"]`);
          await q.waitForSelector("#inEdit");
          const m = await q.evaluate(() => ({ wide: document.documentElement.scrollWidth, right: Math.round(document.getElementById("inEdit").getBoundingClientRect().right), card: Math.round(document.getElementById("inEdit").closest(".formcard").getBoundingClientRect().right),
            broken: ["ieSave", "ieCancel"].filter(b => { const e = document.getElementById(b), cs = getComputedStyle(e); return e.getBoundingClientRect().height > parseFloat(cs.lineHeight) * 1.5 + parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) + 4; }) }));
          if (m.wide > 320 || m.right > m.card) over.push(`${big ? "150%" : "100%"} ${form}.${id}: page ${m.wide}px, box ends at ${m.right} past its card's ${m.card}`);
          if (m.broken.length) over.push(`${big ? "150%" : "100%"} ${form}.${id}: ${m.broken.join(" and ")} on two lines`);
          await q.click("#ieCancel");
        }
      }
    }
    assert.deepEqual(over, []);
  });
});

describe("BT39. A date half typed in a box on the summary isn't wiped when the summary is drawn again", () => {
  test("the filled form finishing while the month is typed: the box and cursor stay, and the rest of the date can be typed", { skip: BROWSER === "webkit" && "Playwright's WebKit date box takes no typed dates" }, async () => {
    await inject(p, "continuance");
    await p.waitForFunction(() => pdfState.result && !pdfState.busy, null, { timeout: 120000 }); // or its build would finish first
    await p.evaluate(() => { window.__realBuild = buildPdf; globalThis.eval("buildPdf = (...a) => new Promise(r => setTimeout(r, 1500)).then(() => window.__realBuild(...a))"); pdfState = { key: null }; ensurePdf(); renderSummary(true); });
    await editHere(p, "hearingDate");
    await p.evaluate(() => { document.getElementById("inEdit").value = ""; });
    await p.focus("#inEdit");
    await p.keyboard.type("12");
    const box = await p.$("#inEdit");
    assert.equal(await p.evaluate(() => [document.getElementById("inEdit").validity.badInput, pdfState.busy].join()), "true,true");
    await p.waitForFunction(() => !pdfState.busy, null, { timeout: 120000 });
    await p.waitForTimeout(200);
    assert.equal(await box.evaluate(b => b.isConnected && document.activeElement === b && b.validity.badInput), true, "the same box, still half typed");
    await p.keyboard.type("112026"); // the date box's own order of parts: day and month, or month and day
    const typed = await p.$eval("#inEdit", b => b.value);
    assert.ok(["2026-11-12", "2026-12-11"].includes(typed), typed);
    await p.waitForFunction(() => /ready|review|Nothing/.test(document.querySelector(".status")?.textContent || "")); // drawn again once the date is whole
    assert.equal(await p.evaluate(() => [document.activeElement.id, document.getElementById("inEdit").value].join("|")), `inEdit|${typed}`);
    await p.click("#ieSave");
    assert.equal(await p.evaluate(() => answers.hearingDate), typed);
    await p.evaluate(() => globalThis.eval("buildPdf = window.__realBuild"));
  });
  test("edge: Save pressed down while the summary waits to be drawn again still saves", { skip: BROWSER === "webkit" && "Playwright's WebKit date box takes no typed dates" }, async () => {
    await inject(p, "continuance");
    await p.waitForFunction(() => pdfState.result && !pdfState.busy, null, { timeout: 120000 });
    await editHere(p, "hearingDate");
    await p.evaluate(() => { document.getElementById("inEdit").value = ""; });
    await p.keyboard.type("12");
    await p.evaluate(() => keepFocus(() => renderSummary(true))); // waits
    await p.keyboard.type("112026");
    const typed = await p.$eval("#inEdit", b => b.value);
    const at = await p.$eval("#ieSave", b => { const r = b.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
    await p.waitForTimeout(1300);
    await p.mouse.move(...at); await p.mouse.down();
    await p.waitForTimeout(600); // past the moment it would have been drawn again
    await p.mouse.up();
    assert.equal(await p.evaluate(() => [answers.hearingDate, inlineEdit].join("|")), `${typed}|`);
  });
  test("edge: with a whole date in the box, the summary is drawn again as usual and the box keeps it", async () => {
    await inject(p, "continuance");
    await editHere(p, "hearingDate");
    await p.fill("#inEdit", "2026-12-23");
    await p.evaluate(() => keepFocus(() => renderSummary(true)));
    assert.equal(await p.evaluate(() => [document.activeElement.id, document.getElementById("inEdit").value].join("|")), "inEdit|2026-12-23");
    await p.click("#ieCancel");
  });
});

describe("BT40. When an answer brings up more needed questions, the next question says why the bar moved back", () => {
  const pct = q => q.$eval(".bar[role=progressbar]", b => +b.getAttribute("aria-valuenow"));
  test("Yes to sending a copy to someone else: the bar moves back, and a line says how many questions that added", async () => {
    await reset(p);
    await pick(p, "appearance");
    await walk(p, "svcMore1");
    const before = await pct(p), total = await p.evaluate(() => completeness().total);
    await answer(p, "yes");
    const added = await p.evaluate(() => completeness().total) - total;
    assert.ok(added > 0 && (await pct(p)) < before);
    assert.equal(await p.textContent("#barNote"), `Your last answer added ${added} needed questions, so the bar moved back a little.`);
    const said = await p.evaluate(() => new Promise(r => setTimeout(() => r(document.getElementById("announce").textContent), 120)));
    assert.equal(said, `Your last answer added ${added} needed questions, so the bar moved back a little.`);
    await p.fill("#ans", "Someone Else");
    await p.click("#next");
    assert.equal(await p.locator("#barNote").count(), 0, "said once, on the next question only");
  });
  test("edge: an answer that brings up no needed question says nothing", async () => {
    await reset(p);
    await pick(p, "appearance");
    await walk(p, "name");
    await answer(p, "Pat Example");
    assert.equal(await p.locator("#barNote").count(), 0);
  });
});

describe("BT42. Paragraphs after \"except\" are taken out of the list, however they're written", () => {
  const listFlags = async (admitted, denied) => { await inject(p, "respond", { admitted, denied, notEnough: "" }); return p.evaluate(() => runChecks().filter(f => ["admitted", "denied", "notEnough"].includes(f.fix)).map(f => f.title)); };
  test("the \"all\" flag's own advice gets no new flag", async () => {
    await inject(p, "respond", { admitted: "all", denied: "3-5", notEnough: "" });
    const why = await p.evaluate(() => runChecks().find(f => f.title === "Your lists say different things").why);
    const advice = why.match(/you could write "([^"]+)"/)[1];
    assert.equal(advice, "all except 3 through 5");
    assert.deepEqual(await listFlags(advice, "3-5"), []);
    assert.deepEqual(await listFlags("all except 2 through 4 and 7", "2, 3, 4, 7"), []);
  });
  test("ranges, #, ¶, no., ordinals, \"save\" and \"apart from\" after all", async () => {
    for (const [admitted, denied] of [["all except 3-5", "3-5"], ["All except 3 thru 5", "3 thru 5"], ["All except #3", "3"], ["All except paragraph #3", "3"], ["All except ¶ 3", "3"], ["All except no. 3", "3"], ["All except the 3rd", "3"], ["all, save 3", "3"], ["All apart from 3", "3"], ["All except numbers 3 and 4", "3, 4"], ["All except paras 3 and 4", "3, 4"]])
      assert.deepEqual(await listFlags(admitted, denied), [], `${admitted} / ${denied}`);
  });
  test("numbers before \"except\" lose the ones after it: \"1-5 except 3\" is 1, 2, 4 and 5", async () => {
    assert.deepEqual(await listFlags("1-5 except 3", "3, 6"), []);
    assert.deepEqual(await listFlags("1-5 except 3", "6"), ["Paragraphs not in any list"]);
    assert.match((await flagsFor(p, "admitted")).join(), /Paragraph 3 isn't in any of your lists/);
  });
  test("edge: still flagged: \"all\" next to a named paragraph, and one paragraph in two lists", async () => {
    assert.deepEqual(await listFlags("all", "3"), ["Your lists say different things"]);
    assert.deepEqual(await listFlags("1, 2, 3", "3, 4"), ["Paragraphs listed in more than one list"]);
  });
});

describe("BT43. Passwords written in other ways are caught", () => {
  const privacy = async text => { await inject(p, "respond", { defenses: text }); return (await flagsFor(p, "defenses")).filter(f => /Private information/.test(f)); };
  test("\"is:\", \"passwd\", \"pass word\", \"pass code\", \" - \", \"pass's\", \"#\", after a user name, and \"password for the portal is\"", async () => {
    for (const t of ["I paid. pass is: Hunter22", "I paid. passwd: Hunter22", "I paid. pass word is Hunter22", "I paid. pass code is 4829", "I paid. My pass - Hunter22", "I paid. My pass’s Hunter22", "I paid. My pass is #Hunter22", "I paid. user pat88 pass Hunter22", "I paid. username: pat88, password Hunter22", "I paid online. My password for the portal is Hunter22 if anyone needs to check.", "My passcode for the app was Sunny2024!"])
      assert.equal((await privacy(t)).length, 1, t);
  });
  test("Fix selects the password with its label", async () => {
    const t = "I paid online. My password for the portal is Hunter22 if anyone needs to check.";
    await inject(p, "respond", { defenses: t });
    const hit = await p.evaluate(() => runChecks().find(f => f.fix === "defenses" && /Private/.test(f.title)).hit);
    assert.ok(hit.some(([s, e]) => t.slice(s, e).includes("Hunter22")), JSON.stringify(hit.map(([s, e]) => t.slice(s, e))));
  });
  test("edge: still not flagged: a password that's wrong or was changed, a user name, a free pass", async () => {
    for (const t of ["My password is wrong", "My password for the bank was changed in 2024", "I forgot my password for the account", "The user name on the account is Pat", "user error - the pass was free", "They said my pass code was expired"])
      assert.deepEqual(await privacy(t), [], t);
  });
});

describe("BT44. A list that says \"all\" in other words is read as all of them", () => {
  const listFlags = async (admitted, denied) => { await inject(p, "respond", { admitted, denied, notEnough: "" }); return p.evaluate(() => runChecks().filter(f => ["admitted", "denied", "notEnough"].includes(f.fix)).map(f => f.title)); };
  test("next to a named paragraph, each gets \"Your lists say different things\", and nothing else", async () => {
    for (const t of ["All 12", "all 12 paragraphs", "I agree with all of it", "Every single one", "All paragraphs are accurate", "Yes, all", "all of em"])
      assert.deepEqual(await listFlags(t, "3"), ["Your lists say different things"], t);
  });
  test("what's quoted: only list words; other words are described, not repeated", async () => {
    await listFlags("All 12", "3");
    assert.match((await flagsFor(p, "admitted")).join(), /says "All 12"/);
    await listFlags("I agree with all of it", "3");
    const why = (await flagsFor(p, "admitted")).join();
    assert.match(why, /seems to say all of them/);
    assert.doesNotMatch(why, /agree/);
  });
  test("on its own, it's a list like any other: no flag; and \"all 12\" doesn't name paragraph 12", async () => {
    assert.deepEqual(await listFlags("I agree with all of it", ""), []);
    assert.deepEqual(await listFlags("All 12", ""), []);
    assert.deepEqual(await p.evaluate(() => [...paragraphNumbers("All 12")]), []);
  });
  test("edge: \"not all\", \"all 3 through 5\" and a sentence with no numbers are read as before", async () => {
    assert.deepEqual(await listFlags("1, 2, all 3 through 5", "6"), []);
    await inject(p, "respond", { admitted: "1, 2", denied: "I do not agree with all of it", notEnough: "3" });
    assert.deepEqual(await p.evaluate(() => runChecks().filter(f => f.fix === "denied").map(f => f.title)), ["Paragraphs you deny"]);
  });
});

describe("BT45. Paragraph numbers in words are read after twenty, before a verb, in ranges and as ordinals", () => {
  const listFlags = async (admitted, denied, notEnough = "") => { await inject(p, "respond", { admitted, denied, notEnough }); return p.evaluate(() => runChecks().filter(f => ["admitted", "denied", "notEnough"].includes(f.fix)).map(f => f.title)); };
  const TWICE = "Paragraphs listed in more than one list", NONE = "Paragraphs not in any list";
  test("each of these is now flagged", async () => {
    for (const [a, d, n, want] of [
      ["Paragraphs one, two and three are true", "three", "", TWICE],
      ["Paragraph one is true, paragraph two is true", "Paragraph two", "", TWICE],
      ["1-20", "twenty-one", "twenty-one", TWICE],
      ["1-20", "twenty one", "21", TWICE],
      ["1-29", "thirty", "thirty", TWICE],
      ["one through twenty", "twenty-two", "", NONE],
      ["one-four", "two", "", TWICE],
      ["one - four", "six", "", NONE],
      ["One/Two", "Four", "", NONE],
      ["first and second", "second", "", TWICE],
      ["the first five", "7", "", NONE],
    ]) assert.deepEqual(await listFlags(a, d, n), [want], `${a} / ${d} / ${n}`);
  });
  test("edge: words that aren't paragraph numbers are still left alone", async () => {
    assert.deepEqual(await p.evaluate(() => ["every one", "one of them", "One paragraph is wrong", "No one told me", "the first of them"].map(t => [...paragraphNumbers(t)].length)), [0, 0, 0, 0, 0]);
    assert.deepEqual(await listFlags("1, 2", "3", "One paragraph is about a different debt."), ["Paragraphs you can't admit or deny"]);
  });
});

describe("BT46. A number word after \"to\" in a sentence isn't read as a paragraph", () => {
  const listFlags = async (admitted, denied) => { await inject(p, "respond", { admitted, denied, notEnough: "" }); return p.evaluate(() => runChecks().filter(f => ["admitted", "denied", "notEnough"].includes(f.fix)).map(f => f.title)); };
  test("\"I only agreed to one\" and \"the rent went up to twelve\" get no paragraph flag", async () => {
    assert.deepEqual(await listFlags("1, 2, 3", "4. I only agreed to one."), []);
    assert.deepEqual(await listFlags("1-4", "5, the rent went up to twelve"), []);
  });
  test("edge: ranges in words still read: \"one to four\", \"1 through six\", \"twenty-one through twenty-three\"", async () => {
    assert.deepEqual(await p.evaluate(() => ["one to four", "1 through six", "1, 2, twenty-one through twenty-three", "one-four"].map(t => [...paragraphNumbers(t)].join(","))), ["1,2,3,4", "1,2,3,4,5,6", "1,2,21,22,23", "1,2,3,4"]);
    assert.deepEqual(await listFlags("one to four", "three"), ["Paragraphs listed in more than one list"]);
  });
});

describe("BT47. Other ways of saying there's no fax number aren't flagged, and words get a fitting message", () => {
  test("\"Not applicable\", \"No fax\", \"No\", \"nope\", \"N / A\", \"I don't have one\" and ones with a remark", async () => {
    for (const [form, fax] of [["appearance", "Not applicable"], ["appearance", "No fax"], ["respond", "no fax number"], ["continuance", "No"], ["feewaiver", "nope"], ["appearance", "None!"], ["appearance", "None - I don't have one"], ["appearance", "n/a (no fax)"], ["appearance", "N / A"], ["appearance", "I don’t have one"]]) {
      await inject(p, form, { fax });
      assert.deepEqual(await flagsFor(p, "fax"), [], `${form}: ${fax}`);
    }
  });
  test("other words say they're words, not that the number is short; \"I don't know\" and a short number as before", async () => {
    await inject(p, "appearance", { fax: "Same as phone" });
    assert.deepEqual(await flagsFor(p, "fax"), ["check|Fax number|You typed words, not a fax number, and they will print on the form. Type the number, or leave it blank if you don't have one."]);
    await inject(p, "appearance", { fax: "I don't know" });
    assert.match((await flagsFor(p, "fax")).join(), /You typed "I don't know"/);
    await inject(p, "appearance", { fax: "555-01" });
    assert.match((await flagsFor(p, "fax")).join(), /doesn't look like a full fax number/);
  });
  test("edge: \"No\" in the phone box is still flagged: a phone number is needed", async () => {
    await inject(p, "appearance", { phone: "No" });
    assert.match((await flagsFor(p, "phone")).join(), /You typed "No"/);
  });
});
