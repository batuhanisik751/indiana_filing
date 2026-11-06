// The score on the summary, and every flag it shows.
// How many of the answers this form needs are in. What isn't is flagged on the summary: as "Missing",
// or for the ones below, which can be left blank, as something to check.
function completeness() {
  const a = visibleAnswers(), vis = visible();
  const badNum = s => (s.type === "money" || s.type === "number") && !empty(a[s.id]) && !validNum(s, a[s.id]);
  const isIn = s => !empty(a[s.id]) && !badNum(s) && !notAnAnswer(s, a[s.id]);
  const need = vis.filter(s => !s.optional || s.sworn || badNum(s));
  let total = need.length, filled = need.filter(isIn).length;
  if (sitKey === "respond") { // the Answer's three paragraph lists count once: at least one has to have something
    total++;
    if (vis.some(s => PARAGRAPH_IDS.test(s.id) && listsParagraphs(s, a))) filled++;
  }
  if (sitKey === "feewaiver") { // items 6 and 8 of the sworn motion print blank without these. Income and expenses count once each
    total += 2;
    filled += [EARNED_IDS, EXPENSE_IDS].filter(ids => anyAmount(a, ids)).length;
  }
  return { total, filled };
}

// The paragraph numbers in a list, like "1, 3-5" or "1 through 3".
function paragraphNumbers(v) {
  const out = new Set();
  for (const m of notAmounts(v).matchAll(/(\d+)(?:st|nd|rd|th)?(?:\s*(?:[-\u2013\u2014]+|\.{2,}|up to|until|to(?: and including)?|through(?: and including)?|thru)\s*(?:paragraphs?\s*|paras?\s*)?(\d+))?/gi)) {
    if (m[1].length > 6 || (m[2] && m[2].length > 6)) continue; // too long to be a paragraph number
    const from = +m[1], to = m[2] === undefined ? from : +m[2];
    if (to >= from && to <= PARAGRAPH_MAX) for (let i = from; i <= to; i++) out.add(i);
    else { out.add(from); out.add(to); }
  }
  return out;
}

