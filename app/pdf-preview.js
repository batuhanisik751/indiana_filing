// The preview and the download buttons on the summary.
/* ---------- preview and download ---------- */
let pdfState = { key: null, result: null, error: false, busy: false };
const PDF_SLOW_MS = 15000;
let pdfSlow = false, pdfSlowTimer = null; // a stalled download takes two minutes to give up, so say something sooner
const pdfKey = () => JSON.stringify([sitKey, visibleAnswers(), Object.keys(unsure).filter(k => unsure[k]).sort()]);

function ensurePdf() {
  const key = pdfKey();
  if (pdfState.key === key) return;
  pdfState = { key, result: null, error: false, busy: true };
  pdfSlow = false; clearTimeout(pdfSlowTimer);
  pdfSlowTimer = setTimeout(() => {
    if (pdfState.key !== key || !pdfState.busy) return;
    pdfSlow = true;
    if (mode === "summary") { keepFocus(() => renderSummary(true)); announce(`This is taking longer than usual.${pendingLoads.size ? " You can keep waiting, or stop and try again." : ""}`); }
  }, PDF_SLOW_MS);
  (async () => {
    let result = null, error = false;
    // The form and answers as they are now: the person may start over or pick another form while the tools load.
    const sit = sitKey, ans = visibleAnswers();
    try { await loadPdfTools(OFFICIAL[SITUATIONS[sit].official.packet].file); } catch (e) { error = "load"; console.error(e); }
    if (!error) try { result = await buildPdf(sit, ans); } catch (e) { error = e.damagedForm ? "form" : "build"; console.error(e); }
    if (pdfState.key !== key) return; // answers changed while we worked
    pdfState = { key, result, error, busy: false };
    window.dispatchEvent(new Event("pdfready")); // a page of the form shown large, waiting for a change to show
    if (mode === "summary") {
      keepFocus(() => renderSummary(true));
      if (pendingFocus && document.activeElement && document.activeElement.matches(`.status, ul.flags [data-fix="${pendingFocus.id}"]`)) {
        const t = app.querySelectorAll(`ul.flags [data-fix="${pendingFocus.id}"]`)[pendingFocus.nth] || app.querySelector(`ul.flags [data-fix="${pendingFocus.id}"]`);
        if (t) { t.focus(); t.scrollIntoView({ block: "center" }); }
      }
      pendingFocus = null;
      const n = app.querySelectorAll("ul.flags li").length, sc = completeness();
      announce(error ? "We couldn't make the PDF." : `Your filled form is ready to download. ${sc.filled} of ${sc.total} needed answers filled in. ${n ? `${n} item${n > 1 ? "s" : ""} to review before filing.` : "Nothing to review."}`);
    }
  })();
}

// Re-drawing the summary replaces its buttons; put focus back on the same one.
// The page also keeps its place: the focused element (or the edited row) stays
// where it was on screen, even though the PDF section above it has grown.
function keepFocus(redraw) {
  const el = document.activeElement;
  let find = null;
  if (el && el !== document.body && app.contains(el)) {
    const attr = el.id ? "id" : ["data-fix", "data-dl", "data-ics", "href"].find(n => el.hasAttribute(n));
    if (attr) {
      const box = attr === "data-fix" ? (el.closest("ul.flags") ? "ul.flags " : "dl.vals ") : "";
      const sel = attr === "id" ? `#${CSS.escape(el.id)}` : `${box}${attr === "href" ? "a" : ""}[${attr}="${CSS.escape(el.getAttribute(attr))}"]`;
      const i = [...app.querySelectorAll(sel)].indexOf(el);
      find = () => app.querySelectorAll(sel)[i];
    } else if (el.matches("details[data-more] > summary")) {
      const key = el.parentElement.dataset.more;
      find = () => app.querySelector(`details[data-more="${CSS.escape(key)}"] > summary`);
    } else if (el.matches("h1, .status")) find = () => app.querySelector(el.matches("h1") ? "h1" : ".status");
  }
  const anchor = el && el !== document.body && app.contains(el) ? el : null;
  const top = anchor ? anchor.getBoundingClientRect().top : null, y = window.scrollY;
  const wasPdfNote = el && el.id === "pdfStatus";
  // An answer being typed in a box on the summary keeps its cursor.
  const sel = el && el.id === "inEdit" && typeof el.selectionStart === "number" ? [el.selectionStart, el.selectionEnd, el.scrollTop] : null;
  redraw();
  let target = find && find();
  // A6: after "Try again", the status note is replaced by the downloads (or the error).
  if (!target && wasPdfNote) target = document.getElementById("dlAll") || document.getElementById("retryPdf");
  if (target) {
    target.focus({ preventScroll: true });
    if (sel && typeof target.setSelectionRange === "function") { try { target.setSelectionRange(sel[0], sel[1]); } catch { /* not a text box */ } target.scrollTop = sel[2]; }
    if (top !== null) window.scrollBy(0, target.getBoundingClientRect().top - top); else target.scrollIntoView({ block: "center" });
  } else window.scrollTo(0, y);
}

