// The saved copy, what happens between tabs, and clearing data.
/* =====================================================================
   SAVED PROGRESS
   Saving is off unless the person turns it on ("Turn on saving" at the top
   of every screen, or the checkbox on the first screen), because many
   people use a shared or public computer, like a library or courthouse
   kiosk. When it's on, answers are kept in this browser only
   (localStorage), so a refresh or a closed tab doesn't erase them. Nothing
   is sent anywhere, and anyone can delete what's saved ("Clear my data" is
   on every screen). Saved answers are deleted when the page is opened 30
   or more days after the last change.
   ===================================================================== */
const STORE_KEY = "icfh-progress-v1", PREF_KEY = "icfh-save-pref";
const CLEAR_KEY = "icfh-cleared"; // tells other open tabs that the person deleted their answers
const MAX_AGE_DAYS = 30;
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch { /* storage blocked */ } },
};
// Some browsers (private windows, blocked site data) don't let the page save at all.
const storageWorks = store.set("icfh-test", "1") && (store.del("icfh-test"), true);
let turningOn = false; // this tab's first save, just before the setting changes
const savingOn = () => storageWorks && (turningOn || store.get(PREF_KEY) === "on"); // off unless turned on
// Storage that's only full can still be read. Nothing new can be saved, but what's saved isn't touched.
const storageFull = !storageWorks && store.get(PREF_KEY) === "on";
// With saving off, nothing is kept: a copy found when the page opens (for example one saved
// before saving became opt-in) is deleted.
if (!savingOn() && !storageFull) store.del(STORE_KEY);
// What each "keep my address confidential" answer keeps off the device, and how to name it.
const PROTECTS = { acp: ["address"], agConfidential: ["address", "email", "phone", "fax", "acceptEmail"] };
const CONTACT_WORDS = { address: "address", email: "email address", phone: "phone number", fax: "fax number", acceptEmail: "answer about accepting papers by email" };
const contactWords = ids => { const w = ids.map(k => CONTACT_WORDS[k]); return w.length > 1 ? `${w.slice(0, -1).join(", ")} and ${w[w.length - 1]}` : w[0]; };
let clearedContact = []; // answers erased because of those, so the summary can say so
let editErased = null;   // the question being edited, once its box has been emptied
let reloadedEdit = null; // the question whose edit carried on after a reload
let saveOk = true;      // did the last save work?
let savedHere = true;   // is this page's work in the saved copy (another tab may have deleted it)?
let lastSavingOn = null; // the saving setting this page last knew (set at start-up)
let savedHereWhy = "deleted"; // or "replaced", "kept", "otherForm"
let copyKept = {};       // forms whose copy, saved by another tab, this tab chose to keep
let copyReplaced = null; // the copy this tab chose to replace: if writing fails, it isn't asked about again
let otherTab = false;   // has another tab been saving this same form?
let otherTabTimer = null;
let lastWritten = null;  // the saved copy as this page last wrote or opened it
const OTHER_TAB_QUIET_MS = 120000;
let draft = null;       // what's typed in the open question but not saved yet

