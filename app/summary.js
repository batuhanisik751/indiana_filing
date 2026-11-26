// The summary screen.
const sameTitle = (flags, x) => flags.filter(y => y.title === x.title).length;
// The first sentence of a flag's reason, and the rest. A period in "U.S.", "St. Joseph" or an initial doesn't end it.
function splitWhy(why) {
  const t = String(why ?? "");
  for (const m of t.matchAll(/\.(["\u201D\u2019]?)\s+(?=["\u201C(]?[A-Z])/g)) {
    if (/(?:\b(?:St|Mr|Mrs|Ms|Dr|No|Jr|Sr|Inc|Co|vs|v|a\.m|p\.m)|\b[A-Z]\.[A-Z]|\b[A-Z])\.$/.test(t.slice(0, m.index + 1))) continue;
    return [t.slice(0, m.index + 1 + m[1].length), t.slice(m.index + m[0].length)];
  }
  return [t, ""];
}
// Private information first (it prints on a public form), then what's missing, then what to double-check.
const flagRank = x => /^Private information/.test(x.title) ? 0 : x.level === "missing" ? 1 : 2;
// One line per flag. A missing answer shows its title, and why it's needed opens on tap. A check also shows the first
// sentence of its reason, since that says what to look at, and the rest opens on tap.
function flagHtml(x, i, flags) {
  const link = x.link ? ` <a href="${x.link.href}" target="_blank" rel="noopener">${esc(x.link.text)}</a>` : "";
  const [lead, rest] = x.level === "missing" ? ["", x.why] : splitWhy(x.why);
  const nth = flags.filter(y => y.title === x.title && y.fix === x.fix).indexOf(x);
  const title = `<span class="ftitle">${esc(x.title)}</span>${lead ? `<small id="whyA${i}">${esc(lead)}</small>` : ""}`;
  const more = rest || link;
  const text = more ? moreHtml(`${esc(rest)}${link}`, "", `flag:${x.fix || ""}:${x.title}:${nth}`, { cls: "flagwhy", summaryHtml: title, bodyId: `whyB${i}` }) : title;
  const desc = [lead ? `whyA${i}` : "", more ? `whyB${i}` : ""].filter(Boolean).join(" ");
  return `
      <li><span class="tag ${x.level}">${x.level === "missing" ? "Missing" : "Check"}</span>
      <span class="flagtext">${text}</span>
      ${x.fix ? `<button class="ghost small" data-fix="${x.fix}"${x.hit && x.hit.length ? ` data-hit="${x.hit.map(h => h.join("-")).join(",")}"` : ""} aria-label="Fix: ${esc(x.title)}${sameTitle(flags, x) > 1 ? ` (${flags.filter(y => y.title === x.title).indexOf(x) + 1} of ${sameTitle(flags, x)})` : ""}"${desc ? ` aria-describedby="${desc}"` : ""}>Fix</button>` : ""}</li>`;
}
// The summary counts the days to the court date from today. A page left open past midnight, or brought back by a phone
// the next morning without reloading, draws it again for the new day, keeping focus and place.
let summaryDay = null;
function redrawIfNewDay() {
  if (mode !== "summary" || summaryDay === todayDay()) return;
  keepFocus(() => renderSummary(true));
}
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") redrawIfNewDay(); });
window.addEventListener("focus", redrawIfNewDay);
window.addEventListener("pageshow", redrawIfNewDay);
setInterval(redrawIfNewDay, 60000);

// The parts of each answer a flag is about, where they are in the answer, to mark where it's shown in "Show every answer".
function markedParts(flags) {
  const out = {}, a = visibleAnswers();
  for (const f of flags) if (f.hit && f.hit.length && typeof a[f.fix] === "string") (out[f.fix] ||= { raw: a[f.fix], spans: [] }).spans.push(...f.hit);
  return out;
}
// A shown answer with those parts marked where they are, not every copy of the same text ("PIN 1234 ... 1234 Main St.").
// Only where it's shown as typed (an amount is shown as "$123,456,789.00").
function markParts(value, m) {
  if (!m || value !== m.raw) return esc(value);
  let html = "", at = 0;
  for (const [s, e] of [...m.spans].sort((x, y) => x[0] - y[0])) if (s >= at && s < e && e <= value.length) { html += `${esc(value.slice(at, s))}<mark>${esc(value.slice(s, e))}</mark>`; at = e; }
  return html + esc(value.slice(at));
}
// Item 17, quick edit: in "Show every answer", Edit changes a typed answer right there, checked the same way as on its
// question. A choice, and a change that brings up another question, are made on the question itself, which asks it.
const INLINE_TYPES = new Set(["text", "textarea", "email", "tel", "money", "number", "date"]);
const editsInPlace = id => INLINE_TYPES.has(steps.find(s => s.id === id)?.type);
// The question that changes an answer: its own while it's shown. A hidden answer is changed through the question that
// hid it: the county through the case number's confirmation, a fee waiver amount through its "Which of these" list.
function editTarget(id) {
  if (!id) return null;
  const vis = new Set(visible().map(s => s.id));
  if (vis.has(id)) return id;
  const s = steps.find(x => x.id === id), via = s?.editVia || s?.kind?.[0];
  return vis.has(via) ? via : null;
}
const rowSel = (id, nth) => `dl.vals [data-row="${CSS.escape(`${id}:${nth}`)}"]`;
function inlineBoxHtml(step, label) {
  const ie = inlineEdit, v = ie.value, limit = dateLimit(step, visibleAnswers());
  const attrs = `id="inEdit" aria-label="${esc(label)}" aria-describedby="${ie.err ? "ieErr " : ""}ieNeed"${ie.err ? ' aria-invalid="true"' : ""}`;
  const box = step.type === "textarea" ? `<textarea ${attrs} class="${step.short ? "short" : ""}" autocomplete="off">${esc(v)}</textarea>`
    : step.type === "money" ? `<div class="money"><span aria-hidden="true">$</span><input ${attrs} type="text" inputmode="decimal" value="${esc(v)}" autocomplete="off"></div>`
    : step.type === "number" ? `<input ${attrs} type="text" inputmode="decimal" value="${esc(v)}" autocomplete="off">`
    : `<input ${attrs} type="${step.type === "email" ? "text" : step.type}"${step.type === "email" ? ' inputmode="email" autocapitalize="none" autocorrect="off" spellcheck="false"' : ""} value="${esc(v)}" autocomplete="off"${limit ? ` max="${limit.date}"` : ""}>`;
  const need = `${ie.reloaded && ie.erased ? "The answer you erased before reloading isn't kept. Cancel leaves this blank. " : ""}${step.optional ? "Optional. " : ""}${limit ? `It can't be later than your ${limit.name} (${formDate(limit.date)}). ` : ""}Save checks it the same way as the question does.`;
  return `<div class="inedit">${box}
            <p class="need" id="ieNeed">${esc(need)}</p>
            <p class="err" id="ieErr" role="alert">${esc(ie.err || "")}</p>
            <div class="ienav"><button class="primary small" id="ieSave">Save</button><button class="ghost small" id="ieCancel">Cancel</button><button class="link" id="ieFull">Open the full question</button></div>
          </div>`;
}
// Puts the summary's markup on the page. While a box on it is being typed in, the box isn't drawn again: everything
// around it is replaced instead, so the box keeps what's being typed, its cursor, a date being retyped, an open date
// picker, text being composed and undo. The rest (the flags, the downloads) is brought up to date all the same (BT60,
// BT61). Before, the summary waited for a half-typed date, for good if it was left that way, and broke up other ones.
function paintSummary(html) {
  const box = document.getElementById("inEdit"), keep = box && box === document.activeElement && app.contains(box) && box.closest(".inedit");
  if (!keep || !paintAround(html, keep)) app.innerHTML = html;
}
function paintAround(html, keep) {
  const made = document.createElement("div");
  made.innerHTML = html;
  const newKeep = made.querySelector(".inedit");
  if (!newKeep) return false; // the box is gone in the new summary
  const live = [], next = [];
  for (let n = keep; n !== app; n = n.parentElement) live.unshift(n);
  for (let n = newKeep; n !== made; n = n.parentElement) next.unshift(n);
  if (live.length !== next.length || live.some((n, i) => n.tagName !== next[i].tagName || n.className !== next[i].className)) return false;
  // Level by level, from the page down to the box: the kept element stays where it is, and what's around it is replaced.
  let liveParent = app, nextParent = made;
  live.forEach((kept, i) => {
    for (const c of [...liveParent.childNodes]) if (c !== kept) c.remove();
    const kids = [...nextParent.childNodes], at = kids.indexOf(next[i]);
    kept.before(...kids.slice(0, at));
    kept.after(...kids.slice(at + 1));
    if (i < live.length - 1) {
      for (const { name } of [...kept.attributes]) if (!next[i].hasAttribute(name)) kept.removeAttribute(name);
      for (const { name, value } of [...next[i].attributes]) if (kept.getAttribute(name) !== value) kept.setAttribute(name, value);
    }
    liveParent = kept; nextParent = next[i];
  });
  return true;
}
// Draw the summary again with one row kept where it is on screen, then do what's next (usually focus that row).
function redrawSummaryAt(sel, then) {
  const a = app.querySelector(sel), top = a ? a.getBoundingClientRect().top : null, y = window.scrollY;
  renderSummary(true); saveProgress(); updatePrivacyNote();
  const b = app.querySelector(sel);
  if (b && top !== null) window.scrollBy(0, b.getBoundingClientRect().top - top); else window.scrollTo(0, y);
  if (then) then();
}
const inlineChanged = () => !!inlineEdit && (inlineEdit.erased || inlineEdit.value !== String(answers[inlineEdit.id] ?? ""));
// A change in a box on the summary that isn't saved yet: the form and its downloads don't have it, so the status and the
// downloads say so as it's typed (BT56).
const unsavedText = () => (inlineEdit && inlineEdit.where !== "pdf" && inlineChanged()
  ? `Your change to "${steps.find(s => s.id === inlineEdit.id)?.label}" isn't saved yet, so the form doesn't have it. Save it or cancel it before you download.` : "");
function showUnsaved() { const t = unsavedText(); app.querySelectorAll(".unsaved").forEach(el => { el.textContent = t; el.hidden = !t; }); }
// Lets go of the answer being changed, as Cancel does, and saves the copy again without the box: what was typed in it
// leaves the device, and an answer emptied in it goes back on (until then the saved copy keeps it off).
function dropInline() { const had = !!inlineEdit; inlineEdit = null; if (had) saveProgress(); }
// Leaving a box with a change that isn't saved asks first, whichever way the person leaves: another Edit, Back to
// questions, Choose a different form, the logo, Change these answers, the browser's Back, or Close on a page shown large
// (BT70). Saying no keeps the box, with focus in it.
function okToDropInline() {
  if (!inlineEdit || !inlineChanged() || confirm(`Discard your change to "${steps.find(s => s.id === inlineEdit.id)?.label}"?`)) return true;
  document.getElementById("inEdit")?.focus();
  return false;
}
function openInline(id, nth) {
  if (inlineEdit && inlineChanged() && !confirm(`Discard your change to "${steps.find(s => s.id === inlineEdit.id)?.label}"?`)) { document.getElementById("inEdit")?.focus(); return; }
  inlineEdit = { id, nth, value: String(answers[id] ?? ""), erased: false, err: "" };
  redrawSummaryAt(rowSel(id, nth), () => {
    const box = document.getElementById("inEdit");
    if (!box) return;
    box.focus({ preventScroll: true });
    if (box.type !== "date") { const n = box.value.length; box.setSelectionRange(n, n); }
  });
}
function closeInline() {
  if (inlineEdit.where === "pdf") return closePdfEdit(document.querySelector("dialog.pageview"));
  const ie = inlineEdit, sel = rowSel(ie.id, ie.nth);
  inlineEdit = null;
  redrawSummaryAt(sel, () => app.querySelector(`${sel} [data-fix]`)?.focus({ preventScroll: true }));
}
// On to the question itself, with what was typed in the box, and Cancel there still putting the old answer back.
function inlineToQuestion(note = "") {
  const ie = inlineEdit;
  inlineEdit = null;
  if (ie.where === "pdf") document.querySelector("dialog.pageview")?.remove(); // the page shown large goes; the question opens
  goFix(ie.id, "vals", Math.max(0, ie.nth));
  const box = document.getElementById("ans");
  if (!box) return;
  if (ie.erased) editErased = ie.id; // emptied on the summary: the old answer stays off the device here too
  if (box.value !== ie.value) { box.value = ie.value; box.dispatchEvent(new Event("input", { bubbles: true })); }
  if (note) { document.getElementById("qneed").insertAdjacentHTML("beforebegin", `<p class="need" id="inlineNote">${esc(note)}</p>`); announce(note); }
}
function saveInline() {
  const ie = inlineEdit, step = ie && steps.find(s => s.id === ie.id), box = document.getElementById("inEdit");
  if (!step || !box) return;
  const refuse = msg => {
    ie.err = msg; document.getElementById("ieErr").textContent = msg;
    box.setAttribute("aria-invalid", "true"); box.setAttribute("aria-describedby", "ieErr ieNeed"); box.focus();
  };
  if (step.type === "date" && box.validity?.badInput) return refuse(HALF_DATE);
  const problem = answerProblem(step, typedValue(step, box.value), true);
  if (problem) return refuse(problem);
  ie.value = box.value;
  // A change that brings up another question (a case number for another county or court) is made on the question.
  const before = new Set(visible().map(s => s.id)), kept = [answers[step.id], answers.caseConfirm, unsure.caseConfirm, caseConfirmFor];
  keepTyped(step, box.value);
  // As on the question: a case number with no county and court confirmed for it (another county's number drops the
  // confirmation) asks that question again.
  if (step.id === "caseNumber" && empty(answers.caseConfirm)) before.delete("caseConfirm");
  if (visible().some(s => !before.has(s.id))) {
    const put = (o, k, v) => { if (v === undefined) delete o[k]; else o[k] = v; };
    put(answers, step.id, kept[0]); put(answers, "caseConfirm", kept[1]); put(unsure, "caseConfirm", kept[2]); caseConfirmFor = kept[3];
    return inlineToQuestion("This change brings up another question, so it opened on its own page. Save and review there to keep it.");
  }
  if (!empty(answers[step.id]) || step.optional) delete unsure[step.id];
  if (step.type === "money" || step.type === "number") answers[step.id] = cleanNum(answers[step.id]);
  clearedContact = clearedContact.filter(k => k !== step.id);
  if (ie.where === "pdf") {
    // On a page of the form shown large: the summary behind is brought up to date, the form is made again, and the page
    // is shown again with the change.
    inlineEdit = null;
    ie.onSaved();
    renderSummary(true); saveProgress(); updatePrivacyNote();
    // Focus goes to this line (the button pressed is gone), then to the answer once the page is shown again.
    const box = document.getElementById("pvEdit");
    if (box) { box.innerHTML = `<p class="need" id="pvSaving" tabindex="-1">Saved. Making the page again with your change…</p>`; document.getElementById("pvSaving").focus({ preventScroll: true }); }
    announce("Saved. Making the page again with your change.");
    if (!pdfState.busy) window.dispatchEvent(new Event("pdfready")); // nothing changed on the form, so nothing to wait for
    return;
  }
  closeInline();
  announce("Saved. Your filled form and the checks are updated.");
}
function wireInline(root = app) {
  const box = root.querySelector("#inEdit"), on = (id, f) => { const b = root.querySelector(`#${id}`); if (b) b.onclick = f; };
  on("ieFull", () => inlineToQuestion());
  on("ieCancel", closeInline);
  if (!box || box.wired) return; // a box kept through a redraw is wired already
  box.wired = true;
  box.addEventListener("input", () => {
    if (box.validity?.badInput) return; // a half-typed date isn't an answer yet
    inlineEdit.value = box.value;
    // Emptying the box takes the old answer off the device right away, as on the question screen. Cancel brings it back.
    if (!inlineEdit.erased && empty(box.value) && !empty(answers[inlineEdit.id])) inlineEdit.erased = true;
    saveProgress(); // what's typed is kept through a reload, as on the question
    showUnsaved();
  });
  box.addEventListener("keydown", e => {
    if (!e.isComposing && e.key === "Enter" && box.tagName !== "TEXTAREA" && !e.repeat) { e.preventDefault(); saveInline(); }
  });
  // Escape anywhere in the box, on its buttons too, closes it as Cancel does.
  box.closest(".inedit").addEventListener("keydown", e => {
    if (e.key === "Escape" && !e.isComposing) { e.preventDefault(); e.stopPropagation(); closeInline(); }
  });
  on("ieSave", saveInline);
}
function renderSummary(rerender = false) {
  summaryDay = todayDay();
  const sit = SITUATIONS[sitKey];
  const a = visibleAnswers();
  ensurePdf();
  const flags = [...runChecks(), ...pdfFlags()].sort((x, y) => flagRank(x) - flagRank(y)); // a stable sort: the checks' own order stays within each group
  const marked = markedParts(flags);
  const missing = flags.filter(x => x.level === "missing").length;
  const checking = pdfState.busy || !pdfState.key; // the PDF's own checks aren't in yet
  const failed = !!pdfState.error; // the PDF's own checks never ran
  const ready = flags.length === 0 && !checking && !failed;
  const fields = sit.fields(a);
  const score = completeness(), scorePct = score.total ? Math.round(score.filled / score.total * 100) : 100;

  // Every visible question gets an Edit link somewhere on this page.
  const covered = new Set(fields.map(x => x.step).filter(Boolean));
  visible().filter(s => !covered.has(s.id)).forEach(s => fields.push(f(FORM.answers, s.label, shown(s), s.id)));

  const groups = [];
  fields.forEach(x => { let g = groups.find(g => g.form === x.form); if (!g) groups.push(g = { form: x.form, items: [] }); g.items.push(x); });
  const editOf = editTarget;

  // Back from an Edit in the list of every answer: the list is open again, so focus can return to that row.
  if (lastEdited && fixFrom === "vals") openMore.add("answers");
  // Each row's Edit is numbered among the rows for the same answer (a name prints on more than one form).
  const seen = {};
  let boxPlaced = false;
  const rowHtml = (x, g) => {
    const k = editOf(x.step), nth = k ? (seen[k] = (seen[k] ?? -1) + 1) : -1;
    const here = !!inlineEdit && k === inlineEdit.id && nth === inlineEdit.nth && k === x.step && editsInPlace(k);
    if (here) boxPlaced = true;
    return `
          <div${k ? ` data-row="${esc(`${k}:${nth}`)}"` : ""}${here ? ' class="editing"' : ""}><dt>${esc(x.label)}</dt>
          <dd>${here ? inlineBoxHtml(steps.find(s => s.id === k), `${x.label} (${g.form})`) : empty(x.value) ? `<span class="miss">Blank</span>` : markParts(x.value, marked[x.step])}</dd>
          ${k && !here ? `<button class="link edit" data-fix="${k}" data-nth="${nth}"${k === x.step && editsInPlace(k) ? ' data-inline="1"' : ""} aria-label="Edit ${esc(x.label)} (${esc(g.form)})">Edit</button>` : ""}</div>`;
  };
  paintSummary(`
    <div class="bar" role="progressbar" aria-label="Needed answers filled in" aria-valuenow="${scorePct}" aria-valuetext="${score.filled} of ${score.total} needed answers filled in" aria-valuemin="0" aria-valuemax="100"><span style="width:${scorePct}%"></span></div>
    <div class="barlabel"><span>Summary</span><span>${score.filled} of ${score.total} needed answers filled in</span></div>
    <h1 tabindex="-1">Your ${esc(sit.title)} forms</h1>
    <div class="sumgrid">
    <div class="sumreview">
    <div class="status ${ready ? "ready" : "notready"}" tabindex="-1">
      <strong>${ready ? "Nothing to review." : flags.length ? `${flags.length} item${flags.length > 1 ? "s" : ""} to review before filing` : failed ? "We couldn't make your filled form." : "Checking your filled form…"}</strong>
      <span class="unsaved" hidden></span>
      ${ready ? "Read it over once more before you file it yourself." : flags.length ? `${missing} missing, ${flags.length - missing} to double-check. Tap "Fix" to go back to that question.${checking ? " Still checking the filled form…" : failed ? " The checks on the filled form didn't finish." : ""}` : failed ? "The checks on the filled form didn't finish. See below." : pdfSlow ? "This is taking longer than usual." : "This takes a few seconds."}
    </div>
    ${flags.length ? `<ul class="flags">${flags.map((x, i) => flagHtml(x, i, flags)).join("")}</ul>` : ""}
    ${moreHtml(`<ul class="facts howchecks">${checksHowFor(sitKey).map(c => `<li><strong>${esc(c.title)}.</strong> ${esc(c.says)}${c.src.length ? ` <small class="src">Source: ${c.src.map(l => `<a href="${l.href}" target="_blank" rel="noopener">${esc(l.text.replace(/^Read (?:the )?/, ""))}</a>`).join(", ")}</small>` : ""}</li>`).join("")}</ul>`, "How this tool checks your answers", "howchecks", { cls: "howchecks nohover" })}
    ${flags.some(x => x.level === "missing" && T31_ITEMS.test(x.fix)) ? `<div class="note">If you have to file before you have all the information Trial Rule 3.1 requires, that rule says to file the Appearance with what you have and add the rest when you get it. <a href="${RULES.tr31.href}" target="_blank" rel="noopener">${esc(RULES.tr31.text)}</a></div>` : ""}
    ${sit.reminders.map(r => `<div class="note">${esc(r)}</div>`).join("")}
    ${fromTriage && triageAnswered(triage) ? `<div class="note">You started from "${esc(kindOf(triage).pick)}." ${triageVisible().filter(s => triage[s.id]).map(s =>
      `${esc(s.label)}: ${esc((s.options.find(o => o[0] === triage[s.id]) || [, triage[s.id]])[1])}.`).join(" ")}
      <button class="link" id="editTriage">Change these answers</button></div>` : ""}
    </div>

    <div class="sumform">
    <h2 class="sub">Your filled form</h2>
    ${pdfSectionHtml(sit)}
    ${nextStepsHtml(sitKey, a)}
    ${previewHtml()}
    </div>
    </div>

    <h2 class="sub">What goes on your official forms</h2>
    <p class="draftnote">These are the official Indiana forms approved by the Coalition for Court Access. Red text shows what's still blank. <a id="summaryBlank" href="${OFFICIAL[sit.official.packet].source}" target="_blank" rel="noopener">Blank official forms (PDF)</a> · <a href="${sit.official.page}" target="_blank" rel="noopener">On Indiana Legal Help</a></p>
    ${moreHtml(`<div class="formgrid">${groups.map(g => `
      <section class="formcard">
        <h3>${esc(g.form)}${formNumber(sit, g.form) ? `<span class="sr-only">, </span><small>Form ${esc(formNumber(sit, g.form))}</small>` : ""}</h3>
        <dl class="vals">${g.items.map(x => rowHtml(x, g)).join("")}
        </dl>
      </section>`).join("")}</div>`, "Show every answer, with Edit links", "answers", { cls: "section" })}

    <div class="nav">
      <button class="ghost" id="toQuestions">Back to questions</button>
      <button class="ghost" id="restart">Start over</button>
    </div>
    <p class="need"><button class="link" id="changeForm">Choose a different form</button></p>
    <div class="note">This tool checks for blank and mistyped entries. It can't tell whether your answers are right for your case. For free help, visit <a href="${LINKS.getHelp}" target="_blank" rel="noopener">Indiana Legal Help</a>.</div>`);

  if (inlineEdit && inlineEdit.where !== "pdf" && !boxPlaced) dropInline(); // its row is gone (the answer moved or was hidden)
  wireInline();
  app.querySelectorAll("[data-fix]").forEach(b => b.onclick = () => {
    if (b.dataset.inline) return openInline(b.dataset.fix, +b.dataset.nth);
    if (inlineEdit && inlineChanged() && !confirm(`Discard your change to "${steps.find(s => s.id === inlineEdit.id)?.label}"?`)) return document.getElementById("inEdit")?.focus();
    inlineEdit = null;
    const where = b.closest("ul.flags") ? "flags" : "vals";
    // A flag about part of the answer opens it with that part selected.
    selectOnOpen = b.dataset.hit ? { id: b.dataset.fix, spans: b.dataset.hit.split(",").map(h => h.split("-").map(Number)) } : null;
    goFix(b.dataset.fix, where, where === "vals" ? +b.dataset.nth : [...app.querySelectorAll(`ul.flags [data-fix="${b.dataset.fix}"]`)].indexOf(b));
  });
  app.querySelectorAll("[data-ics]").forEach(b => b.onclick = () => downloadIcs(b.dataset.ics));
  document.getElementById("toQuestions").onclick = () => { if (!okToDropInline()) return; returnToSummary = false; cur = visible().length - 1; mode = "step"; render(); };
  document.getElementById("changeForm").onclick = () => { if (okToDropInline()) chooseOtherForm(); };
  document.getElementById("restart").onclick = () => {
    // Another tab's copy of a different form isn't this form's to delete, and saving stays on to keep it.
    const copy = readSaved(), turnsOff = (savingOn() || storageFull) && !(copy && copy.sitKey && copy.sitKey !== sitKey);
    if (!confirm(`Start over? This clears every answer you have entered for "${sit.title}", here and in any other open tab with this form, including any saved on this device${turnsOff ? ", and turns saving off" : ""}.`)) return;
    clearFormEverywhere(sitKey); if (turnsOff) savingOffForNext(); resetAnswers(); mode = "pick"; render();
    announce(turnsOff ? "Your answers were deleted, and saving is off." : "Your answers were deleted.");
  };
  const et = document.getElementById("editTriage");
  if (et) et.onclick = () => { if (!okToDropInline()) return; triageBeforeEdit = { ...triage }; triagePrev = { ...triage, kind: Object.hasOwn(CASE_KINDS, triage.kind) ? triage.kind : "eviction" }; triage = {}; triageHist = []; triageFromSummary = true; mode = "triage"; render(); };
  wirePdfSection(sit);
  showUnsaved();
  markNewTabLinks(app);
  if (rerender) return;
  // After an edit, bring the user back where they were: the flag they fixed
  // (or the review count, if that flag is gone), or the row they changed.
  const back = lastEdited && (fixFrom === "flags"
    ? app.querySelectorAll(`ul.flags [data-fix="${lastEdited}"]`)[fixNth] || app.querySelector(`ul.flags [data-fix="${lastEdited}"]`) || app.querySelector(".status")
    : app.querySelector(`dl.vals [data-fix="${lastEdited}"][data-nth="${fixNth}"]`) || app.querySelector(`dl.vals [data-fix="${lastEdited}"]`));
  if (back) { back.scrollIntoView({ block: "center" }); back.focus(); } else (document.getElementById("inEdit") || app.querySelector("h1")).focus();
  // A Fix button for a flag from the PDF check may only appear once the check finishes.
  const tapped = lastEdited && fixFrom === "flags" && app.querySelectorAll(`ul.flags [data-fix="${lastEdited}"]`)[fixNth];
  pendingFocus = lastEdited && fixFrom === "flags" && !tapped ? { id: lastEdited, nth: fixNth } : null;
  lastEdited = null; fixFrom = null;
}
window.appParts++;
