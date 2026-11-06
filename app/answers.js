// Saving an answer, pressing "I'm not sure", and going back to fix one.
// "I'm not sure": leave the answer blank, remember it, and move on.
// After an edit, go to the next question that edit opened, if any is still unanswered.
function nextFollowUp() {
  const vis = visible();
  const next = vis.find(s => followUps.includes(s.id) && !(unsure[s.id] && empty(answers[s.id])));
  if (!next) { followUps = []; return false; }
  cur = vis.indexOf(next); render(); return true;
}

function markUnsure(step) {
  const before = new Set(returnToSummary && editOriginal && editOriginal.id === step.id && editOriginal.before ? editOriginal.before : visible().map(s => s.id));
  const wasYes = answers[step.id] === "yes";
  readInput(step);
  // Someone who said their address is protected may still need that: what they typed before doesn't come back by itself.
  const protects = wasYes || answers[step.id] === "yes" ? PROTECTS[step.id] || [] : [], clears = protects.filter(k => !empty(answers[k]));
  if (!empty(answers[step.id]) && !confirm(`Clear your answer to this question and mark it "I'm not sure"?${clears.length ? ` This also clears the ${contactWords(clears)} you typed, so a protected address can't come back by itself. You can type ${clears.length > 1 ? "them" : "it"} again.` : ""}`)) return;
  protects.forEach(k => delete answers[k]);
  clearedContact = [...new Set([...clearedContact.filter(k => k !== step.id), ...clears])];
  answers[step.id] = "";
  unsure[step.id] = true;
  justMarked = true;
  announce("Marked \"I'm not sure.\" It will be flagged at the end.");
  const vis = visible();
  const idx = vis.findIndex(s => s.id === step.id);
  if (returnToSummary) {
    // Clearing an answer can open questions too (for example the case type letters).
    followUps = followUps.filter(id => id !== step.id);
    vis.forEach(s => { if (!before.has(s.id)) followUps.push(s.id); });
    if (nextFollowUp()) return;
    editOriginal = null;
    returnToSummary = false; mode = "summary"; return render();
  }
  if (idx < vis.length - 1) { cur = idx + 1; render(); } else { mode = "summary"; render(); }
}

function save(step) {
  // During an edit, "before" is what was shown when the question opened (it survives a reload).
  const before = new Set(returnToSummary && editOriginal && editOriginal.id === step.id && editOriginal.before ? editOriginal.before : visible().map(s => s.id));
  const refuse = msg => {
    document.getElementById("err").textContent = msg;
    const box = document.getElementById("ans");
    box.setAttribute("aria-invalid", "true"); box.setAttribute("aria-describedby", "err qhelp qneed"); box.focus();
  };
  // A date input reports a half-typed date as empty, which would quietly erase the answer.
  if (step.type === "date" && document.getElementById("ans").validity?.badInput) return refuse("This date isn't complete. Enter the month, day and year, or clear the box.");
  readInput(step);
  const v = answers[step.id];
  if (String(v ?? "").length > ANSWER_MAX) return refuse(`This is too long: ${String(v).length.toLocaleString("en-US")} characters. Keep it under ${ANSWER_MAX.toLocaleString("en-US")}.`);
  if ((step.type === "money" || step.type === "number") && !empty(v) && !validNum(step, v))
    return refuse(step.type === "money" ? "Use numbers only, like 1200 or 12.50." : "Use a number only, like 80.");
  if (step.type === "date" && !empty(v) && !isDay(v)) return refuse(`Check the year. Use all four digits, like ${new Date().getFullYear()}.`);
  const limit = dateLimit(step, visibleAnswers());
  if (pastLimit(v, limit))
    return refuse(`This is after your ${limit.name} (${formDate(limit.date)}). Choose that date or an earlier one. If your ${limit.name} changed, ${returnToSummary ? "press Cancel and edit it on the summary" : "go back and change it first"}.`);
  // Saving an answer (or, for an optional question, choosing to leave it blank) clears "I'm not sure".
  if (!empty(answers[step.id]) || (step.optional && returnToSummary)) delete unsure[step.id];
  if (step.type === "money" || step.type === "number") answers[step.id] = cleanNum(v);
  clearedContact = clearedContact.filter(k => k !== step.id);
  const vis = visible();
  const idx = vis.findIndex(s => s.id === step.id);
  if (returnToSummary) {
    // A changed answer can open follow-up questions (for example "Yes, there
    // are related cases"). Ask those, and only those, before going back to the summary. An earlier answer
    // that comes back is asked again too, with that answer selected, so it can't return unseen.
    followUps = followUps.filter(id => id !== step.id);
    vis.forEach(s => { if (!before.has(s.id)) followUps.push(s.id); });
    if (nextFollowUp()) return;
    editOriginal = null; returnToSummary = false; mode = "summary"; return render();
  }
  if (idx < vis.length - 1) { cur = idx + 1; render(); } else { mode = "summary"; render(); }
}

function goFix(id, from = "vals", nth = 0) {
  const idx = visible().findIndex(s => s.id === id);
  if (idx < 0) return;
  lastEdited = id; fixFrom = from; fixNth = nth; followUps = []; editOriginal = null;
  cur = idx; returnToSummary = true; mode = "step"; render(); window.scrollTo(0, 0);
}
window.appParts++;
