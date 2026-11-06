// Every question the forms ask, with its help text.
/* =====================================================================
   QUESTIONS
   Each step fills one spot on the official form. `optional` steps can be
   left blank without a "missing" flag. `showIf` hides steps that don't
   apply; hidden answers are never put on the form.
   ===================================================================== */

const caseSteps = sec => [
  { id: "county", sec, type: "select", label: "County", options: COUNTIES,
    q: "Which county is your case in?",
    help: "This is the county named at the top of your court papers, not necessarily the county you live in." },
  { id: "courtType", sec, type: "choice", label: "Court type",
    q: "What kind of court is your case in?",
    help: "Look at the top of your court papers. It will say something like \"Marion Superior Court\" or \"Allen Circuit Court.\"",
    options: [["SUPERIOR", "Superior Court"], ["CIRCUIT", "Circuit Court"], ["other", "Something else"]] },
  { id: "courtTypeOther", sec, type: "text", label: "Court type (as you typed it)",
    showIf: a => a.courtType === "other",
    q: "What kind of court is it?",
    help: "Type the kind of court as it appears on your papers, without the county name or the word Court (for example, Probate). The form already prints the word COURT after it." },
  { id: "caseNumber", sec, type: "text", label: "Case number", upper: true,
    q: "What is your case number?",
    help: "Indiana case numbers have four parts, like 49D01-2610-CC-001234. The first two digits are the county number. Copy it exactly from your papers." },
  { id: "caseTypeLetters", sec, type: "text", label: "Case type letters", upper: true, noWords: true,
    showIf: a => !caseMatch(a.caseNumber),
    q: "What two letters show your case type?",
    help: "The official form asks for the two letters in your case number that show the case type, like CC (civil collection) or PL (civil plenary). We fill this in for you when the case number is complete." },
  { id: "courtDate", sec, type: "date", label: "Your next court date", optional: true,
    q: "When is your next court date, if you have one?",
    help: "It's on your court papers, or you can look it up at mycase.in.gov. Indiana's court staff page says staff can also tell you when your next hearing is. It doesn't go on the form; it goes in your next steps. Leave this blank if you don't have one yet." },
  { id: "plaintiff", sec, type: "text", label: "Plaintiff",
    q: "Who is suing you?",
    help: "This is the plaintiff: the person or company that started the case. Copy the name exactly as it appears on your papers." },
];

const youSteps = sec => [
  { id: "name", sec, type: "text", label: "Your full name",
    q: "What is your full legal name?",
    help: "The form asks for your name. It says to fill out its top section to match the other court forms filed in this case." },
  { id: "acp", sec, type: "choice", label: "Address Confidentiality Program",
    q: "Are you in the Indiana Attorney General's Address Confidentiality Program?",
    help: "The Attorney General's office says program participants have their mail sent to a secure substitute address, which is also used for government services and legal process.",
    link: { href: LINKS.acp, text: "About the Address Confidentiality Program" },
    options: [["no", "No"], ["yes", "Yes"]] },
  { id: "address", sec, type: "textarea", short: true, label: "Mailing address",
    showIf: a => a.acp !== "yes",
    q: "What is your mailing address?",
    help: "Include your street, apartment number, city, state and ZIP code. The form gives this to the court and the other side as a way to contact you. You'll choose later where you want to receive court papers." },
  { id: "acpAddress", sec, type: "textarea", short: true, label: "Substitute address",
    showIf: a => a.acp === "yes",
    q: "What is your Address Confidentiality Program substitute address?",
    help: "Don't enter your home address. This address goes on the form and is shared with the court and the other side. The Attorney General's office says to email confidential@atg.in.gov to learn more about the program.",
    link: { href: LINKS.acp, text: "About the Address Confidentiality Program" } },
  { id: "email", sec, type: "email", label: "Email",
    q: "What is your email address?",
    help: "The official form says an email address is required, and Trial Rule 11.1 says to give one if available. If you don't have one, type None." },
  { id: "phone", sec, type: "tel", label: "Phone number",
    q: "What is your phone number?",
    help: "The official form asks for a 10-digit phone number, including the area code. If you don't have one, type None." },
  { id: "fax", sec, type: "tel", label: "Fax number", optional: true, noWords: true,
    q: "What is your fax number?",
    help: "Leave this blank if you don't have one." },
];

