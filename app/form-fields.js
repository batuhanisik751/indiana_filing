// Where the Appearance, Answer and fee waiver answers land on their PDFs.
/* =====================================================================
   FIELD MAP: answers -> spots on the official PDFs.
   label/value/step drive the summary. `pdf` lists what goes on the PDF:
     text:  { t: "text", name, value }       fill a text field
     radio: { t: "radio", name, option }     select a radio button
     check: { t: "check", name, on }          tick a checkbox
     drop:  { t: "drop", name, option }       select a dropdown option
     lines: { t: "lines", page, x0, x1, ys }  write on the form's printed ruled lines
     draw:  { t: "draw", page, x, y }         write where the form has no field
   Page numbers are 0-based pages of the original PDF. For "lines", ys are
   the bottoms of the printed rules; text sits just above each rule. The
   Address, paragraph-list and Defenses boxes on the Answer packet are real
   fields, but their boxes don't line up with the printed rules, so the
   text is written on the rules and those fields are flattened empty.
   For "draw", y is the text baseline.
   ===================================================================== */
// The form prints "IN THE ___ COUNTY ___ COURT", so drop a trailing "Court".
const courtTypeText = a => a.courtType === "other"
  ? String(a.courtTypeOther || "").replace(/\s*court\s*$/i, "").trim()
  : (a.courtType || "");
const caseLetters = a => { const m = caseMatch(a.caseNumber); return m ? m[2] : String(a.caseTypeLetters || "").toUpperCase(); };
const f = (form, label, value, step, pdf = []) => ({ form, label, value: value ?? "", step, pdf });
const yesNo = v => v === "yes" ? "Yes" : v === "no" ? "No" : "";
// The address that may go on a form: the program's substitute address for participants, never their home address.
const myAddress = a => (a.acp === "yes" ? a.acpAddress : a.address);
const myAddressStep = a => (a.acp === "yes" ? "acpAddress" : "address");

function captionFields(a) {
  const ct = courtTypeText(a);
  return [
    f(FORM.caption, "County", a.county, "county", [{ t: "text", name: "County", value: a.county }]),
    f(FORM.caption, "Court type", !ct ? "" : a.courtType === "other" ? `${ct} Court` : `${ct.charAt(0)}${ct.slice(1).toLowerCase()} Court`,
      a.courtType === "other" ? "courtTypeOther" : "courtType", courtTypeOps(ct, ANSWER_COURT_RULES)),
    f(FORM.caption, "Case number", a.caseNumber, "caseNumber", [{ t: "text", name: "Case Number", value: a.caseNumber }]),
    f(FORM.caption, "Plaintiff", a.plaintiff, "plaintiff", [{ t: "text", name: "Plaintiff", value: a.plaintiff, growUp: true }]),
    f(FORM.caption, "Defendant (you)", a.name, "name", [{ t: "text", name: "Defendant", value: a.name, growUp: "vLine" }]),
  ];
}

