// Draws the current screen, handles the Back button and starts the app.
// A double-click's second click lands on whatever the first one just drew, so it's ignored.
let drawnAt = -1e9;
app.addEventListener("click", e => {
  if (e.detail >= 2 && performance.now() - drawnAt < 500) { e.preventDefault(); e.stopPropagation(); }
}, true);

function render() {
  drawnAt = performance.now();
  draft = null; // a new screen: what was typed has been saved or left
  // Get help sits above the screen. Left open, a phone's next question starts far below the fold.
  if (!helpPanel.hidden) { helpPanel.hidden = true; helpBtn.setAttribute("aria-expanded", "false"); }
  window.scrollTo(0, 0); // each screen starts at the top (the summary then scrolls to the row you edited)
  ({ pick: renderPick, triage: renderTriage, notsure: renderNotSure, step: renderStep, summary: renderSummary })[mode]();
  justMarked = false;
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
  if (mode !== "pick") pickedOther = false;
  if (mode === "pick") { if (inGuard() && !ignorePop && !backToAnswers()) dropGuard(); return; } // from here, Back leaves the app
  if (!inGuard()) { try { history.pushState({ icfh: 1 }, ""); } catch { /* not allowed here: Back leaves, with the usual warning */ } }
}
window.addEventListener("popstate", () => {
  if (ignorePop) { ignorePop = false; syncHistory(); return; }
  if (inGuard()) { if (mode === "pick" && !backToAnswers()) dropGuard(); return; } // Forward onto the extra entry
  if (backToAnswers()) { document.getElementById("backToWork").click(); return; }
  if (mode === "pick") return;
  if (!helpPanel.hidden) { setHelp(false); syncHistory(); return; }
  const back = document.getElementById(mode === "summary" ? "toQuestions" : "back");
  if (back) back.click(); else syncHistory();
});
render();
