// "What to do next": the steps for each situation and their official sources.
/* =====================================================================
   NEXT STEPS
   What to do after downloading. Every statement comes from an official
   Indiana source, named in the text and linked.
   ===================================================================== */
// County clerk's offices from the Indiana Directory of Courts & Clerks
// (https://www.in.gov/courts/files/court-directory.pdf, dated October 21, 2026, downloaded November 3, 2026):
// address lines and main phone number. For counties where the directory only
// gives a P.O. box, mailing: true, and note quotes where the directory says the office is.
const CLERKS = {
  "Adams": { address: ["112 S. 2nd Street, Room A", "Decatur, IN 46733-1618"], phone: "260-724-5309" },
  "Allen": { address: ["715 South Calhoun Street, # 201", "Fort Wayne, IN 46802"], phone: "260-449-7245" },
  "Bartholomew": { address: ["P.O. Box 924", "Columbus, IN 47202-0924"], phone: "812-379-1600", mailing: true, court: "the Bartholomew Circuit Court at 234 Washington Street, Columbus, IN 47201" },
  "Benton": { address: ["706 E. 5th Street", "Fowler, IN 47944"], phone: "765-884-0930" },
  "Blackford": { address: ["110 W. Washington", "Hartford City, IN 47348"], phone: "765-348-1130" },
  "Boone": { address: ["212 Courthouse Square", "Lebanon, IN 46052"], phone: "765-482-3510" },
  "Brown": { address: ["PO BOX 85", "20 E. Main Street", "Nashville, IN 47448"], phone: "812-988-5510" },
  "Carroll": { address: ["101 W. Main Street", "Delphi, IN 46923"], phone: "765-564-4485" },
  "Cass": { address: ["200 Court Park, # 103", "Logansport, IN 46947"], phone: "574-753-7740" },
  "Clark": { address: ["Clark County Government Building", "501 E. Court Avenue", "Jeffersonville, IN 47130"], phone: "812-285-6244" },
  "Clay": { address: ["609 E. National Avenue, # 213", "Brazil, IN 47834"], phone: "812-448-9024" },
  "Clinton": { address: ["265 Courthouse Square", "Frankfort, IN 46041"], phone: "765-659-6335" },
  "Crawford": { address: ["PO BOX 375", "715 Judicial Plaza Drive", "English, IN 47118"], phone: "812-338-2565" },
  "Daviess": { address: ["P.O. Box 739", "200 E. Walnut Street", "Washington, IN 47501"], phone: "812-254-8669" },
  "Dearborn": { address: ["165 Mary Street", "Lawrenceburg, IN 47025"], phone: "812-537-8867" },
  "Decatur": { address: ["150 Courthouse Square, # 244", "Greensburg, IN 47240"], phone: "812-663-8223" },
  "DeKalb": { address: ["PO BOX 230", "100 S. Main Street", "Auburn, IN 46706"], phone: "260-925-0912" },
  "Delaware": { address: ["3100 S. Tillotson Avenue", "Muncie, IN 47302"], phone: "765-747-7726" },
  "Dubois": { address: ["One Courthouse Square", "Jasper, IN 47546"], phone: "812-481-7035" },
  "Elkhart": { address: ["1905 Reliance Road", "Goshen, IN 46526"], phone: "574-538-3000" },
  "Fayette": { address: ["401 N. Central Avenue", "Connersville, IN 47331"], phone: "765-825-1813" },
  "Floyd": { address: ["311 Hauss Square, # 235", "New Albany, IN 47150"], phone: "812-948-5415" },
  "Fountain": { address: ["PO BOX 183", "Covington, IN 47932"], phone: "765-793-2192", mailing: true, note: "The Clerk’s Office is in the Fountain County Courthouse.", court: "the Fountain Circuit Court at 301 4th Street, Covington, IN 47932" },
  "Franklin": { address: ["459 Main Street", "Brookville, IN 47012"], phone: "765-647-5111" },
  "Fulton": { address: ["815 Main Street", "Rochester, IN 46975"], phone: "574-223-4824" },
  "Gibson": { address: ["101 N. Main Street", "Princeton, IN 47670-1562"], phone: "812-386-6474" },
  "Grant": { address: ["101 E. 4th Street", "Marion, IN 46952"], phone: "765-668-8121" },
  "Greene": { address: ["PO BOX 229", "Bloomfield, IN 47424"], phone: "812-384-8532", mailing: true, court: null },
  "Hamilton": { address: ["One Hamilton Square, # 106", "Noblesville, IN 46060"], phone: "317-776-9629" },
  "Hancock": { address: ["9 East Main Street, Rm. 213", "Greenfield, IN 46140"], phone: "317-477-1109 (the directory also lists 1143)" },
  "Harrison": { address: ["300 N. Capitol Ave.", "Corydon, IN 47112"], phone: "812-738-4289" },
  "Hendricks": { address: ["One Courthouse Square", "51 W. Main St., # 104", "Danville, IN 46122"], phone: "317-745-9231" },
  "Henry": { address: ["1215 Race Street, Suite 120", "New Castle, IN 47362"], phone: "765-529-6401" },
  "Howard": { address: ["104 N. Buckeye Street, Room 202", "Kokomo, IN 46901"], phone: "765-456-2000" },
  "Huntington": { address: ["201 N. Jefferson Street, # 201", "Huntington, IN 46750"], phone: "260-358-4819" },
  "Jackson": { address: ["P.O. BOX 318 (mailing address)", "109 S. Sugar Street", "Brownstown, IN 47220"], phone: "812-358-6117" },
  "Jasper": { address: ["115 W. Washington Street, # 204", "Rensselaer, IN 47978"], phone: "219-866-4927" },
  "Jay": { address: ["120 N. Court Street", "Portland, IN 47371"], phone: "260-726-6915" },
  "Jefferson": { address: ["300 East Main Street, # 203", "Madison, IN 47250"], phone: "812-265-8922" },
  "Jennings": { address: ["PO BOX 385", "Vernon, IN 47282"], phone: "812-352-3070", mailing: true, note: "The Clerk’s Office is in the Jennings County Courthouse.", court: "the Jennings Superior Court at 24 North Pike Street, Vernon, IN 47282" },
  "Johnson": { address: ["PO BOX 368", "Five East Jefferson Street", "Franklin, IN 46131"], phone: "317-346-4450" },
  "Knox": { address: ["111 North Seventh Street", "Vincennes, IN 47591"], phone: "812-885-2521" },
  "Kosciusko": { address: ["121 N. Lake Street", "Warsaw, IN 46580"], phone: "574-372-2334" },
  "LaGrange": { address: ["105 North Detroit Street", "LaGrange, IN 46761"], phone: "260-499-6371" },
  "Lake": { address: ["2293 N. Main Street", "Crown Point, IN 46307"], phone: "219-755-3461" },
  "LaPorte": { address: ["813 Lincolnway, #105", "LaPorte, IN 46350"], phone: "219-326-6808" },
  "Lawrence": { address: ["916 15th Street, # 31", "Bedford, IN 47421"], phone: "812-275-7543" },
  "Madison": { address: ["16 E. Ninth Street, #213", "Anderson, IN 46016"], phone: "765-641-9443" },
  "Marion": { address: ["675 Justice Way", "Indianapolis, IN 46203"], phone: "317-327-4740" },
  "Marshall": { address: ["211 W. Madison St.", "Plymouth, IN 46563"], phone: "574-936-8922" },
  "Martin": { address: ["PO BOX 120", "Shoals, IN 47581"], phone: "812-247-3651", mailing: true, note: "The Clerk’s Office is in the Martin County Courthouse.", court: "the Martin Circuit Court at 111 Main St. Annex, Shoals, IN 47581" },
  "Miami": { address: ["25 North Broadway, Room 208", "Peru, IN 46970"], phone: "765-472-3901 x256" },
  "Monroe": { address: ["PO BOX 547", "Bloomington, IN 47402"], phone: "812-349-2600", mailing: true, note: "The Clerk’s Office is in the Monroe County Justice Building.", court: "the Monroe Circuit Court at 301 North College Avenue, Bloomington, IN 47404" },
  "Montgomery": { address: ["100 East Main Street", "Crawfordsville, IN 47933"], phone: "765-364-6430" },
  "Morgan": { address: ["Morgan County Justice Campus", "180 S. Main St.", "Martinsville, IN 46151"], phone: "765-205-1548" },
  "Newton": { address: ["PO BOX 49", "Kentland, IN 47951"], phone: "219-474-6081", mailing: true, note: "The Clerk’s Office is in the Newton County Courthouse.", court: null },
  "Noble": { address: ["101 North Orange Street", "Albion, IN 46701"], phone: "260-636-2736" },
  "Ohio": { address: ["PO BOX 185", "Rising Sun, IN 47040"], phone: "812-438-2610", mailing: true, court: "the Ohio Circuit Court #1 at 413 Main Street, Rising Sun, IN 47040" },
  "Orange": { address: ["1 Court Street", "Paoli, IN 47454"], phone: "812-723-2649" },
  "Owen": { address: ["PO BOX 146", "Spencer, IN 47460"], phone: "812-829-5015", mailing: true, note: "The Clerk’s Office is in the Owen County Courthouse.", court: null },
  "Parke": { address: ["116 West High Street, Room 204", "Rockville, IN 47872"], phone: "765-569-5132" },
  "Perry": { address: ["2219 Payne Street", "Tell City, IN 47586"], phone: "812-547-3741" },
  "Pike": { address: ["PO BOX 125", "Petersburg, IN 47567"], phone: "812-354-6025", mailing: true, note: "The Clerk’s Office is in the Pike County Courthouse.", court: null },
  "Porter": { address: ["16 Lincolnway, # 209", "Valparaiso, IN 46383"], phone: "219-465-3450" },
  "Posey": { address: ["300 Main Street, Room 115", "Mount Vernon, IN 47620"], phone: "812-838-1306" },
  "Pulaski": { address: ["117 East Main Street", "Winamac, IN 46996"], phone: "574-946-3313" },
  "Putnam": { address: ["One Courthouse Square", "Greencastle, IN 46135"], phone: "765-653-2648" },
  "Randolph": { address: ["100 S. Main Street, Room 201", "Winchester, IN 47394"], phone: "765-584-4214" },
  "Ripley": { address: ["PO Box 177", "Versailles, IN 47042"], phone: "812-689-6115", mailing: true, note: "The Clerk’s Office is in the Ripley County Courthouse.", court: null },
  "Rush": { address: ["101 E. 2nd Street, Room 209", "Rushville, IN 46173"], phone: "765-932-2086" },
  "St. Joseph": { address: ["101 South Main Street", "South Bend, IN 46601"], phone: "574-235-9635" },
  "Scott": { address: ["One East McClain Avenue", "Scottsburg, IN 47170"], phone: "812-752-8420" },
  "Shelby": { address: ["407 South Harrison Street", "Shelbyville, IN 46176"], phone: "317-392-6320" },
  "Spencer": { address: ["200 Main Street", "Rockport, IN 47635"], phone: "812-649-6029" },
  "Starke": { address: ["53 East Washington Street", "Knox, IN 46534"], phone: "574-772-9128" },
  "Steuben": { address: ["305 South Martha Street", "Steuben County Judicial Center, 1st Floor", "Angola, IN 46703"], phone: "260-668-1000" },
  "Sullivan": { address: ["P.O. Box 370", "100 Courthouse Square", "Sullivan, IN 47882"], phone: "812-268-4657" },
  "Switzerland": { address: ["212 West Main Street", "Vevay, IN 47043"], phone: "812-427-4415" },
  "Tippecanoe": { address: ["PO BOX 1665", "Lafayette, IN 47901"], phone: "765-423-9326", mailing: true, court: "the Tippecanoe Circuit Court at 301 Main Street, Lafayette, IN 47901" },
  "Tipton": { address: ["101 East Jefferson Street", "Tipton, IN 46072"], phone: "765-675-2795" },
  "Union": { address: ["26 West Union Street", "Liberty, IN 47353"], phone: "765-458-6121" },
  "Vanderburgh": { address: ["PO BOX 3356", "Evansville, IN 47732-3356"], phone: "812-435-5160", mailing: true, note: "The Clerk’s Office is in the new Vanderburgh County Courthouse.", court: "the Vanderburgh Circuit Court at 825 Sycamore St., # 210, Evansville, IN 47708" },
  "Vermillion": { address: ["PO BOX 10", "255 South Main", "Newport, IN 47966"], phone: "765-492-3500" },
  "Vigo": { address: ["33 South Third Street", "Courthouse, 1st Floor", "Terre Haute, IN 47807"], phone: "812-462-3211" },
  "Wabash": { address: ["69 West Hill Street", "Wabash, IN 46992"], phone: "260-563-0661" },
  "Warren": { address: ["125 North Monroe Street, # 11", "Williamsport, IN 47993"], phone: "765-762-3510" },
  "Warrick": { address: ["One County Square, # 200", "Boonville, IN 47601"], phone: "812-897-6160" },
  "Washington": { address: ["801 S. Jackson Street, Suite 102", "Salem, IN 47167"], phone: "812-883-5748" },
  "Wayne": { address: ["301 East Main Street", "Richmond, IN 47374-4200"], phone: "765-973-9220" },
  "Wells": { address: ["102 Market Street, #201", "Bluffton, IN 46714"], phone: "260-824-6482" },
  "White": { address: ["PO BOX 350", "110 North Main Street", "Monticello, IN 47960"], phone: "574-583-7032" },
  "Whitley": { address: ["101 West Van Buren Street", "Columbia City, IN 46725"], phone: "260-248-3102" },
};

