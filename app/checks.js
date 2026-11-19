// The score on the summary, and every flag it shows.
// How many of the answers this form needs are in. What isn't is flagged on the summary: as "Missing",
// or for the ones below, which can be left blank, as something to check.
// Real kinds checked in a fee waiver "Which of these" list. "None of these" isn't one.
const kindsChosen = (a, gate) => {
  const keys = (steps.find(s => s.id === gate)?.options || []).map(o => o[0]).filter(k => k !== "none");
  return String(a[gate] ?? "").split(",").some(k => keys.includes(k));
};
function completeness() {
  const a = visibleAnswers(), vis = visible();
  const badNum = s => (s.type === "money" || s.type === "number") && !empty(a[s.id]) && !validNum(s, a[s.id]);
  const isIn = s => !empty(a[s.id]) && !badNum(s) && !notAnAnswer(s, a[s.id]);
  const need = vis.filter(s => !s.optional || s.sworn || badNum(s) || chosenKind(s, a)); // an amount whose kind was checked is needed
  let total = need.length, filled = need.filter(isIn).length;
  if (sitKey === "respond") { // the Answer's three paragraph lists count once: at least one has to have something
    total++;
    if (vis.some(s => PARAGRAPH_IDS.test(s.id) && listsParagraphs(s, a))) filled++;
  }
  if (sitKey === "feewaiver") { // items 6 and 8 of the sworn motion print blank without these. Income and expenses count once each,
    // unless kinds are checked in their list: then each checked kind's amount counts on its own (see need above).
    for (const [ids, gate] of [[EARNED_IDS, "incomeKinds"], [EXPENSE_IDS, "expenseKinds"]]) {
      if (kindsChosen(a, gate)) continue;
      total++;
      if (a[gate] === "none" || anyAmount(a, ids)) filled++;
    }
  }
  return { total, filled };
}

