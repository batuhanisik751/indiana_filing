// The first screen, "Which one fits?", and the question screen.
/* ---------- screens ---------- */
// quiet: re-drawn because something changed elsewhere, so don't move focus or scroll.
let firstRender = true;
let pickMore = false; // "My situation is different" is open
// Other kinds of cases: the official self-help pages, since this tool can't fill their forms yet.
const OTHER_CASES = [
  ["https://www.in.gov/courts/selfservice/protection-orders/", "Protection orders (Indiana courts)"],
  ["https://indianalegalhelp.org/legal-topic-category/divorce-2/", "Divorce"],
  ["https://indianalegalhelp.org/legal-topic-category/paternity/", "Paternity"],
  ["https://indianalegalhelp.org/legal-topic-category/expungement-2/", "Expungement"],
  ["https://indianalegalhelp.org/legal-topic-category/estate-2/", "The estate of someone who died (Small Estate form only)"],
];
// Which element had focus, so a redraw can put it back.
const focusKey = el => el.matches("a[href]") ? `a[href="${el.getAttribute("href")}"]` : el.id ? `#${el.id}` : el.dataset.k ? `[data-k="${el.dataset.k}"]` : el.dataset.kind ? `[data-kind="${el.dataset.kind}"]`
  : el.matches(".cardtitle") ? ".cardtitle" : el.matches("h1") ? "h1" : null;