function appearanceFields(a) {
  const receive = { Choice1: "At my street address", Choice2: "At my email address", Choice3: "At the Attorney General confidential address" }[a.receiveAt] || "";
  return [
    f(FORM.appearance, "1. My name is", a.name, "name"),
    f(FORM.appearance, "3. My address", myAddress(a), myAddressStep(a),
      [{ t: "lines", page: 4, x0: 72, x1: 540, ys: [447.5, 425.5], runOn: true, value: myAddress(a) }]),
    f(FORM.appearance, "Email address", a.email, "email", [{ t: "text", name: "Email Address", value: a.email, oneLine: true }]),
    f(FORM.appearance, "Phone number", a.phone, "phone", [{ t: "text", name: "Phone Number", value: a.phone }]),
    f(FORM.appearance, "Fax number", empty(a.fax) ? "Left blank" : a.fax, "fax", [{ t: "text", name: "Fax Number", value: a.fax }]),
    f(FORM.appearance, "4. Receive court papers", receive, "receiveAt",
      a.receiveAt ? [{ t: "radio", name: "Case Information", option: a.receiveAt }] : []),
    f(FORM.appearance, "5. Case type letters", caseLetters(a), caseMatch(a.caseNumber) ? "caseNumber" : "caseTypeLetters",
      [{ t: "text", name: "Case Type Letters", value: caseLetters(a) }]),
    f(FORM.appearance, "6. Related cases", a.related === "yes" ? "Yes" : a.related === "no" ? "No other related cases" : "", "related",
      a.related ? [{ t: "radio", name: "Related Cases", option: a.related === "yes" ? "Choice1" : "Choice2" }] : []),
    // Written above the printed rule: these two boxes run below it, so a second line would be struck through.
    ...(a.related === "yes" ? [f(FORM.appearance, "6. Related case numbers", a.relatedNumbers, "relatedNumbers",
      [{ t: "lines", page: 5, x0: 107.6, x1: 539.7, ys: [720], layouts: ABOVE_RULE_LAYOUTS, spacesOnly: "commas", value: a.relatedNumbers }])] : []),
    f(FORM.appearance, "7. Local rule information", a.localRule === "yes" ? "Provided below" : a.localRule === "none" ? "Not aware of any" : "", "localRule",
      a.localRule ? [{ t: "radio", name: "Local Rules", option: a.localRule === "yes" ? "Choice2" : "Choice1" }] : []),
    ...(a.localRule === "yes" ? [f(FORM.appearance, "7. Information required by local rule", a.localRuleText, "localRuleText",
      [{ t: "lines", page: 5, x0: 107.6, x1: 539.7, ys: [610], layouts: ABOVE_RULE_LAYOUTS, value: a.localRuleText }])] : []),
    f(FORM.appearance, "Date next to your signature", formDate(a.signDate), "signDate",
      [{ t: "draw", page: 5, x: 461, y: 547, value: formDate(a.signDate) }]),
  ];
}

function answerFields(a) {
  const DEFENSE_LINES = [646.6, 631.4, 616.6, 601.4, 586.6, 571.4, 556.6, 541.4, 526.6, 511.4];
  return [
    f(FORM.answer, "1. My name is", a.name, "name"),
    f(FORM.answer, "3. Paragraphs I admit", empty(a.admitted) ? "Left blank" : a.admitted, "admitted",
      [{ t: "lines", page: 6, x0: 90, x1: 540, ys: [376.1, 346.8], value: a.admitted, continues: "Item 3 (paragraphs admitted)" }]),
    f(FORM.answer, "4. Paragraphs I deny", empty(a.denied) ? "Left blank" : a.denied, "denied",
      [{ t: "lines", page: 6, x0: 90, x1: 540, ys: [207.6, 185.8], value: a.denied, continues: "Item 4 (paragraphs denied)" }]),
    f(FORM.answer, "5. Paragraphs I can't admit or deny", empty(a.notEnough) ? "Left blank" : a.notEnough, "notEnough",
      [{ t: "lines", page: 7, x0: 90, x1: 540, ys: [756.7, 734.6], value: a.notEnough, continues: "Item 5 (paragraphs I can't admit or deny)" }]),
    f(FORM.answer, "6. My defenses", empty(a.defenses) ? "Left blank" : a.defenses, "defenses",
      [{ t: "lines", page: 7, x0: 90, x1: 540, ys: DEFENSE_LINES, value: a.defenses, continues: "Item 6 (defenses)" }]),
  ];
}

