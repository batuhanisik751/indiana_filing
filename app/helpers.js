// Small tools: escaping text, numbers, money, dates and case numbers.
/* ---------- small helpers ---------- */
Object.hasOwn ||= (o, k) => Object.prototype.hasOwnProperty.call(o, k); // Safari before 15.4
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const empty = v => v === undefined || v === null || String(v).trim() === "";
const digits = s => String(s ?? "").replace(/\D/g, "");
// Amounts: whole dollars or dollars and cents ("1200", "1,200", "$12.50"). Hours: any positive number.
const AMOUNT_RE = /^\d+(\.\d{1,2})?$/, HOURS_RE = /^\d+(\.\d+)?$/;
// A comma only goes away where it groups thousands. So 12,50 is refused instead of read as 1250, and so is any space inside, since 500 300 could be two amounts.
const cleanNum = v => {
  const s = String(v ?? "").trim().replace(/^\$\s*/, "").replace(/^\.(?=\d)/, "0.");
  return (/^[1-9]\d{0,2}(?:,\d{3})+(?:\.\d*)?$/.test(s) ? s.replace(/,/g, "") : s).replace(/(\d)\.$/, "$1");
};
// A billion dollars or more can't be right on these forms, and past about 16 digits it couldn't even print as typed.
// (A card number typed into an amount box is one.) So it's refused, and treated as not a number.
const AMOUNT_MAX = 1e9;
const tooBig = v => HOURS_RE.test(cleanNum(v)) && parseFloat(cleanNum(v)) >= AMOUNT_MAX;
const validNum = (step, v) => (step.type === "money" ? AMOUNT_RE : HOURS_RE).test(cleanNum(v)) && !tooBig(v);
const isNum = v => !empty(v) && HOURS_RE.test(cleanNum(v)) && !tooBig(v);
const toNum = v => (isNum(v) ? parseFloat(cleanNum(v)) : 0);
const NO_WORDS = /^(no|none|n\/a|n\.a|na|nope|not applicable|unknown|don'?t know|do not know|not sure|idk|-+)\.?$/i;
const SAYS_NONE = /^(none|n\/a|n\.a|na)\.?$/i; // how someone with no email or phone answers. "idk" isn't that.
const NO_NUMBER = /^no\s+(?:phone|telephone|cell|fax)(?:\s+number)?\.?$/i;
const hasEmail = a => !empty(a.email) && !SAYS_NONE.test(a.email.trim());
const money = n => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const moneyOrBlank = v => (isNum(v) ? money(toNum(v)) : "");
// yyyy-mm-dd (from <input type=date>) -> mm/dd/yyyy, the way the forms show dates.
const formDate = v => { if (empty(v)) return ""; const [y, m, d] = v.split("-"); return `${m}/${d}/${y}`; };
// A date input turns 11/30/26 into the year 0026, so a real date here has a 20xx year.
// The person's other dates can't be later than the hearing or court date they gave.
const isDay = v => /^20\d{2}-\d{2}-\d{2}$/.test(v ?? "");
const todayDay = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const hasPassed = v => isDay(v) && v < todayDay();
const dateLimit = (step, a) => {
  if (step.type !== "date") return null;
  const [id, name] = isDay(a.hearingDate) ? ["hearingDate", "hearing date"] : ["courtDate", "court date"];
  return step.id !== id && isDay(a[id]) && !hasPassed(a[id]) ? { date: a[id], name } : null; // a past one has its own flag
};
const pastLimit = (v, limit) => !!limit && isDay(v) && v > limit.date;

// Indiana case numbers look like 49D01-2610-CC-001234: county number, court,
// year+month, two-letter case type, sequence number.
const CASE_RE = /^(\d{2})[A-Z]\d{2}-\d{4}-([A-Z][A-Z0-9])-\d{6}$/; // two characters: Administrative Rule 8 has F1 to F6
const caseMatch = cn => String(cn ?? "").trim().toUpperCase().match(CASE_RE);
// Administrative Rule 8's case type codes. Anything else typed in that box, like "none" or "small claims", decides nothing.
const FAMILY_CASES = { DC: "Domestic Relations with Children", DN: "Domestic Relations No Children", DR: "Domestic Relation", JP: "Juvenile Paternity" }; // Administrative Rule 8's names
const NOT_CIVIL_CASES = new Set("CF CM F1 F2 F3 F4 F5 F6 FA FB FC FD MC MR IF OE OV".split(" ")); // Administrative Rule 8's criminal, infraction and ordinance case types
const CASE_CODES = new Set("AD CC CE CP CT DC DN DR EV GV MF MH MI PC PL PO RA RF RS TP TS XP CF CM F1 F2 F3 F4 F5 F6 FA FB FC FD MC MR IF OE OV JC JD JM JP JQ JS JT EM ES EU GM GU TR SC CB".split(" "));
const countyCode = county => String(COUNTIES.indexOf(county) + 1).padStart(2, "0");
// What a full case number says about its county and court. Administrative Rule 8: the first two digits are the
// county's number, and the letter after them is the court, C for Circuit and D for Superior. Null unless it says both.
function caseCourt(cn) {
  const m = caseMatch(cn), letter = m ? String(cn).trim().toUpperCase()[2] : "";
  const county = m ? COUNTIES[+m[1] - 1] : null, court = { C: "CIRCUIT", D: "SUPERIOR" }[letter];
  return county && court ? { county, court, name: `${county} County, ${court === "CIRCUIT" ? "Circuit" : "Superior"} Court` } : null;
}
// The person confirmed the county and court in their case number, so those two questions aren't asked. The
// confirmation holds only for the county and court it was answered for (caseConfirmFor), however the number changes.
const caseConfirmed = a => a.caseConfirm === "yes" && !!caseCourt(a.caseNumber) && caseConfirmFor === caseCourt(a.caseNumber).name;
// A confirmation answered for another county or court is dropped, so the question is asked again with nothing chosen.
// Run before each screen: a number can change by a reload of what was typed, not only by Continue.
function dropStaleCaseConfirm() {
  if (empty(answers.caseConfirm) || caseConfirmFor === (caseCourt(answers.caseNumber)?.name ?? null)) return;
  delete answers.caseConfirm; delete unsure.caseConfirm; caseConfirmFor = null;
}
// "More": extra detail that starts closed and opens on tap. A real <details>, so keyboards and screen readers can use it.
// With a key, it stays open when the page redraws (the summary does, when its PDF check finishes).
const openMore = new Set();
// opts.summaryHtml replaces the label with markup the caller has already escaped; opts.cls adds a class.
function moreHtml(inner, label = "More", key = "", opts = {}) {
  // The one on the page now, if any, says whether it's open: the toggle event that records it can come a moment later.
  const now = key && document.querySelector(`details.more[data-more="${CSS.escape(key)}"]`);
  const open = key && (now ? now.open : openMore.has(key));
  return `<details class="more${opts.cls ? ` ${opts.cls}` : ""}"${key ? ` data-more="${esc(key)}"` : ""}${open ? " open" : ""}><summary>${opts.summaryHtml || esc(label)}</summary><div class="morebody"${opts.bodyId ? ` id="${opts.bodyId}"` : ""}>${inner}</div></details>`;
}
// On a computer, resting the pointer on a small "More" for a moment opens it, and moving away closes it again.
// A click right after that keeps it open, and so does tabbing into it. A whole section (like the pages of the
// form) opens only when asked, since it can download things. Phones and keyboards work as before: tap or Enter.
const hoverMore = window.matchMedia ? matchMedia("(hover: hover) and (pointer: fine)") : null;
let hoverTimer = null;
document.addEventListener("pointerover", e => {
  if (!hoverMore || !hoverMore.matches || e.pointerType !== "mouse") return;
  const d = e.target.closest && e.target.closest("details.more:not(.section)");
  if (!d || d.open || d.contains(e.relatedTarget)) return;
  clearTimeout(hoverTimer);
  hoverTimer = setTimeout(() => { if (d.isConnected && !d.open && d.matches(":hover")) { d.dataset.hovered = "1"; d.open = true; } }, 350);
});
document.addEventListener("pointerout", e => {
  const d = e.target.closest && e.target.closest("details.more");
  if (!d || d.contains(e.relatedTarget)) return;
  clearTimeout(hoverTimer);
  if (d.dataset.hovered && !d.contains(document.activeElement)) d.open = false;
  delete d.dataset.hovered;
});
document.addEventListener("click", e => {
  const d = e.target.closest && e.target.closest("details.more > summary")?.parentElement;
  if (d && d.dataset.hovered) { e.preventDefault(); delete d.dataset.hovered; } // it opened on hover: this click keeps it open
}, true);
document.addEventListener("toggle", e => {
  const d = e.target;
  if (d.matches && d.matches("details.more[data-more]")) { if (d.open) openMore.add(d.dataset.more); else openMore.delete(d.dataset.more); }
}, true);
window.appParts++;
