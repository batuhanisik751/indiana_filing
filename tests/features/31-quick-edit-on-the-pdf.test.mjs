// Item 17 on the MVP list, part 2: on a page of the filled form shown large, each answer can be tapped (or reached with
// Tab) to change it in a small box over the page, checked the same way as on its question. The page is made again.
import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fresh, close, inject, SAVED } from "../lib.mjs";

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
// The page of the filled form an answer prints on, and where its text is drawn (from the PDF itself).
const textAt = (q, n, needle) => q.evaluate(async ([n, needle]) => {
  await loadPreviewTools();
  const doc = await pdfjsLib.getDocument({ data: pdfState.result.all.slice() }).promise;
  const items = (await (await doc.getPage(n)).getTextContent()).items.filter(x => x.str.includes(needle));
  return items.map(x => [x.transform[4], x.transform[5]]);
}, [n, needle]);
const spotsOn = (q, n) => q.evaluate(n => pageSpots(pdfState.result, n), n);
const tap = async (q, id, k = 0) => { await q.locator(`dialog.pageview .pvspot[data-id="${id}"]`).nth(k).click(); await q.waitForSelector("#pvEdit"); };
const reopened = q => q.waitForFunction(() => { const d = document.querySelector("dialog.pageview"); return d && !d.querySelector("#pvEdit") && d.querySelector(".pvpage canvas") && document.activeElement?.classList.contains("pvspot"); }, null, { timeout: 120000 });