// "3, 5 through 9 and 12", from sorted numbers.
function rangesText(ns) {
  const parts = [];
  for (let i = 0, j; i < ns.length; i = j + 1) {
    j = i;
    while (ns[j + 1] === ns[j] + 1) j++;
    if (j - i > 1) parts.push(`${ns[i]} through ${ns[j]}`); else parts.push(...ns.slice(i, j + 1));
  }
  return parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}` : parts[0];
}

// Why each required answer matters, from the rule or the official form. [reason, rule to link]
const RULES = {
  tr31: { href: "https://rules.incourts.gov/Content/trial/rule3-1/current.htm", text: "Read Trial Rule 3.1" },
  tr5: { href: "https://rules.incourts.gov/Content/trial/rule5/current.htm", text: "Read Trial Rule 5" },
  tr111: { href: "https://rules.incourts.gov/Content/trial/rule11-1/current.htm", text: "Read Trial Rule 11.1" },
  acr5: { href: "https://rules.incourts.gov/Content/records/rule5/current.htm", text: "Read Access to Court Records Rule 5" },
};
const T111 = "Trial Rule 11.1 says to provide a \"mailing address, telephone number, and email address, if available.\"";
const CAPTION_WHY = ["The official form says to fill out its top section to match the other court forms in your case."];
const RELATED_WHY = ["Trial Rule 3.1 says the Appearance must list the caption and case number of all related cases.", "tr31"];
const T31_ITEMS = /^(name|address|acpAddress|email|phone|caseTypeLetters|acceptEmail|receiveAt|related|relatedNumbers|rel\dCaption|rel\dNumber|localRule|localRuleText)$/; // what Trial Rule 3.1(A) lists
const LOCAL_WHY = ["Trial Rule 3.1 says the Appearance must include any other matters a state or local rule requires to maintain the court's information system.", "tr31"];
const BLANK_WHY = {
  county: CAPTION_WHY, courtType: CAPTION_WHY, courtTypeOther: CAPTION_WHY, caseNumber: CAPTION_WHY, plaintiff: CAPTION_WHY,
  caseTypeLetters: ["The Appearance asks for the two letters that show your case type, and Trial Rule 3.1 says it must give the case type.", "tr31"],
  name: ["Trial Rule 3.1 says the Appearance must give your name.", "tr31"],
  acp: ["This decides which address prints on the form. Trial Rule 11.1 lets an address be withheld or replaced by a public mailing address when the rules allow it.", "tr111"],
  address: [`${T111} If you don't have one, type None.`, "tr111"],
  acpAddress: ["Trial Rule 11.1 lets a public mailing address replace yours when the rules allow it. This address prints instead of your home address.", "tr111"],
  email: ["The official form says an email address is required, and Trial Rule 11.1 says to give one if available. If you don't have one, type None.", "tr111"],
  phone: [`The official form says a phone number is required, and ${T111} If you don't have one, type None.`, "tr111"],
  receiveAt: ["The Appearance asks you to choose one, and Trial Rule 3.1 says the clerk uses the Appearance to send you court papers.", "tr31"],
  related: ["Trial Rule 3.1 says the Appearance must list all related cases.", "tr31"],
  relatedNumbers: ["Trial Rule 3.1 says the Appearance must give the case number of all related cases.", "tr31"],
  relCaption: RELATED_WHY, relNumber: RELATED_WHY,
  localRule: LOCAL_WHY, localRuleText: LOCAL_WHY,
  svcName: ["Trial Rule 5 says the Certificate of Service must list the parties served.", "tr5"],
  svcAddress: ["The Certificate of Service on the official form has a column for the address."],
  svcMethod: ["Trial Rule 5 says the Certificate of Service must give the means of service.", "tr5"],
  svcDate: ["Trial Rule 5 says the Certificate of Service must give the date of service.", "tr5"],
  svcMore: ["Trial Rule 5 says each party generally must be served, and the Certificate of Service lists them.", "tr5"],
  fileMethod: ["This decides whether your signature prints as \"/s/\" or is left for you to sign by hand. Trial Rule 11.1 says you must sign what you file, and a court may strike a filing that doesn't follow the rule.", "tr111"],
  signDate: ["The official form prints this date next to your signature."],
  fwCourtType: ["The top of the official form names the court where you're filing. If you don't know, the official instructions say to leave it blank, so choose \"I don't know.\""],
  agConfidential: ["The form treats this address as an alternative to your address, email, phone and fax, so this decides which ones print."],
  acceptEmail: ["Trial Rule 3.1 says the Appearance must state whether you will accept court papers by email.", "tr31"],
  monthlyHours: ["The Verified Motion for Fee Waiver works out wages as dollars per hour times hours per month."],
  otherIncomeDesc: ["The Verified Motion for Fee Waiver says to describe other income."],
  bank: ["The Verified Motion for Fee Waiver asks how much you have in the bank."],
  otherCostsDesc: ["The Verified Motion for Fee Waiver says to describe other expenses."],
  role: ["This decides which side of the official form's top section your name prints on. Until you answer, the names there and the addresses in the Order's distribution list stay blank."],
  otherParty: ["Item 5 of the Verified Motion for Continuance asks for the other party's name."],
  hearingDate: ["Item 2 of the Verified Motion for Continuance asks when your hearing is scheduled."],
  reason: ["Item 3 of the Verified Motion for Continuance asks why. Indiana Legal Help's instructions say you need to show a good reason, and the court decides."],
  timeNeeded: ["Item 4 of the Verified Motion for Continuance asks how many days or weeks you need."],
};
const RULE8 = { href: "https://rules.incourts.gov/Content/admin/rule8/current.htm", text: "Read Administrative Rule 8" };
function printingAnyway(s, a) {
  const typed = (PROTECTS[s.id] || []).filter(k => !empty(a[k]));
  return typed.length ? `Your ${contactWords(typed)} will print on the form. If you need ${typed.length > 1 ? "them" : "it"} kept confidential, clear ${typed.length > 1 ? "them" : "it"}. ` : "";
}
function blankWhy(s) {
  // Someone in the Address Confidentiality Program: the rule's exception is the part that may apply to them.
  const exception = answers.acp === "yes" && (s.id === "phone" || s.id === "email") ? ' The rule makes an exception where this is "protected from public access" or may be "withheld or replaced by a public mailing address."' : "";
  if (sitKey === "feewaiver" && s.id === "county") return { why: "The top of the official form names the county where you're filing." };
  if (sitKey === "feewaiver" && s.id === "phone") return { why: `${T111} If you don't have one, type None.${exception}`, link: RULES.tr111 }; // this form doesn't call it required
  const [why, rule] = BLANK_WHY[s.id.replace(/^(svc|rel)\d/, "$1").replace(/^svcMore\d$/, "svcMore")] || ["This is blank."];
  return rule ? { why: why + exception, link: RULES[rule] } : { why };
}

