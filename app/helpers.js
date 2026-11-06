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
const validNum = (step, v) => (step.type === "money" ? AMOUNT_RE : HOURS_RE).test(cleanNum(v));
const isNum = v => !empty(v) && HOURS_RE.test(cleanNum(v));
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
window.appParts++;