function renderPick(quiet = false) {
  if (window.appFileFailed) return; // another tab's change can land here, and the page can't work
  // Answers still on this page (for example with saving off) come first; then a saved copy.
  const live = sitKey && hasAnswers();
  const saved = live ? null : readSaved();
  const card = `${live ? `live:${sitKey}` : saved ? `saved:${saved.sitKey}:${saved.savedAt}` : ""}|${savingOn()}`;
  // A redraw because another tab saved: skip it if nothing on this screen would change, so focus stays put.
  if (quiet && app.dataset.card === card) return;
  const ae = document.activeElement;
  const focused = quiet && app.contains(ae) ? focusKey(ae) : null;
  app.dataset.card = card;
  app.innerHTML = `
    ${live ? `<div class="resume">
      <h2 class="cardtitle" tabindex="-1">Go back to your answers?</h2>
      <span>Your answers for "${esc(SITUATIONS[sitKey].title)}" are still on this page.</span>
      <div class="nav"><button class="primary" id="backToWork">Go back</button></div>
    </div>` : saved ? `<div class="resume">
      <h2 class="cardtitle" tabindex="-1">Continue where you left off?</h2>
      <span>${esc(savedTitle(saved))}, saved on this device ${esc(new Date(saved.savedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }))}.</span>
      <div class="nav"><button class="primary" id="resume">Continue</button><button class="ghost" id="discard">Delete saved answers</button></div>
    </div>` : ""}
    <div class="hero">
      <div class="hero-text">
        <h1 tabindex="-1">What is your case about?</h1>
        <p class="help">Pick the one that fits. We'll ask about your papers, show which official forms fit, then fill them in one question at a time.</p>
        <p class="takes">Each form is ${takesRange()[0]} to ${takesRange()[1]} questions. Have any court papers you got with you: the court, the case number and the other side's name are on them.</p>
        <p class="takes">Not listed here, or not sure which fits? <button class="link" id="moreJump" aria-controls="moreChoices">See other choices</button></p>
      </div>
      <div class="hero-art" aria-hidden="true">${HERO_ART}</div>
    </div>
    ${Object.entries(CASE_KINDS).map(([k, c]) => `<button class="pick has-ic" data-kind="${k}"><span class="pick-ic" aria-hidden="true">${icon(KIND_ICONS[k])}</span><strong>${esc(c.pick)}</strong><span>${esc(c.blurb)}</span></button>`).join("")}
    <button class="pick more has-ic" id="moreToggle" aria-expanded="${pickMore}" aria-controls="moreChoices"><span class="pick-ic" aria-hidden="true">${icon("dots")}</span><strong>My situation is different<span class="chev" aria-hidden="true">›</span></strong><span>Not sure which one fits? Start here. You can also pick a form directly or see other kinds of cases.</span></button>
    <div class="morebox" id="moreChoices" ${pickMore ? "" : "hidden"}>
      <h2 class="sub" id="moreTitle" tabindex="-1">Pick a form directly</h2>
      ${Object.entries(SITUATIONS).map(([k, s]) => `<button class="pick has-ic" data-k="${k}"><span class="pick-ic" aria-hidden="true">${icon(SITUATION_ICONS[k])}</span><strong>${esc(s.pick)}</strong><span>${esc(s.blurb)}</span>${takesHtml(k)}</button>`).join("")}
      <button class="pick has-ic" id="notSure"><span class="pick-ic" aria-hidden="true">${icon("question")}</span><strong>I'm not sure which one fits</strong><span>See which choice matches the papers you have, or find help.</span></button>
      <h2 class="sub">Other kinds of cases</h2>
      <p class="help">This tool can't fill these forms yet. Indiana Legal Help's pages have the official forms and instructions. For protection orders, the Indiana courts' page says trained advocates can help prepare and file a request.</p>
      <ul class="facts">${OTHER_CASES.map(([href, text]) => `<li><a href="${href}" target="_blank" rel="noopener">${esc(text)}</a></li>`).join("")}</ul>
    </div>
    <div class="note">You'll see your answers on the official form at the end, with anything missing flagged, before you file it yourself.</div>
    <label class="choice savepref"><input type="checkbox" id="savePref" ${savingOn() ? "checked" : ""}>
      <span>Save my answers on this device so I can come back later. <small>${storageWorks
        ? `${savingOn() ? "Saving is on. If this is a shared or public computer, like a library or courthouse kiosk, turn it off." : "Saving is off unless you turn it on. Turn it on only if this is your own device, not a shared or public computer like a library or courthouse kiosk."} If you don't change your answers for ${MAX_AGE_DAYS} days, they are deleted the next time this page is opened. In a private or incognito window, they're gone when the window closes.`
        : "This browser isn't letting the page save, so your answers will be lost if you close or refresh it."}</small></span></label>`;
  const pref = document.getElementById("savePref");
  pref.disabled = !storageWorks;
  pref.onchange = () => {
    if (!setSaving(pref.checked)) { pref.checked = !pref.checked; return; }
    renderPick(true);
    document.getElementById("savePref").focus();
  };
  if (saved) {
    // Read the saved answers again when Continue is chosen, in case another tab changed them.
    document.getElementById("resume").onclick = () => {
      const now = readSaved();
      if (now) restoreSaved(now); else { renderPick(); updatePrivacyNote(); announce("Those saved answers are no longer on this device."); }
    };
    document.getElementById("discard").onclick = () => {
      if (!confirm(`Delete your saved answers for "${savedTitle(saved)}"? This also clears them in any other open tab with this form, and turns saving off. This can't be undone.`)) return;
      clearFormEverywhere(saved.triageOnly ? sortingTag(saved.triage) : saved.sitKey);
      savingOffForNext();
      resetAnswers(); render();
      announce("Your saved answers were deleted, and saving is off.");
    };
  }
  if (live) document.getElementById("backToWork").onclick = () => {
    if (triageBeforeEdit) { triage = triageBeforeEdit; fromNotSure = notSureBeforeEdit; triageBeforeEdit = null; triageHist = []; }
    mode = triageFromSummary ? "summary" : "step"; triageFromSummary = false;
    render();
  };
  const more = document.getElementById("moreChoices"), toggle = document.getElementById("moreToggle");
  toggle.onclick = () => { pickMore = !pickMore; toggle.setAttribute("aria-expanded", String(pickMore)); more.hidden = !pickMore; };
  // The same choices as "My situation is different", from above the cards: opened (never closed), shown and focused.
  document.getElementById("moreJump").onclick = () => {
    if (!pickMore) toggle.click();
    const title = document.getElementById("moreTitle");
    title.scrollIntoView({ block: "start" }); title.focus({ preventScroll: true });
  };
  document.getElementById("notSure").onclick = () => { mode = "notsure"; render(); };
  app.querySelectorAll(".pick[data-kind]").forEach(b => b.onclick = () => {
    if (sitKey && hasAnswers()) setSortingAside(); // the form's stay until a form is chosen
    triage = { kind: b.dataset.kind }; triagePrev = {}; triageHist = []; triageTouched = false; fromNotSure = false; mode = "triage"; render();
  });
  app.querySelectorAll(".pick[data-k]").forEach(b => b.onclick = () => startSituation(b.dataset.k, "pick"));
  // On first load, leave focus at the top of the page so the header and card come first.
  if (focused) (app.querySelector(focused) || app.querySelector(".cardtitle") || app.querySelector("h1"))?.focus({ preventScroll: true });
  else if (!quiet && !firstRender) (app.querySelector(".cardtitle") || app.querySelector("h1")).focus();
  firstRender = false;
  markNewTabLinks(app);
}