function serviceFields(a, withAnswer) {
  const out = [];
  const n = recipientCount(a);
  for (let i = 1; i <= n; i++) {
    // The PDF's field names have two typos we must match exactly:
    // "Service Name  2" (two spaces, Appearance page) and "Servcice Type 4" (Answer page).
    const nameFields = i === 2 ? ["Service Name  2", "Service Name 2"] : [`Service Name ${i}`];
    const typeFields = i === 4 ? ["Service Type 4", "Servcice Type 4"] : [`Service Type ${i}`];
    const label = n > 1 ? ` (person ${i})` : "";
    out.push(
      // The official "Service Name 2" is centered and "Servcice Type 4" is one line, unlike their rows.
      f(FORM.service, `Sent to${label}`, a[`svc${i}Name`], `svc${i}Name`, nameFields.map(name => ({ t: "text", name, value: a[`svc${i}Name`], align: "Left" }))),
      f(FORM.service, `Address${label}`, a[`svc${i}Address`], `svc${i}Address`, [{ t: "text", name: `Service Address ${i}`, value: a[`svc${i}Address`], maxSize: 10 }]),
      f(FORM.service, `Type of service used${label}`, a[`svc${i}Method`], `svc${i}Method`, typeFields.map(name => ({ t: "text", name, value: a[`svc${i}Method`], maxSize: 10, multiline: true }))),
      f(FORM.service, `Date of service${label}`, formDate(a[`svc${i}Date`]), `svc${i}Date`, [{ t: "text", name: `Service Date ${i}`, value: formDate(a[`svc${i}Date`]), maxSize: 10 }]),
    );
    if (i < MAX_RECIPIENTS) out.push(f(FORM.service, `Anyone else to send a copy to (after person ${i})`, yesNo(a[`svcMore${i}`]), `svcMore${i}`));
  }
  const dates = [{ t: "draw", page: 5, x: 111, y: 148.5, value: formDate(a.signDate) }];
  if (withAnswer) dates.push({ t: "draw", page: 7, x: 111, y: 134.5, value: formDate(a.signDate) });
  out.push(f(FORM.service, "Date next to your signature", formDate(a.signDate), "signDate", dates));
  return out;
}

// "/s/ Name" on every signature line of the pages this situation uses, when e-filing.
function signatureFields(a, key) {
  const { packet, docs } = SITUATIONS[key].official;
  const pages = new Set(docs.flatMap(d => OFFICIAL[packet].docs[d].pages));
  const lines = OFFICIAL[packet].signatures.filter(s => pages.has(s.page));
  const efile = a.fileMethod === "efile";
  // Characters the font can't print are already flagged on your name, so not again here.
  return [{ ...f(FORM.sign, `Signature${lines.length > 1 ? ` (${lines.length} lines)` : ""}`,
    efile ? (empty(a.name) ? "" : `/s/ ${a.name}`) : a.fileMethod === "paper" ? "Left blank. Sign by hand after you print." : "",
    "fileMethod", efile && !empty(a.name) ? lines.map(s => ({ t: "lines", page: s.page, x0: s.x - 2, x1: s.x + s.w + 2, ys: [s.y - 2.5], layouts: SIGN_LAYOUTS, value: `/s/ ${a.name}` })) : []), quietChars: true }];
}

// To the cent, half a cent up, so the total matches adding up the printed lines.
const wages = a => Math.round(Math.round(toNum(a.hourlyRate) * 100) * toNum(a.monthlyHours)) / 100;
const incomeTotal = a => wages(a) + INCOME.reduce((s, [k]) => s + toNum(a[k]), 0);
const expenseTotal = a => EXPENSES.reduce((s, [k]) => s + toNum(a[k]), 0);
const INCOME_IDS = ["hourlyRate", "monthlyHours", ...INCOME.map(x => x[0])], EXPENSE_IDS = EXPENSES.map(x => x[0]);
const EARNED_IDS = ["hourlyRate", ...INCOME.map(x => x[0])];
const anyAmount = (a, ids) => ids.some(k => !empty(a[k]) && AMOUNT_RE.test(cleanNum(a[k])));
// A sworn total can't be worked out while part of it is marked "I'm not sure", so it stays blank on the form.
const anyMarked = (a, ids) => ids.some(k => Object.hasOwn(a, k) && unsure[k] && empty(a[k]));
// Nothing entered isn't the same as swearing to $0.00, so that stays blank too (noneText says so). A typed 0 prints.
const totalRow = (form, label, total, ids, a, names, noneText, waiting = "", waitingOn = null) => {
  const marked = anyMarked(a, ids), none = noneText && !ids.some(k => Object.hasOwn(a, k) && !empty(a[k]));
  const open = marked || none || !!waiting;
  const firstMarked = marked ? ids.find(k => Object.hasOwn(a, k) && unsure[k] && empty(a[k])) : null;
  return { from: ids, ...f(form, label, marked ? "Left blank until you answer the questions marked \"I'm not sure\"" : waiting || (none ? noneText : `$${money(total)}`), firstMarked || (waiting ? waitingOn : ids[0]),
    names.map(name => ({ t: "text", name, value: open ? "" : money(total) }))) };
};
const amountRow = (form, label, k, a, name) =>
  f(form, label, isNum(a[k]) ? `$${moneyOrBlank(a[k])}` : "Left blank", k, [{ t: "text", name, value: moneyOrBlank(a[k]) }]);