// Problems found while putting answers on the PDF (text too long, characters the font can't print).
function pdfFlags() {
  if (!pdfState.result || pdfState.key !== pdfKey()) return [];
  const overflow = new Map(), chars = new Map(), continued = new Map(), small = new Map();
  for (const n of pdfState.result.notes) {
    const k = `${n.step}|${n.label}`;
    if (n.kind === "overflow") overflow.set(k, n);
    // One answer can print in several places (a name in the caption and in item 1), but it's one thing to fix.
    else if (n.kind === "chars") { if (!chars.has(n.step)) chars.set(n.step, { ...n, list: new Map() }); chars.get(n.step).list.set(n.ch, n.out); }
    else if (n.kind === "continued") continued.set(k, n);
    else if (n.kind === "small") { if (!small.has(k) || small.get(k).size > n.size) small.set(k, n); }
  }
  return [
    ...[...overflow.values()].map(n => ({ level: "check", title: n.label, why: "This is too long for the space on the official form, so part of it may be cut off. Check it in the preview below.", fix: n.step })),
    ...[...small.values()].filter(n => !overflow.has(`${n.step}|${n.label}`)).map(n => ({ level: "check", title: n.label,
      why: `This is printed in small ${n.size}-point text so it fits the box on the official form. Check in the preview below that it's readable.`, fix: n.step })),
    ...[...continued.values()].map(n => ({ level: "check", title: n.label, why: `This is longer than the lines on the form, so it continues on a page added at the end of the ${n.doc}, marked "continued on attached page." Check it in the preview below.`, fix: n.step })),
    ...[...chars.values()].map(n => {
      const list = [...n.list].map(([c, o]) => `"${c}" (printed as "${o}")`).join(", ");
      return { level: "check", title: steps.find(s => s.id === n.step)?.label || n.label, why: `The form's font can't print some characters exactly: ${list}. Check that this is how you want it to appear.`, fix: n.step };
    }),
  ];
}