const relatedHelp = "Indiana Legal Help's Answer instructions say related cases can be other cases with the same parties. In a debt case, this might be a case about the same debt, like a small claims case, a bankruptcy case, or a divorce case where the debt was assigned to one of the parties. In an eviction case, it might be a separate case about damages owed.";

const contactSteps = (sec, relHelp = relatedHelp) => [
  { id: "receiveAt", sec, type: "choice", label: "Where you want court papers",
    q: "Where do you want to receive court papers and case information?",
    help: "Pick one. The form says the Attorney General confidential address is only an option if you have used it in another court case.",
    options: [["Choice1", "At my street address"], ["Choice2", "At my email address"], ["Choice3", "At the Attorney General confidential address"]] },
  { id: "related", sec, type: "choice", label: "Related cases",
    q: "Are there other court cases related to this one?",
    help: relHelp,
    options: [["yes", "Yes"], ["no", "No"]] },
  { id: "relatedNumbers", sec, type: "text", label: "Related case numbers", upper: true,
    showIf: a => a.related === "yes",
    q: "What are the case numbers of the related cases?",
    help: "Separate them with commas." },
  { id: "localRule", sec, type: "choice", label: "Local rule information",
    q: "Does a local rule in your county require you to give any other information on this form?",
    help: "Some counties have local rules that ask for more information on this form. The form's first choice is \"I am not aware of any additional information required by a local rule that I must provide.\"",
    options: [["none", "I'm not aware of any"], ["yes", "Yes, a local rule requires more information"]] },
  { id: "localRuleText", sec, type: "text", label: "Information required by local rule",
    showIf: a => a.localRule === "yes",
    q: "What information does the local rule require you to provide?",
    help: "Type the information itself. The form says: \"There is additional information required by local rule that is provided below.\" It has one line for this." },
];

const paragraphHelp = "Indiana Legal Help's instructions say you must respond to each part (paragraph number) of the Complaint, and if you skip one, the court will take it as true. Each paragraph number should be in this list or one of the next two.";
const answerSteps = sec => [
  { id: "admitted", sec, type: "textarea", short: true, label: "Paragraphs you admit", optional: true,
    need: "Leave this blank only if no paragraphs belong here.",
    q: "Which paragraphs of the Complaint do you agree are true?",
    help: `The Complaint is the paper that started the case. Its paragraphs are numbered. List the numbers you agree with, like "1, 3". The form warns that you won't be able to challenge these later, and to only admit paragraphs you know are true. ${paragraphHelp}` },
  { id: "denied", sec, type: "textarea", short: true, label: "Paragraphs you deny", optional: true,
    need: "Leave this blank only if no paragraphs belong here.",
    q: "Which paragraphs of the Complaint do you say are not true?",
    help: "List the numbers, like \"2, 4\". The form says the plaintiff will have to prove these, and that if a paragraph has some information you agree with and some you don't, list it here." },
  { id: "notEnough", sec, type: "textarea", short: true, label: "Paragraphs you can't admit or deny", optional: true,
    need: "Leave this blank only if no paragraphs belong here.",
    q: "Which paragraphs don't you have enough information to agree or disagree with?",
    help: "List the numbers, like \"5, 6\". The form says the plaintiff will still have to prove these." },
  { id: "defenses", sec, type: "textarea", label: "Your defenses", optional: true,
    q: "What defenses do you believe you have?",
    help: "A defense is a legal reason why you should win or owe less money. The form asks you to write each defense in one short sentence and give the facts that support it, and its instructions warn that you may lose the right to use a defense later if you don't list it now. This tool can't tell you which defenses apply to you.",
    link: { href: LINKS.answerInstructions, text: "The form points you to the list of defenses in the \"Terms You May Need to Know\" section, on page 3 of Indiana Legal Help's Answer instructions" } },
];

