// What the page is holding right now, the Get help panel, and which questions are showing.
/* =====================================================================
   APP STATE
   ===================================================================== */
let sitKey = null, steps = [], answers = {};
let mode = "pick", cur = 0, returnToSummary = false, lastEdited = null;
let unsure = {}; // questions the person marked "I'm not sure"
let justMarked = false; // the last question was just marked: say so on the next screen
let barGrew = 0;         // needed questions the last answer brought up, which moved the bar back: said on the next screen
let fromNotSure = false; // came here from "Which one fits?"
let followUps = [];      // questions an edited answer just opened, asked before going back to the summary
let selectOnOpen = null; // { id, spans }: the part of an answer a flag is about, to select when its question opens
let fixFrom = null;      // where on the summary the person tapped Fix or Edit ("flags" or "vals")
let fixNth = 0;          // which of several Edit buttons for the same answer was tapped
let pendingFocus = null; // a Fix button to focus once the PDF check finishes
let editOriginal = null; // the answer before an edit from the summary, for Cancel
let inlineEdit = null;   // an answer being changed in place on the summary: { id, nth, value, erased, err }
let caseConfirmFor = null; // the county and court the case number confirmation was answered for
let triageHist = [];     // earlier sorting answers, for Back
let triageBeforeEdit = null; // sorting answers before "Change these answers"
const app = document.getElementById("app");

// Forget every answer in this tab. (clearSaved() deletes the saved copy.)
function resetAnswers() {
  sitKey = null; steps = []; answers = {}; unsure = {}; triage = {}; triagePrev = {}; triageHist = []; triageTouched = false; triageBeforeEdit = null; triageFromSummary = false; fromTriage = false; fromNotSure = false;
  savedHere = true; saveOk = true; copyKept = {}; notSureFromKind = false; whereOpen = false; openMore.clear(); caseConfirmFor = null;
  editOriginal = null; inlineEdit = null; fixNth = 0; clearedContact = []; editErased = null; reloadedEdit = null; icsEvents = {};
  cur = 0; returnToSummary = false; lastEdited = null; draft = null; followUps = []; fixFrom = null; otherTab = false; pickedOther = false;
  pdfState = { key: null, result: null, error: false, busy: false };
  document.querySelector("dialog.pageview")?.remove(); // a page of the filled form shown large goes with the answers
}
const hasAnswers = () => Object.values(answers).some(v => !empty(v)) || Object.keys(unsure).length > 0;
// The same, with the box on screen counting as it reads now. Emptying the only answer leaves nothing to lose.
const holdsAnswers = () => Object.values(mode === "step" && draft ? { ...answers, [draft.id]: draft.value } : answers).some(v => !empty(v)) || Object.keys(unsure).length > 0
  || (mode === "summary" && !!inlineEdit && !empty(inlineEdit.value)); // text in a box on the summary (BT83)

// "Get help" at the top of every screen opens the same free-help list as the footer.
const helpBtn = document.getElementById("helpBtn"), helpPanel = document.getElementById("helpPanel");
const footerHelp = document.querySelector("footer ul");
if (footerHelp) document.getElementById("helpList").innerHTML = footerHelp.innerHTML;
// The word list, after the places to get help: the words whose definitions fit the form being filled and the person
// filling it, or, before a form is chosen, every word, saying that some are written for the person being sued.
function renderWords() {
  const forForm = !!sitKey && (mode === "step" || mode === "summary");
  const list = forForm ? GLOSSARY.filter(g => g.fits(sitKey, answers)) : GLOSSARY;
  const box = document.getElementById("helpWords"), was = box.querySelector("details");
  box.innerHTML = `<details class="more words nohover"${was && was.open ? " open" : ""}><summary>Words on the forms</summary><div class="morebody">
  <p class="need">What the official instructions say these words mean, word for word.${forForm ? " These are the ones that fit your form." : " Some are written for the person being sued, like the instructions they come from."}</p>
  <dl class="words">${list.map(g => { const d = termDef(g, forForm ? sitKey : null); return `<dt>${esc(g.term)}</dt><dd>\u201c${esc(d.says)}\u201d ${termSource(d)}</dd>`; }).join("")}</dl></div></details>`;
  markNewTabLinks(box);
}
renderWords();
function setHelp(open) {
  if (open) renderWords();
  helpPanel.hidden = !open; helpBtn.setAttribute("aria-expanded", String(open));
  (open ? document.getElementById("helpTitle") : helpBtn).focus();
  syncHistory();
}
helpBtn.onclick = () => setHelp(helpPanel.hidden);
document.getElementById("helpClose").onclick = () => setHelp(false);
// Escape closes it from anywhere. Someone typing in a question stays where they are.
document.addEventListener("keydown", e => {
  if (e.key !== "Escape" || helpPanel.hidden) return;
  const active = document.activeElement;
  if (helpPanel.contains(active) || active === helpBtn || active === document.body) return setHelp(false);
  helpPanel.hidden = true; helpBtn.setAttribute("aria-expanded", "false");
  syncHistory();
});

