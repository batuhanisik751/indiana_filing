// Shared helpers. Every test drives the real page in a real browser: Chromium, or WebKit or Firefox with BROWSER=.
// BASE_URL=https://... runs the tests against a hosted copy instead of the local file.
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// BROWSER=webkit runs them in WebKit, the engine inside Safari (install it with `npx playwright install webkit`), and
// BROWSER=firefox in Firefox (`npx playwright install firefox`). GitHub Actions runs all three on every push (TG19).
export const BROWSER = process.env.BROWSER || "chromium";
if (!["chromium", "webkit", "firefox"].includes(BROWSER)) throw new Error(`BROWSER must be chromium, webkit or firefox, not "${BROWSER}"`);
const engine = createRequire(import.meta.url)("playwright")[BROWSER];
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const BASE_URL = process.env.BASE_URL || "";
export const APP = BASE_URL || "file://" + path.join(ROOT, "form-builder-mvp.html");
export const SAVED = "icfh-progress-v1", SAVING = "icfh-save-pref";
const VIEW = { width: 1000, height: 900 };

let browser = null;
const opened = []; // every page the tests opened, to check for errors at the end
export async function launch() { browser ||= await engine.launch(); return browser; }
// Closes the browser, then fails the test file if any page threw an error that no test expected. A page that breaks
// on purpose (a missing file, someone else's script) sets p.allowErrors = true.
export async function close() {
  if (browser) await browser.close();
  browser = null;
  const errors = opened.splice(0).filter(p => !p.allowErrors).flatMap(p => p.errors);
  if (errors.length) throw new Error(`The page threw ${errors.length} error(s) no test expected:\n${[...new Set(errors)].slice(0, 10).join("\n")}`);
}

// Records the page's errors and dialogs. Dialogs are accepted, and kept in p.dialogs so a test can check one was asked.
function watch(p) {
  p.errors = [];
  p.dialogs = [];
  opened.push(p);
  p.on("pageerror", e => p.errors.push(e.message));
  p.on("dialog", d => { p.dialogs.push({ type: d.type(), message: d.message() }); d.accept(); });
  return p;
}

// A new browser profile with the page open on its first screen.
export async function fresh(opts = {}) {
  const ctx = await (await launch()).newContext({ viewport: VIEW, ...opts });
  const p = watch(await ctx.newPage());
  await p.goto(APP);
  await p.waitForSelector("#app h1");
  return p;
}

// The local copy at a made-up http address. `change(path)` can return "abort" to make a file fail,
// "hold" to make it hang, or new text to serve instead. Pages opened with ctx.open() share storage, like tabs.
export async function site({ change } = {}) {
  const ctx = await (await launch()).newContext({ viewport: VIEW });
  await ctx.route("http://app.test/**", route => {
    const rel = decodeURIComponent(new URL(route.request().url()).pathname.slice(1)) || "form-builder-mvp.html";
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT + path.sep) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: "" });
    const out = change ? change(rel, () => fs.readFileSync(file, "utf8")) : null;
    if (out === "abort") return route.abort();
    if (out === "hold") return;
    if (typeof out === "string") return route.fulfill({ contentType: rel.endsWith(".css") ? "text/css" : "text/javascript", body: out });
    return route.fulfill({ path: file });
  });
  ctx.open = async (wait = true) => {
    const p = watch(await ctx.newPage());
    await p.goto("http://app.test/form-builder-mvp.html");
    if (wait) await p.waitForSelector("#app h1");
    return p;
  };
  return ctx;
}

// Opens one of the four forms from "My situation is different".
export async function pick(p, key) {
  const button = p.locator(`.pick[data-k="${key}"]`);
  if (!(await button.isVisible())) await p.click("#moreToggle");
  await button.click();
}