const MAX_RECIPIENTS = 5;
// How many certificate-of-service rows the user has chosen to fill.
const recipientCount = a => { let n = 1; while (n < MAX_RECIPIENTS && a[`svcMore${n}`] === "yes") n++; return n; };

// The official names for how a copy is sent, from the "Certificate of Service"
// definition in Indiana Legal Help's form instructions.
const SERVICE_METHODS = [["First Class U.S. mail", "First Class U.S. mail"], ["Hand Delivery", "Hand Delivery"], ["Indiana E-Filing System", "Indiana's E-Filing System"]];
const ANSWER_SERVICE_LINK = { href: LINKS.answerInstructions, text: "Read the full definitions (page 4 of the Answer instructions)" };
const serviceSteps = (sec, firstHelp = "The form's Certificate of Service says you sent a copy to the attorney for the plaintiff, or to the plaintiff if they don't have an attorney. Their name and address are usually on the papers you received.", methodLink = ANSWER_SERVICE_LINK) => {
  const out = [];
  for (let i = 1; i <= MAX_RECIPIENTS; i++) {
    const show = i === 1 ? undefined : a => recipientCount(a) >= i;
    out.push(
      { id: `svc${i}Name`, sec, type: "text", label: `Copy sent to (person ${i})`, service: true, showIf: show,
        q: i === 1 ? "Who will you send a copy to?" : "Who else will you send a copy to?",
        help: i === 1 ? firstHelp : "Use their name exactly as it appears on your papers." },
      { id: `svc${i}Address`, sec, type: "textarea", short: true, label: `Their address (person ${i})`, service: true, showIf: show,
        q: "What is their address?",
        help: "The form has an Address column for each person you send a copy to. The address is usually on the papers you received." },
      { id: `svc${i}Method`, sec, type: "choice", label: `Type of service (person ${i})`, service: true, showIf: show,
        q: "How will you send them a copy?",
        help: "Indiana Legal Help's instructions list three ways: First Class U.S. mail, Hand Delivery (paying a sheriff or private company to deliver the papers), and Indiana's E-Filing System. Ask the clerk how each one works.",
        link: methodLink,
        options: SERVICE_METHODS },
      { id: `svc${i}Date`, sec, type: "date", label: `Date of service (person ${i})`, service: true, showIf: show,
        q: "On what date will you send it?",
        help: "The form asks for the date of service." },
    );
    if (i < MAX_RECIPIENTS) out.push(
      { id: `svcMore${i}`, sec, type: "choice", label: "Anyone else to send a copy to", showIf: show,
        q: "Do you need to send a copy to anyone else?",
        help: "Indiana Legal Help's instructions say you are required to give a copy of every form you file to every other person involved in the case. The form has room for five.",
        options: [["no", "No"], ["yes", "Yes"]] });
  }
  return out;
};

const signSteps = (sec, help) => [
  { id: "fileMethod", sec, type: "choice", label: "How you'll sign",
    q: "How will you file your forms?",
    help: "Indiana's E-Filing User Guide says e-filed documents can be signed with \"/s/\" followed by your name. If you file on paper, the signature lines are left blank so you can sign by hand.",
    options: [["paper", "On paper at the courthouse. I'll sign by hand."], ["efile", "Online through e-filing. Sign with \"/s/\" and my name."]] },
  { id: "signDate", sec, type: "date", label: "Date you'll sign",
    q: "What date will you sign the form?",
    help },
];