// After keeping what another tab saved, this tab can still choose to save its own answers instead.
document.getElementById("saveMine").onclick = () => {
  let old = null; try { old = JSON.parse(store.get(STORE_KEY) || "null"); } catch { /* unreadable */ }
  if (!confirm(`Replace what the other tab saved on this device with this tab's answers?${old && old.sitKey === sitKey ? addressNote(old) : ""}`)) return;
  copyKept = {}; copyReplaced = store.get(STORE_KEY);
  saveProgress(); updatePrivacyNote();
  announce(savedHere ? "This tab's answers are saved on this device." : "This tab's answers couldn't be saved.");
  document.getElementById("saveToggle").focus(); // this link is hidden now
};
// Bigger text and high contrast, from the header. Kept on this device only while saving is on, like everything
// else the tool keeps; with saving off they last until the page is closed.
const DISPLAY_KEY = "icfh-display-v1", TEXT_SIZES = [1, 1.15, 1.3, 1.5];
const look = { size: 0, contrast: false };
function applyDisplay() {
  const root = document.documentElement;
  if (look.size) root.style.setProperty("--text-scale", TEXT_SIZES[look.size]); else root.style.removeProperty("--text-scale");
  if (look.contrast) root.dataset.contrast = "high"; else delete root.dataset.contrast;
  // At the end of the range a button is marked unavailable but keeps focus, so one Enter too many does nothing
  // (rather than moving focus to the other button, where it would undo a step).
  document.getElementById("textSmaller").setAttribute("aria-disabled", String(look.size === 0));
  document.getElementById("textBigger").setAttribute("aria-disabled", String(look.size === TEXT_SIZES.length - 1));
  document.getElementById("contrastBtn").setAttribute("aria-pressed", String(look.contrast));
}
// Only a change from the usual look is kept, and only with saving on.
function keepDisplay() {
  if (!storageWorks) return; // blocked, or full: nothing can be kept, and what's kept stays (like the answers)
  if (savingOn() && (look.size || look.contrast)) store.set(DISPLAY_KEY, JSON.stringify(look)); else store.del(DISPLAY_KEY);
}
// A saved copy too old to use turns saving off (in readSaved), and with it the previous person's look: so it's
// checked first, and an expired copy's look is never applied.
if (savingOn()) readSaved();
if (savingOn() || storageFull) { // full storage can still be read, like the saved answers
  try {
    const d = JSON.parse(store.get(DISPLAY_KEY) || "null");
    if (d && Number.isInteger(d.size) && d.size > 0 && d.size < TEXT_SIZES.length) look.size = d.size;
    if (d && d.contrast === true) look.contrast = true;
  } catch { /* unreadable: the usual look */ }
} else if (!storageFull) store.del(DISPLAY_KEY);
applyDisplay();
// "Aa" opens and closes the row of controls; Escape closes it from inside, back on "Aa".
const readBtn = document.getElementById("readBtn"), readTools = document.getElementById("readTools");
function setReadTools(open, refocus) { readTools.hidden = !open; readBtn.setAttribute("aria-expanded", String(open)); if (refocus) readBtn.focus(); }
readBtn.onclick = () => setReadTools(readTools.hidden);
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && !readTools.hidden && (readTools.contains(document.activeElement) || document.activeElement === readBtn)) setReadTools(false, true);
});
const sizeBtn = (id, step) => document.getElementById(id).onclick = () => {
  const to = look.size + step;
  if (to < 0 || to >= TEXT_SIZES.length) return announce(to < 0 ? "Text size is already the usual size." : `Text size is already at its biggest, ${Math.round(TEXT_SIZES[look.size] * 100)} percent.`);
  look.size = to;
  applyDisplay(); keepDisplay();
  announce(`Text size ${Math.round(TEXT_SIZES[look.size] * 100)} percent.`);
};
sizeBtn("textBigger", 1); sizeBtn("textSmaller", -1);
document.getElementById("contrastBtn").onclick = () => {
  look.contrast = !look.contrast;
  applyDisplay(); keepDisplay();
  announce(look.contrast ? "High contrast is on." : "High contrast is off.");
};

document.getElementById("clearData").onclick = () => {
  const stored = store.get(STORE_KEY) !== null, wasOn = savingOn();
  if (!confirm(`Clear my data? This deletes every answer you have entered, on this page${stored ? ", in any other open tab, and saved on this device" : " and in any other open tab"}${wasOn ? ", and turns saving off" : ""}.`)) return;
  clearEverywhere();
  // Saving goes back to off, so the next person on this computer starts with it off.
  store.del(PREF_KEY); store.del(DISPLAY_KEY); lastSavingOn = false;
  resetAnswers(); mode = "pick"; render();
  announce(wasOn ? "Your answers were deleted, and saving is off." : "Your answers were deleted.");
};
document.getElementById("saveToggle").onclick = () => {
  if (setSaving(!savingOn()) && mode === "pick") renderPick(true);
};

const visible = () => steps.filter(s => !s.showIf || s.showIf(answers));
// Only answers to questions that are currently shown go on the form, plus what a hidden question takes from
// another answer: the county and court, from a case number the person confirmed.
const visibleAnswers = () => Object.fromEntries(steps.flatMap(s => (!s.showIf || s.showIf(answers) ? [[s.id, answers[s.id]]] : s.derive ? [[s.id, s.derive(answers)]] : [])));

function shown(step) {
  const v = answers[step.id];
  if (empty(v)) return "";
  if (step.type === "choice") { const o = step.options.find(o => o[0] === v); return o ? o[1] : v; }
  if (step.type === "checks") return String(v).split(",").map(k => (step.options.find(o => o[0] === k) || [, k])[1]).join(", ");
  if (step.type === "date") return formDate(v);
  if (step.type === "money") return isNum(v) ? `$${moneyOrBlank(v)}` : v;
  return v;
}
window.appParts++;
