// Item 18: runs the test set in quality/cases.mjs through the page's own checks and counts what's caught, missed and
// falsely flagged. `npm run quality` writes quality/REPORT.md and quality/baseline.json; quality.test.mjs fails if a
// later change catches less or flags more than the baseline says.
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { fresh, close, inject } from "../lib.mjs";
import { CASES, FORMS, BASE } from "./cases.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const day = n => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const resolve = answers => Object.fromEntries(Object.entries(answers).map(([k, v]) => [k, v && typeof v === "object" && "days" in v ? day(v.days) : v]));
// The flags the page raises for these answers, without the checks on the made PDF (those need it built: see REPORT.md).
async function flagsFor(p, form, answers) {
  await inject(p, form, answers);
  return p.evaluate(() => ({ flags: runChecks().map(f => ({ id: f.fix || "", title: f.title, level: f.level })), shown: visible().map(s => s.id) }));
}

export async function measure(p) {
  const base = {}, shown = {};
  for (const form of FORMS) {
    const b = await flagsFor(p, form, BASE[form] || {});
    base[form] = new Set(b.flags.map(f => f.id)); shown[form] = new Set(b.shown);
  }
  const results = [];
  for (const c of CASES) {
    const { flags } = await flagsFor(p, c.form, { ...(BASE[c.form] || {}), ...resolve(c.answers) });
    const ids = new Set(flags.map(f => f.id)), expected = c.expect.flat();
    const missed = c.expect.filter(e => ![e].flat().some(id => ids.has(id))).map(e => [e].flat().join(" or "));
    // A question the change brought up counts too when the case answered it (BT48): a flag on a box the case filled in.
    const answered = new Set(Object.entries(c.answers).filter(([, v]) => v !== "" && v != null).map(([k]) => k));
    const extra = flags.filter(f => !expected.includes(f.id) && !base[c.form].has(f.id) && (shown[c.form].has(f.id) || answered.has(f.id)));
    results.push({ ...c, mistake: c.expect.length > 0, caught: missed.length === 0, missed, extra });
  }
  return { base: Object.fromEntries(Object.entries(base).map(([k, v]) => [k, [...v]])), results };
}

// What the test compares: which mistakes are missed, and which cases get a flag they shouldn't.
export const summary = ({ results }) => ({
  missed: results.filter(r => r.mistake && !r.caught).map(r => r.name).sort(),
  falseAlarms: results.filter(r => r.extra.length).map(r => r.name).sort(),
});

