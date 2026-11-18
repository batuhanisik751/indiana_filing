// Feature: a word list. Words on the forms, as the official instructions define them, word for word: in Get help, and
// as buttons in a question's explanation. (An idea from other teams' projects: Team 7's "Words on the form", Team 2's
// tap-a-term definitions.)
import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fresh, close, reset, pick, walk } from "../lib.mjs";

let p;
before(async () => { p = await fresh(); });
after(close);
const TERMS = ["Plaintiff", "Defendant", "Complaint", "Answer", "Defenses", "Appearance", "Continuance", "Related cases", "Certificate of Service", "Perjury"];
const openWords = async () => { await p.click("#helpBtn"); await p.click("#helpWords summary"); };
// The official PDFs set some letter pairs as one glyph, which comes out of the text as another character
// ("ti" as "H" or ">", "ft" as "S", "tt" as "O", "fi" as "ﬁ"), so a quote is matched allowing for those.
function loose(s) {
  const pairs = { ffi: "ﬃ", ffl: "ﬄ", ff: "ﬀ", fi: "ﬁ", fl: "ﬂ", ti: "H|>", ft: "S", tt: "O" };
  let r = "";
  for (let i = 0; i < s.length;) {
    const k = [3, 2].map(n => s.slice(i, i + n)).find(x => pairs[x]);
    if (k) { r += `(?:${k}|${pairs[k]})`; i += k.length; continue; }
    const c = s[i++];
    if (/\s/.test(c)) continue;
    r += c === "'" || c === "’" ? "['’]" : c === '"' || c === "“" || c === "”" ? '["“”]' : c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  return r;
}

describe("Word list", () => {
  test("Get help has \"Words on the forms\", closed, with every word and its definition", async () => {
    await reset(p); await p.click("#helpBtn");
    assert.equal(await p.textContent("#helpWords summary"), "Words on the forms");
    assert.equal(await p.$eval("#helpWords details", d => d.open), false);
    await p.click("#helpWords summary");
    assert.deepEqual(await p.$$eval("#helpWords dt", d => d.map(x => x.textContent)), TERMS);
    assert.match(await p.textContent("#helpWords"), /What the official instructions say these words mean, word for word\./);
  });

  test("each definition is in quotation marks and links the page of the official instructions it's from", async () => {
    await reset(p); await openWords();
    const LINKS = await p.evaluate(() => LINKS);
    const dds = await p.$$eval("#helpWords dd", d => d.map(x => ({ text: x.textContent, href: x.querySelector("a").getAttribute("href"), target: x.querySelector("a").target })));
    assert.equal(dds.length, TERMS.length);
    for (const d of dds) {
      assert.match(d.text, /^“[^“]+” Source: (Answer|Continuance) instructions, page \d/);
      assert.ok(d.href.startsWith(`${LINKS.answerInstructions}#page=`) || d.href.startsWith(`${LINKS.continuanceInstructions}#page=`), d.href);
      assert.equal(d.target, "_blank");
    }
  });

  test("edge: every definition is word for word on the page it links", async () => {
    await reset(p);
    const missing = await p.evaluate(async ([LOOSE]) => {
      const loose = new Function(`return ${LOOSE}`)();
      await loadPreviewTools();
      const out = [];
      for (const g of GLOSSARY) {
        const packet = g.src.href.startsWith(LINKS.answerInstructions) ? "answerPacket" : "continuancePacket";
        await loadPdfTools(OFFICIAL[packet].file);
        const doc = await whereDoc(OFFICIAL[packet].file), page = +g.src.href.split("#page=")[1];
        const text = (await (await doc.getPage(page)).getTextContent()).items.map(x => x.str).join("").replace(/\s+/g, "");
        if (!new RegExp(loose(g.says)).test(text)) out.push(`${g.term} (page ${page})`);
      }
      return out;
    }, [loose.toString()]);
    assert.deepEqual(missing, []);
  });

  test("a word in a question's explanation is a button that shows its definition there, and hides it again", async () => {
    await reset(p); await pick(p, "respond"); await walk(p, "defenses");
    const help = await p.evaluate(() => visible()[cur].help);
    assert.ok((await p.textContent("#qhelp")).startsWith(help), "the explanation reads the same (its link comes after it)");
    const b = p.locator("#qhelp button.term").first();
    const word = await b.textContent();
    assert.equal(await p.isHidden("#termbox"), true);
    await b.click();
    assert.equal(await b.getAttribute("aria-expanded"), "true");
    assert.equal(await p.isVisible("#termbox"), true);
    const g = await p.evaluate(i => GLOSSARY[i], +(await b.getAttribute("data-term")));
    assert.ok(g.match.test(word), word);
    assert.match(await p.textContent("#termbox"), new RegExp(`^${g.term}: “`));
    await b.click();
    assert.equal(await b.getAttribute("aria-expanded"), "false");
    assert.equal(await p.isHidden("#termbox"), true);
  });

  test("edge: only the first time a word comes up in a paragraph, and \"answer\" as an everyday word isn't one", async () => {
    await reset(p);
    const out = await p.evaluate(() => {
      const div = document.createElement("div");
      div.innerHTML = termify("The plaintiff said the plaintiff's answer and the Answer are due. Related cases, a related case.");
      return [...div.querySelectorAll("button.term")].map(b => b.textContent);
    });
    assert.deepEqual(out, ["plaintiff", "Answer", "Related cases"]);
  });

  test("edge: choosing another word swaps the definition; only one is open", async () => {
    await reset(p);
    await pick(p, "continuance");
    const ids = await p.evaluate(() => visible().map(s => s.id));
    let found = false;
    for (let i = 0; i < ids.length && !found; i++) {
      await p.evaluate(i => { cur = i; render(); }, i);
      if (await p.locator("#qhelp button.term, #qmore button.term").count() >= 2) found = true;
    }
    if (!found) { // no question has two: check it with two made-up ones
      await p.evaluate(() => { document.getElementById("qhelp").innerHTML = termify("The plaintiff and the defendant."); wireTerms(); });
    }
    const terms = p.locator("#qhelp button.term, #qmore button.term");
    await terms.nth(0).click(); await terms.nth(1).click();
    assert.deepEqual(await terms.evaluateAll(bs => bs.slice(0, 2).map(b => b.getAttribute("aria-expanded"))), ["false", "true"]);
    assert.equal(await p.locator("#termbox p").count(), 1);
  });

  test("edge: from the keyboard, Enter on a word opens it and doesn't move to the next question", async () => {
    await reset(p); await pick(p, "respond"); await walk(p, "defenses");
    const before = await p.evaluate(() => cur);
    await p.locator("#qhelp button.term").first().focus();
    await p.keyboard.press("Enter");
    assert.equal(await p.evaluate(() => cur), before);
    assert.equal(await p.isVisible("#termbox"), true);
    assert.match(await p.textContent("#termbox"), /\(opens in a new tab\)/);
  });

  test("edge: the next question starts with the definition closed", async () => {
    await reset(p); await pick(p, "respond"); await walk(p, "defenses");
    await p.locator("#qhelp button.term").first().click();
    await p.evaluate(() => { cur += 1; render(); });
    assert.equal(await p.isHidden("#termbox"), true);
  });

  test("edge: words in the word list come up in the questions' explanations", async () => {
    await reset(p);
    const unused = await p.evaluate(() => {
      const text = Object.keys(SITUATIONS).flatMap(k => SITUATIONS[k].steps()).map(s => `${s.help || ""} ${s.more || ""}`).join(" ");
      return GLOSSARY.filter(g => !g.match.test(text)).map(g => g.term);
    });
    // The rest are in Get help only: they're on the forms and in the official instructions.
    assert.ok(unused.length <= 5, unused.join(", "));
  });

  test("edge: on a 320px phone, the list and a definition fit without running off the side", async () => {
    const ph = await fresh({ viewport: { width: 320, height: 640 } });
    await ph.click("#helpBtn"); await ph.click("#helpWords summary");
    assert.equal(await ph.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    await ph.click("#helpClose");
    await pick(ph, "respond"); await walk(ph, "defenses"); await ph.locator("#qhelp button.term").first().click();
    assert.equal(await ph.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    await ph.context().close();
  });
});
