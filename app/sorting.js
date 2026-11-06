// The kinds of cases on the first screen and the sorting questions after them.
/* =====================================================================
   KINDS OF CASES AND SORTING QUESTIONS
   The first screen starts with the five kinds of civil cases these forms
   fit, in order of how many were filed in Indiana in 2024 (Indiana
   Judicial Service Report). The person then answers factual questions
   about their papers (not "what should I do?"). The tool shows which
   official forms fit and why, and the person chooses where to go.
   Every statement names its official source.
   ===================================================================== */
const CASE_KINDS = {
  debt: { pick: "I'm being sued over a debt", blurb: "Someone says you owe them money, like for a bill or a loan.",
    notice: "Small claims debt case: what fits", complaint: "Debt complaint: what fits" },
  smallclaims: { pick: "I'm being sued in small claims court", blurb: "The main paper you got is called a \"Notice of Claim,\" whatever the case is about.",
    notice: "Small claims case: what fits", complaint: "Complaint: what fits" },
  eviction: { pick: "I got eviction papers", blurb: "A landlord filed a case to have you move out.",
    notice: "Small claims eviction: what fits", complaint: "Eviction complaint: what fits" },
  tort: { pick: "I'm being sued over an injury or damage", blurb: "Someone says you hurt them or damaged their property, for example in a car accident.",
    notice: "Small claims case: what fits", complaint: "Injury or damage complaint: what fits" },
  plenary: { pick: "I'm being sued in another kind of civil case", blurb: "For example, over a contract.",
    notice: "Small claims case: what fits", complaint: "Civil complaint: what fits" },
};
// The kind of case chosen on the first screen (copies saved before there was a choice were eviction).
const kindOf = t => Object.hasOwn(CASE_KINDS, t?.kind) ? CASE_KINDS[t.kind] : CASE_KINDS.eviction;
// "I have a small claims case" already says the paper is a Notice of Claim.
const paperOf = t => t.kind === "smallclaims" ? "notice" : t.paper;
// Has the person answered a sorting question yet? (Choosing the kind of case isn't an answer.)
const triageAnswered = t => TRIAGE_STEPS.some(s => s.id !== "kind" && !empty(t?.[s.id]));
// What saved sorting answers are called in the clear signal to other tabs.
const sortingTag = t => `sorting:${Object.hasOwn(CASE_KINDS, t?.kind) ? t.kind : "eviction"}`;
const cleanTriage = o => { const t = strings(o); if (!Object.hasOwn(CASE_KINDS, t.kind)) delete t.kind; return t; };

const TRIAGE_STEPS = [
  // Only when changing these answers from the summary: the first screen answered this the first time.
  { id: "kind", label: "Kind of case", q: "What is your case about?", help: "Pick the one that fits.", showIf: () => triageFromSummary,
    options: Object.entries(CASE_KINDS).map(([k, c]) => [k, c.pick]) },
  { id: "paper", label: "Main paper you got", q: "What is the main paper you got called?", showIf: t => t.kind !== "smallclaims",
    help: "Look at the title near the top of the first page.",
    options: [["notice", "Notice of Claim"], ["complaint", "Complaint (it may come with a Summons)"], ["unsure", "Something else, or I'm not sure"]] },
  { id: "canGo", label: "Can you go to court on that date", showIf: t => paperOf(t) === "notice",
    q: "Can you go to court at the date and time on your Notice of Claim?",
    help: "The date and time are printed on the Notice of Claim.",
    options: [["yes", "Yes"], ["no", "No, I need to ask for a new date"], ["unsure", "I'm not sure"]] },
];

const SMALL_CLAIMS_FACTS = [
  "Your case is in small claims court. Indiana's Small Claims Manual says a Notice of Claim is a written statement of a claim against the defendant that serves as notice that the lawsuit has been filed and that the party is ordered to appear in court.",
  "A written answer usually isn't filed. Indiana Legal Help says Answers are not usually filed in small claims court or family court, and Small Claims Rule 4 says all defenses are \"deemed at issue without responsive pleadings,\" adding that this does not change the burden of proof.",
  "Indiana Legal Help says that when you respond to a case someone else started, you file an Appearance to tell the court who you are and how the court and others can contact you. Small Claims Rule 4 says the court may ask you to enter an appearance before trial, and that not entering one is not grounds for a default judgment.",
  "The Small Claims Manual says that if the plaintiff shows up and the defendant does not appear at the time on the Notice of Claim (or a continued date), the plaintiff can ask for a default judgment, which it defines as a decision for the plaintiff when the defendant fails to appear in court.",
  "The Small Claims Manual says it does not address the specific jurisdiction or procedures of Marion County Small Claims Court. If your case is in Marion County, the court directory lists its township small claims courts.",
];

