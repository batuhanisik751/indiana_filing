// Moved out of form-builder-mvp.html so the page's Content-Security-Policy can refuse every inline script (BT107).
// A kept text size and contrast apply before anything is drawn, so a slow connection doesn't show the usual look
// first. Kept only with saving on, and not from saved answers too old to use (30 days). The same keys and sizes as
// app/state.js, which checks them again once the page has loaded and undoes anything it can't use.
try {
  if (localStorage.getItem("icfh-save-pref") === "on") {
    const copy = JSON.parse(localStorage.getItem("icfh-progress-v1") || "null");
    const old = copy && Number.isFinite(copy.savedAt) && Date.now() - copy.savedAt > 30 * 864e5;
    const d = old ? null : JSON.parse(localStorage.getItem("icfh-display-v1") || "null"), sizes = [1, 1.15, 1.3, 1.5];
    if (d && Number.isInteger(d.size) && d.size > 0 && d.size < sizes.length) document.documentElement.style.setProperty("--text-scale", sizes[d.size]);
    if (d && d.contrast === true) document.documentElement.dataset.contrast = "high";
  }
} catch (e) { /* storage blocked or unreadable: the usual look */ }