function runChecks() {
  const a = visibleAnswers();
  const vis = visible();
  const flags = [];
  const has = id => vis.some(s => s.id === id);
  const handled = new Set();

  // These print on a public form, so they come first.
  vis.filter(s => s.type === "text" || s.type === "textarea" || s.type === "tel" || s.type === "email").forEach(s => {
    const v = String(a[s.id] ?? "");
    // A phone or fax box only gets the number-shape checks. In a case number box, real case numbers are set aside first.
    // A good or foreign phone number isn't an account number, however long.
    const kind = s.type === "tel" ? (["", "foreign"].includes(phoneShape(v)) ? null : privateKind(v, true))
      : CASE_NUMBER_BOXES.test(s.id) ? privateKind(v.replace(/\b[0-9A-Z]{2,}(?:-[0-9A-Z]+){2,}\b/gi, t => (/[A-Z]/i.test(t) && !/(?:^|-)\d{3}-\d{2}-\d{4}$/.test(t) ? " " : t)), false)
      : privateKind(v, /address/i.test(s.id));
    if (kind) flags.push({ level: "check", title: `Private information: ${s.label}`, fix: s.id, link: RULES.acr5,
      why: `${PRIVATE_WHAT[kind]} It will print on the form until you remove it. Access to Court Records Rule 5 says to take these out of court papers unless the case needs them. If yours does, the rule requires filing it on green paper (or as a confidential document if e-filed), plus a copy that leaves it out and an ACR Form.` });
  });

  if (has("caseNumber")) {
    handled.add("caseNumber");
    if (empty(a.caseNumber)) { if (!vis.find(s => s.id === "caseNumber").optional) flags.push({ level: "missing", title: "Case number", ...blankWhy({ id: "caseNumber" }), fix: "caseNumber", blank: true }); }
    else {
      const m = caseMatch(a.caseNumber);
      if (!m && !notAnAnswer(vis.find(s => s.id === "caseNumber"), a.caseNumber)) flags.push({ level: "check", title: "Case number", why: "It doesn't look like an Indiana case number (for example 49D01-2610-CC-001234). Compare it with your papers.", fix: "caseNumber" });
      else if (m && a.county && m[1] !== countyCode(a.county))
        flags.push({ level: "check", title: "Case number", why: `The first two digits (${m[1]}) don't match ${a.county} County's number (${countyCode(a.county)}). One of them may be wrong.`, fix: "caseNumber" });
      // Administrative Rule 8: the letter after the county number is the court. Others, like K or H, aren't one of these two choices.
      const courtLetter = m ? a.caseNumber.trim().toUpperCase()[2] : "", letterSays = { C: "Circuit", D: "Superior" }[courtLetter];
      if (letterSays && ["SUPERIOR", "CIRCUIT"].includes(a.courtType) && letterSays.toUpperCase() !== a.courtType)
        flags.push({ level: "check", title: "Case number", fix: "caseNumber", link: RULE8,
          why: `Administrative Rule 8 says the "${courtLetter}" in your case number means ${letterSays} Court, but you chose ${a.courtType === "CIRCUIT" ? "Circuit" : "Superior"} Court. One of them may be wrong. Compare them with your papers.` });
    }
    const letters = caseLetters(a), lettersFix = caseMatch(a.caseNumber) ? "caseNumber" : "caseTypeLetters";
    if (NOT_CIVIL_CASES.has(letters))
      flags.push({ level: "check", title: "Case type letters", fix: lettersFix, link: RULE8, why: `This tool's forms are for civil cases, but Administrative Rule 8 lists ${letters} as a criminal, infraction or ordinance case type. Compare it with your papers. You can ask free legal help what you need.` });
    if (/^[A-Z][A-Z0-9]$/.test(letters) && !CASE_CODES.has(letters))
      flags.push({ level: "check", title: "Case type letters", fix: lettersFix, link: RULE8, why: `${letters} isn't one of the case type codes in Administrative Rule 8. Compare it with your papers.` });
    if (fromTriage && paperOf(triage) === "notice" && CASE_CODES.has(letters) && !["SC", "EV"].includes(letters))
      flags.push({ level: "check", title: "Case type letters", why: `You said your main paper is a Notice of Claim, which the Small Claims Manual says starts a small claims case, but the case type letters are ${letters}. Compare them with your papers.`, fix: lettersFix });
    if (sitKey === "respond" && letters === "SC")
      flags.push({ level: "check", title: "Small claims case", why: "Your case type is SC, which means small claims. Indiana Legal Help says Answers are not usually filed in small claims court. You can ask free legal help whether you need one.", fix: lettersFix, link: { href: LINKS.getHelp, text: "Find free legal help" } });
    if (sitKey === "respond" && letters === "EV")
      flags.push({ level: "check", title: "Eviction case", why: "Your case type is EV, which means eviction. If your case is in small claims court, Indiana Legal Help says Answers are not usually filed there. You can ask free legal help whether you need one.", fix: lettersFix, link: { href: LINKS.getHelp, text: "Find free legal help" } });
    if (sitKey === "respond" && FAMILY_CASES[letters])
      flags.push({ level: "check", title: "Family case", why: `Your case type is ${letters} (${FAMILY_CASES[letters]}). Indiana Legal Help says Answers are not usually filed in small claims court or family court. You can ask free legal help whether you need one.`, fix: lettersFix, link: { href: LINKS.getHelp, text: "Find free legal help" } });
  }

  // "None" is how someone with no email or phone answers on the forms that require them.
  const says = id => { const s = vis.find(x => x.id === id); return s ? notAnAnswer(s, a[id]) : false; }; // flagged below instead
  if (has("email") && !empty(a.email) && !says("email") && !SAYS_NONE.test(a.email.trim()) && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(a.email.trim()))
    flags.push({ level: "check", title: "Email", why: "This email looks incomplete. Check it for typos.", fix: "email" });
  // Phone and fax: only the shape. This tool can't tell whether a number works. A private number has its own flag above.
  [["phone", "phone", "Phone number"], ["fax", "fax", "Fax number"]].forEach(([id, word, title]) => {
    const v = String(a[id] ?? "").trim();
    if (!has(id) || !v || saysNoAnswer(v) || SAYS_NONE.test(v) || NO_NUMBER.test(v) || (privateKind(v, true) && !["", "foreign"].includes(phoneShape(v)))) return;
    const kind = phoneShape(v);
    // The Appearance forms ask for 10 digits. The fee waiver's form doesn't say, and neither does a fax box.
    const asks = id === "phone" && sitKey !== "feewaiver" ? "The official form asks for a 10-digit phone number, including the area code." : "";
    const why = { impossible: `This has 10 digits, but it doesn't look like a real U.S. ${word} number. Check it for typos.`,
      foreign: `This looks like a number outside the U.S. ${asks || "Check it for typos."}`,
      letters: `This has letters in it. Write the number in digits, including the area code.`,
      long: asks || `This has more digits than one ${word} number. Check it for typos.`,
      short: asks || `This doesn't look like a full ${word} number with area code. Check it for typos.` }[kind];
    if (why) flags.push({ level: "check", title, why, fix: id });
  });
  // Addresses that look incomplete. Only a flag: this tool can't know every address.
  // (Sent through the e-filing system, a person's address box may hold something else.)
  vis.filter(s => /^(?:address|acpAddress|otherPartyAddress|svc\dAddress)$/.test(s.id) && !empty(a[s.id]) && !notAnAnswer(s, a[s.id]) && !(s.noWords && saysNoAnswer(a[s.id])) && a[s.id.replace("Address", "Method")] !== "Indiana E-Filing System").forEach(s => {
    // "No fixed address" can be right for someone's own address. For someone else's, it's what's unknown so far.
    if ((s.service || s.noWords) && startsNo(a[s.id])) return flags.push({ level: "check", title: s.service ? `Certificate of Service: ${s.label}` : s.label, fix: s.id,
      why: "This says there's no address, and that will print on the form. If you don't have the address yet, clear it and choose \"I'm not sure\" so it's flagged here instead." });
    const { missing, note } = addressGaps(a[s.id]);
    if (!missing.length && !note) return;
    const list = missing.length > 1 ? `${missing.slice(0, -1).join(", ")} and ${missing[missing.length - 1]}` : missing[0];
    flags.push({ level: "check", title: s.service ? `Certificate of Service: ${s.label}` : s.label, fix: s.id,
      why: `${missing.length ? `This address may be missing the ${list}. A full address looks like 123 Main St, Indianapolis, IN 46204.` : ""}${missing.length && note ? " " : ""}${note}` });
  });
  // Answers like "no" or "none" in fill-in boxes would print on the form.
  vis.filter(s => s.noWords && saysNoAnswer(a[s.id])).forEach(s =>
    flags.push({ level: "check", title: s.label, why: `You typed "${String(a[s.id]).trim()}". That will print on the form. Leave it blank instead if there's nothing to add.`, fix: s.id }));
  // The continuance instructions leave the court and the case number to staff, but not these letters.
  if (sitKey === "continuance" && has("caseTypeLetters") && empty(a.caseTypeLetters))
    flags.push({ level: "check", title: "Case type letters", fix: "caseTypeLetters", blank: true, link: { href: LINKS.continuanceInstructions, text: "Read the continuance instructions" },
      why: "Item 5 of the Appearance asks for the two letters in your case number that show the case type, and it will print empty. Indiana Legal Help's continuance instructions say court staff will complete the court information and your case number, but don't mention this item. The letters are on your court papers or at mycase.in.gov." });
  // The case type is two letters, like CC or SC.
  if (has("caseTypeLetters") && !empty(a.caseTypeLetters) && !NO_WORDS.test(a.caseTypeLetters.trim()) && !/^[A-Z][A-Z0-9]$/i.test(a.caseTypeLetters.trim()))
    flags.push({ level: "check", title: "Case type letters", why: "The form asks for the two letters that show the case type, like CC or SC. Check this against your case number.", fix: "caseTypeLetters" });
  // "I'm not sure" typed into a box would print on the form. The button is what flags it instead.
  vis.filter(s => notAnAnswer(s, a[s.id])).forEach(s => {
    handled.add(s.id);
    flags.push({ level: s.optional && !s.sworn ? "check" : "missing", title: s.service ? `Certificate of Service: ${s.label}` : s.label, fix: s.id,
      why: s.id === "courtTypeOther" && /^court[.!]*$/i.test(String(a[s.id]).trim()) ? "The form already prints the word COURT, so this leaves the court type blank. Type the kind of court, like Probate."
        : `You typed "${String(a[s.id]).trim()}". That will print on the form. If you don't know yet, clear it and choose "I'm not sure" so it's flagged here instead.` });
  });
  // Amounts that aren't numbers can't go on the form.
  vis.filter(s => (s.type === "money" || s.type === "number") && !empty(a[s.id]) && !validNum(s, a[s.id])).forEach(s => {
    handled.add(s.id);
    flags.push({ level: "missing", title: s.label, why: "This isn't a number we can put on the form. Use numbers only, like 1200 or 12.50.", fix: s.id });
  });

  // The three lists count once in the score: at least one has to have something.
  if (sitKey === "respond" && !vis.some(s => PARAGRAPH_IDS.test(s.id) && listsParagraphs(s, a)))
    flags.push({ level: "missing", title: "Your answer", why: "You haven't listed any paragraph numbers. Indiana Legal Help's instructions say that if you skip a part of the Complaint, the court will take it as true.", fix: "admitted" });

  // A real list next to one that names no paragraphs: what was typed still prints.
  if (sitKey === "respond" && vis.some(s => PARAGRAPH_IDS.test(s.id) && listsParagraphs(s, a)))
    vis.filter(s => PARAGRAPH_IDS.test(s.id) && !empty(a[s.id]) && !saysNoList(a[s.id]) && !namesParagraphs(a[s.id])).forEach(s =>
      flags.push({ level: "check", title: s.label, why: "This list doesn't seem to name any paragraph numbers, and what you typed will print on the form. Check that it says what you mean.", fix: s.id }));

  if (sitKey === "respond") {
    const lists = ["admitted", "denied", "notEnough"].map(k => [k, paragraphNumbers(a[k])]);
    const twice = [...new Set(lists.flatMap(([, n]) => [...n]))].filter(n => lists.filter(([, l]) => l.has(n)).length > 1).sort((x, y) => x - y);
    if (twice.length) flags.push({ level: "check", title: "Paragraphs listed in more than one list", fix: lists.find(([, l]) => twice.some(n => l.has(n)))[0],
      why: `${twice.length > 1 ? `Paragraphs ${twice.slice(0, -1).join(", ")} and ${twice[twice.length - 1]} are` : `Paragraph ${twice[0]} is`} in more than one of your lists. The form warns that you won't be able to challenge the paragraphs you admit later. Check which list each one belongs in.` });

    // A number skipped between the ones listed. "The rest" covers it, and a number this big isn't a paragraph.
    const listed = new Set(lists.flatMap(([, n]) => [...n]).filter(n => n >= 1 && n <= PARAGRAPH_MAX));
    const skipped = [];
    for (let i = 1, top = Math.max(0, ...listed); i < top; i++) if (!listed.has(i)) skipped.push(i);
    if (skipped.length && !lists.some(([k]) => unsure[k] || onlyListWords(notAmounts(a[k]))))
      flags.push({ level: "check", title: "Paragraphs not in any list", fix: "admitted", link: { href: LINKS.answerInstructions, text: "Read the Answer instructions" },
        why: `${skipped.length > 1 ? `Paragraphs ${rangesText(skipped)} aren't` : `Paragraph ${skipped[0]} isn't`} in any of your lists. Indiana Legal Help's instructions say that if you skip a part of the Complaint, the court will take it as true. This tool can't see your Complaint, so check these numbers against it.` });
  }

  if (sitKey === "respond" && empty(a.defenses) && !unsure.defenses)
    flags.push({ level: "check", title: "Your defenses", fix: "defenses", link: { href: LINKS.answerInstructions, text: "Read the Answer instructions" },
      why: "Indiana Legal Help's Answer instructions say you must list your defenses in this initial Answer, and that if you do not list them now, you may lose your right to use them later in the case. This tool can't tell you which ones apply. You can ask free legal help about that. Typing None clears this flag, and None prints on the form." });

  // Contact details erased to protect an address. Some of them can be left blank, so nothing else would mention them.
  const goneNow = clearedContact.filter(k => has(k) && empty(a[k]));
  if (goneNow.length) flags.push({ level: "check", title: "Contact details cleared", fix: goneNow[0],
    why: `Your ${contactWords(goneNow)} ${goneNow.length > 1 ? "were" : "was"} cleared to keep a protected address off this device. If you still want ${goneNow.length > 1 ? "them" : "it"} on the form, type ${goneNow.length > 1 ? "them" : "it"} again.` });

  if (has("fwCaseType") && !empty(a.fwCaseType) && !saysNoAnswer(a.fwCaseType) && !CASE_CODES.has(a.fwCaseType.trim().toUpperCase()))
    flags.push({ level: "check", title: "Case type", fix: "fwCaseType", link: RULE8, why: "The form asks for the two-letter case type from Administrative Rule 8, like PL or CT. If you don't know it, the official instructions say to leave it blank." });

  // A date this far off is usually a mistyped year. It prints as typed. A hearing that has passed has its own flag.
  const daysOff = v => (new Date(`${v}T12:00:00`) - new Date(`${todayDay()}T12:00:00`)) / 864e5;
  vis.filter(s => isDay(a[s.id]) && ((/^(?:signDate|spokeDate|svc\dDate)$/.test(s.id) && Math.abs(daysOff(a[s.id])) > 180) || (s.id === "hearingDate" && daysOff(a[s.id]) > 180))).forEach(s =>
    flags.push({ level: "check", title: s.service ? `Certificate of Service: ${s.label}` : s.label, fix: s.id, why: `${formDate(a[s.id])} is more than 180 days from today. Check the year.` }));
  if (isDay(a.spokeDate) && has("spokeDate") && daysOff(a.spokeDate) > 0 && daysOff(a.spokeDate) <= 180)
    flags.push({ level: "check", title: "Date you spoke to the other party", fix: "spokeDate", why: `${formDate(a.spokeDate)} is in the future, but item 6 of this sworn form says this conversation already happened. Check the date.` });

  // The Appearance's certificate is pre-printed "I certify that I mailed a copy".
  if (a.receiveAt === "Choice2" && (empty(a.email) || NO_WORDS.test(a.email.trim())))
    flags.push({ level: "check", title: "Where you want court papers", why: "You chose to receive court papers at your email address, but no email address is entered.", fix: "receiveAt" });
  if (a.receiveAt === "Choice1" && a.acp !== "yes" && startsNo(a.address))
    flags.push({ level: "check", title: "Where you want court papers", why: `You chose to receive court papers at your street address, but you typed "${String(a.address).trim()}" as your address.`, fix: "receiveAt" });
  if (a.receiveAt === "Choice3" && a.acp !== "yes")
    flags.push({ level: "check", title: "Where you want court papers", why: "You chose the Attorney General confidential address. The form says this option is only available if you have used this address in another court case.", fix: "receiveAt" });

  const notMail = (sitKey === "respond" || sitKey === "appearance") && vis.find(s => /^svc\dMethod$/.test(s.id) && a[s.id] && a[s.id] !== "First Class U.S. mail");
  // Filing at the courthouse, but sending the copy through the e-filing system.
  const eService = a.fileMethod === "paper" && vis.find(s => /^svc\dMethod$/.test(s.id) && a[s.id] === "Indiana E-Filing System");
  if (eService)
    flags.push({ level: "check", title: `Certificate of Service: ${eService.label}`, why: "You chose to file on paper at the courthouse, but you listed Indiana's E-Filing System as the way you sent a copy. Check which one you mean.", fix: eService.id });
  if (notMail)
    flags.push({ level: "check", title: "Certificate of Service wording", why: "The Appearance's Certificate of Service is printed as \"I certify that I mailed a copy.\" You chose another way to send a copy. Read that wording before you sign.", fix: notMail.id });

  if (sitKey === "continuance") {
    if (has("timeNeeded") && looksLikeDate(a.timeNeeded))
      flags.push({ level: "check", title: "How much more time you're asking for", why: "This looks like a date. The form says to write the number of days or weeks you need, not a specific date.", fix: "timeNeeded" });
    // Both options on this sworn form say a conversation happened, so leaving it blank isn't called Missing.
    if (has("otherAgreed") && empty(a.otherAgreed))
      flags.push({ level: "check", title: "Did the other party agree", why: "The Verified Motion for Continuance asks you to select whether the other party agreed. It will be blank. If you haven't spoken to them, you can ask free legal help what to do.", fix: "otherAgreed", blank: true, link: { href: LINKS.getHelp, text: "Find free legal help" } });
    if (has("spokeDate") && empty(a.spokeDate))
      flags.push({ level: "check", title: "Date you spoke to the other party", why: "Item 6 on the form asks when you spoke to the other party about this continuance. It will be blank. If you haven't spoken to them, you can ask free legal help what to do.", fix: "spokeDate", blank: true, link: { href: LINKS.getHelp, text: "Find free legal help" } });
  }

  if (sitKey === "feewaiver") {
    if (a.agConfidential === "yes" && a.related === "no")
      flags.push({ level: "check", title: "Attorney General confidential address", why: "The form says you may check this box if, in a related case, you have used the Attorney General confidential address, but you answered that there are no related cases. With this box checked, your Appearance has no address, email, phone or fax.", fix: "agConfidential" });
    // E19: a related case number with no caption.
    [2, 3].forEach(i => { // case 1's caption is required, so a blank one is already flagged
      if (a.related === "yes" && empty(a[`rel${i}Caption`]) && !empty(a[`rel${i}Number`]))
        flags.push({ level: "check", title: `Related case ${i} caption`, why: `You gave a case number for related case ${i} but no caption (case name), so the number prints next to a blank line.`, fix: `rel${i}Caption` });
    });
    if (has("monthlyHours") && toNum(a.monthlyHours) > 744)
      flags.push({ level: "check", title: "Hours worked per month", fix: "monthlyHours", why: "A month has at most 744 hours, and this number goes into the wages on this sworn form. Check it." });
    if (toNum(a.hourlyRate) >= 200)
      flags.push({ level: "check", title: "Wages per hour", fix: "hourlyRate", why: `$${money(toNum(a.hourlyRate))} an hour is unusually high, and it goes on this sworn form. Check this number, including the decimal point.` });
    if (!anyAmount(a, EARNED_IDS))
      flags.push({ level: "missing", title: "Income", why: "No income is entered for you or the people you support, so item 6 and Total Income stay blank on this sworn form. If there is none, enter 0 for any one of them so the form shows $0.00.", fix: "hourlyRate" });
    if (!anyAmount(a, EXPENSE_IDS))
      flags.push({ level: "missing", title: "Expenses", why: "No expenses are entered, so item 8 and Total Expenses stay blank on this sworn form. If there are none, enter 0 for any one of them so the form shows $0.00.", fix: "housing" });
    [["adults", "People over 18 who live with you", "Item 3 of the Verified Motion for Fee Waiver asks who you live with who is over 18."],
     ["children", "People under 18 who live with you", "Item 4 of the Verified Motion for Fee Waiver asks who you live with who is under 18."],
     ["supported", "People you financially support", "Item 5 of the Verified Motion for Fee Waiver asks who you financially support in your household."]].forEach(([k, label, why]) => {
      if (has(k) && empty(a[k])) flags.push({ level: "missing", title: label, why: `${why} If there's no one, type None.`, fix: k, blank: true });
    });
  }

  // Certificate of service: name, address, method and date for each person.
  vis.filter(s => s.service && !(unsure[s.id] && empty(a[s.id]))).forEach(s => {
    handled.add(s.id);
    if (empty(a[s.id])) flags.push({ level: "missing", title: `Certificate of Service: ${s.label}`, ...blankWhy(s), fix: s.id, blank: true });
  });

  // The question refuses a date past the hearing, but the hearing date can change afterward.
  vis.forEach(s => {
    const limit = dateLimit(s, a);
    const title = s.service ? `Certificate of Service: ${s.label}` : s.label;
    if (s.type === "date" && !empty(a[s.id]) && !isDay(a[s.id])) flags.push({ level: "check", title, why: "This date doesn't look right. Check the year.", fix: s.id });
    else if (pastLimit(a[s.id], limit)) flags.push({ level: "check", title,
      why: `${formDate(a[s.id])} is after your ${limit.name} (${formDate(limit.date)}). Change whichever one is wrong.`, fix: s.id });
  });

  // A court date that has passed can't be the next one.
  vis.filter(s => (s.id === "courtDate" || s.id === "hearingDate") && hasPassed(a[s.id])).forEach(s =>
    flags.push({ level: "check", title: s.label, why: `${formDate(a[s.id])} has already passed. Check it against your papers, or look it up at mycase.in.gov.`, fix: s.id }));

  // Questions the person marked "I'm not sure" and hasn't answered since.
  // A required one is still missing from the form, so it's flagged that way.
  vis.filter(s => unsure[s.id] && empty(a[s.id])).forEach(s => {
    handled.add(s.id);
    flags.push({ level: s.optional && !s.sworn ? "check" : "missing", title: s.service ? `Certificate of Service: ${s.label}` : s.label, fix: s.id, unsure: true, link: blankWhy(s).link || unsureLink(s),
      // A question the form needs keeps the reason it matters, and the rule that gives it. A question that protects an address says what it isn't protecting yet.
      why: `You marked this "I'm not sure." ${!s.optional && blankWhy(s).why !== "This is blank." ? `${blankWhy(s).why} ` : ""}${printingAnyway(s, a)}${unsureAdvice(s)} ${unsureNext(s, "summary")}`.trim() });
  });

  // Everything else that is required but blank.
  vis.forEach(s => {
    if (handled.has(s.id) || s.optional) return;
    if (empty(a[s.id])) flags.push({ level: "missing", title: s.label, ...blankWhy(s), fix: s.id, blank: true });
  });
  const unsureIds = new Set(flags.filter(f => f.unsure).map(f => f.fix));
  return flags.filter(f => f.unsure || !(f.blank && unsureIds.has(f.fix)));
}
window.appParts++;