describe("17. Quick edit: change an answer on a page of the filled form", () => {
  test("each answer on a page is a place to tap, where it's printed", async () => {
    await inject(p, "respond");
    await ready(p);
    for (const [id, needle] of [["name", "Pat Example"], ["email", "pat@example.com"], ["caseNumber", "02D01-2611-CC-001234"], ["defenses", "I paid this debt in full."]]) {
      const pages = await p.evaluate(id => pdfState.result.allPages.map((x, i) => [i + 1, x]).filter(([, x]) => pdfState.result.spots.some(s => s.step === id && s.page === x.src)).map(([n]) => n), id);
      assert.ok(pages.length, `${id} has a place`);
      let found = 0;
      for (const n of pages) {
        const spots = (await spotsOn(p, n)).filter(s => s.id === id);
        for (const [x, y] of await textAt(p, n, needle)) if (spots.some(s => x >= s.rect[0] - 3 && x <= s.rect[2] && y >= s.rect[1] - 3 && y <= s.rect[3])) found++;
      }
      assert.ok(found > 0, `${id}: the text is inside its place`);
    }
  });

  test("the page shows them as buttons named for the answer, top to bottom, with a line saying to tap one", async () => {
    await inject(p, "respond");
    await openPage(p, 1);
    const names = await p.$$eval("dialog.pageview .pvspot", b => b.map(x => x.getAttribute("aria-label")));
    assert.ok(names.length >= 5, names.join());
    assert.ok(names.every(n => /^Change: /.test(n)));
    const tops = await p.$$eval("dialog.pageview .pvspot", b => b.map(x => x.getBoundingClientRect().top));
    assert.deepEqual(tops, [...tops].sort((a, b) => a - b));
    assert.equal(await p.textContent("dialog.pageview .pvhint"), "To change an answer, tap it on the page.");
    await p.keyboard.press("Escape");
  });

  test("tapping one opens a box over the page with the answer; Save makes the page again with the change", async () => {
    await inject(p, "respond");
    await openPage(p, 1);
    await tap(p, "email");
    assert.equal(await p.$eval("#inEdit", b => b.value), "pat@example.com");
    assert.equal(await p.evaluate(() => document.activeElement.id), "inEdit");
    const inside = await p.evaluate(() => { const b = document.getElementById("pvEdit").getBoundingClientRect(), g = document.querySelector(".pvpage").getBoundingClientRect(); return b.left >= g.left - 1 && b.right <= g.right + 1; });
    assert.equal(inside, true);
    await p.fill("#inEdit", "pat@newmail.com");
    await p.click("#ieSave");
    await reopened(p);
    assert.equal(await p.evaluate(() => answers.email), "pat@newmail.com");
    assert.equal(await p.evaluate(() => document.activeElement.dataset.id), "email", "back on the same answer");
    const n = await p.evaluate(() => pdfState.result.allPages.findIndex(x => pdfState.result.spots.some(s => s.step === "email" && s.page === x.src)) + 1);
    assert.ok((await textAt(p, n, "pat@newmail.com")).length > 0, "the page shows it");
    await p.keyboard.press("Escape");
    assert.equal(await p.evaluate(() => mode), "summary");
    assert.ok((await p.$$eval("dl.vals dd", d => d.map(x => x.textContent))).includes("pat@newmail.com"), "and so does the summary");
  });

  test("the same checks as the question, and Escape closes the box before the page", async () => {
    await inject(p, "respond");
    await openPage(p, 1);
    await tap(p, "email");
    await p.fill("#inEdit", "pat@");
    await p.click("#ieSave");
    assert.equal(await p.textContent("#ieErr"), await p.evaluate(() => answerProblem(steps.find(s => s.id === "email"), "pat@", true)));
    assert.equal(await p.evaluate(() => answers.email), "pat@example.com");
    await p.keyboard.press("Escape");
    assert.equal(await p.locator("#pvEdit").count(), 0);
    assert.ok((await p.locator("dialog.pageview[open]").count()) > 0, "the page is still open");
    assert.equal(await p.evaluate(() => document.activeElement.dataset.id), "email");
    await p.keyboard.press("Escape");
    await p.waitForFunction(() => !document.querySelector("dialog.pageview"));
    // From one of the box's buttons, too: Escape closes the box first.
    await openPage(p, 1);
    await tap(p, "email");
    await p.focus("#ieCancel");
    await p.keyboard.press("Escape");
    assert.equal(await p.locator("#pvEdit").count(), 0);
    assert.equal(await p.evaluate(() => !!document.querySelector("dialog.pageview")?.open), true);
    await p.keyboard.press("Escape");
    await p.waitForFunction(() => !document.querySelector("dialog.pageview"));
  });

  test("edge: a choice opens its question, and the page closes", async () => {
    await inject(p, "respond");
    await ready(p);
    const n = await p.evaluate(() => pdfState.result.allPages.findIndex(x => pdfState.result.spots.some(s => s.step === "receiveAt" && s.page === x.src)) + 1);
    assert.ok(n > 0, "the chosen box has a place");
    assert.equal((await spotsOn(p, n)).filter(s => s.id === "receiveAt").length, 1, "only the box that's ticked, not the others");
    await openPage(p, n);
    await tap(p, "receiveAt");
    assert.equal(await p.locator("#inEdit").count(), 0);
    await p.click("#ieFull");
    assert.equal(await p.evaluate(() => [mode, visible()[cur].id].join()), "step,receiveAt");
    assert.equal(await p.locator("dialog.pageview").count(), 0);
  });

  test("edge: a total worked out from other answers isn't a place to tap; its amounts are", async () => {
    await inject(p, "feewaiver", { incomeKinds: "wages" });
    await ready(p);
    const steps = await p.evaluate(() => [...new Set(pdfState.result.spots.map(s => s.step))]);
    assert.ok(steps.includes("hourlyRate"));
    const totals = await p.evaluate(() => SITUATIONS[sitKey].fields(visibleAnswers()).filter(r => r.from).map(r => r.label));
    assert.ok(totals.length > 0);
    const labels = await p.evaluate(() => pdfState.result.spots.map(s => s.label));
    for (const t of totals) assert.ok(!labels.includes(t), t);
  });

  test("edge: an added page that continues a long answer says where to change it, with nothing to tap", async () => {
    await inject(p, "respond", { defenses: "I paid this debt in full and I have the receipts to show it. ".repeat(40) });
    await ready(p);
    const n = await p.evaluate(() => pdfState.result.allPages.findIndex(x => x.attached) + 1);
    assert.ok(n > 0, "an added page");
    await openPage(p, n);
    assert.match(await p.textContent("dialog.pageview .pvhint"), /continues answers from the form/);
    assert.equal(await p.locator("dialog.pageview .pvspot").count(), 0);
    await p.keyboard.press("Escape");
  });

  test("edge: with saving on, emptying the box takes the old answer off the device; Cancel and closing put it back", async () => {
    const q = await fresh();
    await q.click("#savePref");
    await inject(q, "respond", { plaintiff: "Acme Credit LLC" });
    await q.evaluate(() => saveProgress());
    const copy = () => q.evaluate(k => JSON.parse(localStorage.getItem(k)).answers.plaintiff, SAVED);
    await openPage(q, 1);
    await tap(q, "plaintiff");
    await q.fill("#inEdit", "");
    assert.equal(await copy(), "");
    await q.click("#ieCancel");
    assert.equal(await copy(), "Acme Credit LLC");
    await tap(q, "plaintiff");
    await q.fill("#inEdit", "");
    assert.equal(await copy(), "");
    await q.click("#pvClose");
    await q.waitForFunction(() => !document.querySelector("dialog.pageview"));
    assert.equal(await copy(), "Acme Credit LLC");
    assert.equal(await q.evaluate(() => inlineEdit), null);
  });

  test("edge: on a phone the box fits the screen, and the browser's Back closes the page without changing anything", async () => {
    const q = await fresh({ viewport: { width: 375, height: 667 } });
    await inject(q, "respond");
    await openPage(q, 1);
    await tap(q, "address");
    const b = await q.$eval("#pvEdit", e => { const r = e.getBoundingClientRect(); return [r.left, r.right]; });
    assert.ok(b[0] >= 0 && b[1] <= 375, b.join());
    await q.fill("#inEdit", "Changed");
    await q.goBack();
    await q.waitForFunction(() => !document.querySelector("dialog.pageview"));
    assert.equal(await q.evaluate(() => [mode, answers.address].join("|")), "summary|1 Main St, Fort Wayne, IN 46802");
  });
});
