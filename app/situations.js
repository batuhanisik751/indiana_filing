// The four things someone can do here, and which questions and forms each one uses.
/* =====================================================================
   SITUATIONS
   ===================================================================== */
const SIGN_HELP = {
  court: "This date is printed next to the signature lines. Indiana Legal Help says forms must be signed before they are filed.",
  feewaiver: "This date is printed next to the signature line. If you file on paper, the official instructions say to sign after you print the form.",
};
// What to have ready before the first question: the thing, what the official papers say about it, and where they
// say it (a page of the official instructions, or the line of the form that asks for it). Shown on each form's first question.
const READY_SRC = {
  answer: page => ({ text: `Answer instructions, page ${page}`, href: `${LINKS.answerInstructions}#page=${page}` }),
  cont: page => ({ text: `Continuance instructions, page ${page}`, href: `${LINKS.continuanceInstructions}#page=${page}` }),
  contMotion: item => ({ text: `Verified Motion for Continuance, item ${item}`, href: `${LINKS.continuanceInstructions}#page=6` }),
  // Item 3 of the Appearance in the Answer and Continuance packets, which says the email and phone are required.
  appearance: packet => ({ text: "Appearance, item 3", href: packet === "cont" ? `${LINKS.continuanceInstructions}#page=4` : `${LINKS.answerInstructions}#page=5` }),
  fw: page => ({ text: `Fee waiver instructions, page ${page}`, href: `${LINKS.feeWaiverInstructions}#page=${page}` }),
};
const READY_CONTACT = "Your mailing address, and your email and phone number if you have them"; // the fee waiver's Appearance
const READY_CONTACT_NEEDED = ["Your mailing address, email address and 10-digit phone number", "Item 3 of the Appearance says an email address and a 10-digit phone number are required."];
const READY_ANSWER_CASE = [
  ["Your court papers, with the county, court, case number and the plaintiff's name", "The instructions say this case information goes in the caption at the top of each form.", READY_SRC.answer(2)],
  [...READY_CONTACT_NEEDED, READY_SRC.appearance("answer")],
  ["The name and address of the plaintiff's attorney, or of the plaintiff if they don't have one", "The instructions say you must give a copy of every form you file to every other person involved in the case, and say when and how you gave it.", READY_SRC.answer(4)],
  ["The case numbers of any related cases", "The instructions give examples, like a small claims or bankruptcy case about the same debt. Skip this if there are none.", READY_SRC.answer(4)],
];
const SITUATIONS = {
  respond: {
    pick: "I'm being sued and need to respond to the complaint",
    blurb: "Fills the official Appearance and Answer forms. Indiana Legal Help says Answers are not usually filed in small claims court.",
    title: "Appearance and Answer",
    bring: "Have the Complaint you received: the Answer goes through its numbered paragraphs.",
    ready: [
      ["The Complaint you received", "The Answer instructions say you must respond to each part (paragraph number) of it, and that the court will take any part you skip as true.", READY_SRC.answer(1)],
      ["Your defenses, if you have any", "The Answer instructions say you must list your defenses in this initial Answer, and that if you do not list them now, you may lose your right to use them later in the case.", READY_SRC.answer(3)],
      ...READY_ANSWER_CASE,
    ],
    sections: ["Your case", "About you", "How the court reaches you", "Your answer", "Sending a copy", "Signing"],
    steps: () => [...caseSteps(0), ...youSteps(1), ...contactSteps(2), ...answerSteps(3), ...serviceSteps(4), ...signSteps(5, SIGN_HELP.court)],
    official: { packet: "answerPacket", docs: ["appearance", "answer"], page: LINKS.answerTopic },
    fields: a => [...captionFields(a), ...appearanceFields(a), ...answerFields(a), ...serviceFields(a, true), ...signatureFields(a, "respond")],
    reminders: ["Check that every paragraph number of the Complaint is in one of your three lists. Indiana Legal Help's instructions say a skipped paragraph will be taken as true."],
  },
  appearance: {
    pick: "I'm being sued and want to tell the court I'm representing myself",
    blurb: "Fills the official Appearance form, which gives the court and the other side your contact information.",
    title: "Appearance",
    bring: "Have the court papers you received.",
    ready: READY_ANSWER_CASE, // this Appearance is the one in the Answer packet, so its instructions are the Answer's
    sections: ["Your case", "About you", "How the court reaches you", "Sending a copy", "Signing"],
    steps: () => [...caseSteps(0), ...youSteps(1), ...contactSteps(2), ...serviceSteps(3), ...signSteps(4, SIGN_HELP.court)],
    official: { packet: "answerPacket", docs: ["appearance"], page: LINKS.answerTopic, // this Appearance comes from the Answer packet (see forms/README.md)
      pageNote: "That page is about the Answer. The Appearance is part of its PDF, on pages 5 and 6." },
    fields: a => [...captionFields(a), ...appearanceFields(a), ...serviceFields(a, false), ...signatureFields(a, "appearance")],
    reminders: [],
  },
  feewaiver: {
    pick: "I'm starting a case and can't afford the filing fee",
    blurb: "Fills the official fee waiver forms. Indiana Legal Help says filing fees are generally charged only when a case is started. Not for family law cases, which have their own form.",
    title: "Fee waiver",
    bring: "Have your household's monthly income and expenses, and how much you have in the bank.",
    ready: [
      ["The county where you'll file, and the kind of court and case if you know them", "The instructions say to leave the court type and the case type blank if you don't know them.", READY_SRC.fw(1)],
      ["The name of the other person in your case, if there is one", "The instructions say to leave it blank if no other person is involved, like in a name change.", READY_SRC.fw(1)],
      [READY_CONTACT, "Item 2 of the Appearance asks where the court can send you papers and case information.", READY_SRC.fw(1)],
      ["The case numbers of any related cases", "Item 4 of the Appearance asks for the caption and case number of each one. Skip this if there are none.", READY_SRC.fw(1)],
      ["The names of the people you live with, and which of them you support", "Items 3 to 5 of the Verified Motion for Fee Waiver ask for the adults, the children under 18, and the people you support.", READY_SRC.fw(3)],
      ["The monthly income, before taxes, of everyone you support", "Item 6 lists wages (hourly pay and hours worked each month), unemployment, TANF, SSI or SSD, child support and other income.", READY_SRC.fw(3)],
      ["How much money you have in the bank", "Item 7 asks for it.", READY_SRC.fw(3)],
      ["Your household's monthly expenses", "Item 8 lists housing, utilities, food, child care, medical bills, transportation, insurance, child support and other costs.", READY_SRC.fw(4)],
    ],
    sections: ["Your case", "About you", "Your household", "Income", "Expenses", "Signing"],
    steps: () => [...fwCaseSteps(0), ...fwYouSteps(1), ...fwHouseholdSteps(2), ...fwIncomeSteps(3), ...fwExpenseSteps(4), ...signSteps(5, SIGN_HELP.feewaiver)],
    official: { packet: "feeWaiverPacket", docs: ["appearance", "motion", "order"], page: LINKS.fileInPerson },
    fields: a => [...feeWaiverFields(a), ...signatureFields(a, "feewaiver")],
    reminders: [],
  },
  continuance: {
    pick: "I need to ask the court to move my hearing date",
    blurb: "Fills the official Appearance and Verified Motion for Continuance, plus the Order the judge signs if the request is granted.",
    title: "Continuance",
    bring: "Have the papers with your hearing date and case number.",
    ready: [
      ["Your court papers, with the hearing date, the case number, and the county and court", "Item 2 of the Verified Motion for Continuance asks when your hearing is scheduled, and the top of the form asks to match the other court forms in your case.", READY_SRC.contMotion(2)],
      ["Your reason for asking for a new date", "The instructions say you need a good reason and need to show it with proof, like a written statement, which the form gives you a place for. The court decides.", READY_SRC.cont(3)],
      ["How many days or weeks you need before a new court date", "Item 4 of the Verified Motion for Continuance asks for the number of days or weeks, not a specific date.", READY_SRC.contMotion(4)],
      ["When you talked to the other party about asking for a new date, and whether they agreed", "Item 6 of the Verified Motion for Continuance asks the date you spoke to them about it, and whether they agreed to your request.", READY_SRC.contMotion(6)],
      [...READY_CONTACT_NEEDED, READY_SRC.appearance("cont")],
      ["The name and address of the other party, and of anyone else involved in the case", "The instructions say you must give a copy of every form you file to every other person involved in the case, and say when and how you gave it.", READY_SRC.cont(3)],
      ["The case numbers of any related cases", "The instructions give an example: in an eviction case, a separate case about damages owed. Skip this if there are none.", READY_SRC.cont(3)],
    ],
    sections: ["Your case", "About you", "How the court reaches you", "Your request", "Sending a copy", "Signing"],
    steps: () => [...contCaseSteps(0), ...youSteps(1), ...contactSteps(2, contRelatedHelp, contRelatedMore), ...contRequestSteps(3), ...serviceSteps(4, contServiceHelp, { href: LINKS.continuanceInstructions, text: "Read the full definitions (page 3 of the continuance instructions)" }), ...signSteps(5, SIGN_HELP.court)],
    official: { packet: "continuancePacket", docs: ["appearance", "motion", "order"], page: LINKS.continuance },
    formNumbers: { [FORM.appearance]: "CCA-GF-1219-3000" },
    fields: a => [...contCaptionFields(a), ...contAppearanceFields(a), ...contMotionFields(a), ...contServiceFields(a), ...contOrderFields(a), ...signatureFields(a, "continuance")],
    reminders: ["Indiana Legal Help says asking does not change your court date by itself: only an order signed by the judge can change a court date or time."],
  },
};
// What starting a form takes: the questions it starts with (some answers add a few), and what to have with you.
// The most is with nothing answered. The fewest is with every "Which of these" list answered "None of these".
const questionCount = key => SITUATIONS[key].steps().filter(s => !s.showIf || s.showIf({})).length;
const questionMin = key => { const st = SITUATIONS[key].steps(), none = Object.fromEntries(st.filter(s => s.type === "checks").map(s => [s.id, "none"])); return st.filter(s => !s.showIf || s.showIf(none)).length; };
const questionsText = key => questionMin(key) === questionCount(key) ? `About ${questionCount(key)} questions.` : `${questionMin(key)} to ${questionCount(key)} questions, depending on your answers.`;
// The list above, closed until opened, on a form's first question.
const readyHtml = key => moreHtml(`<ul class="facts ready">${SITUATIONS[key].ready.map(([what, why, src]) =>
  `<li><strong>${esc(what)}.</strong> ${esc(why)} <small class="src">Source: <a href="${src.href}" target="_blank" rel="noopener">${esc(src.text)}</a></small></li>`).join("")}</ul>`,
  "Before you start: what to have ready", `ready:${key}`, { cls: "ready" });
const takesHtml = key => `<small class="takes">${questionsText(key)} ${esc(SITUATIONS[key].bring)}</small>`;
const takesRange = () => { const k = Object.keys(SITUATIONS); return [Math.min(...k.map(questionMin)), Math.max(...k.map(questionCount))]; };
window.appParts++;
