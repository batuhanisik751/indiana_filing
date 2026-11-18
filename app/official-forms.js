// The counties, links, official PDFs and libraries the app uses.
/* =====================================================================
   OFFICIAL FORMS
   Every question below fills a field on an official Indiana form approved
   by the Coalition for Court Access. The PDFs live in forms/ (see
   forms/README.md for sources and form numbers). Field names in the
   `pdf` entries are the exact field names inside those PDFs.
   ===================================================================== */

// Indiana counties in official county-number order (01 Adams ... 92 Whitley).
const COUNTIES = ["Adams","Allen","Bartholomew","Benton","Blackford","Boone","Brown","Carroll","Cass","Clark","Clay","Clinton","Crawford","Daviess","Dearborn","Decatur","DeKalb","Delaware","Dubois","Elkhart","Fayette","Floyd","Fountain","Franklin","Fulton","Gibson","Grant","Greene","Hamilton","Hancock","Harrison","Hendricks","Henry","Howard","Huntington","Jackson","Jasper","Jay","Jefferson","Jennings","Johnson","Knox","Kosciusko","LaGrange","Lake","LaPorte","Lawrence","Madison","Marion","Marshall","Martin","Miami","Monroe","Montgomery","Morgan","Newton","Noble","Ohio","Orange","Owen","Parke","Perry","Pike","Porter","Posey","Pulaski","Putnam","Randolph","Ripley","Rush","St. Joseph","Scott","Shelby","Spencer","Starke","Steuben","Sullivan","Switzerland","Tippecanoe","Tipton","Union","Vanderburgh","Vermillion","Vigo","Wabash","Warren","Warrick","Washington","Wayne","Wells","White","Whitley"];

const LINKS = {
  acp: "https://www.in.gov/attorneygeneral/about-the-office/appeals/victim-services/address-confidentiality-program/",
  answerInstructions: "https://indianalegalhelp.org/wp-content/uploads/2026/08/Answer-20260801.pdf",
  continuance: "https://indianalegalhelp.org/how-to-ask-for-a-new-court-date/",
  continuanceInstructions: "https://indianalegalhelp.org/wp-content/uploads/2024/12/Continuance-Motion-202409.pdf",
  fileInPerson: "https://indianalegalhelp.org/how-to-file-forms-with-the-court-in-person/",
  efile: "https://indianalegalhelp.org/how-to-electronically-file-forms-with-the-court/",
  courtDirectory: "https://www.in.gov/courts/files/court-directory.pdf",
  getHelp: "https://indianalegalhelp.org/get-help/",
  feeWaiverInstructions: "https://indianalegalhelp.org/wp-content/uploads/2023/08/GeneralFeeWaiver_0420INSTRUCTIONS-4.21.23.pdf",
  helpDesk: "https://indianalegalhelp.org/when-is-the-legal-help-desk-available-and-what-issues-does-it-cover/",
  answerTopic: "https://indianalegalhelp.org/legal-topic/answer/",
};