// A page shown large, over the summary or question: "Enlarge" under a page opens it. Close, Escape or Back closes it.
// render(n, cssWidth) draws page n and resolves to { canvas, marks }, marks being highlight markup placed in percent.
function showPageLarge({ count = 1, at = 1, titleFor, render, opener, refocus, shown }) {
  document.querySelector("dialog.pageview")?.remove();
  const dlg = document.createElement("dialog");
  dlg.className = "pageview";
  dlg.setAttribute("aria-labelledby", "pvTitle");
  dlg.innerHTML = `<div class="pvbar"><h2 class="sub" id="pvTitle"></h2><span class="pvnav">${count > 1 ? `<button class="ghost small" id="pvPrev">Previous page</button><button class="ghost small" id="pvNext">Next page</button>` : ""}<button class="primary small" id="pvClose">Close</button></span></div><div class="pvbody"></div>`;
  document.body.appendChild(dlg);
  const body = dlg.querySelector(".pvbody"), prev = dlg.querySelector("#pvPrev"), next = dlg.querySelector("#pvNext");
  let token = 0;
  const show = async n => {
    at = n; const mine = ++token;
    dlg.querySelector("#pvTitle").textContent = titleFor(n);
    if (prev) { prev.disabled = n <= 1; next.disabled = n >= count; }
    body.innerHTML = `<p class="draftnote" role="status">Loading the page…</p>`;
    try {
      const { canvas, marks = "" } = await render(n, Math.min(body.clientWidth - 2 || window.innerWidth, 1100));
      if (mine !== token || !dlg.isConnected) return;
      canvas.setAttribute("role", "img");
      canvas.setAttribute("aria-label", titleFor(n));
      const page = document.createElement("div");
      page.className = "pvpage"; page.innerHTML = marks; page.prepend(canvas);
      body.replaceChildren(page); body.scrollTop = 0;
      if (shown) shown(n, page, body);
    } catch (e) {
      console.error(e);
      if (mine === token && dlg.isConnected) body.innerHTML = `<p class="draftnote" role="alert">This page couldn't be shown large. The page and the download on the screen behind still work.</p>`;
    }
  };
  // The button pressed can become disabled at the first or last page, and focus shouldn't fall to the top of the page.
  // show() sets that before it starts drawing, so focus moves at once.
  const step = (to, from, other) => () => { show(to()); if (from.disabled) other.focus(); };
  if (prev) { prev.onclick = step(() => at - 1, prev, next); next.onclick = step(() => at + 1, next, prev); }
  dlg.querySelector("#pvClose").onclick = () => dlg.close();
  dlg.addEventListener("close", () => {
    dlg.remove();
    const back = opener && opener.isConnected ? opener : refocus && refocus(at);
    if (back) back.focus();
  });
  dlg.showModal();
  dlg.querySelector("#pvClose").focus();
  show(at);
  return dlg;
}
// One page of a PDF, drawn sharp at this width. A phone gets extra detail, so pinching in stays readable.
async function drawPdfPage(pdf, n, cssWidth) {
  const page = await pdf.getPage(n), base = page.getViewport({ scale: 1 });
  const zoom = Math.min(2, Math.max(1, 900 / cssWidth));
  const viewport = page.getViewport({ scale: (cssWidth / base.width) * (window.devicePixelRatio || 1) * zoom });
  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(viewport.width); canvas.height = Math.floor(viewport.height);
  await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
  return canvas;
}
// A page of the filled form shown large. Item 17: each answer on it can be tapped (or reached with Tab) to change it in
// a small box over the page, checked the same way as on its question. The page is then made again with the change.
function showFilledPage(pdf, n, opener, focusId = null) {
  const result = pdfState.result;
  let waiting = false;
  const reopen = () => {
    window.removeEventListener("pdfready", reopen);
    if (!dlg.isConnected || !waiting) return;
    const at = dlg.pvAt || n;
    if (!pdfState.result || pdfState.error) {
      dlg.querySelector(".pvbody").innerHTML = `<p class="draftnote" role="alert">Your change is saved, but the form couldn't be made again. Close this page to see why.</p>`;
      return;
    }
    pdfjsLib.getDocument({ data: pdfState.result.all.slice() }).promise.then(doc => { showFilledPage(doc, Math.min(at, doc.numPages), null, waiting); announce("Saved. The page shows your change."); })
      .catch(e => { console.error(e); dlg.querySelector(".pvbody").innerHTML = `<p class="draftnote" role="alert">Your change is saved, but this page couldn't be shown again. Close it to see your form.</p>`; });
  };
  const dlg = showPageLarge({
    count: pdf.numPages, at: n, opener,
    titleFor: i => `Page ${i} of ${pdf.numPages} of your filled form`,
    render: async (i, w) => {
      const canvas = await drawPdfPage(pdf, i, w), view = (await pdf.getPage(i)).getViewport({ scale: 1 });
      return { canvas, marks: pageSpots(result, i).map((s, k) => spotHtml(s, k, view)).join("") };
    },
    refocus: i => app.querySelector(`#preview [data-page="${i}"]`) || app.querySelector('details[data-more="preview"] > summary') || app.querySelector("h1"),
    shown: (i, page, body) => {
      dlg.pvAt = i;
      const list = pageSpots(result, i), attached = result?.allPages?.[i - 1]?.attached;
      body.insertAdjacentHTML("afterbegin", `<p class="draftnote pvhint">${list.length ? "To change an answer, tap it on the page." : attached ? "This page continues answers from the form. Change them where they start, on the form's own page." : "Nothing on this page can be changed here."}</p>`);
      page.querySelectorAll(".pvspot").forEach(b => b.onclick = () => openPdfEdit(dlg, page, list[+b.dataset.spot], b, () => { waiting = list[+b.dataset.spot].id; window.addEventListener("pdfready", reopen); }));
      if (focusId) { const s = page.querySelector(`.pvspot[data-id="${CSS.escape(focusId)}"]`); if (s) s.focus(); focusId = null; }
    },
  });
  // Closing the page, or Back, closes a box on it as Cancel would.
  dlg.addEventListener("close", () => { window.removeEventListener("pdfready", reopen); if (inlineEdit && inlineEdit.where === "pdf") dropInline(); });
  dlg.addEventListener("cancel", e => { if (dlg.querySelector("#pvEdit")) { e.preventDefault(); closePdfEdit(dlg); } });
  return dlg;
}
// The answers on page i of the filled form that can be changed, top to bottom: { id, label, rect }.
function pageSpots(result, i) {
  const at = result?.allPages?.[i - 1];
  if (!at || at.src === undefined) return [];
  const list = [];
  for (const s of result.spots || []) {
    const id = s.page === at.src && editTarget(s.step);
    if (id && !list.some(x => x.id === id && x.rect.every((v, j) => Math.abs(v - s.rect[j]) < .5))) list.push({ id, label: s.label, rect: s.rect });
  }
  return list.sort((x, y) => (Math.max(y.rect[1], y.rect[3]) - Math.max(x.rect[1], x.rect[3])) || (x.rect[0] - y.rect[0]));
}
function spotHtml(s, k, view) {
  const [x1, y1, x2, y2] = view.convertToViewportRectangle(s.rect), pct = (v, of) => `${(v / of * 100).toFixed(2)}%`;
  const left = Math.min(x1, x2), top = Math.min(y1, y2), width = Math.max(Math.abs(x2 - x1), 8), height = Math.max(Math.abs(y2 - y1), 8);
  return `<button type="button" class="pvspot" data-spot="${k}" data-id="${esc(s.id)}" style="left:${pct(left, view.width)};top:${pct(top, view.height)};width:${pct(width, view.width)};height:${pct(height, view.height)}" aria-label="Change: ${esc(s.label)}"></button>`;
}
// The box over the page, under the answer tapped (or above it, near the bottom of the page).
function openPdfEdit(dlg, page, spot, button, onSaved) {
  if (inlineEdit && inlineEdit.where === "pdf" && inlineChanged() && !confirm(`Discard your change to "${steps.find(s => s.id === inlineEdit.id)?.label}"?`)) { dlg.querySelector("#inEdit")?.focus(); return; }
  if (inlineEdit && inlineEdit.where !== "pdf") {
    if (inlineChanged() && !confirm(`Discard your change to "${steps.find(s => s.id === inlineEdit.id)?.label}"?`)) return;
    dropInline(); renderSummary(true); // the box open on the summary behind closes
  }
  if (inlineEdit) dropInline(); // the box open on this page closes, as Cancel would
  dlg.querySelector("#pvEdit")?.remove();
  page.querySelectorAll(".pvspot.on").forEach(b => b.classList.remove("on"));
  const step = steps.find(s => s.id === spot.id), typed = editsInPlace(spot.id);
  inlineEdit = { id: spot.id, nth: -1, where: "pdf", value: String(answers[spot.id] ?? ""), erased: false, err: "", onSaved };
  button.classList.add("on");
  page.insertAdjacentHTML("beforeend", `<div class="pvedit" id="pvEdit" role="group" aria-labelledby="pvEditTitle">
      <p class="pvedit-title" id="pvEditTitle">${esc(spot.label)}</p>
      ${typed ? inlineBoxHtml(step, spot.label) : `<p class="need">This is a choice, so it's changed on its question.</p>
      <div class="ienav"><button class="primary small" id="ieFull">Open the question</button><button class="ghost small" id="ieCancel">Cancel</button></div>`}
    </div>`);
  const box = page.querySelector("#pvEdit"), W = page.clientWidth, H = page.clientHeight;
  const r = button.getBoundingClientRect(), p = page.getBoundingClientRect(), bw = box.offsetWidth, bh = box.offsetHeight;
  const below = r.bottom - p.top + 6, above = r.top - p.top - bh - 6;
  box.style.left = `${Math.max(0, Math.min(r.left - p.left, W - bw))}px`;
  box.style.top = `${below + bh <= H || above < 0 ? below : above}px`;
  wireInline(box);
  box.scrollIntoView({ block: "nearest" });
  (box.querySelector("#inEdit") || box.querySelector("#ieFull")).focus({ preventScroll: true });
  const t = box.querySelector("#inEdit");
  if (t && t.type !== "date") { const len = t.value.length; t.setSelectionRange(len, len); }
}
function closePdfEdit(dlg) {
  const box = dlg.querySelector("#pvEdit"), id = inlineEdit && inlineEdit.id;
  if (box) box.remove();
  dropInline(); // an emptied answer comes back to the device
  const spot = dlg.querySelector(`.pvspot.on`) || (id && dlg.querySelector(`.pvspot[data-id="${CSS.escape(id)}"]`));
  dlg.querySelectorAll(".pvspot.on").forEach(b => b.classList.remove("on"));
  spot?.focus();
}

