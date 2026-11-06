// What "I'm not sure" says about where to look for an answer.
/* ---------- checks: run only at the end ---------- */
// Where to look when you're not sure, by kind of question.
const CASE_IDS = /^(county|courtType|courtTypeOther|caseNumber|caseTypeLetters|courtDate|plaintiff|hearingDate|role|otherParty|otherPartyAddress|related|relatedNumbers|rel\d\w+|svc\dName|svc\dAddress|fwCourtType|otherPerson|fwCaseType)$/;
const PROGRAM_IDS = /^(acp|acpAddress|agConfidential)$/;
const PARAGRAPH_IDS = /^(admitted|denied|notEnough)$/;
const MONEY_IDS = new Set(["hourlyRate", "monthlyHours", "otherIncomeDesc", "otherCostsDesc", ...INCOME.map(x => x[0]), ...EXPENSES.map(x => x[0])]);
function unsureAdvice(step) {
  const id = step.id;
  if (PROGRAM_IDS.test(id)) return "The Attorney General's office says to email confidential@atg.in.gov to learn more about the Address Confidentiality Program.";
  if (id === "name" && sitKey !== "feewaiver") return "The form says to fill out its top section to match the other court forms filed in this case. Check how your name appears on your court papers, or get free legal help.";
  if (id === "email" || id === "phone") return "If you need help with this, you can get free legal help.";
  if (id === "address") return "If you're not sure which address to use, you can get free legal help.";
  if (id === "name") return "If you're not sure how to write it, you can get free legal help.";
  if (id === "fax") return "Leave this blank if you don't have one.";
  if (id === "receiveAt") return "The form asks you to pick one. If you're not sure, you can get free legal help.";
  if (id === "acceptEmail") return "The official instructions say to check this box only if you want the court to communicate with you only by email and you can check your email every day.";
  if (id === "adults" || id === "children" || id === "supported") return "List their names, or type None if there's no one.";
  if (id === "bank") return "Check your bank statements, or get free legal help.";
  if (id === "hourlyRate" || id === "monthlyHours") return "Check your pay stubs, or get free legal help.";
  if (INCOME.some(x => x[0] === id) || id === "otherIncomeDesc") return "Check your benefit letters or statements, or get free legal help.";
  if (EXPENSES.some(x => x[0] === id) || id === "otherCostsDesc") return "Check your bills or statements, or get free legal help.";
  if (MONEY_IDS.has(id)) return "Check your records, like pay stubs and bills, or get free legal help.";
  if (id === "defenses") return "Indiana Legal Help's Answer instructions say that if you do not list your defenses now, you may lose your right to use them later in the case. This tool can't tell you what to write here. You can get free legal help.";
  if (PARAGRAPH_IDS.test(id)) return "Indiana Legal Help's instructions say that if you skip a part of the Complaint, the court will take it as true. This tool can't tell you which paragraphs go where; you can get free legal help.";
  if (id === "role") return "Check your court papers, look up your case at mycase.in.gov, or ask the clerk's office. Until you answer, the names at the top of the form stay blank.";
  if (sitKey === "feewaiver" && id === "county") return "Indiana's court directory lists the courts and clerk's offices in each county. It doesn't say which county your case belongs in; you can get free legal help.";
  if (id === "fwCourtType") return "The official instructions say to select the court type if you know it and leave it blank if not.";
  if (id === "fwCaseType") return "The official instructions say to insert the case type or leave it blank.";
  if (id === "otherPerson") return "The official instructions say that if there is no other person involved in your case (like a name change), leave this blank. If you're not sure who it is, you can get free legal help.";
  if (sitKey === "feewaiver" && id === "localRuleText") return "The official instructions say to put information here if it's required by a local rule. If you don't know of one, you can leave it blank or ask the clerk's office.";
  if (id === "localRuleText") return "Ask the clerk's office what your county's local rule requires. If you're not aware of one, edit \"Local rule information\" and choose \"I'm not aware of any.\"";
  if (id === "otherAgreed") return "This is about what the other party told you. If you couldn't reach them, you can get free legal help.";
  if (id === "spokeDate") return "Check your texts, emails or call log for the date. If you're not sure what to do here, you can get free legal help.";
  if (id === "timeNeeded") return "The form says to write the number of days or weeks you need, not a date.";
  if (/^svc\dDate$/.test(id)) return "This is the date you send the copy, so there's nothing to look up.";
  if (id === "signDate") return "This is the date you sign the form, so there's nothing to look up.";
  if (/^rel\d/.test(id) || id === "relatedNumbers") return "Check the papers from that case, look it up at mycase.in.gov, or ask the clerk's office.";
  if (/^localRule/.test(id)) return "The form's first choice is for people who aren't aware of any local rule that requires more information. You can also ask the clerk's office.";
  if (/^svcMore/.test(id)) return "Indiana Legal Help's instructions say you are required to give a copy of every form you file to every other person involved in the case.";
  if (id === "fileMethod") return "The steps at the end explain both ways to file.";
  if (/^svc\dMethod$/.test(id)) return "Indiana Legal Help's Service FAQ says to call the clerk or court where you're filing and ask what your service options are and what each one costs.";
  if (sitKey === "feewaiver" && id === "related") return "Check any papers you have from other court cases, look them up at mycase.in.gov, or ask the clerk's office.";
  if (CASE_IDS.test(id)) return sitKey === "feewaiver"
    ? "Check your records, or get free legal help."
    : "Check your court papers, look up your case at mycase.in.gov, or ask the clerk's office.";
  return step.type === "choice" ? "This tool can't choose this for you. You can get free legal help." : "This tool can't tell you what to write here. You can get free legal help.";
}
// What to do next, after the advice.
function unsureNext(step, where) {
  // What the tool does with this answer, not which one to pick.
  if (step.id === "fwCourtType") return where === "summary" ? "To leave it blank on the form, choose Fix, then \"I don't know.\"" : "To leave it blank on the form, choose \"I don't know.\"";
  if (step.id === "localRuleText" && sitKey !== "feewaiver") return ""; // the advice already says
  // Item 6 of the sworn motion doesn't say this date is optional, so the tool doesn't either.
  if (step.id === "spokeDate") return where === "summary" ? "Then come back and answer it." : "Answer it any time; until then it is flagged at the end.";
  if (where === "summary") return step.optional ? "To leave it blank, choose Fix, then Save and review." : "Then come back and answer it.";
  return returnToSummary && step.optional ? "To leave it blank, choose Save and review." : "Answer it any time; until then it is flagged at the end.";
}
// The source an "I'm not sure" note names, linked.
function unsureLink(step) {
  const id = step.id;
  if (sitKey === "feewaiver" && /^(fwCourtType|fwCaseType|otherPerson|localRuleText)$/.test(id)) return { href: LINKS.feeWaiverInstructions, text: "Fee waiver instructions" };
  if (sitKey === "feewaiver" && id === "county") return { href: LINKS.courtDirectory, text: "Indiana court directory" };
  if (PARAGRAPH_IDS.test(id) || /^svcMore/.test(id)) return { href: sitKey === "continuance" ? LINKS.continuanceInstructions : LINKS.answerInstructions, text: "Indiana Legal Help's instructions" };
  if (/^svc\dMethod$/.test(id)) return { href: SOURCES.serviceFaq.href, text: "Indiana Legal Help's Service FAQ" };
  if (PROGRAM_IDS.test(id)) return { href: LINKS.acp, text: "About the Address Confidentiality Program" };
  if (/mycase/.test(unsureAdvice(step))) return { href: "https://mycase.in.gov/", text: "mycase.in.gov" };
  if (/free legal help/.test(unsureAdvice(step))) return { href: LINKS.getHelp, text: "Find free legal help" };
  return null;
}
