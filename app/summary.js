// The summary screen.
const sameTitle = (flags, x) => flags.filter(y => y.title === x.title).length;
function renderSummary(rerender = false) {
  const sit = SITUATIONS[sitKey];
  const a = visibleAnswers();
  ensurePdf();
  const flags = [...runChecks(), ...pdfFlags()];
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
  const visIds = new Set(visible().map(s => s.id));

  app.innerHTML = `
    <div class="bar" role="progressbar" aria-label="Needed answers filled in" aria-valuenow="${scorePct}" aria-valuetext="${score.filled} of ${score.total} needed answers filled in" aria-valuemin="0" aria-valuemax="100"><span style="width:${scorePct}%"></span></div>
    <div class="barlabel"><span>Summary</span><span>${score.filled} of ${score.total} needed answers filled in</span></div>
    <h1 tabindex="-1">Your ${esc(sit.title)} forms</h1>
    <div class="status ${ready ? "ready" : "notready"}" tabindex="-1">
      <strong>${ready ? "Nothing to review." : flags.length ? `${flags.length} item${flags.length > 1 ? "s" : ""} to review before filing` : failed ? "We couldn't make your filled form." : "Checking your filled form…"}</strong>
      ${ready ? "Read it over once more before you file it yourself." : flags.length ? `${missing} missing, ${flags.length - missing} to double-check. Tap "Fix" to go back to that question.${checking ? " Still checking the filled form…" : failed ? " The checks on the filled form didn't finish." : ""}` : failed ? "The checks on the filled form didn't finish. See below." : pdfSlow ? "This is taking longer than usual." : "This takes a few seconds."}
    </div>
    ${flags.length ? `<ul class="flags">${flags.map((x, i) => `
      <li><span class="tag ${x.level}">${x.level === "missing" ? "Missing" : "Check"}</span>
      <span class="flagtext">${esc(x.title)}<small id="why${i}">${esc(x.why)}${x.link ? ` <a href="${x.link.href}" target="_blank" rel="noopener">${esc(x.link.text)}</a>` : ""}</small></span>
      ${x.fix ? `<button class="ghost small" data-fix="${x.fix}" aria-label="Fix: ${esc(x.title)}${sameTitle(flags, x) > 1 ? ` (${flags.filter(y => y.title === x.title).indexOf(x) + 1} of ${sameTitle(flags, x)})` : ""}" aria-describedby="why${i}">Fix</button>` : ""}</li>`).join("")}</ul>` : ""}
    ${flags.some(x => x.level === "missing" && T31_ITEMS.test(x.fix)) ? `<div class="note">If you have to file before you have all the information Trial Rule 3.1 requires, that rule says to file the Appearance with what you have and add the rest when you get it. <a href="${RULES.tr31.href}" target="_blank" rel="noopener">${esc(RULES.tr31.text)}</a></div>` : ""}
    ${sit.reminders.map(r => `<div class="note">${esc(r)}</div>`).join("")}
    ${fromTriage && triageAnswered(triage) ? `<div class="note">You started from "${esc(kindOf(triage).pick)}." ${triageVisible().filter(s => triage[s.id]).map(s =>
      `${esc(s.label)}: ${esc((s.options.find(o => o[0] === triage[s.id]) || [, triage[s.id]])[1])}.`).join(" ")}
      <button class="link" id="editTriage">Change these answers</button></div>` : ""}

    <h2 class="sub">Your filled form</h2>
    ${pdfSectionHtml(sit)}
    ${nextStepsHtml(sitKey, a)}
    ${previewHtml()}

    <h2 class="sub">What goes on your official forms</h2>
    <p class="draftnote">These are the official Indiana forms approved by the Coalition for Court Access. Red text shows what's still blank. <a id="summaryBlank" href="${OFFICIAL[sit.official.packet].source}" target="_blank" rel="noopener">Blank official forms (PDF)</a> · <a href="${sit.official.page}" target="_blank" rel="noopener">On Indiana Legal Help</a></p>
    ${groups.map(g => `
      <section class="formcard">
        <h3>${esc(g.form)}${formNumber(sit, g.form) ? `<small>Form ${esc(formNumber(sit, g.form))}</small>` : ""}</h3>
        <dl class="vals">${g.items.map(x => `
          <div><dt>${esc(x.label)}</dt>
          <dd>${empty(x.value) ? `<span class="miss">Blank</span>` : esc(x.value)}</dd>
          ${x.step && visIds.has(x.step) ? `<button class="link edit" data-fix="${x.step}" aria-label="Edit ${esc(x.label)} (${esc(g.form)})">Edit</button>` : ""}</div>`).join("")}
        </dl>
      </section>`).join("")}

    <div class="nav">
      <button class="ghost" id="toQuestions">Back to questions</button>
      <button class="ghost" id="restart">Start over</button>
    </div>
    <p class="need"><button class="link" id="changeForm">Choose a different form</button></p>
    <div class="note">This tool checks for blank and mistyped entries. It can't tell whether your answers are right for your case. For free help, visit <a href="${LINKS.getHelp}" target="_blank" rel="noopener">Indiana Legal Help</a>.</div>`;

  app.querySelectorAll("[data-fix]").forEach(b => b.onclick = () => {
    const where = b.closest("ul.flags") ? "flags" : "vals";
    goFix(b.dataset.fix, where, [...app.querySelectorAll(`${where === "flags" ? "ul.flags" : "dl.vals"} [data-fix="${b.dataset.fix}"]`)].indexOf(b));
  });
  document.getElementById("toQuestions").onclick = () => { returnToSummary = false; cur = visible().length - 1; mode = "step"; render(); };
  document.getElementById("changeForm").onclick = chooseOtherForm;
  document.getElementById("restart").onclick = () => {
    // Another tab's copy of a different form isn't this form's to delete, and saving stays on to keep it.
    const copy = readSaved(), turnsOff = (savingOn() || storageFull) && !(copy && copy.sitKey && copy.sitKey !== sitKey);
    if (!confirm(`Start over? This clears every answer you have entered for "${sit.title}", here and in any other open tab with this form, including any saved on this device${turnsOff ? ", and turns saving off" : ""}.`)) return;
    clearFormEverywhere(sitKey); if (turnsOff) savingOffForNext(); resetAnswers(); mode = "pick"; render();
    announce(turnsOff ? "Your answers were deleted, and saving is off." : "Your answers were deleted.");
  };
  const et = document.getElementById("editTriage");
  if (et) et.onclick = () => { triageBeforeEdit = { ...triage }; triagePrev = { ...triage, kind: Object.hasOwn(CASE_KINDS, triage.kind) ? triage.kind : "eviction" }; triage = {}; triageHist = []; triageFromSummary = true; mode = "triage"; render(); };
  wirePdfSection(sit);
  markNewTabLinks(app);
  if (rerender) return;
  // After an edit, bring the user back where they were: the flag they fixed
  // (or the review count, if that flag is gone), or the row they changed.
  const back = lastEdited && (fixFrom === "flags"
    ? app.querySelectorAll(`ul.flags [data-fix="${lastEdited}"]`)[fixNth] || app.querySelector(`ul.flags [data-fix="${lastEdited}"]`) || app.querySelector(".status")
    : app.querySelectorAll(`dl.vals [data-fix="${lastEdited}"]`)[fixNth] || app.querySelector(`dl.vals [data-fix="${lastEdited}"]`));
  if (back) { back.scrollIntoView({ block: "center" }); back.focus(); } else app.querySelector("h1").focus();
  // A Fix button for a flag from the PDF check may only appear once the check finishes.
  const tapped = lastEdited && fixFrom === "flags" && app.querySelectorAll(`ul.flags [data-fix="${lastEdited}"]`)[fixNth];
  pendingFocus = lastEdited && fixFrom === "flags" && !tapped ? { id: lastEdited, nth: fixNth } : null;
  lastEdited = null; fixFrom = null;
}
