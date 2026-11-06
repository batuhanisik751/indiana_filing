// How the court type fits on the forms, and where continuance answers land on its PDFs.
// The court type is written on the printed rule after "COUNTY", centered, in up to
// three short lines, so long names like "WASHINGTON TOWNSHIP SMALL CLAIMS" fit.
// The rules' positions were measured on the official PDFs (0-based pages).
const ANSWER_COURT_RULES = [{ page: 4, x0: 438.5, x1: 504.1, y: 714.8 }, { page: 6, x0: 438.2, x1: 504.1, y: 717.6 }];
const CONT_COURT_RULES = [{ page: 3, x0: 438.5, x1: 504.1, y: 714.8 }, { page: 5, x0: 438.5, x1: 504.1, y: 714.8 }, { page: 7, x0: 439.2, x1: 504.8, y: 729.4 }];
const COURT_LAYOUTS = [{ n: 1, sizes: [11, 10.5, 10, 9.5, 9, 8.5, 8, 7.5, 7] }, { n: 2, sizes: [8, 7.5, 7, 6.5, 6] }, { n: 3, sizes: [6, 5.5, 5] }];
// Fitted to the narrowest rule, so every form shows the same lines at the same size.
const courtTypeOps = (ct, rules) => {
  const w = Math.min(...rules.map(r => r.x1 - r.x0));
  return rules.map(r => ({ t: "lines", page: r.page, x0: r.x0, x1: r.x0 + w, ys: [r.y], layouts: COURT_LAYOUTS, center: true, smallOk: 6, value: ct.toUpperCase() }));
};

function contCaptionFields(a) {
  const ct = courtTypeText(a);
  // Until the person says who started the case, neither name goes on the form: the sides could be swapped.
  const first = a.role === "me" ? a.name : a.role === "other" ? a.otherParty : "", second = a.role === "me" ? a.otherParty : a.role === "other" ? a.name : "";
  return [
    // Centered, so the county doesn't run into the printed "COUNTY OF" label.
    f(FORM.caption, "County", a.county, "county", [{ t: "text", name: "County", value: a.county, align: "Center" }]),
    f(FORM.caption, "Court type", !ct ? "" : a.courtType === "other" ? `${ct} Court` : `${ct.charAt(0)}${ct.slice(1).toLowerCase()} Court`,
      a.courtType === "other" ? "courtTypeOther" : "courtType", courtTypeOps(ct, CONT_COURT_RULES)),
    f(FORM.caption, "Case number", a.caseNumber, "caseNumber", [{ t: "text", name: "Case Number", value: a.caseNumber }]),
    f(FORM.caption, "In re the matter of (who started the case)", first, !a.role ? "role" : a.role === "me" ? "name" : "otherParty", [{ t: "text", name: "Petitioner", value: first, growUp: true }]),
    f(FORM.caption, "v. (the other side)", second, !a.role ? "role" : a.role === "me" ? "otherParty" : "name", [{ t: "text", name: "Respondent", value: second, growUp: "vLine" }]),
    f(FORM.caption, "Who started the case", a.role === "me" ? "I did" : a.role === "other" ? "The other side" : "", "role"),
  ];
}

function contAppearanceFields(a) {
  const receive = { Choice1: "At my street address", Choice2: "At my email address", Choice3: "At the Attorney General confidential address" }[a.receiveAt] || "";
  return [
    f(FORM.appearance, "1. My name is", a.name, "name", [{ t: "text", name: "Petitioner or Repondent Name", value: a.name, growUp: true }]),
    f(FORM.appearance, "3. My address", myAddress(a), myAddressStep(a),
      [{ t: "lines", page: 3, x0: 72, x1: 540, ys: [423.7, 401.6], runOn: true, value: myAddress(a) }]),
    f(FORM.appearance, "Email address", a.email, "email", [{ t: "text", name: "Email Address", value: a.email }]),
    f(FORM.appearance, "Phone number", a.phone, "phone", [{ t: "text", name: "Phone Number", value: a.phone }]),
    f(FORM.appearance, "Fax number", empty(a.fax) ? "Left blank" : a.fax, "fax", [{ t: "text", name: "Fax Number", value: a.fax }]),
    f(FORM.appearance, "4. Receive court papers", receive, "receiveAt",
      a.receiveAt ? [{ t: "radio", name: "Case Information", option: a.receiveAt }] : []),
    f(FORM.appearance, "5. Case type letters", caseLetters(a), caseMatch(a.caseNumber) ? "caseNumber" : "caseTypeLetters",
      [{ t: "text", name: "Case Type Letters", value: caseLetters(a) }]),
    f(FORM.appearance, "6. Related cases", a.related === "yes" ? "Yes" : a.related === "no" ? "No other related cases" : "", "related",
      a.related ? [{ t: "radio", name: "Related Cases", option: a.related === "yes" ? "Choice1" : "Choice2" }] : []),
    ...(a.related === "yes" ? [f(FORM.appearance, "6. Related case numbers", a.relatedNumbers, "relatedNumbers", [{ t: "lines", page: 4, x0: 108, x1: 540.1, ys: [701.8], layouts: ABOVE_RULE_LAYOUTS, spacesOnly: "commas", value: a.relatedNumbers }])] : []),
    f(FORM.appearance, "7. Local rule information", a.localRule === "yes" ? "Provided below" : a.localRule === "none" ? "Not aware of any" : "", "localRule",
      a.localRule ? [{ t: "radio", name: "Local Rules", option: a.localRule === "yes" ? "Choice2" : "Choice1" }] : []),
    ...(a.localRule === "yes" ? [f(FORM.appearance, "7. Information required by local rule", a.localRuleText, "localRuleText", [{ t: "text", name: "Local Rule", value: a.localRuleText }])] : []),
    f(FORM.appearance, "Date next to your signature", formDate(a.signDate), "signDate",
      [{ t: "draw", page: 4, x: 461, y: 525, value: formDate(a.signDate) }]),
  ];
}