const MARION_SMALL_CLAIMS = [
  ["Center Township", "300 E. Fall Creek Parkway N. Drive, Indianapolis, IN 46205", "317-920-4530"],
  ["Decatur Township", "3730 South Foltz St., Indianapolis, IN 46241", "317-241-2854"],
  ["Franklin Township", "4531 Independence Square, Indianapolis, IN 46203", "317-784-1751"],
  ["Lawrence Township", "4455 McCoy St., Indianapolis, IN 46226", "317-545-2369"],
  ["Perry Township", "4925 S. Shelby St., #100, Indianapolis, IN 46227", "317-786-9242"],
  ["Pike Township", "5665 Lafayette Rd., Suite B, Indianapolis, IN 46254", "317-293-1842"],
  ["Warren Township", "501 N. Post Rd., Suite C, Indianapolis, IN 46219", "317-327-8919"],
  ["Washington Township", "5302 N. Keystone Ave., Suite E, Indianapolis, IN 46220", "317-327-8184"],
  ["Wayne Township", "5401 W. Washington St., Indianapolis, IN 46241", "317-241-9573"],
];
const SCM_NOT_MARION = "The Small Claims Manual says it does not address the specific jurisdiction or procedures of Marion County Small Claims Court, but Small Claims Rule 1(A) says these rules apply there too.";

