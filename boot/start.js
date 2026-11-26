// Moved out of form-builder-mvp.html so the page's Content-Security-Policy can refuse every inline script (BT107).
// Each file loads on its own, so on a bad connection one can fail or arrive cut off, and the app can't work without all of them.
// So each file's last line counts it in, and the app starts only if all of them got there.
window.appParts = 0;
window.appPartsNeeded = 22;
document.getElementById("app").innerHTML = '<p class="need">Loading the page…</p>';
// The check that all of them arrived: boot/check.js runs it right after them. If that file itself doesn't arrive, it
// runs once the page has loaded, so the page still says it didn't finish loading.
window.appCheck = () => {
  if (window.appChecked) return;
  window.appChecked = true;
  if (window.appParts !== window.appPartsNeeded || /^Loading/.test(document.getElementById("app").textContent || "")) {
    window.appFileFailed = true;
    document.getElementById("app").innerHTML = '<h1>This page didn\'t finish loading</h1><p class="help" role="alert">Part of it didn\'t come through. Anything you saved is still on this device. Check your connection, then reload the page. The free help listed below still works.</p>';
  }
};
window.addEventListener("load", () => window.appCheck());
