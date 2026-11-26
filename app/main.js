// Draws the current screen, handles the Back button and starts the app.
// A double-click's second click lands on whatever the first one just drew, so it's ignored. A mouse gives it a click
// count of 2. Safari on a touch screen gives every tap a count of 1, so there a second tap near the first, within half
// a second, with a new screen drawn in between, is ignored too (BT67).
// Only the click that comes from that tap itself: the last press was a touch, and its click hasn't come yet.
let drawnAt = -1e9, tapNow = null, tapBefore = null;
document.addEventListener("pointerdown", e => {
  if (e.pointerType !== "touch") { tapNow = tapBefore = null; return; }
  tapBefore = tapNow; tapNow = { x: e.clientX, y: e.clientY, at: performance.now() };
}, true);
const secondTap = () => {
  const t = tapNow, b = tapBefore;
  if (!t || t.clicked) return false;
  t.clicked = true;
  return !!(b && t.at - b.at < 500 && drawnAt > b.at && drawnAt < t.at && Math.hypot(t.x - b.x, t.y - b.y) < 40 && performance.now() - t.at < 1000);
};
app.addEventListener("click", e => {
  if ((e.detail >= 2 && performance.now() - drawnAt < 500) || (e.isTrusted && secondTap())) { e.preventDefault(); e.stopPropagation(); }
}, true);

function render() {
  drawnAt = performance.now();
  dropStaleCaseConfirm();
  draft = null; // a new screen: what was typed has been saved or left
  if (mode !== "summary") inlineEdit = null; // a box opened on the summary closes with it, as Cancel would
  // Get help sits above the screen. Left open, a phone's next question starts far below the fold.
  if (!helpPanel.hidden) { helpPanel.hidden = true; helpBtn.setAttribute("aria-expanded", "false"); }
  window.scrollTo(0, 0); // each screen starts at the top (the summary then scrolls to the row you edited)
  app.dataset.screen = mode; // lets the stylesheet lay out each screen its own way on wide screens
  ({ pick: renderPick, triage: renderTriage, notsure: renderNotSure, step: renderStep, summary: renderSummary })[mode]();
  justMarked = false; barGrew = 0;
  markNewTabLinks();
  saveProgress();
  updatePrivacyNote();
  syncHistory();
}

// The browser's or phone's Back button. One extra history entry while the person is past the first
// screen means Back steps back inside the app, the same as its own Back button, instead of leaving it.
const inGuard = () => !!history.state && history.state.icfh === 1;
let ignorePop = false; // this page itself stepped off the extra entry
function dropGuard() { ignorePop = true; history.back(); }
// After "Choose a different form", Back returns to the answers. From anywhere else, Back leaves from the first screen,
// so nobody is trapped going back and forth.
const backToAnswers = () => mode === "pick" && pickedOther && !!sitKey && hasAnswers();
function syncHistory() {
  // A side trip into the sorting questions or "Which one fits?" keeps it: the answers are still waiting.
  if (mode === "step" || mode === "summary") pickedOther = false;
  // From the first screen, Back leaves the app, unless it has something to close or return to first.
  if (mode === "pick" && helpPanel.hidden && !backToAnswers()) { if (inGuard() && !ignorePop) dropGuard(); return; }
  if (!inGuard()) { try { history.pushState({ icfh: 1 }, ""); } catch { /* not allowed here: Back leaves, with the usual warning */ } }
}
window.addEventListener("popstate", () => {
  if (ignorePop) { ignorePop = false; syncHistory(); return; }
  if (inGuard()) { if (mode === "pick" && helpPanel.hidden && !backToAnswers()) dropGuard(); return; } // Forward onto the extra entry
  const big = document.querySelector("dialog.pageview[open]");
  // Back closes a page shown large, and stays on this screen; and a box opened on the summary, as Cancel does. A change
  // not saved in either asks first; kept, Back is undone.
  if (big) { if (!big.beforeClose || big.beforeClose()) big.close(); syncHistory(); return; }
  if (mode === "summary" && inlineEdit) { if (okToDropInline()) closeInline(); syncHistory(); return; }
  if (!helpPanel.hidden) { setHelp(false); return; }
  if (backToAnswers()) { document.getElementById("backToWork").click(); return; }
  if (mode === "pick") return;
  const back = document.getElementById(mode === "summary" ? "toQuestions" : "back");
  if (back) back.click(); else syncHistory();
});
window.appParts++;
if (window.appParts === window.appPartsNeeded) render();