// Plain, valid answers. Dates are worked out from today, so the tests don't go stale.
export const VALUES = {
  county: "Allen", courtType: "SUPERIOR", caseNumber: "02D01-2611-CC-001234", plaintiff: "Acme Credit LLC", name: "Pat Example",
  acp: "no", address: "1 Main St, Fort Wayne, IN 46802", email: "pat@example.com", phone: "260-555-0100", fax: "",
  receiveAt: "Choice1", related: "no", localRule: "none", admitted: "1, 2", denied: "3", notEnough: "", defenses: "I paid this debt in full.",
  fileMethod: "paper", agConfidential: "no", acceptEmail: "no", fwCourtType: "CIRCUIT", otherPerson: "Acme Credit LLC",
  adults: "None", children: "None", supported: "None", hourlyRate: "12.50", monthlyHours: "80", bank: "0",
  role: "other", otherParty: "Acme Credit LLC", otherPartyAddress: "2 Oak St, Fort Wayne, IN 46802", reason: "I have surgery that day.",
  timeNeeded: "2 weeks", otherAgreed: "Choice1", svc1Name: "Acme Credit LLC", svc1Address: "2 Oak St, Fort Wayne, IN 46802",
  svc1Method: "First Class U.S. mail", svcMore1: "no",
};
const DAYS_AHEAD = { courtDate: 30, hearingDate: 30 };

export const step = p => p.evaluate(() => (mode === "step" ? visible()[cur].id : mode));