function contMotionFields(a) {
  return [
    f(FORM.contMotion, "1. My name is", a.name, "name"),
    f(FORM.contMotion, "2. My court hearing has been scheduled for", formDate(a.hearingDate), "hearingDate",
      [{ t: "text", name: "Court Hearing Date", value: formDate(a.hearingDate) }]),
    f(FORM.contMotion, "3. I need to change the date of the hearing because", a.reason, "reason",
      [{ t: "lines", page: 5, x0: [370, 90, 90, 90, 90, 90], x1: 540, ys: [375.8, 353.9, 331.9, 310.0, 288.0, 266.0], value: a.reason, continues: "Item 3 (why I need to change the date)" }]),
    f(FORM.contMotion, "4. I am asking the court for", a.timeNeeded, "timeNeeded",
      [{ t: "text", name: "Number of Days/Weeks Needed", value: a.timeNeeded }]),
    f(FORM.contMotion, "5. The name of the other party", a.otherParty, "otherParty",
      [{ t: "text", name: "Other Party (Petitioner or Respondent)", value: a.otherParty }]),
    f(FORM.contMotion, "6. I spoke to the other party on", empty(a.spokeDate) ? "Left blank" : formDate(a.spokeDate), "spokeDate",
      [{ t: "text", name: "Conversation Date", value: formDate(a.spokeDate) }]),
    f(FORM.contMotion, "The other party", { Choice1: "Agreed to my continuance request", Choice2: "Did not agree to my continuance request" }[a.otherAgreed] || "", "otherAgreed",
      a.otherAgreed ? [{ t: "radio", name: "Request Agreement/Disagreement", option: a.otherAgreed }] : []),
    f(FORM.contMotion, "Printed Name", a.name, "name"),
    f(FORM.contMotion, "Date", formDate(a.signDate), "signDate", [{ t: "draw", page: 6, x: 183, y: 566, value: formDate(a.signDate) }]),
  ];
}

function contOrderFields(a) {
  const meFirst = a.role === "me";
  const petAddr = !a.role ? "" : meFirst ? myAddress(a) : a.otherPartyAddress, resAddr = !a.role ? "" : meFirst ? a.otherPartyAddress : myAddress(a);
  return [
    f(FORM.contOrder, "Distribution: first party's address", empty(petAddr) ? "Left blank" : petAddr, meFirst ? myAddressStep(a) : "otherPartyAddress",
      [{ t: "lines", page: 8, x0: 216, x1: 576, ys: [698.5, 676.6], runOn: true, value: petAddr }]),
    f(FORM.contOrder, "Distribution: second party's address", empty(resAddr) ? "Left blank" : resAddr, meFirst ? "otherPartyAddress" : myAddressStep(a),
      [{ t: "lines", page: 8, x0: 216, x1: 576, ys: [610.6, 588.6], runOn: true, value: resAddr }]),
  ];
}

function contServiceFields(a) {
  const out = [];
  const n = recipientCount(a);
  for (let i = 1; i <= n; i++) {
    // The PDF's field name for row 2 has two spaces: "Service Name  2".
    const label = n > 1 ? ` (person ${i})` : "";
    out.push(
      f(FORM.service, `Sent to${label}`, a[`svc${i}Name`], `svc${i}Name`, [{ t: "text", name: i === 2 ? "Service Name  2" : `Service Name ${i}`, value: a[`svc${i}Name`], maxSize: 10 }]),
      f(FORM.service, `Address${label}`, a[`svc${i}Address`], `svc${i}Address`, [{ t: "text", name: `Service Address ${i}`, value: a[`svc${i}Address`], maxSize: 10 }]),
      f(FORM.service, `Type of service used${label}`, a[`svc${i}Method`], `svc${i}Method`, [{ t: "text", name: `Service Type ${i}`, value: a[`svc${i}Method`], maxSize: 10 }]),
      f(FORM.service, `Date of service${label}`, formDate(a[`svc${i}Date`]), `svc${i}Date`, [{ t: "text", name: `Service Date ${i}`, value: formDate(a[`svc${i}Date`]), maxSize: 10 }]),
    );
    if (i < MAX_RECIPIENTS) out.push(f(FORM.service, `Anyone else to send a copy to (after person ${i})`, yesNo(a[`svcMore${i}`]), `svcMore${i}`));
  }
  out.push(f(FORM.service, "Date next to your signature (on both forms)", formDate(a.signDate), "signDate",
    [{ t: "draw", page: 4, x: 461, y: 121.5, value: formDate(a.signDate) }, { t: "draw", page: 6, x: 461, y: 184.5, value: formDate(a.signDate) }]));
  return out;
}
window.appParts++;