// Fee waiver packet (for starting a new case).
const fwCaseSteps = sec => [
  { id: "county", sec, type: "select", label: "County", options: COUNTIES,
    q: "Which county will you file your case in?",
    help: "This is the county of the court where you'll start your case. This fee waiver form is not for family law cases: Indiana Legal Help says to use its Family Filing Fee Waiver instructions and form for those.",
    link: { href: LINKS.fileInPerson, text: "Find the Family Filing Fee Waiver form" } },
  { id: "fwCourtType", sec, type: "choice", label: "Court type",
    q: "What kind of court will you file in?",
    help: "The official instructions say to select the court type if you know it, and leave it blank if you don't. They also say to leave the cause number blank.",
    link: { href: LINKS.feeWaiverInstructions, text: "Fee waiver instructions" },
    options: [["CIRCUIT", "Circuit Court"], ["SUPERIOR", "Superior Court"], ["PROBATE", "Probate Court"], ["unknown", "I don't know"]] },
  { id: "otherPerson", sec, type: "text", label: "Other person in the case", optional: true, noWords: true,
    q: "Who is the other person in your case?",
    help: "This is the person you're filing against, called the respondent. The official instructions say that if there's no other person, like in a name change, leave this blank." },
  { id: "fwCaseType", sec, type: "text", label: "Case type", optional: true, upper: true, noWords: true,
    q: "What is the two-letter case type?",
    help: "The official instructions say to insert the case type defined in Administrative Rule 8(B)(3), or leave it blank. Leave this blank if you don't know it." },
];

const fwYouSteps = sec => {
  const base = Object.fromEntries(youSteps(sec).map(s => [s.id, s]));
  const contact = a => a.agConfidential !== "yes";
  return [
    { ...base.name, help: "The form asks for your name." }, // no court papers yet: this starts the case
    { id: "agConfidential", sec, type: "choice", label: "Attorney General confidential address",
      q: "Do you want to use the Attorney General confidential address for this case?",
      help: "The form says you may check this box if, in a related case, you have used the Attorney General confidential address. On the form it is an alternative (\"OR\") to your address, email, phone and fax, so if you choose yes we won't ask for those or put them on the form.",
      link: { href: LINKS.acp, text: "About the Address Confidentiality Program" },
      options: [["no", "No"], ["yes", "Yes"]] },
    { ...base.acp, showIf: contact },
    { ...base.address, showIf: a => contact(a) && a.acp !== "yes" },
    { ...base.acpAddress, showIf: a => contact(a) && a.acp === "yes" },
    { ...base.email, optional: true, showIf: contact, help: "Leave this blank if you don't have one." },
    { id: "acceptEmail", sec, type: "choice", label: "Accept service by email",
      showIf: a => contact(a) && hasEmail(a),
      q: "Will you accept court papers at this email address?",
      help: "The official instructions say to check this box only if you want the court to communicate with you only by email and you can check your email every day.",
      options: [["no", "No"], ["yes", "Yes"]] },
    { ...base.phone, showIf: contact, help: "The form asks for your phone number. If you don't have one, type None." },
    { ...base.fax, showIf: contact, noWords: true },
    { id: "related", sec, type: "choice", label: "Related cases",
      q: "Are there other court cases related to this one?",
      help: "The form asks whether there are other cases related to this case. " + relatedHelp,
      options: [["yes", "Yes"], ["no", "No"]] },
    ...[1, 2, 3].flatMap(i => [
      { id: `rel${i}Caption`, sec, type: "text", label: `Related case ${i} caption`, optional: i > 1,
        showIf: a => a.related === "yes",
        q: i === 1 ? "What is the caption (name) of the related case?" : `What is the caption of related case ${i}?`,
        help: i === 1 ? "The caption is the case name at the top of its papers, like \"Smith v. Jones.\"" : "Leave this blank if there are no more related cases." },
      { id: `rel${i}Number`, sec, type: "text", label: `Related case ${i} number`, optional: i > 1, upper: true,
        showIf: a => a.related === "yes",
        q: i === 1 ? "What is its case number?" : `What is the case number of related case ${i}?`, help: i === 1 ? "Copy it from that case's papers." : "Leave this blank if there are no more related cases." },
    ]),
    { id: "localRuleText", sec, type: "textarea", short: true, label: "Information required by local rule", optional: true, noWords: true,
      q: "What additional information does a local rule require you to provide?",
      help: "Some counties have local rules that ask for more information on this form. Type the information itself. Leave this blank if there is none." },
  ];
};