// Answers every question from `over`, then VALUES, then a plain default, until `target` (a question id or "summary").
export async function walk(p, target = "summary", over = {}) {
  const vals = { ...VALUES, ...over };
  for (let i = 0; i < 120; i++) {
    const s = await p.evaluate(() => (mode === "step" ? (({ id, type, optional, options }) => ({ id, type, optional, options: (options || []).map(o => (Array.isArray(o) ? o[0] : o)) }))(visible()[cur]) : { id: mode }));
    if (s.id === target || s.id !== undefined && !s.type) break;
    let v = vals[s.id];
    // The page's own local date, as its date box gives it (not UTC, which is already tomorrow in a US evening).
    // A court date never falls on a Sunday or December 25, which the app flags (BT94): it moves on a day.
    if (s.type === "date") v ??= await p.evaluate(([n, court]) => { const d = new Date(); d.setDate(d.getDate() + n); while (court && (d.getDay() === 0 || (d.getMonth() === 11 && d.getDate() === 25))) d.setDate(d.getDate() + 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }, [DAYS_AHEAD[s.id] ?? 0, s.id in DAYS_AHEAD]);
    if (s.type === "checks") { for (const k of String(v ?? "").split(",").filter(Boolean)) await p.locator(`input[name=ans][value="${k}"]`).check({ force: true }); } // left blank: every amount is asked
    else if (s.type === "choice") await p.locator(`input[name=ans][value="${s.options.includes(v) ? v : s.options[0]}"]`).check({ force: true });
    else if (s.type === "select") await p.selectOption("#ans", v && s.options.includes(v) ? v : s.options[0]);
    else await p.fill("#ans", v ?? (s.type === "money" || s.type === "number" ? "0" : s.optional ? "" : "Sample answer"));
    await p.click("#next");
  }
  return step(p);
}

// Waits for the filled PDF and returns its text, read back with the page's own PDF viewer.
export async function pdfText(p) {
  await p.waitForFunction(() => pdfState.result || pdfState.error, null, { timeout: 120000 });
  return p.evaluate(async () => {
    if (!pdfState.result) return null;
    await loadPreviewTools();
    const doc = await pdfjsLib.getDocument({ data: pdfState.result.all.slice() }).promise;
    let text = "";
    for (let i = 1; i <= doc.numPages; i++) text += (await (await doc.getPage(i)).getTextContent()).items.map(x => x.str).join(" ") + "\n";
    return text.replace(/\s+/g, " ");
  });
}

// The summary's flags, as text, and the Missing count against the score.
export const flags = p => p.evaluate(() => runChecks().map(f => `${f.level}|${f.fix}|${f.title}|${f.why}`));
export const scoreMatchesFlags = p => p.evaluate(() => { const s = completeness(); return s.total - s.filled === runChecks().filter(f => f.level === "missing").length; });

// ---------- for the feature tests ----------
// Back to a clean first screen in the same page (storage stays, so saving tests use their own page).
export async function reset(p) { await p.goto(p.url().startsWith("http://app.test") ? "http://app.test/form-builder-mvp.html" : APP); await p.waitForSelector("#app h1"); }
// Puts answers straight into a form and shows its summary, for checks that don't need the whole walk.
// Date questions not given get a date counted from today, as in walk().
export const inject = (p, form, answers = {}, unsure = {}) => p.evaluate(([form, answers, unsure, ahead, given]) => {
  for (const s of SITUATIONS[form].steps()) if (s.type === "date" && !given.includes(s.id)) {
    const d = new Date(); d.setDate(d.getDate() + (ahead[s.id] ?? 0));
    while (s.id in ahead && (d.getDay() === 0 || (d.getMonth() === 11 && d.getDate() === 25))) d.setDate(d.getDate() + 1); // not a Sunday or December 25 (BT94)
    answers[s.id] = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; // local, like the date box
  }
  window.__set = { form, answers, unsure };
  // Through eval, because the page's own variables are top-level lets.
  // A confirmation given here counts for the case number given with it, as if it had been answered on its question.
  globalThis.eval("resetAnswers(); sitKey = __set.form; steps = SITUATIONS[sitKey].steps(); answers = __set.answers; unsure = __set.unsure; caseConfirmFor = answers.caseConfirm ? (caseCourt(answers.caseNumber) || {}).name || null : null; mode = 'summary'; render();");
}, [form, { ...VALUES, ...answers }, unsure, DAYS_AHEAD, Object.keys(answers)]);
// Every flag for one question, as "level|title|why".
export const flagsFor = (p, id) => p.evaluate(id => runChecks().filter(f => f.fix === id).map(f => `${f.level}|${f.title}|${f.why}`), id);
// Where each answer goes: [label, value printed, question] for every row of the form's fields.
export const fieldRows = p => p.evaluate(() => SITUATIONS[sitKey].fields(visibleAnswers()).map(r => [r.label, String(r.value ?? ""), r.step]));
// Goes straight to one question of the form being filled.
export const jump = (p, id) => p.evaluate(id => { const i = visible().findIndex(s => s.id === id); if (i < 0) throw new Error(`no question ${id}`); cur = i; mode = "step"; returnToSummary = false; render(); }, id);
// Answers the question on screen.
export async function answer(p, value) {
  const s = await p.evaluate(() => (({ type }) => ({ type }))(visible()[cur]));
  if (s.type === "checks") { await p.locator("input[name=ans]:checked").evaluateAll(cs => cs.forEach(c => c.click())); for (const k of value.split(",").filter(Boolean)) await p.locator(`input[name=ans][value="${k}"]`).check({ force: true }); }
  else if (s.type === "choice") await p.locator(`input[name=ans][value="${value}"]`).check({ force: true });
  else if (s.type === "select") await p.selectOption("#ans", value);
  else await p.fill("#ans", value);
  await p.click("#next");
}

// Edit one answer from the summary's list of every answer, which starts closed.
// Two frames: WebKit can still move the page a frame after it's drawn (it scrolls to what has focus), and a click aimed
// before that lands somewhere else.
export const settle = p => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
export async function editAnswer(p, id) {
  await p.evaluate(() => { const d = document.querySelector('details[data-more="answers"]'); if (d) d.open = true; });
  await settle(p);
  await p.click(`dl.vals [data-fix="${id}"]`);
  // A typed answer opens in a box right on the summary (item 17); its question is one more tap.
  if (await p.$("#inEdit")) await p.click("#ieFull");
}
// Item 17: open a typed answer in its box on the summary (the nth row showing that answer).
export async function editHere(p, id, nth = 0) {
  await p.evaluate(() => { const d = document.querySelector('details[data-more="answers"]'); if (d) d.open = true; });
  await settle(p);
  await p.click(`dl.vals [data-fix="${id}"][data-nth="${nth}"]`);
  await p.waitForSelector("#inEdit");
}
