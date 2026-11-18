// Feature: "Before you start: what to have ready" on each form's first question. Each thing it lists says what the
// official papers say about it, and links the page or form item that says it. (An idea from other teams' projects:
// Team 2's "Before you begin", Team 10's "Have these nearby", Team 11's document checklist.)
import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fresh, close, reset, pick, inject, editAnswer } from "../lib.mjs";

let p;
before(async () => { p = await fresh(); });
after(close);
const FORMS = { respond: 6, appearance: 4, continuance: 7, feewaiver: 8 };
const box = () => p.$("details.ready");
const items = () => p.$$eval("details.ready li", lis => lis.map(li => ({
  what: li.querySelector("strong").textContent, text: li.textContent,
  href: li.querySelector("a").getAttribute("href"), link: li.querySelector("a").textContent.replace(/\s*\(opens in a new tab\)/, ""),
  target: li.querySelector("a").target, sr: li.querySelector("a .sr-only")?.textContent || "" })));

describe("What to have ready", () => {
  for (const [form, n] of Object.entries(FORMS)) {
    test(`${form}: the first question has the list, closed until opened, with ${n} things`, async () => {
      await reset(p); await pick(p, form);
      assert.equal(await p.textContent("details.ready > summary"), "Before you start: what to have ready");
      assert.equal(await p.$eval("details.ready", d => d.open), false, "closed, so the question and its box come first");
      await p.click("details.ready > summary");
      assert.equal(await p.$eval("details.ready", d => d.open), true);
      const list = await items();
      assert.equal(list.length, n);
      for (const it of list) assert.match(it.text, /Source: /, it.what);
    });
  }

  test("each list names what its form needs most", async () => {
    const said = {};
    for (const form of Object.keys(FORMS)) { await reset(p); await pick(p, form); said[form] = (await items()).map(i => i.what).join(" | "); }
    assert.match(said.respond, /^The Complaint you received/);
    assert.match(said.continuance, /hearing date/); assert.match(said.continuance, /reason for asking/);
    assert.match(said.feewaiver, /in the bank/); assert.match(said.feewaiver, /monthly income/); assert.match(said.feewaiver, /monthly expenses/);
    assert.doesNotMatch(said.appearance, /Complaint you received/, "the Appearance alone doesn't answer the Complaint");
    for (const form of ["respond", "appearance", "continuance"]) assert.match(said[form], /related cases/);
  });

  test("every source links its official PDF, at the page, in a new tab that says so", async () => {
    const LINKS = await p.evaluate(() => LINKS);
    const pdf = { respond: LINKS.answerInstructions, appearance: LINKS.answerInstructions, continuance: LINKS.continuanceInstructions, feewaiver: LINKS.feeWaiverInstructions };
    for (const form of Object.keys(FORMS)) {
      await reset(p); await pick(p, form);
      for (const it of await items()) {
        const [file, page] = it.href.split("#page=");
        assert.equal(file, pdf[form], `${form}: ${it.what}`);
        assert.match(page, /^\d+$/);
        assert.equal(it.target, "_blank");
        assert.equal(it.sr, " (opens in a new tab)");
        assert.match(it.link, /^(Answer|Continuance|Fee waiver) instructions, page \d+$|^Verified Motion for Continuance, item [246]$/);
      }
    }
  });

  test("it's only on the first question", async () => {
    await reset(p); await pick(p, "respond");
    await p.evaluate(() => { cur = 1; render(); });
    assert.equal(await box(), null);
  });

  test("edge: not when changing the first answer from the summary, which isn't starting", async () => {
    await reset(p); await inject(p, "continuance");
    const first = await p.evaluate(() => visible()[0].id);
    await editAnswer(p, first);
    assert.equal(await p.evaluate(() => mode === "step" && cur === 0 && returnToSummary), true);
    assert.equal(await box(), null);
  });

  test("edge: once opened, it stays open after Back from the next question", async () => {
    await reset(p); await pick(p, "feewaiver");
    await p.click("details.ready > summary");
    await p.waitForFunction(() => openMore.has("ready:feewaiver")); // the browser reports the opening a moment after the tap
    await p.evaluate(() => { cur = 1; render(); });
    await p.click("#back");
    assert.equal(await p.evaluate(() => cur), 0);
    assert.equal(await p.$eval("details.ready", d => d.open), true);
  });

  // The words each item relies on, found on the page it links. The Answer and Continuance links are the same PDFs as the
  // packets the tool fills (forms/README.md). The fee waiver's instructions PDF is the packet's five pages with notes
  // added, page for page, so its form text is checked on the packet.
  const SAYS = {
    respond: ["paragraph number", "lose your right", "top of each form", "how to contact you", "every other person involved in the case", "bankruptcy"],
    appearance: ["top of each form", "how to contact you", "every other person involved in the case", "bankruptcy"],
    continuance: ["hearing has been scheduled", "written statement", "number of days or weeks", "I spoke to the other party", "how to contact you", "every other person involved in the case", "damages owed"],
    feewaiver: ["case type", "Respondent", "receiving legal service", "related to this case", "eighteen", "per hour", "in the bank", "Monthly Expenses"],
  };
  for (const form of Object.keys(FORMS)) {
    test(`edge: ${form}: each page it links says what the list says it does`, async () => {
      await reset(p);
      const missing = await p.evaluate(async ([form, says]) => {
        const packet = { respond: "answerPacket", appearance: "answerPacket", continuance: "continuancePacket", feewaiver: "feeWaiverPacket" }[form];
        await loadPreviewTools(); await loadPdfTools(OFFICIAL[packet].file);
        const doc = await whereDoc(OFFICIAL[packet].file), flat = s => s.replace(/\s+/g, "").toLowerCase();
        const out = [];
        for (const [i, [what, , src]] of SITUATIONS[form].ready.entries()) {
          const page = +src.href.split("#page=")[1];
          const text = (await (await doc.getPage(page)).getTextContent()).items.map(x => x.str).join(" ");
          if (!flat(text).includes(flat(says[i]))) out.push(`${what} (page ${page}): "${says[i]}"`);
        }
        return out;
      }, [form, SAYS[form]]);
      assert.deepEqual(missing, []);
    });
  }

  test("edge: closed, it adds one line on a phone, so the answer box stays near the question", async () => {
    const ph = await fresh({ viewport: { width: 375, height: 667 } });
    for (const form of Object.keys(FORMS)) {
      await reset(ph); await pick(ph, form);
      const at = () => ph.$eval("#ans, .choices", el => el.getBoundingClientRect().top);
      const withBox = await at();
      await ph.evaluate(() => document.querySelector("details.ready").remove());
      assert.ok(withBox - await at() <= 60, `${form}: ${withBox - await at()}px`);
    }
    await ph.context().close();
  });

  test("edge: open on a 320px phone, nothing runs off the side", async () => {
    const ph = await fresh({ viewport: { width: 320, height: 640 } });
    for (const form of Object.keys(FORMS)) {
      await reset(ph); await pick(ph, form); await ph.click("details.ready > summary");
      assert.equal(await ph.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, form);
    }
    await ph.context().close();
  });
});
