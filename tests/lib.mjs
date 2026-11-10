// Shared helpers. Every test drives the real page in Chromium.
// BASE_URL=https://... runs the tests against a hosted copy instead of the local file.
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const { chromium } = createRequire(import.meta.url)("playwright");
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const BASE_URL = process.env.BASE_URL || "";
export const APP = BASE_URL || "file://" + path.join(ROOT, "form-builder-mvp.html");
export const SAVED = "icfh-progress-v1", SAVING = "icfh-save-pref";
const VIEW = { width: 1000, height: 900 };

let browser = null;
export async function launch() { browser ||= await chromium.launch(); return browser; }
export async function close() { if (browser) await browser.close(); browser = null; }

function watch(p) {
  p.errors = [];
  p.on("pageerror", e => p.errors.push(e.message));
  p.on("dialog", d => d.accept());
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
    if (s.type === "date") v ??= await p.evaluate(n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }, DAYS_AHEAD[s.id] ?? 0);
    if (s.type === "choice") await p.locator(`input[name=ans][value="${s.options.includes(v) ? v : s.options[0]}"]`).check({ force: true });
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