async function renderPreview(bytes, el) {
  const pdf = await pdfjsLib.getDocument({ data: bytes.slice() }).promise;
  for (let i = 1; i <= pdf.numPages; i++) {
    if (!el.isConnected) return; // the user moved on
    const page = await pdf.getPage(i);
    const width = Math.max(240, Math.min(el.clientWidth || 560, 820));
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: (width / base.width) * (window.devicePixelRatio || 1) });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width); canvas.height = Math.floor(viewport.height);
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", `Page ${i} of ${pdf.numPages} of your filled form`);
    const fig = document.createElement("figure");
    fig.innerHTML = `<figcaption>Page ${i} of ${pdf.numPages} <button class="link" data-page="${i}" aria-label="Enlarge page ${i} of ${pdf.numPages}">Enlarge</button></figcaption>`;
    fig.prepend(canvas);
    const big = fig.querySelector("button");
    big.onclick = () => showFilledPage(pdf, i, big);
    canvas.addEventListener("click", () => big.click()); // the page itself opens large too; the button is there for keyboards
    // Browsers without scroll anchoring would push what's on screen down as each page appears.
    const above = getComputedStyle(el).overflowAnchor !== "auto" && el.getBoundingClientRect().bottom <= 0, before = el.offsetHeight;
    el.appendChild(fig);
    if (above) window.scrollBy(0, el.offsetHeight - before);
    await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
  }
}