function triageResult(t) {
  if (paperOf(t) === "notice") return {
    title: kindOf(t).notice,
    facts: t.canGo === "unsure" ? [...SMALL_CLAIMS_FACTS,
      "Not sure about your court date? It is printed on your Notice of Claim. You can also look up your case at mycase.in.gov, and Indiana's court staff page says staff can give you information from your case file, including when your next court hearing is."]
      : SMALL_CLAIMS_FACTS,
    sources: [SOURCES.smallClaims, { href: "https://rules.incourts.gov/Content/small-claims/rule4/current.htm", text: "Small Claims Rule 4" }, SOURCES.answerTopic, SOURCES.respond, SOURCES.directory,
      ...(t.canGo === "unsure" ? [SOURCES.mycase, { href: "https://www.in.gov/courts/selfservice/unrepresented/help", text: "Indiana courts: How court staff can help" }] : [])],
    choices: t.canGo === "no"
      ? [["continuance", "Ask the court to move my court date", "Fills the official Appearance and Verified Motion for Continuance."],
         ["appearance", "Fill out the Appearance only", "Gives the court your contact information."]]
      : [["appearance", "Fill out the Appearance", "Gives the court your contact information."],
         ["continuance", "I can't make my court date after all", "Fills the official Appearance and Verified Motion for Continuance."]],
  };
  if (t.paper === "complaint") return {
    title: kindOf(t).complaint,
    facts: [
      "Indiana Legal Help's Answer instructions define a Complaint as the official legal document filed by the plaintiff to start a civil lawsuit against you.",
      "Indiana Legal Help says its Answer form is for people being sued in superior or circuit court, that Answers are not usually filed in small claims court or family court, and that the court might decide the case without you if you don't file an Answer when you're required to.",
      "Its Answer instructions say you generally have twenty days to file your Answer once you've received the complaint.",
    ],
    sources: [SOURCES.answerTopic, SOURCES.answerInstructions],
    choices: [["respond", "Fill out the Appearance and Answer", "The official forms for responding to a complaint."],
              ["continuance", "I need to ask the court to move a court date", "Fills the official Appearance and Verified Motion for Continuance."]],
  };
  return {
    title: "Let's find out what kind of case it is",
    facts: [
      "Check the title at the top of your papers. The Small Claims Manual says a small claims case is started with a Notice of Claim, and Indiana Legal Help's Answer instructions define a Complaint as the document a plaintiff files to start a civil lawsuit.",
      "You can look up your case at mycase.in.gov. Indiana's court staff page says staff can give you information from your case file, including when your next court hearing is.",
    ],
    sources: [SOURCES.smallClaims, SOURCES.answerInstructions, SOURCES.mycase, { href: "https://www.in.gov/courts/selfservice/unrepresented/help", text: "Indiana courts: How court staff can help" }, SOURCES.directory, SOURCES.getHelp, SOURCES.helpDesk],
    choices: [],
    papers: [["notice", "My paper says \"Notice of Claim\""], ["complaint", "My paper says \"Complaint\""]],
  };
}

let triage = {}, fromTriage = false;
let notSureBeforeEdit = false;  // what "Which one fits?" was set to when the sorting answers were set aside
let triagePrev = {};            // earlier sorting answers, pre-selected when changing them
let triageTouched = false;      // this page has had sorting answers (answered here, or reopened from a saved copy)
let pickedOther = false;        // on the first screen because of "Choose a different form"
let triageFromSummary = false;  // the person is changing their sorting answers from the summary
let notSureFromKind = false;    // "Which one fits?" was opened from the kind of case question
const triageVisible = () => TRIAGE_STEPS.filter(s => !s.showIf || s.showIf(triage));