const fwHouseholdSteps = sec => [
  { id: "adults", sec, type: "text", label: "People over 18 who live with you", optional: true, sworn: true,
    q: "Who do you live with who is over eighteen (18)?",
    help: "The form says: \"I live with the following persons who are over eighteen (18) years of age.\" List their names, or type None if there's no one." },
  { id: "children", sec, type: "text", label: "People under 18 who live with you", optional: true, sworn: true,
    q: "Who do you live with who is under eighteen (18)?",
    help: "The form says: \"I live with the following persons who are under eighteen (18) years of age.\" List their names, or type None if there's no one." },
  { id: "supported", sec, type: "text", label: "People you financially support", optional: true, sworn: true,
    q: "Who do you financially support who lives in your household?",
    help: "The form says: \"I am responsible for the financial support of the following people who live in my household.\" List their names, or type None if there's no one." },
];

const incomeHelp = "The form asks for the combined monthly income, before taxes, of all the people you are responsible for supporting. Leave this blank if none.";
const INCOME = [
  ["unemployment", "Unemployment compensation", "How much unemployment compensation is received each month?", "MonthlyUnemployment"],
  ["tanf", "AFDC/TANF benefits", "How much is received in AFDC/TANF benefits each month?", "MonthlyAFDC/TANF"],
  ["ssi", "SSI/SSD benefits", "How much is received in SSI/SSD benefits each month?", "MonthlySSI/SSD"],
  ["childSupportIn", "Child support received", "How much child support is received each month?", "MonthlyChildSupportReceived"],
  ["otherIncome", "Other income", "How much other income is received each month?", "OtherIncome"],
];
const fwIncomeSteps = sec => [
  { id: "hourlyRate", sec, type: "money", label: "Wages per hour", optional: true,
    q: "If wages are earned, how much is paid per hour?",
    help: `The form lists wages as dollars per hour times hours per month. ${incomeHelp}` },
  { id: "monthlyHours", sec, type: "number", label: "Hours worked per month",
    showIf: a => toNum(a.hourlyRate) > 0,
    q: "About how many hours are worked per month?",
    help: "We multiply this by the hourly wage to fill in the monthly wages on the form." },
  ...INCOME.map(([id, label, q]) => ({ id, sec, type: "money", label: `${label} per month`, optional: true, q, help: incomeHelp })),
  { id: "otherIncomeDesc", sec, type: "textarea", short: true, label: "Description of other income",
    showIf: a => toNum(a.otherIncome) > 0,
    q: "What is the other income?", help: "The form says \"Other (please describe).\"" },
  { id: "bank", sec, type: "money", label: "Money in the bank",
    q: "How much money is in the bank?",
    help: "The form says: \"We have $___ in the bank.\" Enter 0 if none." },
];

const EXPENSES = [
  ["housing", "Housing (rent, contract or mortgage)", "MonthlyHousing"],
  ["utilities", "Utilities (gas, electric, water, phone, etc.)", "MonthlyUtilities"],
  ["food", "Food", "MonthlyFood"],
  ["childCare", "Child care", "MonthlyChildCare"],
  ["medical", "Medical bills", "MonthlyMedicalBills"],
  ["transportation", "Transportation", "MonthlyTransportation"],
  ["insurance", "Insurance (car, medical and/or property)", "MonthlyInsurance"],
  ["childSupportOut", "Child support paid", "MonthlyChildSupportPaid"],
  ["otherCosts", "Other expenses", "OtherCosts"],
];
const fwExpenseSteps = sec => [
  ...EXPENSES.map(([id, label]) => ({ id, sec, type: "money", label: `${label} per month`, optional: true,
    q: id === "childSupportOut" ? "How much child support is paid each month?" : `How much is spent each month on ${label.charAt(0).toLowerCase() + label.slice(1)}?`,
    help: id === "childSupportOut" ? "This is child support paid, listed under Monthly Expenses on the form. Leave this blank if none." : "The form lists monthly expenses. Leave this blank if none." })),
  { id: "otherCostsDesc", sec, type: "textarea", short: true, label: "Description of other expenses",
    showIf: a => toNum(a.otherCosts) > 0,
    q: "What are the other expenses?", help: "The form says \"Other (please describe).\"" },
];