// "I'm not sure which one fits": match the choices to what the person has
// in hand (facts, not advice), or point them to help.
// [kind of case or form, description]
const NOT_SURE = [
  ["eviction", "You got eviction papers, for example a \"Notice of Claim\" from a landlord"],
  ["smallclaims", "You got a \"Notice of Claim\" for another kind of case"],
  ["respond", "You got a \"Complaint\" (it may come with a \"Summons\") and need to respond to it"],
  ["appearance", "You're being sued and only want to give the court your contact information"],
  ["continuance", "You have a court date you can't make"],
  ["feewaiver", "You want to start a case but can't afford the filing fee"],
];
function renderNotSure() {
  app.innerHTML = `
    <h1 tabindex="-1">Which one fits?</h1>
    <p class="help">Look at the papers you have. Pick the description that matches.</p>
    ${NOT_SURE.map(([k, text]) => `<button class="pick" data-go="${k}"><strong>${esc(text)}</strong><span>${esc((CASE_KINDS[k] || SITUATIONS[k]).pick)}</span></button>`).join("")}
    <h2 class="sub">None of these, or still not sure?</h2>
    <ul class="facts">
      <li>${esc(HELP_DESK)} <a href="${LINKS.helpDesk}" target="_blank" rel="noopener">About the Indiana Legal Help Desk</a></li>
      <li>Indiana Legal Help's site lets you find free and low-cost legal help near you by entering your ZIP code or county. <a href="${LINKS.getHelp}" target="_blank" rel="noopener">Find free legal help</a></li>
      <li>Indiana's court staff page says staff can explain and answer questions about how the court works, and give you information from your case file, but cannot give legal advice. <a href="https://www.in.gov/courts/selfservice/unrepresented/help" target="_blank" rel="noopener">How court staff can help</a> · <a href="${LINKS.courtDirectory}" target="_blank" rel="noopener">Indiana court directory</a></li>
      <li>You can look up your case at <a href="https://mycase.in.gov/" target="_blank" rel="noopener">mycase.in.gov</a>.</li>
    </ul>
    <div class="nav"><button class="ghost" id="back">Back</button></div>`;
  app.querySelector("h1").focus();
  app.querySelectorAll("[data-go]").forEach(b => b.onclick = () => {
    const k = b.dataset.go;
    if (Object.hasOwn(CASE_KINDS, k)) { if (sitKey && hasAnswers()) setSortingAside(); triage = { kind: k }; triagePrev = {}; triageHist = []; triageTouched = false; fromNotSure = true; mode = "triage"; return render(); }
    startSituation(k, "notsure");
  });
  document.getElementById("back").onclick = () => { mode = notSureFromKind ? "triage" : "pick"; notSureFromKind = false; render(); };
}