// Paragraph numbers written as words where they stand in a list: "one, 2", "paragraphs two and three", "one through
// four", "one-four", "twenty-one", "first and second", "the first five", "Paragraphs one, two and three are true". Not
// "every one", "one of them" or "One paragraph is wrong".
const UNIT_WORDS = "one two three four five six seven eight nine".split(" "), TENS_WORDS = "twenty thirty forty fifty sixty seventy eighty ninety".split(" ");
const NUMBER_WORDS = {};
UNIT_WORDS.forEach((w, i) => { NUMBER_WORDS[w] = i + 1; });
"ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen".split(" ").forEach((w, i) => { NUMBER_WORDS[w] = i + 10; });
TENS_WORDS.forEach((t, i) => { NUMBER_WORDS[t] = (i + 2) * 10; UNIT_WORDS.forEach((u, j) => { NUMBER_WORDS[`${t} ${u}`] = (i + 2) * 10 + j + 1; }); });
"first second third fourth fifth sixth seventh eighth ninth tenth eleventh twelfth thirteenth fourteenth fifteenth sixteenth seventeenth eighteenth nineteenth twentieth".split(" ").forEach((w, i) => { NUMBER_WORDS[w] = i + 1; });
const NUMBER_WORD = Object.keys(NUMBER_WORDS).sort((x, y) => y.length - x.length).map(w => w.replace(" ", "[-\\s]")).join("|"); // "twenty-one" before "twenty"
const LIST_NUMBER_WORD = new RegExp(`(^|[,;&(/]|[-\u2013](?=\\s*(?:${NUMBER_WORD})\\b)|\\b(?:and|or|through|thru|to|paragraphs?|paras?|nos?\\.?|numbers?)\\b)(\\s*)(${NUMBER_WORD})\\b(?=\\s*(?:$|[,;&).\\/\\-\u2013]|\\b(?:and|or|through|thru|to|are|is|were|was)\\b))`, "gi");
const wordValue = w => NUMBER_WORDS[w.toLowerCase().replace(/[-\s]+/, " ")];
// "the first five" is paragraphs 1 to 5 ("the first five of them" too, but not "the first of them").
const FIRST_N = new RegExp(`\\b(?:the )?first (${NUMBER_WORD}|\\d{1,3})\\b`, "gi");
const numberWordsAsDigits = v => String(v ?? "").replace(FIRST_N, (m, w) => `1-${/^\d/.test(w) ? w : wordValue(w)}`).replace(LIST_NUMBER_WORD, (m, before, gap, w) => `${before}${gap}${wordValue(w)}`);
// The numbers in text like "1, 3-5" or "1 through 3".
function numbersIn(t, out = new Set()) {
  for (const m of t.matchAll(/(\d+)(?:st|nd|rd|th)?(?:\s*(?:[-\u2013\u2014]+|\.{2,}|up to|until|to(?: and including)?|through(?: and including)?|thru)\s*(?:paragraphs?\s*|paras?\s*)?(\d+))?/gi)) {
    if (m[1].length > 6 || (m[2] && m[2].length > 6)) continue; // too long to be a paragraph number
    const from = +m[1], to = m[2] === undefined ? from : +m[2];
    if (to >= from && to <= PARAGRAPH_MAX) for (let i = from; i <= to; i++) out.add(i);
    else { out.add(from); out.add(to); }
  }
  return out;
}
// The paragraph numbers in a list, like "1, 3-5", "1 through 3" or "one, two". Those after "except" are taken out:
// "1-5 except 3" is 1, 2, 4 and 5.
function paragraphNumbers(v) {
  const t = numberWordsAsDigits(v), out = numbersIn(notAmounts(t));
  for (const m of t.matchAll(new RegExp(EXCEPT_PART, "gi"))) for (const n of numbersIn(m[0])) out.delete(n);
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

// "How this tool checks your answers" on the summary: one line per kind of check below, for the forms it applies to,
// with the source that says it matters, or saying it's this tool's own check for typing mistakes. Keep it in step
// with the checks.
const CHECK_SRC = {
  answer: { href: LINKS.answerInstructions, text: "Answer instructions" },
  answerTopic: { href: LINKS.answerTopic, text: "Indiana Legal Help: Answer" },
  cont: { href: LINKS.continuanceInstructions, text: "Continuance instructions" },
  fw: { href: LINKS.feeWaiverInstructions, text: "Fee waiver instructions" },
  // The Appearance itself: its choices for where court papers go.
  appearance: key => ({ href: key === "feewaiver" ? `${LINKS.feeWaiverInstructions}#page=1` : key === "continuance" ? `${LINKS.continuanceInstructions}#page=4` : `${LINKS.answerInstructions}#page=5`, text: "The Appearance" }),
};
const OWN_CHECK = "This tool's own check for typing mistakes.";
const CASE_FORMS_HOW = ["respond", "appearance", "continuance"];
const CHECKS_HOW = [
  { title: "Blank answers", forms: ["respond", "appearance", "continuance", "feewaiver"],
    says: "Every answer the official form needs, and every question marked \"I'm not sure.\" Each flag says what needs it: the form itself or a court rule.",
    src: key => [RULES.tr31, ...(key === "feewaiver" ? [] : [RULES.tr5]), RULES.tr111] },
  { title: "Private information", forms: ["respond", "appearance", "continuance", "feewaiver"],
    says: "Complete Social Security, account and card numbers, PINs and passwords in anything that would print.", src: () => [RULES.acr5] },
  { title: "Case number", forms: CASE_FORMS_HOW,
    says: "That it has the shape of an Indiana case number, that its county number and court letter match your county and court, and that its case type is a civil one Administrative Rule 8 lists. If you said your main paper is a Notice of Claim, also that the case type is small claims (SC) or eviction (EV): the Small Claims Manual says a Notice of Claim starts a small claims case.", src: () => [RULE8] },
  { title: "Case type", forms: ["feewaiver"], says: "That the two-letter case type is one Administrative Rule 8 lists.", src: () => [RULE8] },
  { title: "Kind of case", forms: ["respond"],
    says: "Whether your case type is small claims, eviction or a family case, where Indiana Legal Help says Answers are not usually filed.", src: () => [CHECK_SRC.answerTopic] },
  { title: "Your answer to the Complaint", forms: ["respond"],
    says: "That your lists name paragraph numbers, that no paragraph is in two lists or left out, that a list saying \"all\" isn't next to another list naming paragraphs, and that you've listed your defenses. The Answer instructions say a skipped part is taken as true, and defenses not listed now may be lost.", src: () => [CHECK_SRC.answer] },
  { title: "Your request", forms: ["continuance"],
    says: "That the time you need is days or weeks, not a date, and whether you've said when you spoke to the other party and whether they agreed, and a date for that talk that's in the future (items 4 and 6 of the Verified Motion for Continuance; item 6 says the talk already happened).", src: () => [CHECK_SRC.cont] },
  { title: "Amounts", forms: ["feewaiver"],
    says: "Amounts that aren't numbers, unusually high ones ($100,000 or more, wages of $100 an hour or more, more than 744 hours a month), and income or expenses left out of this sworn form.", src: () => [CHECK_SRC.fw] },
  { title: "Certificate of Service", forms: CASE_FORMS_HOW,
    says: "Who got a copy, how and when; that how you sent it fits the form's printed wording and how you're filing; and a service date before the date you sign.", src: () => [RULES.tr5] },
  { title: "Email", forms: ["respond", "appearance", "continuance", "feewaiver"],
    says: `Whether it looks mistyped, like a misspelled email provider, or couldn't work. It can't tell whether an address works. ${OWN_CHECK}` },
  { title: "Phone and fax", forms: ["respond", "appearance", "continuance", "feewaiver"],
    says: key => `Whether it looks like a full U.S. number with area code.${key === "feewaiver" ? "" : " The official Appearance asks for a 10-digit phone number."} ${OWN_CHECK}` },
  { title: "Addresses", forms: ["respond", "appearance", "continuance", "feewaiver"],
    says: `Whether an address may be missing its house or box number, unit number, city, state or ZIP code, and whether the ZIP code fits the state. It can't know every address. ${OWN_CHECK}` },
  { title: "Dates", forms: ["respond", "appearance", "continuance", "feewaiver"],
    // Only the dates each form asks for: the continuance's court date is its hearing date, and only it has a conversation date.
    says: key => {
      if (key === "feewaiver") return `A date that doesn't look right, and a signing date more than 180 days off, which may be a mistyped year. ${OWN_CHECK}`;
      const court = key === "continuance" ? "hearing date" : "court date", others = key === "continuance" ? "signing, service or conversation date" : "signing or service date";
      return `A date that doesn't look right; a year that looks mistyped (a ${others} more than 180 days off, or a ${court} more than a year off); a ${court} that has passed${key === "continuance" ? "; a conversation date in the future" : ""}; and a ${others} after the ${court}. ${OWN_CHECK}`;
    } },
  { title: "Words that would print", forms: ["respond", "appearance", "continuance", "feewaiver"],
    says: `Words like "I don't know" or "none" typed into a box, "/s/" typed before your name, and an answer longer than a question takes. ${OWN_CHECK}` },
  // The fee waiver doesn't ask where court papers go: it has the Attorney General confidential address box.
  { title: key => (key === "feewaiver" ? "Confidential address" : "Where court papers go"), forms: ["respond", "appearance", "continuance", "feewaiver"],
    says: key => (key === "feewaiver" ? "The Attorney General confidential address checked with no related case listed, and contact details cleared to keep a protected address off this device."
      : "Choices that don't match what's entered: email chosen with no email address, the street address chosen with an address like \"None,\" or the Attorney General confidential address without having used it in another case. Also contact details cleared to keep a protected address off this device."), src: key => [CHECK_SRC.appearance(key)] },
  { title: "The filled form", forms: ["respond", "appearance", "continuance", "feewaiver"],
    says: "Answers too long for their box (printed smaller, cut off, or continued on a page added at the end) and characters the form's font can't print. This tool checks the PDF it made." },
];
const checksHowFor = key => CHECKS_HOW.filter(c => c.forms.includes(key)).map(c => ({ title: typeof c.title === "function" ? c.title(key) : c.title, says: typeof c.says === "function" ? c.says(key) : c.says, src: c.src ? c.src(key) : [] }));
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

// What an email's shape means, in plain words: on the summary, and on the question itself for shapes that can't work.
function emailWhy(e) {
  if (!e.kind) return "";
  return { typo: `The end of this email, ${e.domain}, may be a typo for ${e.target}. If it's right, you can leave it.`,
    noemail: sitKey === "feewaiver" ? "If you don't have an email address, leave this blank." : "If you don't have an email address, type None.",
    spelled: "Write this with an @ sign and a dot, like name@example.com.",
    noat: "This is missing the @ sign. A full email looks like name@example.com.",
    nolocal: "This is missing the part before the @. A full email looks like name@example.com.",
    nodomain: "This is missing the part after the @. A full email looks like name@example.com.",
    noend: "This seems to be missing the end of the address, like .com.",
    two: "This looks like more than one email address. The form has room for one.",
    ats: "This has more than one @ sign. Check it for typos.",
    space: "This has a space in it. Email addresses don't, and the form needs just the address.",
    comma: "This has a comma where a dot usually goes. Check it for typos.",
    extra: "This has an extra character at the end. Check it for typos.",
    odd: "This has a character email addresses don't usually have. Check it for typos.",
    accent: "This has an accented or special letter before the @. Check it for typos.",
    dots: "This has a dot in the wrong place, like two in a row or one at the end. Check it for typos.",
    long: "This is too long to be one email address. Check it for typos.",
    hyphen: "A part of the address after the @ starts or ends with a hyphen, which email addresses can't. Check it for typos.",
    locallong: "The part before the @ is longer than an email address allows. Check it for typos." }[e.kind] || "This email looks incomplete. Check it for typos.";
}
// Shapes no working email address has. These are stopped when Continue is pressed, because the court would send papers nowhere.
// A likely typo, an accented letter or an unusual character can still be right, so those are only flagged at the end.
const EMAIL_CANT_WORK = new Set(["noat", "spelled", "nolocal", "nodomain", "noend", "dots", "ats", "two", "space", "comma", "extra", "long", "hyphen", "locallong"]);

function runChecks() {
  const a = visibleAnswers();
  const vis = visible();
  const flags = [];
  const has = id => vis.some(s => s.id === id);
  const handled = new Set();

  // These print on a public form, so they come first.
  // Amount boxes too: a 9-digit "amount" may be a Social Security number, and it would print on a sworn form.
  vis.filter(s => s.type === "text" || s.type === "textarea" || s.type === "tel" || s.type === "email" || s.type === "money").forEach(s => {
    const v = String(a[s.id] ?? "");
    if (s.type === "money" && !validNum(s, v)) return; // an amount that can't print has its own flag below
    // A phone or fax box only gets the number-shape checks. In a case number box, real case numbers are set aside first.
    // A good or foreign phone number isn't an account number, however long.
    const kindOf = v => s.type === "tel" ? (["", "foreign"].includes(phoneShape(v)) ? null : privateKind(v, true))
      : CASE_NUMBER_BOXES.test(s.id) ? privateKind(v.replace(CASE_TOKEN, t => (isCaseToken(t) ? " " : t)), false)
      : privateKind(v, /address/i.test(s.id));
    const kind = kindOf(v);
    // hit: the part of the answer it's about (see privateSpans), selected when the person fixes it.
    if (kind) flags.push({ level: "check", title: `Private information: ${s.label}`, fix: s.id, link: RULES.acr5, hit: privateSpans(v, kindOf, CASE_NUMBER_BOXES.test(s.id) ? caseTokens(v) : []),
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
  if (has("email") && !empty(a.email) && !says("email") && !SAYS_NONE.test(a.email.trim())) {
    const e = emailShape(a.email);
    // It prints as typed. This tool can't tell whether an address works, only whether it looks mistyped.
    const why = emailWhy(e);
    const papers = a.receiveAt === "Choice2" || a.acceptEmail === "yes" ? " You chose to get court papers at this address, so a typo could mean you miss them." : "";
    // A private number has its own flag above. A typo in the domain still needs saying, unless saying it would repeat that number.
    // On the fee waiver, words like "no email" leave the box blank, as its instructions say, so there's nothing to fix.
    if (why && !(sitKey === "feewaiver" && e.kind === "noemail") && !(privateKind(a.email) && (e.kind !== "typo" || privateKind(e.domain)))) flags.push({ level: "check", title: "Email", why: `${why}${e.kind === "noemail" ? "" : papers}`, fix: "email" });
  }
  // Sent through the e-filing system, a service address can be an email. (By mail, it gets the address check's flag instead.)
  vis.filter(s => /^svc\dAddress$/.test(s.id) && a[s.id.replace("Address", "Method")] === "Indiana E-Filing System" && !empty(a[s.id])).forEach(s => {
    const emails = String(a[s.id]).trim().split(/\s+/).filter(x => x.includes("@") && x.length <= 254).map(x => x.replace(/^[<(\[,;]+|[>)\],;.]+$/g, ""));
    const e = emails.length === 1 ? emailShape(emails[0]) : {};
    if (e.kind === "typo" && !privateKind(e.domain)) flags.push({ level: "check", title: `Certificate of Service: ${s.label}`, why: `The end of this email, ${e.domain}, may be a typo for ${e.target}. If it's right, you can leave it.`, fix: s.id });
    else if (EMAIL_CANT_WORK.has(e.kind) && !privateKind(emails[0])) flags.push({ level: "check", title: `Certificate of Service: ${s.label}`, fix: s.id,
      why: `${emailWhy(e)} You chose to send this copy through the E-Filing System, which sends it to an email address.` });
  });
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
  // "/s/" is the e-filing signature this tool adds itself. Typed into the name, it prints in every name box.
  if (has("name") && /^\s*\/s\//i.test(a.name || ""))
    flags.push({ level: "check", title: vis.find(s => s.id === "name").label, fix: "name",
      why: "Your name starts with \"/s/\", and it prints that way wherever your name goes on the form. Type your name without it: if you e-file, this tool puts \"/s/\" before your name on the signature lines." });
  // Answers like "no" or "none" in fill-in boxes would print on the form. Not "None" for a fax number: the official
  // Appearance says one isn't required if you don't have one, and "None" says so plainly.
  vis.filter(s => s.noWords && saysNoAnswer(a[s.id]) && !(s.id === "fax" && SAYS_NONE.test(String(a[s.id]).trim()))).forEach(s =>
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
    flags.push({ level: s.optional && !s.sworn && !chosenKind(s, a) ? "check" : "missing", title: s.service ? `Certificate of Service: ${s.label}` : s.label, fix: s.id,
      why: s.id === "courtTypeOther" && /^court[.!]*$/i.test(String(a[s.id]).trim()) ? "The form already prints the word COURT, so this leaves the court type blank. Type the kind of court, like Probate."
        : `You typed "${String(a[s.id]).trim()}". That will print on the form. If you don't know yet, clear it and choose "I'm not sure" so it's flagged here instead.${s.id === "email" && NO_WORDS.test(String(a[s.id]).trim()) && !NOT_KNOWN.test(String(a[s.id]).trim()) ? ` If you don't have one, ${sitKey === "feewaiver" ? "leave this blank" : "type None"}.` : ""}` });
  });
  // Longer than a question takes: refused on Continue, but it can stay by leaving the question another way.
  vis.filter(s => String(a[s.id] ?? "").length > ANSWER_MAX).forEach(s =>
    flags.push({ level: "check", title: s.service ? `Certificate of Service: ${s.label}` : s.label, fix: s.id,
      why: `This answer is ${String(a[s.id]).length.toLocaleString("en-US")} characters, more than the ${ANSWER_MAX.toLocaleString("en-US")} a question takes. Shorten it.` }));
  // Amounts that aren't numbers can't go on the form.
  vis.filter(s => (s.type === "money" || s.type === "number") && !empty(a[s.id]) && !validNum(s, a[s.id])).forEach(s => {
    handled.add(s.id);
    flags.push({ level: "missing", title: s.label, fix: s.id, why: tooBig(a[s.id]) ? "This is too large to be right for this form, so it's left blank. Check the number, including the decimal point."
      : "This isn't a number we can put on the form. Use numbers only, like 1200 or 12.50." });
  });

  // The three lists count once in the score: at least one has to have something.
  if (sitKey === "respond" && !vis.some(s => PARAGRAPH_IDS.test(s.id) && listsParagraphs(s, a)))
    flags.push({ level: "missing", title: "Your answer", why: "You haven't listed any paragraph numbers. Indiana Legal Help's instructions say that if you skip a part of the Complaint, the court will take it as true.", fix: "admitted" });

  // A real list next to one that names no paragraphs: what was typed still prints.
  if (sitKey === "respond" && vis.some(s => PARAGRAPH_IDS.test(s.id) && listsParagraphs(s, a)))
    vis.filter(s => PARAGRAPH_IDS.test(s.id) && !empty(a[s.id]) && !saysNoList(a[s.id]) && !namesParagraphs(a[s.id])).forEach(s =>
      flags.push({ level: "check", title: s.label, why: "This list doesn't seem to name any paragraph numbers, and what you typed will print on the form. Check that it says what you mean.", fix: s.id }));

  // While the privacy check flags one of the lists, these wait: its digits may be a Social Security or account number,
  // and these flags name paragraph numbers.
  if (sitKey === "respond" && !flags.some(f => f.link === RULES.acr5 && ["admitted", "denied", "notEnough"].includes(f.fix))) {
    const lists = ["admitted", "denied", "notEnough"].map(k => [k, paragraphNumbers(a[k])]);
    const twice = [...new Set(lists.flatMap(([, n]) => [...n]))].filter(n => lists.filter(([, l]) => l.has(n)).length > 1).sort((x, y) => x - y);
    if (twice.length) flags.push({ level: "check", title: "Paragraphs listed in more than one list", fix: lists.find(([, l]) => twice.some(n => l.has(n)))[0],
      why: `${twice.length > 1 ? `Paragraphs ${twice.slice(0, -1).join(", ")} and ${twice[twice.length - 1]} are` : `Paragraph ${twice[0]} is`} in more than one of your lists. The form warns that you won't be able to challenge the paragraphs you admit later. Check which list each one belongs in.` });

    // A list that says "all" (with no "except" or "the rest") next to another list that names a paragraph: the two can't
    // both be right. What the list says is quoted only when it's nothing but such words, so nothing private is repeated.
    const allList = lists.find(([k]) => saysAll(a[k]));
    const inRange = n => [...n].filter(x => x >= 1 && x <= PARAGRAPH_MAX).sort((x, y) => x - y);
    const named = allList && lists.find(([k, n]) => k !== allList[0] && inRange(n).length);
    if (named) {
      const which = k => vis.find(s => s.id === k).label.replace(/^Paragraphs/, "paragraphs"), nums = inRange(named[1]);
      flags.push({ level: "check", title: "Your lists say different things", fix: allList[0], link: { href: LINKS.answerInstructions, text: "Read the Answer instructions" },
        why: `Your list of ${which(allList[0])} ${onlyListWords(notAmounts(a[allList[0]])) ? `says "${String(a[allList[0]]).trim()}"` : "seems to say all of them"}, but your list of ${which(named[0])} names ${nums.length > 1 ? `paragraphs ${rangesText(nums)}` : `paragraph ${nums[0]}`}. A paragraph can only be in one list. If you mean all the others, you could write "all except ${rangesText(nums)}".` });
    }

    // A number skipped between the ones listed. "The rest" covers it, and a number this big isn't a paragraph.
    const listed = new Set(lists.flatMap(([, n]) => [...n]).filter(n => n >= 1 && n <= PARAGRAPH_MAX));
    const skipped = [];
    for (let i = 1, top = Math.max(0, ...listed); i < top; i++) if (!listed.has(i)) skipped.push(i);
    if (skipped.length && !lists.some(([k]) => unsure[k] || onlyListWords(notAmounts(numberWordsAsDigits(a[k]))) || saysAll(a[k])))
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
  vis.filter(s => isDay(a[s.id]) && ((/^(?:signDate|spokeDate|svc\dDate)$/.test(s.id) && Math.abs(daysOff(a[s.id])) > 180) || ((s.id === "hearingDate" || s.id === "courtDate") && daysOff(a[s.id]) > FAR_HEARING_DAYS))).forEach(s =>
    flags.push({ level: "check", title: s.service ? `Certificate of Service: ${s.label}` : s.label, fix: s.id, why: `${formDate(a[s.id])} is more than ${s.id === "hearingDate" || s.id === "courtDate" ? "a year" : "180 days"} from today. Check the year.` }));
  if (isDay(a.spokeDate) && has("spokeDate") && daysOff(a.spokeDate) > 0 && daysOff(a.spokeDate) <= 180)
    flags.push({ level: "check", title: "Date you spoke to the other party", fix: "spokeDate", why: `${formDate(a.spokeDate)} is in the future, but item 6 of this sworn form says this conversation already happened. Check the date.` });

  // The Appearance's certificate is pre-printed "I certify that I mailed a copy".
  if (a.receiveAt === "Choice2" && (empty(a.email) || NO_WORDS.test(a.email.trim())))
    flags.push({ level: "check", title: "Where you want court papers", why: "You chose to receive court papers at your email address, but no email address is entered.", fix: "receiveAt" });
  // It quotes the address, unless the privacy check flags it: then only the word it starts with, since no flag repeats
  // what that check found.
  if (a.receiveAt === "Choice1" && a.acp !== "yes" && startsNo(a.address)) {
    const typed = String(a.address).trim();
    flags.push({ level: "check", title: "Where you want court papers", fix: "receiveAt",
      why: `You chose to receive court papers at your street address, but ${privateKind(typed, true) ? `your address starts with "${typed.match(/^\S+?(?=[\s,.;:!]|$)/)[0]}"` : `you typed "${typed}" as your address`}.` });
  }
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
    vis.filter(s => s.type === "money" && s.id !== "hourlyRate" && validNum(s, a[s.id]) && toNum(a[s.id]) >= 100000).forEach(s =>
      flags.push({ level: "check", title: s.label, fix: s.id, why: `$${money(toNum(a[s.id]))} is unusually high for this sworn form. Check the number, including the decimal point.` }));
    if (toNum(a.hourlyRate) >= 100)
      flags.push({ level: "check", title: "Wages per hour", fix: "hourlyRate", why: `$${money(toNum(a.hourlyRate))} an hour is unusually high, and it goes on this sworn form. Check this number, including the decimal point.` });
    // With kinds checked in the list, each checked kind with no amount has its own flag instead.
    if (!anyAmount(a, EARNED_IDS) && a.incomeKinds !== "none" && !kindsChosen(a, "incomeKinds"))
      flags.push({ level: "missing", title: "Income", why: "No income is entered for you or the people you support, so item 6 and Total Income stay blank on this sworn form. If there is none, choose \"None of these\" in the list of kinds of income, so the form shows $0.00.", fix: "incomeKinds" });
    if (!anyAmount(a, EXPENSE_IDS) && a.expenseKinds !== "none" && !kindsChosen(a, "expenseKinds"))
      flags.push({ level: "missing", title: "Expenses", why: "No expenses are entered, so item 8 and Total Expenses stay blank on this sworn form. If there are none, choose \"None of these\" in the list of expenses, so the form shows $0.00.", fix: "expenseKinds" });
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

  // The Certificate of Service says a copy was sent on its date, so a date before the form is signed is worth a look.
  if (isDay(a.signDate)) vis.filter(s => /^svc\dDate$/.test(s.id) && isDay(a[s.id]) && a[s.id] < a.signDate).forEach(s =>
    flags.push({ level: "check", title: `Certificate of Service: ${s.label}`, fix: s.id,
      why: `${formDate(a[s.id])} is before the date you'll sign the form (${formDate(a.signDate)}). The certificate says a copy was sent on this date. Check both dates.` }));

  // A court date that has passed can't be the next one.
  vis.filter(s => (s.id === "courtDate" || s.id === "hearingDate") && hasPassed(a[s.id])).forEach(s =>
    flags.push({ level: "check", title: s.label, why: `${formDate(a[s.id])} has already passed. Check it against your papers, or look it up at mycase.in.gov.`, fix: s.id }));

  // Questions the person marked "I'm not sure" and hasn't answered since.
  // A required one is still missing from the form, so it's flagged that way.
  vis.filter(s => unsure[s.id] && empty(a[s.id])).forEach(s => {
    handled.add(s.id);
    flags.push({ level: s.optional && !s.sworn && !chosenKind(s, a) ? "check" : "missing", title: s.service ? `Certificate of Service: ${s.label}` : s.label, fix: s.id, unsure: true, link: blankWhy(s).link || unsureLink(s),
      // A question the form needs keeps the reason it matters, and the rule that gives it. A question that protects an address says what it isn't protecting yet.
      why: `You marked this "I'm not sure." ${!s.optional && blankWhy(s).why !== "This is blank." ? `${blankWhy(s).why} ` : ""}${printingAnyway(s, a)}${unsureAdvice(s)} ${unsureNext(s, "summary")}`.trim() });
  });

  // Everything else that is required but blank.
  // An amount whose kind was checked in a "Which of these" list is needed too: left blank, a sworn total leaves it out.
  vis.forEach(s => {
    if (handled.has(s.id) || (s.optional && !chosenKind(s, a))) return;
    if (empty(a[s.id])) flags.push({ level: "missing", title: s.label, fix: s.id, blank: true, ...(s.optional
      ? { why: s.id === "hourlyRate" ? "You said your household gets wages, but no hourly wage is entered, so wages aren't counted in Total Income on this sworn form. Enter the hourly wage, or uncheck Wages from work in the list of kinds of income."
        : s.kind[0] === "incomeKinds" ? "You said your household gets this, but no amount is entered, so it isn't counted in Total Income on this sworn form. Enter the monthly amount, or uncheck it in the list of kinds of income."
        : "You said your household pays this, but no amount is entered, so it isn't counted in Total Expenses on this sworn form. Enter the monthly amount, or uncheck it in the list of expenses." }
      : blankWhy(s)) });
  });
  const unsureIds = new Set(flags.filter(f => f.unsure).map(f => f.fix));
  return flags.filter(f => f.unsure || !(f.blank && unsureIds.has(f.fix)));
}
window.appParts++;
