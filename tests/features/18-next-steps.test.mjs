// Feature: Next steps. After download, how to file, the fees and how to ask for a fee waiver, how to serve the other
// side, and the hearing date, plus what missing it can mean. Facts, not advice: every line names its official source.
// What missing a hearing can mean is said only as far as the sources go. None of them calls it automatic: the court
// "can" or "may" decide without hearing your side.
import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fresh, close, inject } from "../lib.mjs";

let p;
before(async () => { p = await fresh(); });
after(close);
const steps = () => p.evaluate(() => nextSteps(sitKey, visibleAnswers()).map(s => ({ title: s.title, line: s.short || s.body, body: s.body, links: s.links.map(l => l.href) })));
const stepNamed = async title => (await steps()).find(s => s.title === title);
const shown = () => p.evaluate(() => document.querySelector("ol.steps").innerText);

describe("Next steps", () => {
  test("it shows how to file, online and at the courthouse, with the county clerk's office", async () => {
    await inject(p, "respond", { fileMethod: "", county: "Allen", caseConfirm: "no" });
    const t = await shown();
    assert.match(t, /If you file online\n+.*efile\.incourts\.gov/);
    assert.match(t, /If you file at the courthouse\n+.*Allen County Clerk's Office at 715 South Calhoun Street/);
  });
  test("it shows the filing fee and how to ask for a fee waiver, linking to the fee waiver form's page", async () => {
    await inject(p, "appearance");
    const fee = await stepNamed("Filing fee");
    assert.match(fee.line, /a fee waiver asks the court not to charge a fee you can't afford/);
    assert.ok(fee.links.includes("https://indianalegalhelp.org/filing-fee-frequently-asked-questions/"));
    assert.ok(fee.links.some(h => /how-to-file-forms-with-the-court-in-person/.test(h)), "the page with the fee waiver form");
  });
  test("it shows how to send a copy to the other side", async () => {
    await inject(p, "respond");
    assert.match((await stepNamed("Send a copy to the other side")).line, /Indiana Legal Help says you must give a copy of every form you file to everyone else in the case/);
  });
  test("it shows the hearing date entered, and that only a judge's order can change it", async () => {
    await inject(p, "respond");
    const date = await p.evaluate(() => formDate(answers.courtDate));
    assert.match((await stepNamed("Go to every court date")).line, new RegExp(`^Your next court date: ${date.replace(/\//g, "\\/")}\\. Indiana Legal Help says only an order signed by the judge can change it\\.`));
  });
  test("it says what missing the hearing can mean, in the line itself, not only behind More", async () => {
    await inject(p, "respond", { caseNumber: "", caseConfirm: "" });
    assert.match(await shown(), /In an eviction or small claims case, the official sources say missing it can mean losing without the court hearing your side\./);
  });
  test("edge: an eviction case gives the Eviction FAQ's words, with its link", async () => {
    await inject(p, "appearance", { caseNumber: "02D01-2611-EV-001234" });
    const s = await stepNamed("Go to every court date");
    assert.match(s.line, /Indiana Legal Help says that if you don't show up to your hearing, the court can rule against you without hearing your side\./);
    assert.ok(s.links.includes("https://indianalegalhelp.org/eviction-frequently-asked-questions/"));
  });
  test("edge: a small claims case cites Small Claims Rule 10(B), and the person who started one gets the Manual's dismissal rule", async () => {
    await inject(p, "appearance", { caseNumber: "02D01-2611-SC-001234" });
    assert.match((await stepNamed("Go to every court date")).line, /Small Claims Rule 10\(B\) says the court may enter a default judgment against a defendant who doesn't appear/);
    await inject(p, "continuance", { caseNumber: "02D01-2611-SC-001234", role: "me" });
    assert.match((await stepNamed("If you don't go to court")).line, /Small Claims Manual says the court may dismiss the claim if the person who started it doesn't appear/);
  });
  test("edge: for other civil cases it claims no more than the rules it cites", async () => {
    await inject(p, "appearance", { caseNumber: "02D01-2611-CC-001234" });
    const s = await stepNamed("Go to every court date");
    assert.match(s.line, /The court rules this tool cites don't name missing a hearing for your kind of case\. More has what they do say\./);
    assert.match(s.body, /Trial Rule 55 .* doesn't name missing a hearing specifically/);
  });
  test("edge: in every situation, nothing says losing is automatic, and every line names its source or is about your own answers", async () => {
    const bad = await p.evaluate(() => {
      const SOURCED = /Indiana Legal Help|Indiana Legal Services|E-Filing User Guide|Small Claims (Rule|Manual)|court directory|court rules this tool cites|official sources say|fee waiver forms say|this tool|Your (next )?court date|court date you entered|hearing date you entered|Your hearing is still set|Your case type is|Your forms are signed|Your name is blank|This asks the judge|More has|Certificate of Service on your form|These forms don't answer|It says courts differ|You can ask free legal help|left for you to sign|on your papers or at mycase\.in\.gov/;
      const out = [];
      for (const form of ["respond", "appearance", "continuance", "feewaiver"]) for (const fileMethod of ["", "efile", "paper"]) for (const county of ["", "Allen", "Martin", "Greene"])
        for (const role of ["me", "other"]) for (const caseNumber of ["", "02D01-2611-SC-001234", "02D01-2611-EV-001234", "02D01-2611-CC-001234", "02D01-2611-DC-001234", "02D01-2611-CM-001234"])
          for (const courtDate of ["", "2020-01-02", "2099-01-02"]) {
            sitKey = form;
            for (const s of nextSteps(form, { fileMethod, county, role, caseNumber, courtDate, hearingDate: courtDate, name: "Pat" })) {
              // ("Some waivers are automatic by law" is the E-Filing User Guide on fee waivers, not about losing.)
              if (/(los[et]|losing|default|judgment|rule against)[^.]*automatic|automatic[^.]*(los[et]|losing|default|judgment|rule against)/i.test(s.short + " " + s.body)) out.push(`${form}/${s.title}: says losing is automatic`);
              for (const sentence of (s.short || s.body).split(/(?<=[.!?])\s+(?=[A-Z"])/)) if (!SOURCED.test(sentence)) out.push(`${form}/${s.title}: "${sentence}"`);
            }
          }
      return [...new Set(out)].slice(0, 10);
    });
    assert.deepEqual(bad, []);
  });
  test("edge: the continuance shows its hearing date, and the fee waiver its fees", async () => {
    await inject(p, "continuance");
    const date = await p.evaluate(() => formDate(answers.hearingDate));
    assert.ok((await stepNamed("Your court date stays the same until the judge signs an order")).line.includes(`Your hearing is still set for ${date}.`));
    await inject(p, "feewaiver", { housing: "500" });
    assert.match((await stepNamed("File these with the forms that start your case")).line, /\$157, or \$185 with sheriff service/);
  });
  test("edge: after Download, it says the next steps are just below the download buttons", async () => {
    await inject(p, "appearance");
    await p.waitForFunction(() => pdfState.result && pdfState.key === pdfKey() && !pdfState.busy, null, { timeout: 120000 });
    await Promise.all([p.waitForEvent("download"), p.click("#dlAll")]);
    await p.waitForFunction(() => /What to do next is just below the download buttons/.test(document.getElementById("announce").textContent));
    const [dl, next] = await p.evaluate(() => [document.getElementById("dlAll"), [...document.querySelectorAll("h2.sub")].find(h => /What to do next/.test(h.textContent))].map(e => e.getBoundingClientRect().top));
    assert.ok(next > dl, "below the download buttons");
  });
});
