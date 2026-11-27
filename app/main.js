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

// Right after a change is saved back to the summary, focus is on its Edit, so a second Enter (or Enter held down)
// would open it again, and in a box, add blank lines. Enter is ignored for a moment then, and while it's still held
// (BT104).
let enterQuietUntil = 0, enterHeldOver = false;
const quietEnter = () => { enterQuietUntil = performance.now() + 500; enterHeldOver = true; };
document.addEventListener("keydown", e => {
  // Only on what it would open (a button or link), not while typing in a box opened since.
  if (e.key !== "Enter" || (e.target.matches && e.target.matches("input, textarea, select"))) return;
  if (performance.now() < enterQuietUntil || (enterHeldOver && e.repeat)) { e.preventDefault(); e.stopPropagation(); }
}, true);
document.addEventListener("keyup", e => { if (e.key === "Enter") enterHeldOver = false; }, true);
// On a phone, the keyboard can cover the box being typed in: Edit on the summary opens one where it was tapped, often
// low on the screen, and nothing moved it (seen in the iPhone simulator, BT110). When the visible part of the page
// gets shorter, a box now under the keyboard is brought just above it, with its Save and Cancel when they fit.
function keepTypingInView() {
  const vv = window.visualViewport, el = document.activeElement;
  if (!vv || !el || !el.matches || !el.matches("input:not([type=radio]):not([type=checkbox]), textarea")) return;
  const top = vv.offsetTop, bottom = vv.offsetTop + vv.height, pad = 12;
  const field = el.getBoundingClientRect(), whole = (el.closest(".inedit") || el).getBoundingClientRect();
  if (field.bottom <= bottom - pad && field.top >= top) return; // in view: nothing moves
  // Enough to show the whole box with its buttons, but never so much that the field itself goes off the top.
  const by = Math.min(whole.bottom - (bottom - pad), field.top - (top + pad));
  if (by > 0) window.scrollBy(0, by);
}
if (window.visualViewport) visualViewport.addEventListener("resize", keepTypingInView);
// A mouse button or finger is down: a redraw now would replace what it's pressing, so a redraw that can wait does (BT104).
let pointerHeld = false;
document.addEventListener("pointerdown", () => { pointerHeld = true; }, true);
for (const t of ["pointerup", "pointercancel"]) document.addEventListener(t, () => setTimeout(() => { pointerHeld = false; }), true);
const whenPointerFree = f => { if (!pointerHeld) return f(); document.addEventListener("pointerup", () => setTimeout(f), { once: true, capture: true }); };

// A double click on Get help, Aa or "My situation is different" opened it and closed it again: the second click is
// ignored (BT105).
document.addEventListener("click", e => {
  if (e.detail >= 2 && e.target.closest && e.target.closest("#helpBtn, #readBtn, #moreToggle")) { e.preventDefault(); e.stopImmediatePropagation(); }
}, true);
// The tab's title says where the person is, as the page does (BT105). Only the question, never an answer.
function screenTitle() {
  const sit = sitKey && SITUATIONS[sitKey];
  const where = mode === "step" && sit ? `Question ${cur + 1} of ${visible().length}: ${visible()[cur]?.label || ""}`
    : mode === "summary" && sit ? `Your ${sit.title} forms` : mode === "triage" ? "Which papers do you have?" : mode === "notsure" ? "Which one fits?" : "";
  document.title = where ? `${where} · Indiana Court Form Helper` : "Indiana Court Form Helper";
}

function render() {
  drawnAt = performance.now();
  dropStaleCaseConfirm();
  draft = null; // a new screen: what was typed has been saved or left
  if (mode !== "pick") gonePageNote = ""; // said on the first screen; gone once the person moves on
  if (mode !== "summary") inlineEdit = null; // a box opened on the summary closes with it, as Cancel would
  // Get help sits above the screen. Left open, a phone's next question starts far below the fold.
  if (!helpPanel.hidden) { helpPanel.hidden = true; helpBtn.setAttribute("aria-expanded", "false"); }
  window.scrollTo(0, 0); // each screen starts at the top (the summary then scrolls to the row you edited)
  app.dataset.screen = mode; // lets the stylesheet lay out each screen its own way on wide screens
  ({ pick: renderPick, triage: renderTriage, notsure: renderNotSure, step: renderStep, summary: renderSummary })[mode]();
  justMarked = false; barGrew = 0;
  markNewTabLinks();
  screenTitle();
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
