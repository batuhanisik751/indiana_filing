// "Show it on the form": where each answer prints, and the picture of the form.
/* ---------- where each answer goes ---------- */
let whereOpen = false;  // the preview under each question; it stays open from one question to the next, on one form
let whereForm = null;   // the form it was opened on
let whereToken = 0;     // only the newest drawing may finish
const whereDocs = {}, whereNotes = {}, whereCanvases = {};
const shortForm = form => ({ [FORM.caption]: "Top of each form", [FORM.appearance]: "Appearance", [FORM.fwAppearance]: "Appearance", [FORM.fwOrder]: "Order", [FORM.contOrder]: "Order", [FORM.sign]: "Signature lines" }[form] || form);
const sampleAnswer = s => (s.type === "date" ? "2031-01-15" : s.type === "money" || s.type === "number" ? "1" : "x");
// The rows of the official forms this question's answer fills. It may not be answered yet, so they're worked out as
// if it were, and as if the other boxes were too: a signature needs a name before it has a place to print.
function whereRows(step, guessRole = true) {
  const filled = Object.fromEntries(steps.filter(s => s.type !== "choice" && s.type !== "select").map(s => [s.id, sampleAnswer(s)]));
  Object.entries(visibleAnswers()).forEach(([k, v]) => { if (!empty(v)) filled[k] = v; });
  const chosen = draft && draft.id === step.id ? draft.value : answers[step.id], given = !empty(chosen); // the choice on screen counts before it's saved
  // A choice not made yet could print any of its options. One that's made prints only that one.
  // (A real case number, because that's what fills in the case type letters too.)
  const tries = given ? [chosen] : step.type === "choice" ? step.options.map(o => o[0]) : step.type === "select" ? [step.options[0]] : [step.id === "caseNumber" ? "49D01-2610-CC-000000" : sampleAnswer(step)];
  // A blank box isn't a place this answer prints, and neither is a box that stays unticked because of it.
  const prints = o => (!("value" in o) || !empty(o.value)) && !(o.t === "check" && !o.on && (step.type !== "choice" || given)) && !(o.t === "drop" && /^_+$/.test(o.option));
  const rows = new Map();
  // Who started the case decides which box an answer prints in. Marked "I'm not sure", it could be either.
  const roles = guessRole && step.id !== "role" && steps.some(s => s.id === "role") && empty(filled.role) ? [{ role: "other" }, { role: "me" }] : [{}];
  for (const role of roles) for (const value of tries) for (const r of SITUATIONS[sitKey].fields({ ...filled, ...role, [step.id]: value })) {
    // Worked out from this answer: a total counts as a place for each answer that goes into it, after the answer's own line.
    const worked = !!r.from && r.from.includes(step.id);
    // When e-filing, the name also prints as "/s/ name" on the signature lines.
    if (!worked && (r.from || r.step !== step.id) && !(step.id === "name" && r.form === FORM.sign)) continue;
    const pdf = r.pdf.filter(prints);
    // A row with no place of its own, like "1. My name is", shares a box with another row. A choice doesn't print that way.
    if (!pdf.length && (r.pdf.length || step.type === "choice" || r.form === FORM.sign)) continue;
    const key = `${r.form}|${r.label}`;
    if (rows.has(key)) rows.get(key).pdf.push(...pdf); else rows.set(key, { form: r.form, label: r.label, pdf, worked });
  }
  // The continuance's Order repeats the names in its distribution list, from the same PDF fields as the top of the form.
  if (sitKey === "continuance" && [...rows.values()].some(r => r.pdf.some(o => o.name === "Petitioner" || o.name === "Respondent"))) rows.set("order names", { form: FORM.contOrder, label: "Distribution: names", pdf: [], worked: false });
  const all = [...rows.values()].sort((x, y) => x.worked - y.worked);
  return all.some(r => r.pdf.length) ? all : []; // a row with no place on the page, like "Anyone else to send a copy to"
}
function whereHtml(step) {
  if (whereForm !== sitKey) whereOpen = false; // another form's preview is another download, so it waits to be asked for
  const { official } = SITUATIONS[sitKey], rows = whereRows(step), MAX = 3, place = r => `${shortForm(r.form)}: ${r.label}`;
  // Nothing here prints until that's answered, and then only one of these does.
  const roleOpen = rows.length && step.id !== "role" && steps.some(s => s.id === "role") && empty(answers.role) && !whereRows(step, false).length;
  const text = rows.length
    ? `${roleOpen ? "Once you answer who started the case, this prints on:" : "Prints on:"} ${rows.slice(0, MAX).map(place).join(" · ")}${rows.length > MAX ? `, and ${rows.length - MAX} more` : ""}.`
    : "This answer doesn't print on the form itself. It decides what the form asks next, where other answers print, or what your next steps say.";
  return `<div class="where">
      <p class="need" id="whereText">${esc(text)}</p>
      ${rows.length > MAX ? `<details class="wheremore"><summary>Show the other ${rows.length - MAX}</summary><p class="need">${esc(rows.slice(MAX).map(place).join(" · "))}</p></details>` : ""}
      <p class="need wherenav">
        ${rows.length ? `<button class="link" id="whereToggle" aria-expanded="${whereOpen}" aria-controls="wherePreview">${whereOpen ? "Hide the form" : "Show it on the form"}</button>` : ""}
        <a id="whereBlank" href="${OFFICIAL[official.packet].source}" target="_blank" rel="noopener">Blank official form (PDF)</a>
        <a href="${official.page}" target="_blank" rel="noopener">On Indiana Legal Help</a>
      </p>
      ${official.pageNote ? `<p class="draftnote">${esc(official.pageNote)}</p>` : ""}
      ${rows.length ? `<p class="draftnote" id="whereSize"${whereOpen ? " hidden" : ""}>Showing it downloads up to 3 MB the first time.</p><div id="wherePreview"${whereOpen ? "" : " hidden"}></div>` : ""}
    </div>`;
}
function wireWhere(step) {
  const toggle = document.getElementById("whereToggle");
  if (!toggle) return;
  toggle.onclick = () => {
    whereOpen = !whereOpen; whereForm = sitKey; whereToken++;
    toggle.setAttribute("aria-expanded", String(whereOpen));
    toggle.textContent = whereOpen ? "Hide the form" : "Show it on the form";
    document.getElementById("wherePreview").hidden = !whereOpen;
    document.getElementById("whereSize").hidden = whereOpen;
    if (whereOpen) drawWhere(step, 0, true);
  };
  if (whereOpen) drawWhere(step);
}
// Remembered unless it fails, so Try again really tries again.
const remember = (cache, key, make) => (cache[key] ||= make().catch(e => { delete cache[key]; throw e; }));
const whereDoc = file => remember(whereDocs, file, () => pdfjsLib.getDocument({ data: b64ToBytes(window.OFFICIAL_PDFS[file]) }).promise);
const whereFields = (doc, file, page) => remember(whereNotes, `${file}:${page}`, () => doc.getPage(page + 1).then(p => p.getAnnotations()));
// Where on the packet's pages this answer prints: [{ page, rects: [[x1, y1, x2, y2], ...] }], in PDF points.
async function whereSpots(step, doc) {
  const { official } = SITUATIONS[sitKey], off = OFFICIAL[official.packet];
  const pages = official.docs.flatMap(k => off.docs[k].pages);
  const ops = whereRows(step).flatMap(r => r.pdf);
  const spots = new Map(); // in the order of the rows, so the answer's own line comes first
  // Two ops can fill the same place, and marking it twice would darken the highlight.
  const within = (a, b) => Math.min(a[0], a[2]) >= Math.min(b[0], b[2]) - .5 && Math.min(a[1], a[3]) >= Math.min(b[1], b[3]) - .5 && Math.max(a[0], a[2]) <= Math.max(b[0], b[2]) + .5 && Math.max(a[1], a[3]) <= Math.max(b[1], b[3]) + .5;
  const add = (page, rect) => {
    if (!pages.includes(page)) return;
    const list = spots.get(page) || [];
    if (!list.some(r => within(rect, r))) spots.set(page, [...list.filter(r => !within(r, rect)), rect]);
  };
  for (const o of ops) {
    // One radio button's box, not all of its group's.
    if (o.name) for (const page of pages) for (const a of await whereFields(doc, off.file, page)) if (a.fieldName === o.name && (o.t !== "radio" || a.buttonValue === o.option)) add(page, a.rect);
    if (o.t === "draw") add(o.page, [o.x - 1, o.y - 3, o.x + (o.w || 90), o.y + 11]);
    if (o.t === "lines") {
      const left = Math.min(...[o.x0].flat()), low = Math.min(...o.ys);
      const tall = o.layouts ? Math.max(...o.layouts.map(l => l.n * l.sizes[0] * 1.15)) : Math.max(...o.ys) - low + 11;
      add(o.page, [left, low - 1, o.x1, low + tall + 2]);
    }
  }
  return [...spots].map(([page, rects]) => ({ page, rects }));
}
// One canvas per page, kept and reused.
function whereCanvas(doc, file, page) {
  return remember(whereCanvases, `${file}:${page}`, () => doc.getPage(page + 1).then(async p => {
    const scale = Math.min(800, 460 * (window.devicePixelRatio || 1)) / p.getViewport({ scale: 1 }).width, viewport = p.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width); canvas.height = Math.floor(viewport.height);
    await p.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
    return canvas;
  }));
}
// speak: the person asked for this, so a screen reader hears when it's ready. Moving to the next question stays quiet.
async function drawWhere(step, at = 0, speak = false) {
  const box = document.getElementById("wherePreview");
  if (!box) return;
  const token = ++whereToken, stale = () => token !== whereToken || !box.isConnected;
  const { official } = SITUATIONS[sitKey], off = OFFICIAL[official.packet];
  if (!box.querySelector("canvas")) box.innerHTML = `<p class="draftnote" role="status">Loading the form…</p>`;
  try {
    await Promise.all([loadPreviewTools(), loadScript({ src: formDataSrc(off.file) })]);
    if (stale()) return;
    const doc = await whereDoc(off.file), spots = await whereSpots(step, doc);
    const { page, rects } = spots[at];
    const [pg, canvas] = await Promise.all([doc.getPage(page + 1), whereCanvas(doc, off.file, page)]);
    if (stale()) return;
    const form = official.docs.map(k => off.docs[k]).find(d => d.pages.includes(page));
    const where = `${form.name} (${form.number}), page ${form.pages.indexOf(page) + 1} of ${form.pages.length}`;
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", `${where}, with the place for this answer highlighted.`);
    const view = pg.getViewport({ scale: 1 }), pct = (v, of) => `${(v / of * 100).toFixed(2)}%`;
    const marks = rects.map(r => {
      const [x1, y1, x2, y2] = view.convertToViewportRectangle(r);
      const left = Math.min(x1, x2), top = Math.min(y1, y2), width = Math.max(Math.abs(x2 - x1), 8), height = Math.max(Math.abs(y2 - y1), 8);
      return `<span class="wheremark" style="left:${pct(left, view.width)};top:${pct(top, view.height)};width:${pct(width, view.width)};height:${pct(height, view.height)}"></span>`;
    }).join("");
    box.innerHTML = `<div class="wherepage">${marks}</div><p class="draftnote" id="whereCaption">${esc(where)}${spots.length > 1 ? `. Place ${at + 1} of ${spots.length}.` : "."}</p>
      ${spots.length > 1 ? `<p class="need wherenav"><button class="link" id="wherePrev"${at ? "" : " disabled"}>Previous place</button><button class="link" id="whereNext"${at < spots.length - 1 ? "" : " disabled"}>Next place</button></p>` : ""}`;
    box.querySelector(".wherepage").prepend(canvas);
    if (speak) announce(`${where}. The place for this answer is highlighted.`);
    // The button pressed can become disabled at either end, and focus shouldn't fall to the top of the page.
    const move = (id, to, other) => { const b = document.getElementById(id); if (b) b.onclick = () => drawWhere(step, to, true).then(() => { const again = document.getElementById(id); (again && !again.disabled ? again : document.getElementById(other))?.focus({ preventScroll: true }); }); };
    move("wherePrev", at - 1, "whereNext"); move("whereNext", at + 1, "wherePrev");
  } catch (e) {
    console.error(e);
    // The form arrived but couldn't be used, so it may have come through damaged. Try again fetches it fresh.
    const damaged = !!window.OFFICIAL_PDFS?.[off.file];
    if (stale()) return;
    box.innerHTML = `<p class="draftnote" role="alert">The preview couldn't be shown. The blank form link above still works. <button class="link" id="whereRetry">Try again</button></p>`;
    document.getElementById("whereRetry").onclick = () => {
      if (damaged) { formDataTry++; Object.keys(whereCanvases).forEach(k => { if (k.startsWith(`${off.file}:`)) delete whereCanvases[k]; }); Object.keys(whereNotes).forEach(k => { if (k.startsWith(`${off.file}:`)) delete whereNotes[k]; }); delete whereDocs[off.file]; }
      document.getElementById("whereToggle").focus(); // the Try again button is about to go
      drawWhere(step, at, true);
    };
  }
}
