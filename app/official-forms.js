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