// Continuance packet (to ask the court to move a hearing).
const contRelatedHelp = "Indiana Legal Help's continuance instructions say related cases can be other cases with the same parties. For example, in an eviction case there might be a separate case about damages owed.";
const CONT_COURT_NOTE = " Indiana Legal Help's continuance instructions say court staff will complete the court information and your case number, while the top of the form says to fill out that section to match the other court forms filed in your case. This question is optional.";
const contCaseSteps = sec => [
  ...caseSteps(sec).filter(s => s.id !== "plaintiff" && s.id !== "courtDate")
    .map(s => ["courtType", "courtTypeOther", "caseNumber"].includes(s.id) ? { ...s, optional: true, help: s.help + CONT_COURT_NOTE }
      : s.id === "caseTypeLetters" ? { ...s, optional: true } : s),
  { id: "role", sec, type: "choice", label: "Who started the case",
    q: "Who started this case?",
    help: "The top of the form names both sides of the case. The tool puts the names in the right places based on your answer.",
    options: [["other", "The other side started it"], ["me", "I started it"]] },
  { id: "otherParty", sec, type: "text", label: "Other party's name",
    q: "What is the other party's name?",
    help: "The form asks for the first and last name of the other party involved in this case. If it's a company, copy its name exactly as it appears on your papers." },
  { id: "otherPartyAddress", sec, type: "textarea", short: true, label: "Other party's address", optional: true, noWords: true,
    q: "What is the other party's mailing address?",
    help: "The Order form has a distribution list with both parties' names and addresses. Leave this blank if you don't know it." },
];

const contRequestSteps = sec => [
  { id: "hearingDate", sec, type: "date", label: "Hearing date",
    q: "When is your court hearing scheduled?",
    help: "The form asks for the date the court has scheduled your hearing for, including the month, day and year." },
  { id: "reason", sec, type: "textarea", label: "Why you need to change the date",
    q: "Why do you need to change the date of the hearing?",
    help: "The form says: \"Explain why you need more time or are not able to attend your hearing at the scheduled date and time.\" Indiana Legal Help's instructions say the court will decide whether to postpone the hearing. This tool can't tell you what to write." },
  { id: "timeNeeded", sec, type: "text", label: "How much more time you're asking for",
    q: "How much more time are you asking for?",
    help: "The form says to write the number of days or weeks you need before your new court date, and not to write a specific date." },
  { id: "spokeDate", sec, type: "date", label: "Date you spoke to the other party", optional: true,
    need: "The form asks for this date. If it's blank, it will be flagged at the end.",
    q: "On what date did you speak to the other party about filing this continuance?",
    help: "The form asks for the date you spoke to the other party about changing the court date." },
  { id: "otherAgreed", sec, type: "choice", label: "Did the other party agree", optional: true,
    need: "The form asks you to select one. If it's blank, it will be flagged at the end.",
    q: "Did the other party agree to your request?",
    help: "The form asks you to select one.",
    options: [["Choice1", "They agreed to my continuance request"], ["Choice2", "They did not agree to my continuance request"]] },
];

const contServiceHelp = "The form's Certificate of Service says you sent a copy to the other party and any other interested parties in this case. Their names and addresses are usually on the papers you received.";
window.appParts++;