// from: the screen the person chose the form on ("pick", "triage" or "notsure").
// Keep a form's sorting answers aside while other sorting questions are on screen. Go back restores them.
function setSortingAside() { if (!triageBeforeEdit) { triageBeforeEdit = { ...triage }; notSureBeforeEdit = fromNotSure; } }
// A change from the summary is over. The kind of case question is hidden again, so its empty starting
// point can't stay in the history, or Back would land on a case with no kind.
function finishTriageChange() {
  if (triageFromSummary) triageHist = triageHist.filter(h => h.kind);
  triageFromSummary = false; triageBeforeEdit = null; notSureFromKind = false;
}
function startSituation(key, from = "pick") {
  const cameFrom = () => { fromTriage = from === "triage"; if (from !== "triage") fromNotSure = from === "notsure"; };
  // Coming back to the same form (for example with Back from its first question) keeps the answers.
  if (sitKey === key && (hasAnswers() || triageFromSummary)) {
    cameFrom(); cur = 0; returnToSummary = false;
    mode = triageFromSummary ? "summary" : "step"; finishTriageChange(); return render();
  }
  const saved = hasAnswers() ? null : readSaved();
  const prev = hasAnswers() ? sitKey : saved ? saved.sitKey : null;
  const title = SITUATIONS[key].title;
  let keep = {}, keepMarks = {};
  if (prev === key && saved) {
    // The same form was saved earlier: offer to pick up where the person left off.
    if (confirm(`You have saved answers for "${title}". Continue with them? (Choose Cancel to start over instead.)`)) {
      const path = { triage: { ...triage }, hist: triageHist.slice(), notSure: fromNotSure };
      restoreSaved(saved, () => {
        if (from !== "pick") { triage = path.triage; triageHist = path.hist; fromNotSure = path.notSure; }
        cameFrom();
      });
      return;
    }
    if (!confirm(`Start "${title}" over? Your saved answers will be deleted.`)) return;
    clearSaved();
  } else if (prev) {
    // Answers both forms ask for (your contact details, and the case details when
    // both forms are for a case already in court) carry over.
    // What was on the open question counts: choosing the Address Confidentiality Program without pressing Continue.
    const from = hasAnswers() ? visibleAnswers() : { ...strings(saved.answers), ...(saved.draft && typeof saved.draft.value === "string" ? { [saved.draft.id]: saved.draft.value } : {}) };
    const ids = new Set(SITUATIONS[key].steps().map(s => s.id));
    const sameCase = CASE_FORMS.includes(prev) && CASE_FORMS.includes(key);
    const carries = k => ids.has(k) && (SHARED_YOU.includes(k) || (sameCase && SHARED_CASE.includes(k)));
    keep = Object.fromEntries(Object.entries(from).filter(([k, v]) => carries(k) && !empty(v)));
    // "I'm not sure" on a question both forms ask stays marked, so the new form flags it too.
    const marks = hasAnswers() ? unsure : saved.unsure && typeof saved.unsure === "object" ? saved.unsure : {};
    keepMarks = Object.fromEntries(Object.keys(marks).filter(k => marks[k] === true && carries(k) && !keep[k]).map(k => [k, true]));
    const kept = Object.keys(keep).length
      ? ` Your contact details${sameCase && Object.keys(keep).some(k => SHARED_CASE.includes(k)) ? " and case details" : ""} will be kept.` : "";
    if (!confirm(`Start "${title}"? Your other answers for "${SITUATIONS[prev].title}" will be deleted, including any saved on this device.${kept}`)) return;
    // Only the copy that question names. Another tab's copy of a different form stays, and saving the new form asks about it.
    const copy = readSaved();
    if (!copy || copy.triageOnly || copy.sitKey === prev) clearSaved();
  }
  cameFrom(); finishTriageChange(); savedHere = true; otherTab = false; copyKept = {}; clearTimeout(otherTabTimer);
  sitKey = key; steps = SITUATIONS[key].steps(); answers = keep; unsure = keepMarks; cur = 0; mode = "step"; returnToSummary = false; render();
}
// What two forms share when switching between them.
const SHARED_YOU = ["name", "acp", "address", "acpAddress", "email", "phone", "fax"];
const SHARED_CASE = ["county", "courtType", "courtTypeOther", "caseNumber", "caseTypeLetters", "courtDate", "plaintiff"];
const CASE_FORMS = ["respond", "appearance", "continuance"];

