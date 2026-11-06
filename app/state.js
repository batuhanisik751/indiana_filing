// What the page is holding right now, the Get help panel, and which questions are showing.
/* =====================================================================
   APP STATE
   ===================================================================== */
let sitKey = null, steps = [], answers = {};
let mode = "pick", cur = 0, returnToSummary = false, lastEdited = null;
let unsure = {}; // questions the person marked "I'm not sure"
let justMarked = false; // the last question was just marked: say so on the next screen
let fromNotSure = false; // came here from "Which one fits?"
let followUps = [];      // questions an edited answer just opened, asked before going back to the summary
let fixFrom = null;      // where on the summary the person tapped Fix or Edit ("flags" or "vals")
let fixNth = 0;          // which of several Edit buttons for the same answer was tapped
let pendingFocus = null; // a Fix button to focus once the PDF check finishes
let editOriginal = null; // the answer before an edit from the summary, for Cancel
let lastProgress = {};   // the progress bar's last position
let triageHist = [];     // earlier sorting answers, for Back
let triageBeforeEdit = null; // sorting answers before "Change these answers"
const app = document.getElementById("app");

// Forget every answer in this tab. (clearSaved() deletes the saved copy.)
function resetAnswers() {
  sitKey = null; steps = []; answers = {}; unsure = {}; triage = {}; triagePrev = {}; triageHist = []; triageTouched = false; triageBeforeEdit = null; triageFromSummary = false; fromTriage = false; fromNotSure = false;
  savedHere = true; saveOk = true; copyKept = {}; notSureFromKind = false; whereOpen = false;
  editOriginal = null; lastProgress = {}; fixNth = 0; clearedContact = []; editErased = null; reloadedEdit = null;
  cur = 0; returnToSummary = false; lastEdited = null; draft = null; followUps = []; fixFrom = null; otherTab = false; pickedOther = false;
  pdfState = { key: null, result: null, error: false, busy: false };
}
const hasAnswers = () => Object.values(answers).some(v => !empty(v)) || Object.keys(unsure).length > 0;
// The same, with the box on screen counting as it reads now. Emptying the only answer leaves nothing to lose.
const holdsAnswers = () => Object.values(mode === "step" && draft ? { ...answers, [draft.id]: draft.value } : answers).some(v => !empty(v)) || Object.keys(unsure).length > 0;

// "Get help" at the top of every screen opens the same free-help list as the footer.
const helpBtn = document.getElementById("helpBtn"), helpPanel = document.getElementById("helpPanel");
const footerHelp = document.querySelector("footer ul");
if (footerHelp) document.getElementById("helpList").innerHTML = footerHelp.innerHTML;
function setHelp(open) {
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
document.getElementById("clearData").onclick = () => {
  const stored = store.get(STORE_KEY) !== null, wasOn = savingOn();
  if (!confirm(`Clear my data? This deletes every answer you have entered, on this page${stored ? ", in any other open tab, and saved on this device" : " and in any other open tab"}${wasOn ? ", and turns saving off" : ""}.`)) return;
  clearEverywhere();
  // Saving goes back to off, so the next person on this computer starts with it off.
  store.del(PREF_KEY); lastSavingOn = false;
  resetAnswers(); mode = "pick"; render();
  announce(wasOn ? "Your answers were deleted, and saving is off." : "Your answers were deleted.");
};
document.getElementById("saveToggle").onclick = () => {
  if (setSaving(!savingOn()) && mode === "pick") renderPick(true);
};

const visible = () => steps.filter(s => !s.showIf || s.showIf(answers));
// Only answers to questions that are currently shown go on the form.
const visibleAnswers = () => Object.fromEntries(visible().map(s => [s.id, answers[s.id]]));

function shown(step) {
  const v = answers[step.id];
  if (empty(v)) return "";
  if (step.type === "choice") { const o = step.options.find(o => o[0] === v); return o ? o[1] : v; }
  if (step.type === "date") return formDate(v);
  if (step.type === "money") return isNum(v) ? `$${moneyOrBlank(v)}` : v;
  return v;
}