const SOURCES = {
  answerInstructions: { href: LINKS.answerInstructions, text: "Indiana Legal Help: Answer instructions" },
  respond: { href: "https://indianalegalhelp.org/respond-after-a-case-is-filed/", text: "Indiana Legal Help: Respond After a Case is Filed" },
  inPerson: { href: LINKS.fileInPerson, text: "Indiana Legal Help: How to File Forms with the Court in Person" },
  efile: { href: LINKS.efile, text: "Indiana Legal Help: How to Electronically File Forms with the Court" },
  efileGuide: { href: "https://www.in.gov/courts/files/efiling-user-guide.pdf", text: "Indiana E-Filing User Guide" },
  waiverAccount: { href: "https://www.in.gov/courts/tutorials/efile-creating-waiver-account/", text: "How to create a waiver account" },
  efileSite: { href: "https://efile.incourts.gov/", text: "efile.incourts.gov (the state's e-filing provider)" },
  tr86: { href: "https://rules.incourts.gov/Content/trial/rule86/current.htm", text: "Trial Rule 86" },
  tr41: { href: "https://rules.incourts.gov/Content/trial/rule41/current.htm", text: "Trial Rule 41" },
  tr55: { href: "https://rules.incourts.gov/Content/trial/rule55/current.htm", text: "Trial Rule 55" },
  sc4: { href: "https://rules.incourts.gov/Content/small-claims/rule4/current.htm", text: "Small Claims Rule 4" },
  sc10: { href: "https://rules.incourts.gov/Content/small-claims/rule10/current.htm", text: "Small Claims Rule 10" },
  sc1: { href: "https://rules.incourts.gov/Content/small-claims/rule1/current.htm", text: "Small Claims Rule 1" },
  feeFaq: { href: "https://indianalegalhelp.org/filing-fee-frequently-asked-questions/", text: "Indiana Legal Help: Filing Fee Questions" },
  feeWaiverInstructions: { href: LINKS.feeWaiverInstructions, text: "Indiana Legal Help: Fee waiver instructions" },
  serviceFaq: { href: "https://indianalegalhelp.org/service-frequently-asked-questions/", text: "Indiana Legal Help: Service Frequently Asked Questions" },
  smallClaims: { href: "https://www.in.gov/courts/files/small-claims-manual.pdf", text: "Indiana Small Claims Manual" },
  newDate: { href: LINKS.continuance, text: "Indiana Legal Help: How to Ask for a New Court Date" },
  contInstructions: { href: LINKS.continuanceInstructions, text: "Indiana Legal Help: Continuance instructions" },
  mycase: { href: "https://mycase.in.gov/", text: "mycase.in.gov" },
  directory: { href: LINKS.courtDirectory, text: "Indiana court directory" },
  getHelp: { href: LINKS.getHelp, text: "Find free legal help" },
  helpDesk: { href: LINKS.helpDesk, text: "Indiana Legal Help Desk" },
  answerTopic: { href: LINKS.answerTopic, text: "Indiana Legal Help: Answer" },
  courtStaff: { href: "https://www.in.gov/courts/selfservice/unrepresented/help", text: "Indiana courts: How court staff can help" },
  evictionFaq: { href: "https://indianalegalhelp.org/eviction-frequently-asked-questions/", text: "Indiana Legal Help: Eviction Frequently Asked Questions" },
  proSup: { href: "https://www.indianalegalservices.org/debt-collection-pro-sup/", text: "Indiana Legal Services: Guide to Proceedings Supplemental" },
  debt: { href: "https://indianalegalhelp.org/legal-topic-category/debt-2/", text: "Indiana Legal Help: Debt" },
  garnishment: { href: "https://indianalegalhelp.org/legal-topic/wage-garnishment-reduction/", text: "Indiana Legal Help: Wage Garnishment Reduction" },
  efileSchedule: { href: "https://www.in.gov/courts/efiling/schedule/", text: "Which case types can be e-filed" },
};
// Indiana Legal Help's own description of its Help Desk.
const HELP_DESK = "Indiana Legal Help says the Indiana Legal Help Desk is open weekdays from 10am to 2pm ET, with options to call, text, chat or email with housing legal navigators, and that it currently focuses on housing legal issues like eviction. You reach it through the chat bubble on any page of IndianaLegalHelp.org.";