function renderTriage() {
  const step = triageVisible().find(s => !triage[s.id]);
  if (step) {
    const ti = triageVisible().indexOf(step);
    app.innerHTML = `
      <div class="barlabel"><span>Your papers</span><span>Question ${ti + 1 - (triageFromSummary && triage.kind && !triageHist.some(h => !h.kind) ? 1 : 0)}</span></div>
      <h1 class="q" id="q" tabindex="-1">${esc(step.q)}</h1>
      <p class="help" id="qhelp">${esc(step.help)}</p>
      <div class="choices" role="radiogroup" aria-labelledby="q" aria-describedby="qhelp">${step.options.map(([val, lab]) =>
        `<label class="choice"><input type="radio" name="ans" value="${esc(val)}" ${triagePrev[step.id] === val ? "checked" : ""}><span>${esc(lab)}</span></label>`).join("")}</div>
      ${step.id === "kind" ? `<p class="need"><button class="link" id="kindNotSure">I'm not sure which one fits</button></p>` : ""}
      <p class="err" id="err" role="alert"></p>
      <div class="nav"><button class="ghost" id="back">Back</button><button class="primary" id="next">Continue</button></div>`;
    (app.querySelector("input[name=ans]:checked") || app.querySelector("#q")).focus();
    const unsureKind = document.getElementById("kindNotSure");
    if (unsureKind) unsureKind.onclick = () => { notSureFromKind = true; mode = "notsure"; render(); };
    const next = () => {
      const c = app.querySelector("input[name=ans]:checked");
      if (!c) { document.getElementById("err").textContent = "Pick one to continue."; return; }
      triageHist.push({ ...triage }); triage[step.id] = c.value; triageTouched = true; render();
    };
    document.getElementById("next").onclick = next;
    app.querySelectorAll("input[name=ans]").forEach(i => i.addEventListener("keydown", e => {
      if (e.key === "Enter" && !e.repeat && !e.isComposing) { e.preventDefault(); next(); }
    }));
    document.getElementById("back").onclick = triageBack;
    return;
  }
  const r = triageResult(triage);
  app.innerHTML = `
    <h1 tabindex="-1">${esc(r.title)}</h1>
    <ul class="facts">${r.facts.map(x => `<li>${esc(x)}</li>`).join("")}</ul>
    <p class="srcs">${r.sources.map(l => `<a href="${l.href}" target="_blank" rel="noopener">${esc(l.text)}</a>`).join(" · ")}</p>
    ${r.choices.length ? `<h2 class="sub">Choose what you want to do</h2>
      ${r.choices.map(([k, label, blurb]) => `<button class="pick" data-start="${k}"><strong>${esc(label)}</strong><span>${esc(blurb)}</span></button>`).join("")}` : ""}
    ${r.papers ? `<h2 class="sub">Found the title?</h2>
      ${r.papers.map(([k, label]) => `<button class="pick" data-paper="${k}"><strong>${esc(label)}</strong></button>`).join("")}
      <button class="pick" id="allChoices"><strong>See all the choices</strong><span>Go back to the first screen.</span></button>` : ""}
    <div class="note">This tool shows what official sources say about your kind of papers. It can't tell you what to do in your case. ${esc(HELP_DESK)} <a href="${LINKS.helpDesk}" target="_blank" rel="noopener">About the Indiana Legal Help Desk</a> · <a href="${LINKS.getHelp}" target="_blank" rel="noopener">Find free legal help near you</a></div>
    <div class="nav"><button class="ghost" id="back">Back</button></div>`;
  app.querySelector("h1").focus();
  app.querySelectorAll("[data-start]").forEach(b => b.onclick = () => startSituation(b.dataset.start, "triage"));
  app.querySelectorAll("[data-paper]").forEach(b => b.onclick = () => { triageHist.push({ ...triage }); triage.paper = b.dataset.paper; triageTouched = true; render(); });
  const all = document.getElementById("allChoices");
  // With no answers there's no form to go back to, so a change from the summary ends here.
  if (all) all.onclick = () => { triageHist = []; if (!hasAnswers()) { triageFromSummary = false; triageBeforeEdit = null; } mode = "pick"; render(); };
  document.getElementById("back").onclick = triageBack;
}

// Back in the sorting questions goes to the previous screen, with its answer selected.
function triageBack() {
  if (triageHist.length) { triagePrev = { ...triagePrev, ...triage }; triage = triageHist.pop(); return render(); }
  // A card answered the kind of case during a change: Back returns to where the card was, not to the same question.
  if (triageFromSummary && triage.kind && !triageAnswered(triage)) { triage = {}; mode = fromNotSure ? "notsure" : "pick"; return render(); }
  const answered = triageVisible().filter(s => triage[s.id]);
  if (triageFromSummary && triageBeforeEdit && !answered.length) {
    // C11: changing the answers from the summary, then going back: return to the summary unchanged.
    triage = triageBeforeEdit; triageBeforeEdit = null; triageFromSummary = false; mode = "summary"; return render();
  }
  if (answered.length) {
    // No history (for example after a reload): step back one question.
    const last = answered[answered.length - 1].id;
    triagePrev = { ...triagePrev, [last]: triage[last] }; delete triage[last]; return render();
  }
  // Leaving the sorting questions after taking the answers back: their saved copy goes too. Someone who
  // opened a card and left without answering keeps it, and the first screen still offers to continue.
  if (triageTouched) { const d = readSaved(); if (d && d.triageOnly && kindOf(d.triage) === kindOf(triage) && store.get(STORE_KEY) === lastWritten) clearSaved(); }
  triageTouched = false;
  mode = fromNotSure ? "notsure" : "pick"; render();
}
window.appParts++;