// The printed rules under the fee waiver Appearance's three related-case captions:
// one line on the rule, or two lines (the first just above it) for a long caption.
// A name too long for its one-line caption box is written on the box's printed rule instead,
// in one or two smaller lines (the box itself is left blank).
const NAME_LAYOUTS = [{ n: 1, sizes: [11, 10.5, 10, 9.5, 9, 8.5, 8, 7.5] }, { n: 2, sizes: [7.5, 7, 6.5, 6] }, { n: 1, sizes: [7, 6.5, 6] }];
// Where the printed "v." sits right above the line, two lines are used only if the top
// line stays below the "v." (op.maxTop); otherwise one smaller line.
const NAME_V_LINE = [{ n: 1, sizes: [11, 10.5, 10, 9.5, 9, 8.5, 8, 7.5] }, { n: 2, sizes: [7, 6.5, 6] }, { n: 1, sizes: [7, 6.5, 6, 5.5, 5] }];
const ABOVE_RULE_LAYOUTS = [{ n: 1, sizes: [11, 10.5, 10, 9.5, 9, 8.5, 8, 7.5] }, { n: 2, sizes: [8, 7.5, 7, 6.5, 6] }, { n: 3, sizes: [6] }];
const SIGN_LAYOUTS = [{ n: 1, sizes: [11, 10.5, 10, 9.5, 9, 8.5, 8, 7.5] }, { n: 2, sizes: [7, 6.5, 6] }, { n: 1, sizes: [7, 6.5, 6] }];
const CAPTION_LAYOUTS = [{ n: 1, sizes: [11, 10.5, 10, 9.5, 9] }, { n: 2, sizes: [11, 10.5, 10, 9.5, 9, 8.5, 8] }];
const CAPTION_RULES = {
  1: { page: 0, x0: 180, x1: 358, ys: [98.2], layouts: CAPTION_LAYOUTS },
  2: { page: 1, x0: 181, x1: 359, ys: [693.5], layouts: CAPTION_LAYOUTS },
  3: { page: 1, x0: 180, x1: 358, ys: [665.95], layouts: CAPTION_LAYOUTS },
};
function feeWaiverFields(a) {
  const ct = a.fwCourtType && a.fwCourtType !== "unknown" ? a.fwCourtType : "";
  const relName = i => i === 1 ? ["Caption", "Case No"] : [`Caption_${i}`, `Case No_${i}`];
  const out = [
    f(FORM.caption, "County", a.county, "county", [{ t: "text", name: "County", value: a.county }]),
    f(FORM.caption, "Court type", ct ? `${ct.charAt(0)}${ct.slice(1).toLowerCase()} Court` : (a.fwCourtType === "unknown" ? "Left blank" : ""), "fwCourtType",
      [{ t: "drop", name: "CourtType", option: ct || "___________________" }]),
    f(FORM.caption, "Cause No.", "Left blank (the instructions say LEAVE BLANK)", null),
    f(FORM.caption, "Petitioner (you)", a.name, "name", [{ t: "text", name: "Name", value: a.name, growUp: "all" }, { t: "text", name: "Petitioner", value: a.name, growUp: true }]),
    f(FORM.caption, "Respondent", empty(a.otherPerson) ? "Left blank" : a.otherPerson, "otherPerson", [{ t: "text", name: "Respondent", value: a.otherPerson, growUp: true }]),
    f(FORM.fwAppearance, "1. My name is", a.name, "name"),
    f(FORM.fwAppearance, "2. Address", a.agConfidential === "yes" ? "Left blank (Attorney General confidential address checked)" : myAddress(a),
      a.agConfidential === "yes" ? "agConfidential" : myAddressStep(a),
      a.agConfidential === "yes" ? [] : [
        // Written on the four printed address lines (the field's box doesn't line up with them).
        { t: "lines", page: 0, x0: 180, x1: 396, ys: [403.3, 389.5, 375.7, 361.9], runOn: true, value: myAddress(a) },
        // The same field repeats on the Order's distribution list, which has three lines under the name.
        // The Order's three lines are shorter, so the address runs on from line to line there.
        { t: "lines", page: 4, x0: 72, x1: 275, ys: [184.1, 170.6, 157.2], runOn: true, value: myAddress(a) }]),
    ...(a.agConfidential === "yes"
      ? [f(FORM.fwAppearance, "Email, phone and fax", "Left blank (Attorney General confidential address checked)", "agConfidential")]
      : [
        f(FORM.fwAppearance, "Email address", empty(a.email) ? "Left blank" : a.email, "email", [{ t: "text", name: "Email address", value: a.email }]),
        f(FORM.fwAppearance, "I will accept service at the above email address", hasEmail(a) ? yesNo(a.acceptEmail) : "No (no email given)", hasEmail(a) ? "acceptEmail" : "email",
          [{ t: "check", name: "Check Box1", on: hasEmail(a) && a.acceptEmail === "yes" }]),
        f(FORM.fwAppearance, "Phone", a.phone, "phone", [{ t: "text", name: "Phone", value: a.phone }]),
        f(FORM.fwAppearance, "Fax", empty(a.fax) ? "Left blank" : a.fax, "fax", [{ t: "text", name: "Fax", value: a.fax }]),
      ]),
    f(FORM.fwAppearance, "Attorney General confidential address", yesNo(a.agConfidential), "agConfidential",
      [{ t: "check", name: "Check Box2", on: a.agConfidential === "yes" }]),
    f(FORM.fwAppearance, "3. Case type", empty(a.fwCaseType) ? "Left blank" : a.fwCaseType, "fwCaseType", [{ t: "text", name: "CaseType", value: a.fwCaseType }]),
    f(FORM.fwAppearance, "4. Other related cases", yesNo(a.related), "related",
      [{ t: "check", name: "Check Box3", on: a.related === "yes" }, { t: "check", name: "Check Box4", on: a.related === "no" }]),
  ];
  if (a.related === "yes") [1, 2, 3].forEach(i => out.push(
    // Written on the printed rule (the field's box runs below it, so two lines would be struck through).
    f(FORM.fwAppearance, `Related case ${i} caption`, empty(a[`rel${i}Caption`]) ? "Left blank" : a[`rel${i}Caption`], `rel${i}Caption`,
      [{ t: "lines", ...CAPTION_RULES[i], value: a[`rel${i}Caption`] }]),
    f(FORM.fwAppearance, `Related case ${i} number`, empty(a[`rel${i}Number`]) ? "Left blank" : a[`rel${i}Number`], `rel${i}Number`,
      [{ t: "text", name: relName(i)[1], value: a[`rel${i}Number`] }])));
  out.push(
    f(FORM.fwAppearance, "Additional information required by local rule", empty(a.localRuleText) ? "Left blank" : a.localRuleText, "localRuleText",
      [{ t: "text", name: "LocalRule", value: a.localRuleText }]),
    f(FORM.fwMotion, "3. Over 18 and live with me", empty(a.adults) ? "Left blank" : a.adults, "adults", [{ t: "text", name: "AdultsInHome", value: a.adults }]),
    f(FORM.fwMotion, "4. Under 18 and live with me", empty(a.children) ? "Left blank" : a.children, "children", [{ t: "text", name: "ChildrenInHome", value: a.children }]),
    f(FORM.fwMotion, "5. I financially support", empty(a.supported) ? "Left blank" : a.supported, "supported", [{ t: "text", name: "FinancialSupport", value: a.supported }]),
  );
  const hasWages = toNum(a.hourlyRate) > 0;
  out.push(
    f(FORM.fwMotion, "Wages per hour", isNum(a.hourlyRate) ? `$${moneyOrBlank(a.hourlyRate)}` : "Left blank", "hourlyRate",
      [{ t: "text", name: "HourlyRate", value: moneyOrBlank(a.hourlyRate) }]),
    ...(hasWages ? [f(FORM.fwMotion, "Hours per month", a.monthlyHours, "monthlyHours",
      [{ t: "text", name: "MonthlyHours", value: isNum(a.monthlyHours) ? String(toNum(a.monthlyHours)) : "" }])] : []),
    { from: ["hourlyRate", "monthlyHours"], ...f(FORM.fwMotion, "Wages per month (worked out for you)", hasWages && isNum(a.monthlyHours) ? `$${money(wages(a))}` : "Left blank", hasWages ? "monthlyHours" : "hourlyRate",
      [{ t: "text", name: "MonthlyIncome", value: hasWages && isNum(a.monthlyHours) ? money(wages(a)) : "" }]) },
    ...INCOME.map(([k, label, , name]) => amountRow(FORM.fwMotion, label, k, a, name)),
  );
  if (toNum(a.otherIncome) > 0) out.push(f(FORM.fwMotion, "Other income description", a.otherIncomeDesc, "otherIncomeDesc",
    [{ t: "text", name: "DescriptionOtherIncome", value: a.otherIncomeDesc }]));
  out.push(
    totalRow(FORM.fwMotion, "6. and Total Income (added up for you)", incomeTotal(a), INCOME_IDS, a, ["TotalIncome", "HouseholdIncome"], "Left blank (no income entered)",
      toNum(a.hourlyRate) > 0 && empty(a.monthlyHours) ? "Left blank until you enter your hours per month" : "", "monthlyHours"),
    f(FORM.fwMotion, "7. Money in the bank", isNum(a.bank) ? `$${moneyOrBlank(a.bank)}` : "", "bank", [{ t: "text", name: "BankAccount", value: moneyOrBlank(a.bank) }]),
    ...EXPENSES.map(([k, label, name]) => amountRow(FORM.fwMotion, label, k, a, name)),
  );
  if (toNum(a.otherCosts) > 0) out.push(f(FORM.fwMotion, "Other expenses description", a.otherCostsDesc, "otherCostsDesc",
    [{ t: "text", name: "DescriptionOtherCosts", value: a.otherCostsDesc }]));
  out.push(
    totalRow(FORM.fwMotion, "8. and Total Expenses (added up for you)", expenseTotal(a), EXPENSE_IDS, a, ["MonthlyExpenses"], "Left blank (no expenses entered)"),
    f(FORM.fwMotion, "Date", formDate(a.signDate), "signDate", [{ t: "draw", page: 3, x: 76, y: 263, value: formDate(a.signDate) }]),
    f(FORM.fwMotion, "Printed Name", a.name, "name", [{ t: "lines", page: 3, x0: 360, x1: 526, ys: [221.5], layouts: NAME_LAYOUTS, value: a.name }]),
    f(FORM.fwOrder, "Distribution: your name", a.name, "name"),
    f(FORM.fwOrder, "Distribution: your address", a.agConfidential === "yes" ? "Left blank (Attorney General confidential address checked)" : myAddress(a),
      a.agConfidential === "yes" ? "agConfidential" : myAddressStep(a)),
  );
  return out;
}
window.appParts++;