// Links that open a new tab say so to screen-reader users.
function markNewTabLinks(root = document) {
  root.querySelectorAll('a[target="_blank"]:not([data-nt])').forEach(a => {
    a.dataset.nt = "1";
    a.insertAdjacentHTML("beforeend", '<span class="sr-only"> (opens in a new tab)</span>');
  });
}
// Say something to screen-reader users without moving their focus.
function announce(msg) {
  const el = document.getElementById("announce");
  if (!el) return;
  el.textContent = "";
  setTimeout(() => { el.textContent = msg; }, 50);
}
const strings = o => Object.fromEntries(Object.entries(o && typeof o === "object" ? o : {}).filter(([, v]) => typeof v === "string"));
// A saved copy that can't be used (unreadable, too old, or with no answers) is deleted.
function readSaved() {
  const raw = store.get(STORE_KEY);
  if (raw === null) return null;
  try {
    const d = JSON.parse(raw);
    const age = d ? Date.now() - d.savedAt : NaN;
    const fresh = d && d.v === 1 && Number.isFinite(d.savedAt) && age > -864e5 && age <= MAX_AGE_DAYS * 864e5;
    const usable = fresh && (d.triageOnly
      ? triageAnswered(strings(d.triage)) // only the sorting answers so far
      : Object.hasOwn(SITUATIONS, d.sitKey)
        && (Object.values(strings(d.answers)).some(v => !empty(v)) || (d.draft && !empty(d.draft.value)) || Object.values(d.unsure || {}).includes(true)));
    if (usable) return d;
    // Answers that expired: saving goes back to off, so the next person on this computer isn't saved without choosing it.
    if (fresh === false && d && d.v === 1 && Number.isFinite(d.savedAt) && age > MAX_AGE_DAYS * 864e5) savingOffForNext();
  } catch (e) { if (e instanceof ReferenceError) throw e; /* otherwise unreadable. A missing part of this app isn't a bad copy, so it's left alone. */ }
  store.del(STORE_KEY);
  return null;
}
// Only the question screens and the summary hold answers worth saving, and only
// answers to questions that are shown: a hidden answer (like a home address after
// choosing the Address Confidentiality Program) is never kept on the device.
// What a saved copy is called on the first screen and in messages.
const savedTitle = d => d.triageOnly ? kindOf(d.triage).pick : SITUATIONS[d.sitKey].title;
// Storage was already full when the page opened. Nothing can be written, but a copy can still be deleted,
// and it can't keep an address this person just chose to protect, or an answer they erased.
function tidyFullStorageCopy() {
  if (!storageFull || !sitKey) return;
  let old = null; try { old = JSON.parse(store.get(STORE_KEY) || "null"); } catch { return; }
  if (!old || old.sitKey !== sitKey || !old.answers) return;
  const now = mode === "step" && draft ? { ...answers, [draft.id]: draft.value } : answers;
  const hidden = Object.keys(PROTECTS).filter(k => now[k] === "yes").flatMap(k => PROTECTS[k]);
  if (Object.keys(old.answers).some(k => !empty(old.answers[k]) && (hidden.includes(k) || empty(now[k])))) clearSaved();
}
function saveProgress() {
  if (!savingOn()) { tidyFullStorageCopy(); return; }
  // A form opened with nothing in it yet doesn't count: Back from it can lead to new sorting answers.
  if (!sitKey || (mode === "triage" && !hasAnswers())) {
    // Only the sorting answers so far: keep them too, so a refresh doesn't lose them.
    // A copy saved for a form is never replaced by these.
    let prev = null;
    try { prev = JSON.parse(store.get(STORE_KEY) || "null"); } catch { /* unreadable */ }
    // This page's copy of a form whose answers were all erased: an erased answer mustn't stay on the device.
    if (sitKey && prev && prev.sitKey === sitKey && store.get(STORE_KEY) === lastWritten) { clearSaved(); prev = null; }
    // During a change from the summary the copy keeps the old answers until the person accepts the new ones.
    const held = triageBeforeEdit || triage;
    const picked = triageAnswered(held);
    if (mode === "triage" && picked && (!prev || prev.triageOnly)) {
      // Reopening these answers isn't a change, so it doesn't restart the 30 days.
      const same = prev && Number.isFinite(prev.savedAt) && sortingKey(prev.triage) === sortingKey(held);
      saveOk = writeCopy(JSON.stringify({ v: 1, triageOnly: true, triage: held, fromNotSure, mode: "triage", savedAt: same ? prev.savedAt : Date.now() }));
      if (saveOk) savedHere = true;
    } else if (!picked) saveOk = true; // nothing here to save
    return;
  }
  let old = null;
  try { old = JSON.parse(store.get(STORE_KEY) || "null"); } catch { /* unreadable */ }
  if (!hasAnswers() && !(draft && !empty(draft.value))) {
    // Every answer was erased: don't keep an empty copy. Only this page's own copy, though: a tab with
    // nothing typed yet must not delete what another tab saved.
    if (old && old.sitKey === sitKey && store.get(STORE_KEY) === lastWritten) {
      clearSaved();
      // The sorting answers that led to this form are still good.
      if (fromTriage && triageAnswered(triage)) saveOk = writeCopy(JSON.stringify({ v: 1, triageOnly: true, triage, fromNotSure, mode: "triage", savedAt: Date.now() }));
    } else if (old && old.triageOnly && store.get(STORE_KEY) === lastWritten && fromTriage && triageAnswered(triage) && sortingKey(old.triage) !== sortingKey(triage)) {
      // New sorting answers were accepted for a form with nothing in it yet.
      saveOk = writeCopy(JSON.stringify({ v: 1, triageOnly: true, triage, fromNotSure, mode: "triage", savedAt: Date.now() }));
    }
    return;
  }
  // The choice on the open question counts right away: choosing the Address Confidentiality Program
  // takes the home address out of the saved copy before Continue is pressed.
  const withDraft = mode === "step" && draft ? { ...answers, [draft.id]: draft.value } : answers;
  const shownNow = steps.filter(s => !s.showIf || s.showIf(withDraft));
  const visIds = new Set(shownNow.map(s => s.id));
  // A choice that isn't saved yet can't lose the answers it would hide: Cancel after a reload brings them back.
  // A protected address is the exception. It leaves the copy as soon as the choice is made.
  const guarded = id => (withDraft.acp === "yes" && PROTECTS.acp.includes(id)) || (withDraft.agConfidential === "yes" && PROTECTS.agConfidential.includes(id));
  // During an edit the original answer counts too, even after a reload: Cancel puts it back.
  const beforeEdit = returnToSummary && editOriginal ? { ...answers, [editOriginal.id]: editOriginal.value } : answers;
  const keptNow = steps.filter(s => visIds.has(s.id) || ((!s.showIf || s.showIf(answers) || s.showIf(beforeEdit)) && !guarded(s.id)));
  const keptIds = new Set(keptNow.map(s => s.id));
  // From the first screen, "Which one fits?" or the sorting questions, the copy reopens at the
  // question (or the summary, when the person was changing the sorting answers from it).
  const editingTriage = triageFromSummary && mode !== "step" && mode !== "summary";
  const fromSummary = mode === "summary" || editingTriage;
  // What's in the open box replaces the old answer right away, so erased text doesn't stay on the device.
  // During an edit the old answer stays for Cancel, unless the box was emptied.
  // Once it has been emptied, the old answer stays out, even as new text is typed.
  if (mode === "step" && draft && empty(draft.value) && returnToSummary) editErased = draft.id;
  const emptied = mode === "step" && draft && (empty(draft.value) || (returnToSummary && editErased === draft.id));
  const inCopy = withDraft !== answers && (!returnToSummary || emptied) ? withDraft : answers;
  // What a reload won't bring back, so that page can say it's gone.
  const dropped = [...new Set([...clearedContact, ...steps.filter(s => !keptIds.has(s.id) && guarded(s.id) && !empty(answers[s.id])).map(s => s.id)])];
  const data = { v: 1, sitKey, ...(dropped.length ? { cleared: dropped } : {}), answers: Object.fromEntries(keptNow.map(s => [s.id, inCopy[s.id]])), unsure: Object.fromEntries(Object.entries(unsure).filter(([k]) => keptIds.has(k))),
    cur, mode: fromSummary ? "summary" : "step", triage: triageBeforeEdit && mode !== "step" && mode !== "summary" ? triageBeforeEdit : triage,
    fromTriage, fromNotSure, draft: mode === "step" ? draft : null,
    edit: returnToSummary ? { followUps, lastEdited, fixFrom, fixNth, original: emptied && editOriginal?.id === draft.id ? { ...editOriginal, value: undefined, ...(empty(editOriginal.value) ? {} : { erased: true }) } : editOriginal } : null };
  // Typed text counts wherever it's kept, and a blank answer is the same as no answer.
  const filled = d => Object.entries(d.draft ? { ...d.answers, [d.draft.id]: d.draft.value } : d.answers || {}).filter(([, v]) => !empty(v)).sort(([x], [y]) => (x < y ? -1 : 1));
  // Another tab saved since this page last did. Different answers aren't replaced without asking. They aren't
  // mixed in here either: they could be for another case, or something this page erased.
  const stored = store.get(STORE_KEY), compared = d => JSON.stringify([d.sitKey, filled(d), Object.keys(d.unsure || {}).sort()]);
  // A tab that rewrote what this page last saved, with nothing new, isn't something to ask about.
  let lastMine = null; try { lastMine = JSON.parse(lastWritten || "null"); } catch { /* unreadable */ }
  if (old && old.sitKey && stored !== lastWritten && compared(old) !== compared(data) && !(lastMine && compared(lastMine) === compared(old)) && !mayReplaceCopy(old, stored)) return;
  // Only a change to the answers restarts the 30 days, so reopening a copy or stepping past a question changes nothing.
  const content = d => JSON.stringify([d.sitKey, filled(d), Object.keys(d.unsure || {}).sort(), sortingKey(d.triage)]);
  const savedAt = old && Number.isFinite(old.savedAt) && content(old) === content(data) ? old.savedAt : Date.now();
  const json = JSON.stringify({ ...data, savedAt });
  if (json === store.get(STORE_KEY)) { savedHere = true; saveOk = true; lastWritten = json; return; }
  saveOk = writeCopy(json);
  if (saveOk) savedHere = true;
  // The write failed, so the old copy stays. It can't stay if it holds an address this person just chose to protect.
  else if (old && old.sitKey === sitKey && steps.some(s => guarded(s.id) && !empty(old.answers?.[s.id]))) clearSaved();
}
// Saving this tab's answers would undo the other tab's choice to protect an address, so the question says so.
function addressNote(old) {
  const theirs = old.draft && typeof old.draft.value === "string" ? { ...strings(old.answers), [old.draft.id]: old.draft.value } : strings(old.answers);
  return (theirs.acp === "yes" && answers.acp !== "yes") || (theirs.agConfidential === "yes" && answers.agConfidential !== "yes")
    ? " The other tab chose to keep your address confidential, and this tab's address would be saved instead." : "";
}
// One copy is kept, so saving here would replace what another tab saved. Ask each time another tab has saved since,
// unless this tab already chose to keep that form's copy.
function mayReplaceCopy(old, stored) {
  const form = old.sitKey, same = form === sitKey;
  if (!Object.hasOwn(SITUATIONS, form) || stored === copyReplaced) return true; // not a form this page can open, or already answered
  if (!copyKept[form]) {
    if (document.hidden) { savedHere = false; savedHereWhy = "replaced"; return false; } // this tab isn't in front: ask when it is
    const replace = confirm(same
      ? `Another tab saved different answers for "${SITUATIONS[form].title}" on this device. Only one copy can be saved. Replace them with the answers in this tab?${addressNote(old)} (Cancel keeps what the other tab saved. This tab's answers stay on this page but aren't saved.)`
      : `Another tab saved your answers for "${SITUATIONS[form].title}" on this device. Only one form can be saved at a time. Replace them with your answers for "${SITUATIONS[sitKey].title}"?`);
    if (replace) { copyReplaced = stored; return true; }
    copyKept[form] = true;
  }
  savedHere = false; savedHereWhy = same ? "kept" : "otherForm";
  return false;
}
function clearSaved() { store.del(STORE_KEY); }
function savingOffForNext() { store.del(PREF_KEY); lastSavingOn = false; }
// Writes the saved copy and remembers it, so this page can tell its own copy from another tab's.
function writeCopy(json) { const ok = store.set(STORE_KEY, json); if (ok) lastWritten = json; return ok; }
// Are these sorting answers what's in the saved copy? (A form's copy is never replaced by them.)
const sortingKey = t => JSON.stringify(Object.entries(cleanTriage(t)).sort());
const sortingInCopy = () => { try { const d = JSON.parse(store.get(STORE_KEY) || "null"); return !!d?.triageOnly && sortingKey(d.triage) === sortingKey(triage); } catch { return false; } };
const savedIsMine = () => { try { return !!sitKey && JSON.parse(store.get(STORE_KEY) || "null")?.sitKey === sitKey; } catch { return false; } };
// Deleting answers on purpose also clears them from any other open tab.
// (The signal goes first, so other tabs reset before they hear the copy went, and say so once.)
function clearEverywhere() { sendClear(String(Date.now())); clearSaved(); }
// Deleting one form's answers also clears that form (and only that form) in other open tabs.
function clearFormEverywhere(form) {
  // This form's copy, or sorting answers. If another tab saved a different form, that copy isn't this one to delete.
  let d = null; try { d = JSON.parse(store.get(STORE_KEY) || "null"); } catch { /* unreadable */ }
  sendClear(JSON.stringify({ at: Date.now(), form }));
  if (!d || d.triageOnly || d.sitKey === form) clearSaved();
}
// keep(): optional, runs after the saved state is loaded and before the screen is drawn.
function restoreSaved(d, keep) {
  lastWritten = store.get(STORE_KEY); copyKept = {};
  if (d.triageOnly) {
    resetAnswers(); triage = cleanTriage(d.triage); triageTouched = true; fromNotSure = d.fromNotSure === true; mode = "triage";
    if (keep) keep();
    return render();
  }
  triageHist = []; triageFromSummary = false; triageBeforeEdit = null;
  sitKey = d.sitKey; steps = SITUATIONS[sitKey].steps(); answers = strings(d.answers);
  clearedContact = Array.isArray(d.cleared) ? d.cleared.filter(k => Object.hasOwn(CONTACT_WORDS, k) && steps.some(s => s.id === k)) : [];
  unsure = Object.fromEntries(Object.entries(d.unsure && typeof d.unsure === "object" ? d.unsure : {}).filter(([, v]) => v === true));
  // Text typed into a question before the page closed is kept, like the Back button keeps it.
  if (d.draft && typeof d.draft.value === "string" && steps.some(s => s.id === d.draft.id)) {
    answers[d.draft.id] = d.draft.value;
    // During an edit a mark stays until the answer is saved: Save with the box empty again still counts as not sure.
    if (!empty(d.draft.value) && !(d.edit && d.mode !== "summary")) delete unsure[d.draft.id];
  }
  triage = cleanTriage(d.triage); fromTriage = d.fromTriage === true; fromNotSure = d.fromNotSure === true;
  cur = Number.isInteger(d.cur) && d.cur > 0 ? d.cur : 0; returnToSummary = false;
  // An edit started from the summary carries on as an edit.
  const ids = new Set(steps.map(s => s.id));
  if (d.edit && typeof d.edit === "object" && d.mode !== "summary") {
    returnToSummary = true;
    reloadedEdit = d.draft?.id || null;
    followUps = Array.isArray(d.edit.followUps) ? d.edit.followUps.filter(id => ids.has(id)) : [];
    lastEdited = ids.has(d.edit.lastEdited) ? d.edit.lastEdited : null;
    fixFrom = d.edit.fixFrom === "flags" ? "flags" : "vals";
    fixNth = Number.isInteger(d.edit.fixNth) && d.edit.fixNth > 0 ? d.edit.fixNth : 0;
    const o = d.edit.original;
    editOriginal = o && typeof o === "object" && ids.has(o.id) && (o.value === undefined || typeof o.value === "string")
      ? { id: o.id, value: o.value, unsure: o.unsure === true, ...(o.erased === true ? { erased: true } : {}), before: Array.isArray(o.before) ? o.before.filter(x => ids.has(x)) : null } : null;
  }
  mode = d.mode === "summary" ? "summary" : "step";
  if (keep) keep();
  render();
}
function updatePrivacyNote() {
  const btn = document.getElementById("saveToggle");
  if (btn) { btn.hidden = !storageWorks; btn.textContent = savingOn() ? "Turn off saving" : "Turn on saving"; }
  const el = document.getElementById("privacy");
  if (!el) return;
  const working = sitKey && (mode === "step" || mode === "summary");
  const notInCopy = sitKey && holdsAnswers() && !savedHere;
  document.getElementById("saveMine").hidden = !(notInCopy && savingOn() && saveOk && (savedHereWhy === "kept" || savedHereWhy === "otherForm" || (savedHereWhy === "replaced" && mode === "summary"))); // the summary has no next change to save it
  el.textContent = otherTab && working && savingOn() && saveOk && !notInCopy ? "This form is also open in another tab. Use one tab so your answers don't replace each other."
    : !storageWorks || ((sitKey || mode === "triage") && savingOn() && !saveOk) ? "Not saved: this browser isn't letting the page save. Nothing is sent."
    : !savingOn() ? "Not saved on this device. Nothing is sent."
    : notInCopy ? (savedHereWhy === "otherForm"
      ? "Not saved right now: another tab saved a different form on this device. Nothing is sent."
      : savedHereWhy === "kept"
      ? "Not saved right now: you kept what another tab saved. To continue with those answers, reload this page. Nothing is sent."
      : savedHereWhy === "replaced"
      ? "Not saved right now: another tab saved different answers over this copy. Your next change here can save yours again. Nothing is sent."
      : "Not saved right now: the saved copy was deleted in another tab. Your next change saves it again. Nothing is sent.")
    : working && savedIsMine() ? "Saved only on this device. Nothing is sent."
    : "Answers save only on this device. Nothing is sent.";
}
// Another tab saving the same form would replace this tab's answers (and the other way around).
// Deleting answers reaches other tabs by a storage event. That needs working storage, so a channel carries it too.
let lastClearSignal = null, clearChannel = null;
try { clearChannel = new BroadcastChannel("icfh-clear"); clearChannel.onmessage = e => heardClear(e.data); } catch { /* the storage event still works */ }
function sendClear(signal) { store.set(CLEAR_KEY, signal); store.del(CLEAR_KEY); try { clearChannel?.postMessage(signal); } catch { /* the storage event still works */ } }
function heardClear(signal) {
  if (signal === lastClearSignal) return; // it arrived both ways
  lastClearSignal = signal;
  // Start over or Delete saved answers name one form; Clear my data names none (every form).
  let form = null;
  try { const v = JSON.parse(signal); if (v && typeof v === "object" && typeof v.form === "string") form = v.form; } catch { /* a plain time */ }
  if (form && form.startsWith("sorting:")) {
    // Saved sorting answers were deleted: a tab still holding them clears too, or its next click saves them again.
    const held = triageBeforeEdit || triage;
    if (!hasAnswers() && (triageAnswered(held) || (mode === "triage" && triageTouched)) && sortingTag(held) === form) {
      const title = kindOf(held).pick;
      if (sitKey && (mode === "step" || mode === "summary")) {
        // On a form with nothing in it yet: it stays open, without those answers.
        triage = {}; triagePrev = {}; triageHist = []; fromTriage = false; triageBeforeEdit = null; triageFromSummary = false;
        if (mode === "summary") render();
      } else { resetAnswers(); mode = "pick"; render(); }
      announce(`Your answers for "${title}" were deleted in another tab.`);
    } else if (mode === "pick") renderPick(true);
    return;
  }
  if (form && form !== sitKey) { if (mode === "pick") renderPick(true); return; } // a different form: nothing to delete here
  if (form) {
    const title = SITUATIONS[form] ? SITUATIONS[form].title : "this form";
    resetAnswers(); mode = "pick"; render();
    announce(`Your answers for "${title}" were deleted in another tab.`);
    return;
  }
  // The person deleted their answers in another tab: delete them here too.
  const had = hasAnswers();
  if (!had && mode === "pick") { resetAnswers(); renderPick(true); updatePrivacyNote(); return; } // nothing changes here
  resetAnswers(); mode = "pick"; render();
  if (had) announce("Your answers were deleted in another tab.");
}
window.addEventListener("storage", e => {
  if (e.key === CLEAR_KEY) { if (e.newValue !== null) heardClear(e.newValue); return; } // null: the signal removing itself
  if (e.key === PREF_KEY) {
    const now = savingOn();
    if (now === lastSavingOn) { updatePrivacyNote(); return; } // nothing changed for this page
    lastSavingOn = now;
    const hadCard = !!document.getElementById("resume"), live = sitKey && hasAnswers();
    if (now) {
      saveProgress(); // turned on: save this page's answers
      // Only if the copy really is this tab's. Another tab's copy of the same form can be there first.
      if (live && saveOk && store.get(STORE_KEY) === lastWritten) { savedHere = true; announce("Saving was turned on in another tab. Your answers are saved on this device."); }
    } else if (hadCard) announce("Saving was turned off in another tab, and the saved answers were deleted.");
    else if (live) announce("Saving was turned off in another tab. Your answers are still on this page, but they aren't saved.");
    updatePrivacyNote(); if (mode === "pick") renderPick(true); return;
  }
  if (e.key === null) { // something else cleared this site's storage, including the saving setting
    lastSavingOn = savingOn();
    if (sitKey && (hasAnswers() || (draft && !empty(draft.value)))) { savedHere = false; savedHereWhy = "deleted"; announce("The saved copy was deleted outside this page. Your answers are still on this page, but they aren't saved."); }
    if (mode === "pick") renderPick(true);
    updatePrivacyNote(); return;
  }
  if (e.key !== STORE_KEY) return;
  if (e.newValue === null && sitKey && (hasAnswers() || (draft && !empty(draft.value)))) {
    if (savedHere && savingOn()) announce("The saved copy was deleted in another tab. Your answers are still on this page.");
    savedHere = false; savedHereWhy = "deleted"; // deleted in another tab
  } else if (e.newValue === null && mode === "pick" && document.getElementById("resume")) announce("The saved answers were deleted in another tab.");
  // Another tab saved over this page's answers: a different form, or this form without something this page has.
  if (e.newValue !== null && sitKey && (hasAnswers() || (draft && !empty(draft.value)))) {
    // What's in the copy now, not what this event carried: tabs can save right after each other.
    let saver = null; try { saver = JSON.parse(store.get(STORE_KEY) || "null"); } catch { /* unreadable */ }
    if (saver && saver.sitKey && store.get(STORE_KEY) !== lastWritten) {
      // A blank is the same as no answer, and it's fine for the other tab to have more.
      const theirs = saver.draft ? { ...saver.answers, [saver.draft.id]: saver.draft.value } : saver.answers || {};
      // What this page would keep: the choice on the open question counts, as it does when saving.
      const current = mode === "step" && draft ? { ...answers, [draft.id]: draft.value } : answers;
      const shownNow = steps.filter(s => !s.showIf || s.showIf(current));
      const lost = saver.sitKey !== sitKey || shownNow.some(s => !empty(current[s.id]) && theirs[s.id] !== current[s.id])
        || shownNow.some(s => unsure[s.id] && empty(current[s.id]) && !(saver.unsure && saver.unsure[s.id]));
      if (lost) {
        if (savedHere && (saver.sitKey !== sitKey || (mode !== "step" && mode !== "summary"))) announce("Another tab saved different answers over this page's saved copy. Your next change here can save yours again.");
        savedHere = false; savedHereWhy = !copyKept[saver.sitKey] ? "replaced" : saver.sitKey === sitKey ? "kept" : "otherForm";
      } else savedHere = true; // the other tab's copy holds everything this page has now
    }
  }
  if (mode === "pick") { renderPick(true); updatePrivacyNote(); return; } // keep the "Continue" card up to date
  updatePrivacyNote();
  if (e.newValue === null || !sitKey || (mode !== "step" && mode !== "summary")) return;
  // Another tab saved this same form. A different form has its own message above.
  let saver = null; try { saver = JSON.parse(e.newValue); } catch { /* unreadable */ }
  if (!saver || saver.sitKey !== sitKey) return;
  if (!otherTab) announce("This form is also open in another tab. Use one tab so your answers don't replace each other.");
  otherTab = true;
  // A tab can't tell when another one closes, so the message ends after a quiet while.
  clearTimeout(otherTabTimer);
  otherTabTimer = setTimeout(() => { otherTab = false; updatePrivacyNote(); }, OTHER_TAB_QUIET_MS);
  updatePrivacyNote();
});
lastSavingOn = savingOn();
// Cleared in the browser's own settings, nothing tells the page. Check again when the tab comes back to the front.
window.addEventListener("focus", updatePrivacyNote);
// Back after leaving can show this page from the browser's memory. With saving off, the answers shouldn't come back with it.
window.addEventListener("pageshow", e => {
  if (!e.persisted || savingOn() || (!sitKey && mode === "pick")) return;
  resetAnswers(); mode = "pick"; render();
  announce("Your answers were cleared because saving is off.");
});
// With nothing being saved, warn before the page is closed or refreshed.
window.addEventListener("beforeunload", e => {
  const formAtRisk = (!savingOn() || !saveOk || !savedHere || !savedIsMine()) && sitKey && holdsAnswers();
  const sortingAtRisk = mode === "triage" && triageAnswered(triage) && !(sitKey && hasAnswers()) && (!savingOn() || !saveOk || !sortingInCopy());
  // A browser doesn't tell a page what's in a half-typed date, so it can't be saved. All this page can do is warn.
  const halfDate = mode === "step" && document.getElementById("ans")?.validity?.badInput;
  if (formAtRisk || sortingAtRisk || halfDate) { e.preventDefault(); e.returnValue = ""; }
});
// Turning saving off deletes what's saved, so ask first.
function setSaving(on) {
  const saved = !on && readSaved();
  if (saved && !confirm(sitKey && hasAnswers()
    ? "Turn off saving? This deletes the answers saved on this device. Your answers stay on this page until you close it."
    : `Turn off saving? This deletes your saved answers for "${savedTitle(saved)}". This can't be undone.`)) return false;
  // This tab saves first. Another tab hears the setting right away and saves too, so it has to find this tab's copy
  // already there, or it could write over it without asking.
  const before = [saveOk, savedHere];
  if (on) { turningOn = true; saveProgress(); turningOn = false; }
  if (!store.set(PREF_KEY, on ? "on" : "off")) {
    if (on) {
      // The browser refused: the setting didn't change, so don't say it did.
      if (store.get(STORE_KEY) === lastWritten) clearSaved();
      [saveOk, savedHere] = before;
      updatePrivacyNote();
      announce("Saving couldn't be turned on, because this browser isn't letting the page save. Your answers stay on this page until you close it.");
      return false;
    }
    store.del(PREF_KEY); // off is the same as no setting
  }
  lastSavingOn = on;
  if (!on) clearSaved();
  updatePrivacyNote();
  // Say "saved" only when a copy really is on the device.
  const stored = saveOk && savedIsMine();
  announce(on ? (sitKey && hasAnswers() && stored ? "Saving is on. Your answers are saved on this device."
      : sitKey && hasAnswers() ? "Saving is on, but your answers couldn't be saved on this device."
      : "Saving is on. Your answers will be saved on this device.")
    : "Saving is off. Your answers aren't saved on this device.");
  return true;
}
window.appParts++;