// Words on the forms, as the official instructions define them under "Terms You May Need to Know" (or, for a form's
// name, under "Forms Included in this Packet"). Quoted word for word, never reworded; a definition written for
// someone being sued is quoted only as far as it fits anyone. `match` finds the word in the tool's own explanations:
// case matters for Answer and Appearance, which are everyday words too.
const TERM_SRC = {
  answer: page => ({ text: `Answer instructions, page ${page}`, href: `${LINKS.answerInstructions}#page=${page}` }),
  cont: page => ({ text: `Continuance instructions, page ${page}`, href: `${LINKS.continuanceInstructions}#page=${page}` }),
};
const GLOSSARY = [
  { term: "Plaintiff", match: /\bplaintiff(?:'s|s)?\b/i, src: TERM_SRC.answer(3),
    says: "The person or company that is suing you." },
  { term: "Defendant", match: /\bdefendant(?:'s|s)?\b/i, src: TERM_SRC.answer(3),
    says: "The person being sued in a civil legal case, or lawsuit." },
  { term: "Complaint", match: /\bcomplaint\b/i, src: TERM_SRC.answer(3),
    says: "The official legal document filed by the Plaintiff to start a civil lawsuit against you. It lists the reasons they are suing you and tells the court what they want to happen in the case." },
  { term: "Answer", match: /\bAnswer(?:s)?\b/, src: TERM_SRC.answer(3),
    says: "Your formal response to the lawsuit (Complaint) filed against you. In this document, you tell the court which parts of the Complaint you agree with, which you disagree with, and which you aren't sure about. You can also use this form to list your defenses." },
  { term: "Defenses", match: /\bdefenses?\b/i, src: TERM_SRC.answer(3),
    says: "These are legal reasons why you should win the case or face reduced damages, even if some of the things the Plaintiff says in the Complaint are true. Important: You must list your defenses in this initial Answer. If you do not list them now, you may lose your right to use them later in the case." },
  { term: "Appearance", match: /\bAppearance\b/, src: TERM_SRC.answer(2),
    says: "This is the form that tells the court and the other party how to contact you if they need to." },
  { term: "Continuance", match: /\bcontinuance\b/i, src: TERM_SRC.cont(3),
    says: "A \"Continuance\" is when a person asks the court to delay a trial or hearing. You can do this if you have a good reason, which you need to show by giving proof, like a written statement. These forms will give you the place to provide the written statement. The court will decide if it's okay to postpone the hearing." },
  { term: "Related cases", match: /\brelated cases?\b/i, src: TERM_SRC.answer(4),
    says: "Sometimes there can be other cases that have the same parties." },
  { term: "Certificate of Service", match: /\bcertificate of service\b/i, src: TERM_SRC.answer(4),
    says: "You are required to give a copy of every form you file with the court to every other person involved in the case. You must say when you gave them the copies and how you gave them the copies." },
  { term: "Perjury", match: /\bperjury\b/i, src: TERM_SRC.answer(3),
    says: "When a person makes a false statement under oath in the things they say in case documents or when they testify in court, when they know the statement is false or they don't believe the statement is true." },
];
const termHtml = g => `<strong>${esc(g.term)}:</strong> \u201c${esc(g.says)}\u201d <small class="src">Source: <a href="${g.src.href}" target="_blank" rel="noopener">${esc(g.src.text)}</a></small>`;

// Official PDFs and which of their pages end up in the filled document.
// Page numbers are 0-based pages of the original PDF.
const OFFICIAL = {
  answerPacket: {
    file: "answerPacket",
    source: "forms/answer-packet-CCA-GF-1225-6003-CCA-GF-0626-6008.pdf",
    font: "Helvetica", maxSize: 11,
    // Pages 1-4 are instructions. Pages 5-6 = Appearance, 7-8 = Answer.
    docs: {
      appearance: { name: "Appearance", number: "CCA-GF-1225-6003", pages: [4, 5] },
      answer: { name: "Answer", number: "CCA-GF-0626-6008", pages: [6, 7] },
    },
    // Where "/s/ Name" goes when the user e-files (text baseline on each signature line).
    signatures: [{ page: 5, x: 127, y: 547, w: 266 }, { page: 5, x: 111, y: 170.5, w: 390 }, { page: 7, x: 111, y: 157, w: 426 }],
  },
  feeWaiverPacket: {
    file: "feeWaiverPacket",
    source: "forms/fee-waiver-packet-CCA-GF-0420-3012-3006-3007.pdf",
    font: "TimesRoman", maxSize: 12,
    removeButtons: ["Button8"], // a "Print" button that shouldn't be in a filed form
    docs: {
      appearance: { name: "Appearance", number: "CCA-GF-0420-3012", pages: [0, 1] },
      motion: { name: "Verified Motion for Fee Waiver", number: "CCA-GF-0420-3006", pages: [2, 3] },
      order: { name: "Order on Fee Waiver", number: "CCA-GF-0420-3007", pages: [4] },
    },
    signatures: [{ page: 1, x: 327, y: 557.5, w: 210 }, { page: 3, x: 362, y: 262, w: 162 }],
  },
  continuancePacket: {
    file: "continuancePacket",
    source: "forms/continuance-packet-CCA-GF-1219-3000-3002.pdf",
    font: "Helvetica", maxSize: 11,
    // Pages 1-3 are instructions. 4-5 = Appearance, 6-7 = Verified Motion, 8-9 = Order.
    docs: {
      appearance: { name: "Appearance", number: "CCA-GF-1219-3000", pages: [3, 4] },
      motion: { name: "Verified Motion for Continuance", number: "CCA-GF-1219-3002", pages: [5, 6] },
      // The Order's first page has no footer; its second page prints CCA-GF-1219-3002.
      order: { name: "Order on Verified Motion for Continuance", number: "CCA-GF-1219-3002", pages: [7, 8] },
    },
    signatures: [{ page: 4, x: 127, y: 525, w: 266 }, { page: 4, x: 113, y: 121.5, w: 280 }, { page: 6, x: 183, y: 588, w: 354 }, { page: 6, x: 113, y: 184.5, w: 280 }],
  },
};

// PDF tools, loaded only when the summary needs them. Pinned versions with
// integrity hashes so a changed file on the CDN is refused.
const LIBS = {
  pdfLib: { src: "https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js",
    integrity: "sha384-weMABwrltA6jWR8DDe9Jp5blk+tZQh7ugpCsF3JwSA53WZM9/14PjS5LAJNHNjAI" },
  pdfJs: { src: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",
    integrity: "sha384-/1qUCSGwTur9vjf/z9lmu/eCUYbpOTgSjmpbMQZ1/CtX2v/WcAIKqRv+U1DUCG6e" },
  pdfJsWorker: { src: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js",
    integrity: "sha384-SnzOobpRMLXZ52iJvZm/C0fYw0OQemTXzTjIsdsfMcrCtCEe9qgzxTd3RSklO5x2" },
};

const FORM = {
  caption: "Caption (top of each form)",
  answers: "Your other answers",
  appearance: "Appearance by Self-Represented Person in Civil Case",
  answer: "Answer",
  service: "Certificate of Service",
  fwAppearance: "Appearance by Unrepresented Person",
  fwMotion: "Verified Motion for Fee Waiver",
  fwOrder: "Order on Fee Waiver (the judge completes the rest)",
  sign: "Signatures",
  contMotion: "Verified Motion for Continuance",
  contOrder: "Order on Verified Motion for Continuance (the judge completes the rest)",
};
const formNumber = (sit, form) => (sit.formNumbers && sit.formNumbers[form]) || FORM_NUMBER[form];
const FORM_NUMBER = {
  [FORM.appearance]: "CCA-GF-1225-6003", [FORM.answer]: "CCA-GF-0626-6008",
  [FORM.fwAppearance]: "CCA-GF-0420-3012", [FORM.fwMotion]: "CCA-GF-0420-3006", [FORM.fwOrder]: "CCA-GF-0420-3007",
  [FORM.contMotion]: "CCA-GF-1219-3002", [FORM.contOrder]: "CCA-GF-1219-3002",
};
window.appParts++;