// An explanation with the words the word list defines made into buttons that show the definition (the first time each
// word comes up in that paragraph). The text reads the same, to everyone.
// Only words whose definition fits this form and this person, and never a word that is part of a document's name:
// "Answer instructions" is the name of a guide, not the Answer form.
const DOC_NAME_AFTER = /^\s+(?:instructions|packet)\b/i;
function termify(text, key = sitKey, a = answers) {
  let html = esc(text);
  GLOSSARY.forEach((g, i) => {
    if (!g.fits(key, a)) return;
    const every = new RegExp(g.match.source, g.match.flags.includes("g") ? g.match.flags : `${g.match.flags}g`);
    // The first time the word comes up as a word, not inside a button already made for a longer one.
    const m = [...html.matchAll(every)].find(x => !DOC_NAME_AFTER.test(html.slice(x.index + x[0].length)) && !/<button[^>]*>[^<]*$/.test(html.slice(0, x.index)));
    if (m) html = `${html.slice(0, m.index)}<button type="button" class="term" data-term="${i}" aria-expanded="false" aria-controls="termbox">${m[0]}</button>${html.slice(m.index + m[0].length)}`;
  });
  return html;
}
function wireTerms() {
  const box = document.getElementById("termbox");
  if (!box) return;
  // Closing More closes a definition opened from inside it.
  app.querySelectorAll("details.more").forEach(d => d.addEventListener("toggle", () => {
    const shown = !d.open && d.querySelector('button.term[aria-expanded="true"]');
    if (shown) { shown.setAttribute("aria-expanded", "false"); box.hidden = true; }
  }));
  app.querySelectorAll("button.term").forEach(b => b.onclick = () => {
    const open = b.getAttribute("aria-expanded") === "true";
    app.querySelectorAll("button.term").forEach(x => x.setAttribute("aria-expanded", "false"));
    box.hidden = open;
    if (open) return;
    b.setAttribute("aria-expanded", "true");
    const g = GLOSSARY[+b.dataset.term];
    box.innerHTML = `<p>${termHtml(g, sitKey)}</p>`;
    markNewTabLinks(box);
    // The definition shows after the paragraph, so a screen reader hears it now, without losing its place.
    announce(`${g.term}: ${termDef(g, sitKey).says}`);
  });
}