// Plain letters, numbers and dashes only, and well under the E-Filing User Guide's 100-character limit.
const fileStem = s => String(s).replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
// Only a real case number goes in a file name. Whatever else was typed in that box might be private.
const pdfFileCase = () => caseMatch(answers.caseNumber) && visible().some(s => s.id === "caseNumber") ? `-${fileStem(answers.caseNumber).slice(0, 30)}` : "";
function downloadPdf(bytes, name) {
  const caseNo = pdfFileCase();
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url; link.download = `${fileStem(name).slice(0, 95 - caseNo.length)}${caseNo}.pdf`;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  announce("Your PDF is downloading. What to do next is just below the download buttons.");
}

function pdfSectionHtml(sit) {
  if (pdfState.busy || !pdfState.key) return `<p class="note" id="pdfStatus" tabindex="-1">${pdfSlow ? `Filling in the official form is taking longer than usual, so the connection may be slow.${pendingLoads.size ? ` You can keep waiting, or <button class="link" id="stopPdf">stop and try again</button>.` : ""}` : "Filling in the official form…"}</p>`;
  if (pdfState.error) return `<div class="note" role="alert">${pdfState.error === "form" ? "The official form didn't come through properly, so we couldn't fill it in. Check your connection, then try again." : pdfState.error === "build" ? "We couldn't make the PDF from these answers. Check any very long answers, then try again." : "We couldn't make the PDF. The PDF tools and the official form are downloaded the first time you get here, so check your internet connection."} <button class="link" id="retryPdf">Try again</button></div>`;
  const { each } = pdfState.result;
  return `
    <div class="downloads">
      <button class="primary" id="dlAll">Download ${each.length ? "all forms" : "the form"} (PDF)</button>
      ${each.map(d => `<button class="ghost" data-dl="${esc(d.key)}">Download the ${esc(d.name)} only${d.number ? ` (${esc(d.number)})` : ""}</button>`).join("")}
    </div>
    ${each.length ? `<p class="draftnote">To print, use "Download all forms." To e-file, download each form separately: Indiana's E-Filing User Guide says appearance documents go under the Appearance filing code, other documents under a separate filing code${sit.official.docs.includes("order") ? ', and a proposed order under the "Proposed Order" filing code' : ""}.</p>` : ""}
    <p class="draftnote">On a shared or public computer? When you're done, delete the downloaded PDF from the computer and choose "Clear my data" at the top of this page.</p>`;
}
// The pages themselves come after the next steps, so those aren't thousands of pixels below the download.
// They start closed, and are drawn only when opened: drawing them downloads the PDF viewer.
const previewHtml = () => (pdfState.result && !pdfState.busy && !pdfState.error
  ? `<h2 class="sub">Read your filled form</h2>${moreHtml('<div class="preview" id="preview"></div>', "Show the pages", "preview", { cls: "section" })}` : "");

