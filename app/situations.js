// The four things someone can do here, and which questions and forms each one uses.
/* =====================================================================
   SITUATIONS
   ===================================================================== */
const SIGN_HELP = {
  court: "This date is printed next to the signature lines. Indiana Legal Help says forms must be signed before they are filed.",
  feewaiver: "This date is printed next to the signature line. If you file on paper, the official instructions say to sign after you print the form.",
};
const SITUATIONS = {
  respond: {
    pick: "I'm being sued and need to respond to the complaint",
    blurb: "Fills the official Appearance and Answer forms. Indiana Legal Help says Answers are not usually filed in small claims court.",
    title: "Appearance and Answer",
    bring: "Have the Complaint you received: the Answer goes through its numbered paragraphs.",
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
const takesHtml = key => `<small class="takes">${questionsText(key)} ${esc(SITUATIONS[key].bring)}</small>`;
const takesRange = () => { const k = Object.keys(SITUATIONS); return [Math.min(...k.map(questionMin)), Math.max(...k.map(questionCount))]; };
window.appParts++;