function nextSteps(key, a) {
  // The filing method may not be chosen yet; then both ways are shown.
  const efile = a.fileMethod === "efile", paper = a.fileMethod === "paper";
  const mayEfile = !paper, mayPaper = !efile;
  const { packet, docs } = SITUATIONS[key].official;
  const pages = new Set(docs.flatMap(d => OFFICIAL[packet].docs[d].pages));
  const signLines = OFFICIAL[packet].signatures.filter(s => pages.has(s.page)).length;
  const lines = signLines === 1 ? "the signature line" : signLines === 2 ? "both signature lines" : `all ${signLines} signature lines`;
  const hasOrder = docs.includes("order");
  const clerk = CLERKS[a.county];
  const out = [];
  // A small claims case is known from the case type letters (SC) or a Notice of Claim
  // in the sorting questions; otherwise the small claims facts say "if".
  const letters = CASE_CODES.has(caseLetters(a)) ? caseLetters(a) : "";
  // Case type letters decide when they can: an EV case can be in either court, other letters rule small claims out.
  const notSmallClaims = letters ? !["SC", "EV"].includes(letters) : fromTriage && paperOf(triage) === "complaint";
  const smallClaims = letters === "SC" || (!notSmallClaims && fromTriage && paperOf(triage) === "notice");

  // 1. Deadlines and what the court date means for this situation.
  // Someone being sued who isn't filling out the Answer still has to know it may be due.
  if ((key === "appearance" || (key === "continuance" && a.role !== "me")) && !smallClaims) out.push({
    title: "Check whether an Answer is due",
    body: "These forms don't answer the complaint. Indiana Legal Help says an Appearance tells the court who you are and how the court and others can contact you. If you got a Complaint, its Answer instructions say you generally have twenty days to file your Answer once you've received the complaint, and it says the court might decide the case without you if you don't file an Answer when you're required to. It also says Answers are not usually filed in small claims court or family court. This tool can fill out the Answer too: choose \"I'm being sued and need to respond to the complaint.\"",
    links: [SOURCES.answerInstructions, SOURCES.answerTopic, SOURCES.respond] });

  if (key === "respond") out.push({
    title: "Check your deadline",
    body: `Indiana Legal Help's Answer instructions say you generally have twenty days to file your Answer once you've received the complaint. Indiana Legal Help also says the court might decide the case without you if you don't file an Answer when you're required to.${
      caseLetters(a) === "SC" ? " Your case type is SC (small claims). Indiana Legal Help says Answers are not usually filed in small claims court."
      : caseLetters(a) === "EV" ? " Your case type is EV (eviction). If your case is in small claims court, Indiana Legal Help says Answers are not usually filed there."
      : FAMILY_CASES[caseLetters(a)] ? ` Your case type is ${caseLetters(a)} (${FAMILY_CASES[caseLetters(a)]}). Indiana Legal Help says Answers are not usually filed in small claims court or family court.` : ""}`,
    links: [SOURCES.answerInstructions, SOURCES.answerTopic] });

  if (key === "continuance") out.push({
    title: "Your court date stays the same until the judge signs an order",
    body: `${hasPassed(a.hearingDate) ? `The hearing date you entered, ${formDate(a.hearingDate)}, has already passed. Check it against your papers. ` : a.hearingDate ? `Your hearing is still set for ${formDate(a.hearingDate)}. ` : ""}Indiana Legal Help says only an order signed by the judge can change a court date or time, and that you should show up to court on the date and time on the court order. Its instructions say the Order is the form the judge must sign to grant your request, and if it's granted, the judge will schedule your hearing for a new date and time. They also say all the forms in the packet are required to file your Motion for Continuance. You can check your case at mycase.in.gov.`,
    links: [SOURCES.newDate, SOURCES.contInstructions, SOURCES.mycase] });

  if (key === "feewaiver") out.push({
    title: "File these with the forms that start your case",
    body: "Indiana Legal Help says the fee to start a new civil case is $157, or $185 if you want the sheriff to serve the papers. The Order is the judge's decision on your request: its instructions have you fill in only the top section and your name and address. If the request is granted, it lets the judge either let you file without paying fees and costs up front, or have you pay part of the filing fee to the clerk within 20 days. It also says the court will decide later whether any costs must be paid.",
    links: [SOURCES.feeFaq, SOURCES.feeWaiverInstructions, SOURCES.inPerson] });

  // 2. Signing.
  if (!efile && !paper) out.push({
    title: "Signing",
    body: `You haven't chosen how you'll file yet. If you e-file, the E-Filing User Guide allows e-filed documents to be signed with "/s/" and your name, and this tool adds that when you choose e-filing. If you file at the courthouse, print the forms and sign ${lines}: Indiana Legal Help says forms must be signed before they are filed.`,
    links: [SOURCES.efileGuide, SOURCES.inPerson] });
  else out.push(efile
    ? { title: "Your signature",
        body: empty(a.name)
          ? "Your name is blank, so there's no signature on the form yet. Add your name, and the form will be signed with \"/s/\" and your name, which the E-Filing User Guide allows for e-filed documents."
          : `Your forms are signed with "/s/ ${a.name}" on ${lines}. The E-Filing User Guide allows this for e-filed documents.`,
        links: [SOURCES.efileGuide] }
    : { title: "Sign by hand", body: `Print the forms and sign ${lines}. Indiana Legal Help says forms must be signed before they are filed.`, links: [SOURCES.inPerson] });

  // 3. How to file: the e-filing site, or the county clerk's office.
  if (mayEfile) {
    const parts = [
      "The E-Filing User Guide says you can always e-file at no cost, other than filing or service fees, using the state's e-filing provider at efile.incourts.gov. Other e-filing providers are also allowed.",
      docs.length > 1 ? "The guide says all the documents in a filing should match the filing code you give it: for example, appearance documents go under the Appearance filing code, and other documents go under a separate filing code. That's why you can download each form on its own." : "",
      hasOrder ? "It also says a proposed order filed with a motion must be submitted under the separate \"Proposed Order\" filing code." : "",
      key === "feewaiver" ? "To ask for a fee waiver when e-filing, the guide says you submit the request with your first filing and choose a waiver account, set up with your e-filing provider, as the payment account. It also says the court must approve a fee waiver for you to file a case with one, though some waivers are automatic by law." : "",
      key === "feewaiver" ? "The guide also says that for some case types, e-filing in a trial court is not currently available, and some case types can only be e-filed after the case is open. It points to a current list." : "",
      "Indiana Legal Help says the guide shows how to choose an e-filing provider and set up a free account.",
    ];
    out.push({ title: efile ? "File online" : "If you file online", body: parts.filter(Boolean).join(" "),
      links: [SOURCES.efileSite, SOURCES.efileGuide, SOURCES.efile, ...(key === "feewaiver" ? [SOURCES.waiverAccount, SOURCES.efileSchedule] : [])] });
  }
  if (mayPaper) {
    out.push({ title: paper ? "File at the courthouse" : "If you file at the courthouse",
      body: [
        "Indiana Legal Help says to bring the forms to the court where they need to be filed.",
        !clerk ? "" : clerk.mailing
          ? `The Indiana court directory gives a mailing address for the ${a.county} County Clerk's Office: ${clerk.address.join(", ")}.${clerk.note ? ` It also says: "${clerk.note}"` : ""} Phone: ${clerk.phone}.${
              clerk.court ? ` It lists ${clerk.court}.` : clerk.court === null ? ` It lists only P.O. boxes for ${a.county} County's courts, so you may want to call the clerk's office to ask where to bring your forms.` : ""}`
          : `The Indiana court directory lists the ${a.county} County Clerk's Office at ${clerk.address.join(", ")}, phone ${clerk.phone}.`,
        a.county === "Marion" ? `The directory also lists Marion County's nine township small claims courts: ${MARION_SMALL_CLAIMS.map(([n, ad, ph]) => `${n}, ${ad} (${ph})`).join("; ")}.` : "",
        "Indiana Legal Help says courts differ on copies: some courts require you to bring one, two or three copies of each document, and some prefer you not bring any, so you may want to contact the court first.",
      ].filter(Boolean).join(" "),
      links: [SOURCES.inPerson, SOURCES.directory] });
  }

  // 4. Fees and the fee waiver option.
  if (key !== "feewaiver") out.push({
    title: "Filing fee",
    body: `Indiana Legal Help says a filing fee is generally charged only when a case is started, so it is not usually charged every time a document is filed. If you're asked to pay a fee you can't afford, Indiana Legal Help says a filing fee waiver asks the court to waive (not charge) the fee because you cannot afford to pay it, and its filing fee page points to the fee waiver instructions and form on its "How to File Forms with the Court in Person" page (family law cases have their own form).${mayEfile ? " If you e-file, the E-Filing User Guide says you should set up a waiver payment account with your e-filing provider, and that using it for filings that have no fee, like most appellate filings, and in cases where you've been granted pauper status (fees waived) helps make sure fees aren't charged when they aren't due." : ""}`,
    links: [SOURCES.feeFaq, SOURCES.inPerson, ...(mayEfile ? [SOURCES.efileGuide, SOURCES.waiverAccount] : [])] });

  // 5. Serving the other side.
  if (key === "feewaiver") out.push({
    title: "Serving the other side",
    body: `The fee waiver forms themselves say there is no other party to serve. The forms that start your case are different: Indiana Legal Help's Service FAQ says that when a court case begins, it's important for both sides to know about it and receive official forms, which is called service of process. It says to call the clerk or court first and ask what your service options are and what each one costs. For when you know the person's address, it describes sheriff service, certified mail sent by the clerk, and a private process server, and it also covers what to do if you don't know the address. Indiana Legal Help says the fee to start a case with sheriff service is $185.${mayEfile ? " If you e-file, the E-Filing User Guide says to follow Trial Rule 86(B)(2) when serving a filing that starts a case. That rule says you also file completed summonses designating the manner of service, and that you are responsible for service of process, except that when fees and court costs are waived and the clerk has received the required notice that you are entitled to the waiver, the clerk serves the complaint and summonses." : ""}`,
    links: [SOURCES.serviceFaq, SOURCES.feeFaq, ...(mayEfile ? [SOURCES.efileGuide, SOURCES.tr86] : [])] });
  else out.push({
    title: "Send a copy to the other side",
    body: `Indiana Legal Help's instructions say you are required to give a copy of every form you file to every other person involved in the case. They list three ways: First Class U.S. mail (which they describe as paying to have the clerk send the forms by certified mail), Hand Delivery (paying a sheriff or private company to deliver them), and Indiana's E-Filing System. Indiana Legal Help's Service FAQ, for a case that is already open, also describes First Class U.S. Mail as putting the forms in an envelope with enough stamps, and lists sheriff service, certified mail and a private process server. The Certificate of Service on your form lists who you're sending a copy to, how and when.${mayEfile ? " If you e-file, the E-Filing User Guide says that when you e-file, you must serve electronically any party or attorney who has a service contact listed in the case or on the Public Service List, and that self-represented litigants who haven't attached themselves as a service contact must be served conventionally." : ""}`,
    links: [key === "continuance" ? SOURCES.contInstructions : SOURCES.answerInstructions, SOURCES.serviceFaq, ...(mayEfile ? [SOURCES.efileGuide] : [])] });

  // 6. Court dates and what missing one can mean.
  // What missing a court date can mean, in the Small Claims Manual's own terms.
  const marionNote = a.county === "Marion" ? ` ${SCM_NOT_MARION}` : "";
  const ifSC = smallClaims ? "In small claims court" : "If your case is in small claims court";
  // Missing a hearing: Indiana Legal Help says what can happen only in its Eviction FAQ, so this is for
  // evictions. It is said plainly for an eviction, with "In an eviction case" when the kind of case isn't
  // known (no case type letters, or "I have a small claims case"), and left out for other kinds of cases.
  const eviction = letters ? letters === "EV"
    : fromTriage && triage.kind !== "smallclaims" ? kindOf(triage) === CASE_KINDS.eviction : null;
  const missFact = eviction === false ? ""
    : `${eviction ? "" : "In an eviction case, "}Indiana Legal Help's Eviction FAQ says that if you don't show up to your hearing, the court can rule against you without hearing your side of the story (a default judgment).`;
  // Superior and circuit court cases that aren't evictions: no official source this tool uses says what missing a
  // hearing itself can mean. Trial Rule 55 is the closest, so the tool quotes it, says what it doesn't cover, and
  // points to who can answer. The plain words for a default are how other states' court self-help pages explain it.
  const whoToAsk = "Indiana's court staff page says staff can explain and answer questions about how the court works, but cannot give legal advice. You can ask free legal help what missing a hearing could mean for your case.";
  const starterRule = `Indiana's Trial Rule 41(E) says that when there has been a "failure to comply with these rules" the court shall order a hearing about dismissing the case, and that it dismisses the case if the person who started it doesn't show "sufficient cause." Trial Rule 55 says a party who has "failed to plead or otherwise comply with these rules" may be defaulted by the court, including on a counterclaim, which can mean losing that claim without the court hearing your side. These rules don't name missing a hearing specifically. ${whoToAsk}`;
  const defaultRule = `Indiana's Trial Rule 55 says a person who has "failed to plead or otherwise comply with these rules" may be defaulted by the court, which can mean the other side wins without the court hearing your side. The rule doesn't name hearings specifically. ${whoToAsk}`;
  const noSourceFact = eviction === true || smallClaims ? ""
    : notSmallClaims && eviction === false ? defaultRule
    : `In other kinds of cases, ${defaultRule}`;
  // Someone who started the case: the eviction sentence is about the other side, so only the court matters.
  const starterFact = smallClaims ? "" : notSmallClaims ? starterRule
    : `If your case isn't in small claims court, ${starterRule}`;
  const scLinks = [SOURCES.smallClaims, SOURCES.sc10, ...(a.county === "Marion" ? [SOURCES.sc1] : [])];
  const missLinks = [...(missFact ? [SOURCES.evictionFaq] : []), ...(noSourceFact ? [SOURCES.tr55, SOURCES.courtStaff, SOURCES.getHelp] : [])];
  const defaultFact = notSmallClaims ? "" : `${ifSC}, Small Claims Rule 10(B) says that if the defendant (the person being sued) fails to appear at the time and place on the notice of claim, or on a continued date, "the court may enter a default judgment against him." The Small Claims Manual defines that as a decision for the plaintiff when the defendant fails to appear in court. So if that's you, missing court can mean losing without the court hearing your side.${marionNote}`;
  const dismissText = `${ifSC}, the Small Claims Manual says that if the plaintiff (the person suing) fails to appear, the court may dismiss the claim without prejudice, which means the plaintiff can refile by paying another filing fee, and that a second failure to appear may mean it is dismissed with prejudice, which prevents further action in the case. Small Claims Rule 10(A) adds that if a counterclaim has been filed (a claim back against the person suing), "the court may grant judgment for the defendant" after first making an inquiry, so you could lose on that claim without the court hearing your side.${marionNote}`;
  const dismissFact = notSmallClaims ? "" : dismissText;
  if (key === "respond" || key === "appearance") out.push({
    title: "Go to every court date",
    body: `${hasPassed(a.courtDate) ? `The court date you entered, ${formDate(a.courtDate)}, has already passed. Check your papers for your next court date, or look it up at mycase.in.gov. ` : a.courtDate ? `Your next court date: ${formDate(a.courtDate)}. ` : "Check your papers for your court date, or look it up at mycase.in.gov. "}Indiana Legal Help says only an order signed by the judge can change a court date or time, and that you should show up to court on the date and time on the court order. ${[missFact, defaultFact, noSourceFact].filter(Boolean).join(" ")}`,
    links: [SOURCES.mycase, SOURCES.newDate, ...missLinks, ...(defaultFact ? scLinks : [])] });
  if (key === "continuance") out.push({
    title: "If you don't go to court",
    // The person who started the case: the eviction sentence is about the other side, so it never applies here.
    body: a.role === "me" ? [dismissFact, starterFact].filter(Boolean).join(" ") : [missFact, defaultFact, noSourceFact].filter(Boolean).join(" "),
    links: [...(a.role === "me" ? (starterFact ? [SOURCES.tr41, SOURCES.tr55, SOURCES.courtStaff, SOURCES.getHelp] : []) : missLinks), ...(defaultFact ? scLinks : [])] });
  // Small Claims Rule 4(C): someone being sued can ask for a jury, with a short deadline.
  if ((key === "respond" || key === "appearance" || (key === "continuance" && a.role !== "me")) && !notSmallClaims) out.push({
    title: "If you want a jury trial",
    body: `${ifSC}, Small Claims Rule 4(C) says a defendant may request a jury trial by submitting a written request to the court "within ten (10) days after receipt of the notice of claim." It says that unless filed in that time, the right to a jury trial is waived, and that the person requesting one pays the clerk an additional amount (in the Marion Small Claims Court, the filing fee for a case in the appropriate court). You can ask free legal help whether this makes sense for you.`,
    links: [SOURCES.sc4, SOURCES.getHelp] });
  if (key === "feewaiver") out.push({
    title: "If the court sets a hearing",
    body: `${dismissText} In other kinds of cases, ${starterRule}`,
    links: [SOURCES.smallClaims, SOURCES.sc10, SOURCES.tr41, SOURCES.tr55, SOURCES.courtStaff, SOURCES.getHelp] });

  // After a money judgment. Indiana Legal Help covers wage garnishment, and not these hearings. Indiana Legal Services' guide speaks to the
  // person who owes; the Small Claims Manual covers it from the winner's side. For people being sued, not for a
  // case the person started.
  if (key === "respond" || key === "appearance" || (key === "continuance" && a.role !== "me")) out.push({
    title: "If the court decides you owe money",
    body: "Indiana Legal Help says: \"Wage garnishment is when money is taken directly from your paycheck to pay a debt you owe.\" It has a form to ask the court to lower your wage garnishment if it's causing financial hardship. Indiana Legal Services, a nonprofit law firm that gives free civil legal help to eligible low-income people, says proceedings supplemental hearings are held after a court has granted a money judgment against you, to find out if you have any income or property that can be taken to pay it. It says you must go to court if you get an order to appear, even if you have no income or property. It says that if you are notified of the hearing and don't go, the party who was awarded the judgment (the judgment creditor) can ask the court to set a \"rule to show cause\" hearing, where you are ordered to explain why you missed it, and if you also miss that one, the court may issue a warrant for your arrest (called a writ or body attachment). It also says a court may not put you in jail or punish you in any other way for not paying on a judgment debt. The Small Claims Manual also says that if a debtor served with notice of this hearing doesn't attend, the court may set a show cause hearing, and it defines a body attachment as an order of arrest issued when a party doesn't appear at that hearing.",
    links: [SOURCES.proSup, SOURCES.smallClaims, SOURCES.debt, SOURCES.garnishment] });

  out.push({ title: "Get free help", body: `Indiana Legal Help's site lets you find free and low-cost legal help near you by entering your ZIP code or county. ${HELP_DESK}`, links: [SOURCES.getHelp, SOURCES.helpDesk] });
  return out;
}

function nextStepsHtml(key, a) {
  return `
    <h2 class="sub">What to do next</h2>
    <ol class="steps">${nextSteps(key, a).map(s => `
      <li><strong>${esc(s.title)}</strong>
        <p>${esc(s.body)}</p>
        ${s.links.length ? `<p class="srcs">${s.links.map(l => `<a href="${l.href}" target="_blank" rel="noopener">${esc(l.text)}</a>`).join(" · ")}</p>` : ""}
      </li>`).join("")}
    </ol>`;
}