function wirePdfSection(sit) {
  const stop = document.getElementById("stopPdf");
  if (stop) stop.onclick = () => { [...pendingLoads].forEach(give => give()); setTimeout(() => document.getElementById("retryPdf")?.focus()); };
  const retry = document.getElementById("retryPdf");
  if (retry) retry.onclick = () => { if (pdfState.error === "build" || pdfState.error === "form") formDataTry++; pdfState = { key: null }; ensurePdf(); renderSummary(true); document.getElementById("pdfStatus")?.focus(); };
  if (!pdfState.result) return;
  const { all, each } = pdfState.result;
  const docs = sit.official.docs.map(k => OFFICIAL[sit.official.packet].docs[k]);
  // One form: name the file after it and its number. Several: the situation's name.
  document.getElementById("dlAll").onclick = () => downloadPdf(all, docs.length === 1 ? `${docs[0].name} ${docs[0].number}` : `${sit.title} forms`);
  app.querySelectorAll("[data-dl]").forEach(b => b.onclick = () => {
    const d = each.find(x => x.key === b.dataset.dl);
    // Fee waiver and continuance both have an "Appearance"; keep their file names apart.
    downloadPdf(d.bytes, `${sitKey === "respond" ? "" : `${sit.title} `}${d.name} ${d.number || ""}`);
  });
  // E15: draw into this summary's preview box only, and only once, when its section is open.
  const box = document.getElementById("preview"), section = box.closest("details");
  const draw = () => {
    if (box.dataset.token) return;
    const token = box.dataset.token = String(Math.random());
    loadPreviewTools().then(() => {
      if (!box.isConnected || box.dataset.token !== token) return;
      return renderPreview(all, box);
    }).catch(e => {
      console.error(e);
      if (box.isConnected) box.innerHTML = `<p class="draftnote">The preview couldn't be shown, but the downloads above still work.</p>`;
    });
  };
  if (!section || section.open) draw();
  else section.addEventListener("toggle", () => { if (section.open) draw(); });
}
window.appParts++;