// A text box doesn't scroll to a selection made from code. This finds where it is, with a hidden copy of the box
// holding the text before it, and scrolls the box to put it in the middle.
function scrollToSelection(el) {
  if (el.tagName !== "TEXTAREA" || el.scrollHeight <= el.clientHeight) return;
  const cs = getComputedStyle(el), copy = document.createElement("div"), at = document.createElement("span");
  for (const k of ["fontFamily", "fontSize", "fontWeight", "fontStyle", "letterSpacing", "wordSpacing", "lineHeight", "textTransform", "textIndent", "tabSize", "wordBreak", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft"]) copy.style[k] = cs[k];
  Object.assign(copy.style, { position: "absolute", visibility: "hidden", left: "-9999px", top: "0", boxSizing: "border-box", width: `${el.clientWidth}px`, border: "0", whiteSpace: "pre-wrap", overflowWrap: "break-word" });
  copy.textContent = el.value.slice(0, el.selectionStart);
  at.textContent = el.value.slice(el.selectionStart, el.selectionEnd) || "\u200b";
  copy.append(at);
  document.body.append(copy);
  const top = at.offsetTop, height = at.offsetHeight;
  copy.remove();
  el.scrollTop = Math.max(0, top - Math.max(0, (el.clientHeight - height) / 2));
}
function renderStep() {
  const vis = visible();
  if (cur >= vis.length) cur = vis.length - 1;
  const step = vis[cur];
  const sit = SITUATIONS[sitKey];
  // Item 21: the bar fills with the needed answers filled in, the same count as the summary's. A blank, "I'm not sure"
  // or an optional question leaves it where it is, and going back doesn't empty it. Which question this is is in words.
  const score = completeness(), pct = score.total ? Math.round((score.filled / score.total) * 100) : 100;
  const v = answers[step.id] ?? "";
  const limit = dateLimit(step, visibleAnswers());
  // The original answer, so Cancel can put it back during an edit from the summary.
  if (returnToSummary && (!editOriginal || editOriginal.id !== step.id))
    { editOriginal = { id: step.id, value: answers[step.id], unsure: !!unsure[step.id], before: vis.map(s => s.id) }; editErased = null; }
  // A reload kept this choice but not what it protects, and Cancel can only put the choice back.
  const goneHere = returnToSummary && reloadedEdit === step.id && answers[step.id] === "yes" && PROTECTS[step.id] && editOriginal?.value !== "yes" ? clearedContact.filter(k => PROTECTS[step.id].includes(k) && empty(answers[k])) : [];
  let input;
  // On the first question, the answer box's description also names the ready list above it.
  const desc = `aria-describedby="qhelp${step.more ? " qmore" : ""}${cur === 0 && !returnToSummary ? " qready" : ""} qneed"`;
  if (step.type === "checks") { // check every one that applies
    const on = String(v).split(",");
    input = `<div class="choices" role="group" aria-labelledby="q" ${desc}>${step.options.map(([val, lab]) =>
      `<label class="choice"><input type="checkbox" name="ans" value="${esc(val)}" ${on.includes(val) ? "checked" : ""}><span>${esc(lab)}</span></label>`).join("")}</div>`;
  } else if (step.type === "choice") {
    input = `<div class="choices" role="radiogroup" aria-labelledby="q" ${desc}>${step.options.map(([val, lab]) =>
      `<label class="choice"><input type="radio" name="ans" value="${esc(val)}" ${v === val ? "checked" : ""}><span>${esc(lab)}</span></label>`).join("")}</div>`;
  } else if (step.type === "select") {
    // Each county has its own value, kept out of page translators, so a translated name ("Lago" for Lake) isn't the answer.
    input = `<select id="ans" aria-labelledby="q" ${desc}><option value="">Choose a county</option>${step.options.map(o => `<option value="${esc(o)}" translate="no" ${v === o ? "selected" : ""}>${esc(o)}</option>`).join("")}</select>`;
  } else if (step.type === "textarea") {
    // Only the person's own mailing address offers the phone's saved address. Not someone else's, and not the
    // Address Confidentiality Program's substitute, which must not be the home address.
    input = `<textarea id="ans" class="${step.short ? "short" : ""}" aria-labelledby="q" ${desc} autocomplete="${step.id === "address" ? "street-address" : "off"}">${esc(v)}</textarea>`;
  } else if (step.type === "money") {
    input = `<div class="money"><span aria-hidden="true">$</span><input id="ans" type="text" inputmode="decimal" aria-labelledby="q" ${desc} value="${esc(v)}" autocomplete="off"></div>`;
  } else if (step.type === "number") {
    input = `<input id="ans" type="text" inputmode="decimal" aria-labelledby="q" ${desc} value="${esc(v)}" autocomplete="off">`;
  } else {
    // The phone's own saved details, for the person's own boxes only: a fax box isn't their phone number.
    const ac = step.id === "fax" ? "off" : { tel: "tel", email: "email" }[step.type] || (step.id === "name" ? "name" : "off");
    // Email is a text box with the email keyboard: an email box rewrites accented domains, and they'd print that way.
    input = `<input id="ans" type="${step.type === "email" ? "text" : step.type}"${step.type === "email" ? ' inputmode="email" autocapitalize="none" autocorrect="off" spellcheck="false"' : ""} aria-labelledby="q" ${desc} value="${esc(v)}" autocomplete="${ac}"${limit ? ` max="${limit.date}"` : ""}>`;
  }
  const need = (step.need || (step.optional ? "Optional." : "Needed for your form. You can skip it for now; it will be flagged at the end."))
    + (limit ? ` It can't be later than your ${limit.name} (${formDate(limit.date)}).` : "")
    + (step.id === "address" && (unsure.acp || unsure.agConfidential) ? " If you're in the Address Confidentiality Program, don't enter your home address here." : "")
    // Before it's typed: in a protection order case, a victim's or witness's contact information is filed differently.
    + (["address", "email", "phone"].includes(step.id) && protectionLetters(answers) ? ` Your case type is ${protectionLetters(answers)}, ${PROTECTION_CASES[protectionLetters(answers)]}. If you're a victim or a witness in it, Access to Court Records Rule 5 keeps this out of the public record, and the summary says how it's filed.` : "");
  // Earlier answers that came back are still shown before they can print (see the Back button below).
  const cameBack = followUps.includes(step.id) && vis.some(s => s.id !== step.id && followUps.includes(s.id) && !empty(answers[s.id]));
  const cancelGoes = cameBack ? "moves on to the next earlier answer" : "goes back to the summary";
  app.innerHTML = `
    <div class="stepgrid">
    <div class="qmain">
    <div class="barrow"><div class="bar" role="progressbar" aria-label="Needed answers filled in" aria-valuenow="${pct}" aria-valuetext="${score.filled} of ${score.total} needed answers filled in" aria-valuemin="0" aria-valuemax="100"><span style="width:${pct}%"></span></div><span class="barcount" aria-hidden="true">${score.filled} of ${score.total} needed answers</span></div>
    ${justMarked ? `<p class="need">Marked the last question "I'm not sure." It will be flagged at the end.</p>` : ""}
    ${barGrew ? `<p class="need" id="barNote">${esc(grewNote(barGrew))}</p>` : ""}
    <div class="barlabel"><span>${esc(sit.sections[step.sec])}</span><span>Question ${cur + 1} of ${vis.length}</span></div>
    <h1 class="q" id="q" tabindex="-1">${esc(typeof step.q === "function" ? step.q(answers) : step.q)}</h1>
    <p class="help" id="qhelp">${termify(step.help || "")}${step.link ? ` <a href="${step.link.href}" target="_blank" rel="noopener">${esc(step.link.text)}</a>.` : ""}</p>
    ${step.more ? moreHtml(`<p class="help">${termify(step.more)}</p>`, "More", `q:${step.id}`, { bodyId: "qmore" }) : ""}
    <div class="termbox" id="termbox" hidden></div>
    ${cur === 0 && !returnToSummary ? readyHtml(sitKey) : ""}
    ${input}
    <p class="need" id="qneed">${esc(need)}</p>
    <p class="err" id="err" role="alert"></p>
    <div class="nav">
      <button class="ghost" id="back">${returnToSummary ? "Cancel" : "Back"}</button>
      <button class="primary" id="next">${returnToSummary ? "Save and review" : "Continue"}</button>
    </div>
    ${returnToSummary ? `<p class="need">${editOriginal?.erased
      ? `The answer you erased before reloading isn't kept. Cancel ${cancelGoes} and leaves this blank.`
      : goneHere.length
      ? `Your ${contactWords(goneHere)} ${goneHere.length > 1 ? "weren't" : "wasn't"} kept when this page reloaded, because this choice keeps ${goneHere.length > 1 ? "them" : "it"} off the device. Cancel puts this answer back, but you'd need to type ${goneHere.length > 1 ? "them" : "it"} again.`
      : followUps.includes(step.id) && !empty(v)
      ? "Your last change stays. Cancel keeps the answer shown here."
      : followUps.includes(step.id)
      ? `Your last change stays. Cancel ${cancelGoes} without answering this question, and the summary will flag it if it's needed.`
      : "Cancel goes back to the summary without changing this answer."}</p>` : ""}
    <button class="ghost unsure" id="unsure" aria-describedby="unsureHelp">I'm not sure</button>
    <p class="need" id="unsureHelp">${unsure[step.id] && empty(v) ? `You marked this "I'm not sure." ${esc(unsureAdvice(step))}${unsureLink(step) ? ` <a href="${unsureLink(step).href}" target="_blank" rel="noopener">${esc(unsureLink(step).text)}</a>.` : ""} ${unsureNext(step, "step")}` : "Not sure? Choose \"I'm not sure\" and it will be flagged at the end."}</p>
    </div>
    <div class="qside">
      <div class="sidecard progress-card">
        <p class="sidecard-title">${icon("doc")}${esc(sit.title)}</p>
        <ol class="rail" aria-label="Sections of this form">${sit.sections.map((name, i) => {
          // Each section jumps to its first question. Not while editing one answer from the summary: that ends with Save or Cancel.
          const here = i === step.sec ? ' aria-current="step"' : "", jump = !returnToSummary && vis.some(s => s.sec === i);
          const inner = `<span class="rail-ic" aria-hidden="true">${icon(SECTION_ICONS[name])}</span><span>${jump ? '<span class="sr-only">Go to </span>' : ""}${esc(name)}</span>`;
          return `<li class="${i < step.sec ? "done" : i === step.sec ? "current" : ""}">${jump ? `<button type="button" class="railbtn" data-sec="${i}"${here}>${inner}</button>` : `<span class="railitem"${here}>${inner}</span>`}</li>`;
        }).join("")}</ol>
      </div>
      <div class="sidecard where-card">
        <p class="sidecard-title">${icon("court")}On the official form</p>
        ${whereHtml(step)}
      </div>
      ${returnToSummary ? "" : `<p class="need"><button class="link" id="changeForm">Choose a different form</button></p>`}
    </div>
    </div>`;
  wireWhere(step);
  wireTerms();
  // E2: focus the chosen answer, not just the first option.
  // Without moving the page: on a small screen, scrolling to the box would hide the question itself.
  // With bigger text, a new question starts just past the header, so the question is what's on screen.
  // Safari scrolls a focused choice into view in the next frame all the same, so the place is set again then.
  // That place is where the page was put last: below, it's moved to a selected part of the answer (BT59).
  const el = app.querySelector("input[name=ans]:checked") || app.querySelector("#ans, input[name=ans]");
  let placed = 0;
  if (el) {
    placed = look.size ? Math.max(0, app.getBoundingClientRect().top + window.scrollY - 8) : 0;
    el.focus({ preventScroll: true }); window.scrollTo(0, placed);
    requestAnimationFrame(() => { if (document.activeElement === el && Math.abs(window.scrollY - placed) > 1) window.scrollTo(0, placed); });
  }
  // Opened from a flag about part of this answer: that part is selected, so it's easy to find and change.
  const hit = selectOnOpen && selectOnOpen.id === step.id && el && el.id === "ans" && typeof el.setSelectionRange === "function" ? selectOnOpen.spans[0] : null;
  selectOnOpen = null;
  if (hit && hit[1] <= el.value.length) {
    el.setSelectionRange(hit[0], hit[1]);
    el.insertAdjacentHTML("afterend", '<p class="need hitnote" id="hitnote">The part the flag is about is selected.</p>');
    // The selected part has to be in sight, or typing would replace text the person can't see: the box is scrolled
    // to it, and on a phone, where the box can start below the screen, the page is moved down until the note under
    // the box shows (never past the box's top).
    scrollToSelection(el);
    const note = document.getElementById("hitnote").getBoundingClientRect();
    if (note.bottom > window.innerHeight) window.scrollBy(0, Math.min(note.bottom - window.innerHeight + 8, el.getBoundingClientRect().top - 8));
    placed = window.scrollY;
    announce("The part the flag is about is selected.");
  }
  document.getElementById("back").onclick = () => {
    if (returnToSummary) {
      // C19: Cancel puts the original answer back.
      if (editOriginal && editOriginal.id === step.id) {
        if (editOriginal.value === undefined) delete answers[step.id]; else answers[step.id] = editOriginal.value;
        if (editOriginal.unsure) unsure[step.id] = true; else delete unsure[step.id];
      }
      // Earlier answers that came back are still shown before they can print.
      const cameBack = followUps.includes(step.id) && visible().find(s => s.id !== step.id && followUps.includes(s.id) && !empty(answers[s.id]));
      if (cameBack) { followUps = followUps.filter(id => id !== step.id); editOriginal = null; cur = visible().indexOf(cameBack); return render(); }
      editOriginal = null; followUps = []; returnToSummary = false; mode = "summary"; return render();
    }
    readInput(step); // keep what was typed
    if (!empty(answers[step.id])) delete unsure[step.id];
    if (cur === 0) {
      if (fromTriage && hasAnswers()) setSortingAside(); // backing through them isn't changing them
      mode = fromTriage ? "triage" : fromNotSure ? "notsure" : "pick"; return render();
    }
    cur--; render();
  };
  // A section tile in the progress panel: keep what was typed (as Back does), then go to that section's first question.
  app.querySelectorAll(".rail [data-sec]").forEach(b => b.onclick = () => {
    readInput(step);
    if (!empty(answers[step.id])) delete unsure[step.id];
    const to = visible().findIndex(s => s.sec === +b.dataset.sec); // after reading the box: a choice can show or hide questions
    if (to < 0) return;
    cur = to; render();
  });
  const other = document.getElementById("changeForm");
  if (other) other.onclick = () => { readInput(step); if (!empty(answers[step.id])) delete unsure[step.id]; chooseOtherForm(); };
  if (barGrew && !justMarked) announce(grewNote(barGrew)); // the bar moved back: say why
  document.getElementById("next").onclick = () => save(step);
  document.getElementById("unsure").onclick = () => markUnsure(step);
  let typedHere = false; // something was typed or chosen on this question since it appeared
  app.querySelectorAll("#ans, input[name=ans]").forEach(i => i.addEventListener(i.type === "radio" || i.type === "checkbox" ? "change" : "input", () => {
    typedHere = true;
    if (i.validity?.badInput) return; // a half-typed date isn't an answer yet
    if (i.type === "checkbox") {
      // "None of these" and the others rule each other out.
      if (i.checked) app.querySelectorAll("input[name=ans]").forEach(o => { if (o !== i && (o.value === "none") !== (i.value === "none")) o.checked = false; });
      draft = { id: step.id, value: [...app.querySelectorAll("input[name=ans]:checked")].map(o => o.value).join(",") };
    } else draft = { id: step.id, value: i.value };
    const wasOk = saveOk; saveProgress(); updatePrivacyNote();
    if (wasOk && !saveOk) announce("Your answers can't be saved on this device right now.");
    if (i.type === "radio") { app.querySelector(".where").outerHTML = whereHtml(step); wireWhere(step); } // this choice can change where things print
  }));
  app.querySelectorAll("input, select").forEach(i => i.addEventListener("keydown", e => {
    if (e.key !== "Enter" || e.repeat || e.isComposing) return;
    e.preventDefault();
    // A second Enter right after the first would land on the question that just appeared and skip it, as a
    // double click would. So an Enter in the first moment of a new question, before anything is typed, is ignored.
    // (A choice already refuses an Enter with nothing chosen.)
    if (step.type !== "choice" && !typedHere && performance.now() - drawnAt < 500) return;
    // Moving on from a choice with nothing selected would skip it by accident.
    if (step.type === "choice" && !app.querySelector("input[name=ans]:checked")) {
      document.getElementById("err").textContent = `Choose one with the arrow keys or Space, or press ${returnToSummary ? "Save and review" : "Continue"} to skip it.`;
      return;
    }
    save(step);
  }));
}

function readInput(step) {
  if (step.type === "checks") { answers[step.id] = [...app.querySelectorAll("input[name=ans]:checked")].map(c => c.value).join(","); return; }
  if (step.type === "choice") {
    const c = app.querySelector("input[name=ans]:checked"); answers[step.id] = c ? c.value : "";
    if (step.id === "caseConfirm") caseConfirmFor = empty(answers.caseConfirm) ? null : caseCourt(answers.caseNumber)?.name ?? null;
    return;
  }
  if (step.type === "date" && document.getElementById("ans").validity?.badInput) return; // half-typed: keep what was there
  keepTyped(step, document.getElementById("ans").value);
}
// A typed answer as it's kept: tidied, and in capitals where the form wants them.
const grewNote = n => `Your last answer added ${n} needed question${n > 1 ? "s" : ""}, so the bar moved back a little.`;
const typedValue = (step, raw) => { const val = cleanText(raw).trim(); return step.upper ? val.toUpperCase() : val; };
function keepTyped(step, raw) {
  const val = typedValue(step, raw);
  // A case number that names another county or court has to be confirmed again.
  if (step.id === "caseNumber" && caseCourt(val)?.name !== caseCourt(answers.caseNumber)?.name) { delete answers.caseConfirm; delete unsure.caseConfirm; caseConfirmFor = null; }
  answers[step.id] = val;
}

// The logo and name go to the first screen from anywhere. As with "Choose a different form", the answers stay, and
// "Go back" (or the browser's Back) returns to them. An edit from the summary is cancelled first, as Cancel would.
document.getElementById("homeBtn").onclick = () => {
  if (mode === "pick") { app.querySelector("h1")?.focus(); return; }
  for (let i = 0; mode === "step" && returnToSummary && i < 20; i++) document.getElementById("back").click();
  if (mode === "step") { const step = visible()[cur]; if (step) { readInput(step); if (!empty(answers[step.id])) delete unsure[step.id]; } }
  chooseOtherForm();
};

// The first screen, in one step from any question: the answers stay until another form is chosen, and Go back returns here.
function chooseOtherForm() {
  if (hasAnswers()) {
    if (fromTriage || mode === "summary") setSortingAside();
    if (mode === "summary") triageFromSummary = true;
    pickedOther = true;
  }
  mode = "pick"; render();
}
window.appParts++;