function report({ base, results }, commit) {
  const kinds = [...new Set(results.filter(r => r.mistake).map(r => r.kind))];
  const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : "–");
  const row = k => {
    const all = results.filter(r => r.kind === k), usual = all.filter(r => !r.hard), hard = all.filter(r => r.hard);
    const c = l => l.filter(r => r.caught).length;
    return `| ${k} | ${c(usual)} of ${usual.length} | ${hard.length ? `${c(hard)} of ${hard.length}` : "–"} | ${c(all)} of ${all.length} (${pct(c(all), all.length)}) |`;
  };
  const mistakes = results.filter(r => r.mistake), clean = results.filter(r => !r.mistake);
  const caught = mistakes.filter(r => r.caught).length, usual = mistakes.filter(r => !r.hard), hard = mistakes.filter(r => r.hard);
  const alarmsClean = clean.filter(r => r.extra.length), alarmsMistake = mistakes.filter(r => r.extra.length);
  const flagList = r => r.extra.map(f => `"${f.title}" (${f.level === "missing" ? "Missing" : "Check"})`).join(", ");
  return `# How well the checks do on a fixed test set

Item 18 on the MVP list. Made by \`npm run quality\` in \`tests/\` on ${new Date().toISOString().slice(0, 10)}, at commit ${commit}.

The test set is in [cases.mjs](cases.mjs): ${results.length} filled-in forms. ${mistakes.length} have one planted mistake each, the kind a careful reader would flag. ${clean.length} have only correct answers that look a little like mistakes, like a PO box, a phone number written with dots, or a nine-digit invoice number. Each case starts from the same sample answers, which get no flags on their own${Object.values(base).some(l => l.length) ? ` (except: ${Object.entries(base).filter(([, l]) => l.length).map(([f, l]) => `${f}: ${l.join(", ")}`).join("; ")})` : ""}.

- **Caught:** a flag on the question with the mistake. For a mistake between two answers, like a paragraph in two lists, a flag on either one.
- **Missed:** no flag there.
- **False alarm:** a flag on a question whose answer is correct. A question the case itself brings up isn't counted unless the case answers it: an incomplete case number brings up the case type letters, and asking for them is right, but a flag on an expense description the case filled in is counted.

"Harder" cases are the same kinds of mistakes written in less usual ways.

## Mistakes caught

Overall: **${caught} of ${mistakes.length} caught (${pct(caught, mistakes.length)})**. The usual ways of writing them: ${usual.filter(r => r.caught).length} of ${usual.length}. Harder ways: ${hard.filter(r => r.caught).length} of ${hard.length}.

| Kind of check | Usual | Harder | All |
|---|---|---|---|
${kinds.map(row).join("\n")}

${mistakes.some(r => !r.caught) ? `Missed:\n\n${mistakes.filter(r => !r.caught).map(r => `- ${r.kind}: ${r.name}${r.hard ? " (harder)" : ""}`).join("\n")}` : "Nothing missed."}

## False alarms

**${alarmsClean.length} of ${clean.length} correct-answer cases got a flag they shouldn't (${pct(alarmsClean.length, clean.length)}).**

${alarmsClean.length ? alarmsClean.map(r => `- ${r.name}: ${flagList(r)}`).join("\n") : "None."}

${alarmsMistake.length ? `On cases with a planted mistake, ${alarmsMistake.length} also got a flag on another, correct answer:\n\n${alarmsMistake.map(r => `- ${r.kind}, ${r.name}: ${flagList(r)}`).join("\n")}` : "No case with a planted mistake got a flag on another, correct answer."}

## What these numbers don't say

- **Who wrote the cases.** The same team wrote the checks, so the cases may lean toward what the checks were built for. Mistakes from real filings would likely be caught less often.
- **Cases written by someone else.** On 2026-11-18 an independent tester wrote 42 cases without seeing these (27 mistakes, 15 correct answers): the checks caught 25 of the 27 and falsely flagged 1 of the 15 (2, counting a box the case itself filled in, which this set didn't count then). The tester's targeted attempts found more, fixed as BT41 to BT47; six of those are now in this set, so this set is no longer held out from them.
- **What's left out.** The checks on the made PDF aren't counted here: an answer too long for its box, and characters the form's font can't print. They're tested in \`features/17-download-pdf.test.mjs\`.
- **What no check can know.** Whether an address or phone number is real, or whether an answer is right for the case. Those aren't in the set.
- **How the test uses this.** \`quality.test.mjs\` fails if a mistake caught here is missed later, or a correct answer gets a new flag. It also fails when a change makes the numbers better, so this report can be made again to match.
`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const p = await fresh();
  const m = await measure(p);
  await close();
  let commit = "unknown";
  try { commit = execSync("git rev-parse --short HEAD", { cwd: HERE }).toString().trim(); } catch { /* not a git checkout */ }
  fs.writeFileSync(path.join(HERE, "REPORT.md"), report(m, commit));
  fs.writeFileSync(path.join(HERE, "baseline.json"), `${JSON.stringify(summary(m), null, 2)}\n`);
  const s = summary(m), mistakes = m.results.filter(r => r.mistake);
  console.log(`${mistakes.length - s.missed.length} of ${mistakes.length} mistakes caught; ${m.results.filter(r => !r.mistake && r.extra.length).length} of ${m.results.length - mistakes.length} correct cases falsely flagged.`);
}
