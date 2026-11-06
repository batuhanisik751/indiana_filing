// Checks on typed text: dates, private numbers, answers that say nothing, and phone numbers.
// "Until 11/20", "Nov 24", "the 3rd of December", "until March": dates, which the
// continuance form says not to write. "1/2 month" and "maybe 3 weeks" are not.
const MONTH = "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
const MM = "(?:0?[1-9]|1[0-2])", DD = "(?:0?[1-9]|[12]\\d|3[01])";
const WEEKDAY = "(?:mon|tues?|wed(?:nes)?|thu(?:rs?)?|fri|sat(?:ur)?|sun)(?:day)?";
const UNIT = "(?:(?:more|additional|extra|full|business|working|calendar|court)\\s+)?(?:weeks?|wks?|days?|months?|mos?|hours?|hrs?)\\b";
const DATE_RES = [
  // 11/20, 12.15, 11-20-2026 (a real month and day; not "1-1/2 months", "2.5 weeks" or "10-14 days")
  new RegExp(`(?:^|[^\\d\\/.-])\\b${MM}[\\/.]${DD}(?:[\\/.]\\d{2,4})?\\b(?![\\/\\d]|\\s*${UNIT}|\\s*a\\s+(?:month|week))`, "i"),
  new RegExp(`(?:^|[^\\d\\/.-])\\b${MM}-${DD}-\\d{2,4}\\b`, "i"),
  new RegExp(`\\b(?:until|till|by|on|after|before)\\s+${MM}-${DD}\\b(?!\\s*${UNIT})`, "i"),
  // Nov 24, December 3rd, Jan 2027
  new RegExp(`\\b${MONTH}\\.?\\s+\\d{1,4}(?:st|nd|rd|th)?\\b`, "i"),
  // the 3rd of December, 24 Nov
  new RegExp(`\\b\\d{1,2}(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH}\\b`, "i"),
  // until March, early January, end of December, the second week of January
  new RegExp(`\\b(?:until|till|til|through|thru|on|by|after|before|in|into|early|mid|late|end\\s+of|beginning\\s+of|start\\s+of|week\\s+of)[\\s-]+(?:the\\s+)?(?:early\\s+|mid-?\\s*|late\\s+)?${MONTH}\\b`, "i"),
  // a month name on its own
  new RegExp(`^\\s*${MONTH}\\.?\\s*$`, "i"),
  // the 24th, until the 15th, "until the 30" (a day of the month)
  new RegExp(`\\b(?:the|on|by|until|till|before|after)\\s+(?:the\\s+)?\\d{1,2}(?:st|nd|rd|th)\\b(?!\\s*(?:or\\b|-|to\\b|${UNIT}|hearings?|available|times?|appointment|surgery|shift|trimester|quarter|test|session|job|lawyer|try|attempt|round|visit))`, "i"),
  /\b(?:on|by|until|till|before|after)\s+the\s+\d{1,2}\s*(?:$|[.,;)])/i,
  /^\s*(?:the\s+)?\d{1,2}(?:st|nd|rd|th)\s*\.?\s*$/i,
  // next Friday, until Mon, 2 weeks from Friday, or a weekday on its own (not "I work Monday through Friday")
  new RegExp(`\\b(?:next|this|on|until|till|by|after|before|coming|from)\\s+${WEEKDAY}\\b`, "i"),
  new RegExp(`^\\s*(?:a\\s+)?${WEEKDAY}\\.?(?:\\s+(?:morning|afternoon|evening|night|please))?(?:\\s*$|\\s*,|\\s+(?:the\\s+)?\\d)`, "i"),
  // the end of the month, next month, mid-month, this weekend, after the holidays
  /\b(?:end|middle|beginning|start)\s+of\s+(?:the\s+)?(?:month|year)\b|\bend\s+of\s+month\b|\bnext\s+month\b|\bmid-?month\b|\b(?:this|next)\s+weekend\b|\b(?:after|until|till)\s+(?:the\s+)?holidays\b/i,
  // the twentieth, December twentieth (spelled out)
  new RegExp(`\\b(?:the|${MONTH})\\s+(?:first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth|thirteenth|fourteenth|fifteenth|sixteenth|seventeenth|eighteenth|nineteenth|twentieth|twenty-\\w+|thirtieth|thirty-first)\\b(?!\\s*(?:${UNIT}|week|time|hearing|appointment|try|attempt|round|visit))`, "i"),
  /\b(?:tomorrow|christmas|x-?mas|hanukkah|chanukah|kwanzaa|passover|diwali|thanksgiving|new year'?s?(?:\s+day)?|easter|memorial day|labor day|independence day|juneteenth|halloween|valentine'?s(?:\s+day)?|martin luther king|mlk day|presidents'? day|veterans'? day|columbus day)\b/i,
];
const looksLikeDate = v => DATE_RES.some(re => re.test(String(v ?? "")));

// Access to Court Records Rule 5(C): complete Social Security numbers, account numbers, PINs and
// passwords are redacted unless the case needs them. A flag never repeats what it found.
// A bare number right after words like these is that thing's number, not a Social Security or card number.
const REF_LABEL = /(?:^|[^a-z])(?:tracking|track|order|confirmation|claim|invoice|case|cause|docket|receipt|reference|policy|transaction|ticket|citation|contract|lease|bill|statement|parcel|vin|serial|model|plate|permit|inmate|bates|exhibit|file|matter|fedex|ups|usps|po|zip code|zip\+4|zip|(?:inv|pol|conf|ref)\.?)(?:\s+(?:id|number|num|nbr|no\.?))?(?:\s+(?:is|was))?[\s:#=-]*$/i;
// Unless the words right around it name a Social Security number or card: earlier in that part of the sentence, or just after it.
const NAMES_PRIVATE = /\bssn\b|\bs\.s\.n\b|\bss ?#|\bss ?number\b|\bsocial\b(?! (?:worker|services?|media)\b)|\bsoc\.? ?sec\b|\bcards?\b(?! services?\b)/i;
const isReference = (s, at) => {
  const before = s.slice(Math.max(0, at - 30), at);
  const afterState = /(?:^|[\s,])([A-Z]{2})\s+$/.exec(before); // the end of an address: a ZIP+4 with no dash
  if (!REF_LABEL.test(before) && !(afterState && ZIP_PREFIXES[afterState[1]])) return false;
  return !NAMES_PRIVATE.test(before.split(/[,.;]/).pop()) && !NAMES_PRIVATE.test(s.slice(at).replace(/^[\d .-]+/, "").slice(0, 40));
};
// The check digit real card numbers pass (Luhn). Whatever it's labeled, a number that passes is treated as a card.
const passesCardCheck = n => { const d = n.replace(/\D/g, ""); if (d.length < 13 || d.length > 19) return false; let sum = 0; for (let i = 0; i < d.length; i++) { let x = +d[d.length - 1 - i]; if (i % 2 && (x *= 2) > 9) x -= 9; sum += x; } return sum % 10 === 0; };
const ACCOUNT_WORD = "accounts?|accts?|acc|a\\/c|routing|rt|aba|cards?|loans?|mortgages?|checking|savings|member|customer";
const ACCOUNT_LABEL = new RegExp(`\\b(?:${ACCOUNT_WORD})(?![a-z])`, "i");
function privateKind(text, isAddress = false) {
  const s = String(text ?? "").normalize("NFKC").replace(/\p{Cf}/gu, "").replace(/\s+/g, " ").replace(/[‐-―−]/g, "-").replace(/(\d) ?- ?(?=\d)/g, "$1-");
  // 123-45-6789 and the same with other separators. A hyphen before it only counts after a letter, as in Smith-123-45-6789.
  if (/(^|[^\d$-]|[a-z]-)\d{3}(?:-\d{2}[- ]| \d{2} |\.\d{2}\.|\/\d{2}\/|_\d{2}_|,\d{2},|:\d{2}:|\*\d{2}\*|~\d{2}~|·\d{2}·)\d{4}(?!\d|-\d)/i.test(s)) return "ssn";
  if (/(\bssn|\bs\.s\.n\b\.?|\bss ?#|\bss number\b|\bsocial(?! (?:worker|services?|media)\b)(?: security)?\b|\bsoc\.? ?sec\b|\btax(?:payer)? id\b|\bitin\b)[^\d]{0,25}(\d[ ./-]?){9}(?!\d)/i.test(s)) return "ssn";
  // "SS" and "Soc" alone are only that right before the number. "SS Bank claim 123456789" isn't.
  if (/\b(?:s\.?s\.?(?: ?no\.?)?|soc):? ?(\d[ ./-]?){9}(?!\d)/i.test(s)) return "ssn";
  for (const m of s.matchAll(new RegExp(`\\b(?:${ACCOUNT_WORD})(?![a-z])([^\\d]{0,40})(\\d(?:[ -]?\\d){5,})`, "gi"))) {
    // What's after the nearest label, without letters joined to the number, as in "account no ABC12345678".
    const gap = m[1].split(ACCOUNT_LABEL).pop().replace(/(\s)[a-z]{1,3}$/i, "$1"), count = m[2].replace(/\D/g, "").length;
    const marked = /^[\s:#.=,(/-]*$|(?:\bis|\bwas|\bnumber|\bnum|\bnbr|\bno\.?|\bid|:|#|=)[\s:#.=(-]*$/i.test(gap);
    // Or a long number a few words on, as in "account with Chase 12345678". Too long to be an amount.
    const nearby = count >= 8 && gap.trim().split(/\s+/).length <= 6 && !/[.;,]/.test(gap) && !isReference(s, m.index + m[0].length - m[2].length) && !/^\d{5}-\d{4}$/.test(m[2]) && !/\b(?:of|on|in|since|dated?|phone|call|tel|fax|officer|services?|department|dept|center|company)\b/i.test(gap);
    if (!marked && !nearby) continue;
    const labeled = /\b(?:number|num|nbr|no|id)\b|#/i.test(gap);
    // In an address, "Loan Servicing" or "Member Services" can be a company name before a house number or a ZIP+4.
    if (isAddress && (/^\d{5}[ -]\d{4}$/.test(m[2]) || !(labeled || /:\s*$/.test(gap) || (count >= 8 && !gap.trim().replace(/[,:;.-]/g, ""))))) continue;
    if (/\b(?:ends?|ending|last|final)\b/i.test(gap) || (!labeled && /\b(?:balance|amount|total|owed?|paid|payment|due)\b/i.test(gap))) continue;
    if (!labeled && count < 8 && /\b(?:is|was)\s*$/i.test(gap) && /^(?:loans?|mortgages?)/i.test(m[0])) continue; // "the loan was 150000": an amount
    if (/^(1[ -])?\d{3}[ -]\d{3}[ -]\d{4}$|^\d{4}-\d{2}-\d{2}$|^\d{1,2}[- ]\d{1,2}[- ]\d{2,4}$|^\d{1,2}[- ](19|20)\d\d$|^(19|20)\d\d[ -](?:(19|20)\d\d|\d\d)$/.test(m[2])) continue; // a phone number, date or span of years
    if (/^ ?(dollars|usd)\b/i.test(s.slice(m.index + m[0].length))) continue;
    return "account";
  }
  // In an address, 9 digits could be a ZIP+4, but not before the rest of the address.
  if (isAddress) { if (/^\d{9}[ ,]+\S/.test(s)) return "ssn"; }
  else for (const m of s.matchAll(/(^|[^\d$-])\d{9}(?![\d-])/g)) if (!isReference(s, m.index + m[1].length)) return "ssn";
  // Whole groups of digits, so a longer tracking number doesn't read as a card number. Years and round numbers aren't a card.
  const notCard = n => n.split(/[ .-]/).every(d => /^(?:19|20)\d\d$|^\d000$/.test(d));
  if ([...s.matchAll(/\d+(?:[ .-]\d+)*/g)].some(({ 0: n, index }) => (!isReference(s, index) || passesCardCheck(n)) && (n.split(/[ .-]/).some(d => d.length >= 12 && d.length <= 19)
    || (!notCard(n) && /^\d{4}[ .-]\d{4}[ .-]\d{4}[ .-]\d{1,7}(?:[ .-]\d{1,3})?$|^\d{4}[ .-]\d{6}[ .-]\d{4,5}$/.test(n))))) return "account";
  if ([...s.matchAll(/\d{4}([_,/*:~])\d{4}\1\d{4}\1\d{1,7}/g)].some(m => passesCardCheck(m[0]))) return "account";
  if (/\b(?:pin|personal identification number)\b(?: ?(?:number|code|no\.?|#|is|was|:|=|-|,))* ?\d{4,8}\b/i.test(s) || /\bpin\b[^.\d]{0,30}(?:\b(?:is|was)\b|:)[: ]*\d{4,8}\b/i.test(s)) return "pin";
  if (/\b(?:pass(?:word|code)|pwd|pw)\b ?[:=] ?\S/i.test(s)
    || /\bpass(?:word|code)\b ?(?:is|was) (?!(?:not|wrong|incorrect|expired|lost|the|my|a|an|that|this|required|needed|on|in|for|reset|changed|stolen|hacked)\b)\S/i.test(s)
    || /\bpass(?:word|code)\b (?=\S*[\d!@#$%^&*])\S/i.test(s)) return "pin";
  return null;
}
const PRIVATE_WHAT = { ssn: "This may be a complete Social Security number.", account: "This may be a complete account or card number.", pin: "This may be a PIN or password." };
const CASE_NUMBER_BOXES = /^(caseNumber|caseTypeLetters|relatedNumbers|rel\dNumber|fwCaseType)$/; // numbers these boxes are meant to hold

// Words that say the person doesn't know. Typed into a box they'd print on the form, so they count as no answer.
const NOT_KNOWN = /^(?:i'?m not sure|i am not sure|not sure|unsure|idk|i don'?t know|don'?t know|i do not know|do not know|unknown|no idea|no clue|no,? i don'?t know|\?+)[.!]*$/i;
const CODE_BOXES = /^(caseNumber|caseTypeLetters|fwCaseType)$/; // these have their own checks
const saysNoAnswer = v => { const t = String(v ?? "").replace(/\u2019/g, "'").trim(); return NO_WORDS.test(t) || NOT_KNOWN.test(t) || NO_NUMBER.test(t); };
const NAME_BOXES = /^(name|plaintiff|otherParty|otherPerson|svc\dName)$/;
function notAnAnswer(s, v) {
  const t = String(v ?? "").replace(/\u2019/g, "'").trim();
  if (t && !s.noWords && (s.type === "email" || s.type === "tel")) return !SAYS_NONE.test(t) && (NO_WORDS.test(t) || NOT_KNOWN.test(t));
  if (!t || s.noWords || !(s.type === "text" || s.type === "textarea")) return false;
  if (NOT_KNOWN.test(t)) return true;
  if (CODE_BOXES.test(s.id)) return false;
  if (s.id === "courtTypeOther" && /^court[.!]*$/i.test(t)) return true; // the form prints that word itself, so this box would print nothing
  // In a box the form needs, "none" or a single letter isn't an answer either. In an optional one, "None" can be.
  if (s.optional) return false;
  // Trial Rule 11.1 asks for an address "if available", so None is how someone with no address answers.
  if (s.id === "address" && SAYS_NONE.test(t)) return false;
  // A name can be one letter, or "Na" or "No".
  if (NAME_BOXES.test(s.id)) return (NO_WORDS.test(t) && !/^(na|no)\.?$/i.test(t)) || /^[^\p{L}\p{N}]*$/u.test(t);
  // Punctuation is taken out first: as one pattern, a long run of dashes takes this check many seconds.
  return NO_WORDS.test(t) || /^\p{L}?$/u.test(t.replace(/[^\p{L}\p{N}]+/gu, ""));
}

// "None" can be right for one of the Answer's three lists, but not for all of them.
const startsNo = v => /^(?:none|no|nope|n\/a)\b/i.test(String(v ?? "").trim()) && !/\d/.test(String(v)) && !NOT_KNOWN.test(String(v).trim()); // "None of them", "no fixed address"
// What a list needs to name any paragraphs: a number, or only words like "all" or "the first three". "The other side is lying" has those words too, in a sentence.
const LIST_NAMES = /^(?:all|each|every|everything|entire|whole|rest|remaining|others?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|last|ii|iii|iv|vi|vii|viii|ix)$/i;
const LIST_GLUE = /^(?:and|or|the|of|to|through|thru|paragraphs?|paras?|numbers?|nos?|in|my|them|it|its|complaint|else|except|but|above|below|these|those|are|is|not|any|listed|mentioned|admitted|denied|admit|deny|i|they|true|false|correct|wrong)$/i;
const onlyListWords = v => { const w = String(v ?? "").match(/[\p{L}']+/gu) || []; return w.some(x => LIST_NAMES.test(x)) && w.every(x => LIST_NAMES.test(x) || LIST_GLUE.test(x)); };
const notAmounts = v => String(v ?? "").replace(/\$\s*[\d,.]+|\b\d[\d,.]*\s*(?:dollars?|bucks|usd)\b|\bpages?\s*\d+|\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b|\b\d{1,2}(?::\d{2})?\s*[ap]\.?m\b/gi, " "); // "$500", "page 12", "3/15/2024" and "5pm" aren't paragraph numbers
const namesParagraphs = v => [...paragraphNumbers(v)].some(n => n >= 1 && n <= PARAGRAPH_MAX) || onlyListWords(v); // "paid in 2019" has no paragraph in it
const PARAGRAPH_MAX = 500;
const saysNoList = v => NO_WORDS.test(String(v ?? "").trim()) || startsNo(v);
const listsParagraphs = (s, a) => !empty(a[s.id]) && !notAnAnswer(s, a[s.id]) && !saysNoList(a[s.id]) && namesParagraphs(a[s.id]);

// What's wrong with the shape of a typed U.S. phone or fax number, if anything: "impossible", "foreign", "letters" or "short".
// Words around a good number, like "(cell)", and an extension are fine.
function phoneShape(v) {
  const raw = String(v ?? "");
  if (raw.length > 100) return "short";
  // An extension comes after a number. Before one, "Cell #" or "Ex:" is a label, and the digits are the number itself.
  const t = raw.trim().replace(/^[a-z]+\s*#?\s*\d\s*:?\s+(?=\(?\d{3})/i, "").replace(/(^|[^a-z])(?:extension|ext|ex|x)[.:#\s]*\d{1,6}\)?/gi, (m, pre, at, all) => (/\d/.test(all.slice(0, at) + pre) ? pre : m))
    .replace(/#\s*\d{1,6}/g, (m, at, all) => (/\d/.test(all.slice(0, at)) ? "" : m));
  if (/^(?:\+\s*[2-9]|011)/.test(t)) return "foreign"; // a country code other than the U.S.'s
  let d = digits(t);
  if (d.length === 13 && d.startsWith("001")) d = d.slice(3);
  if (d.length === 11 && d[0] === "1") d = d.slice(1);
  // U.S. area codes and the three digits after them can't start with 0 or 1, or be like 911.
  if (d.length === 10) return /^[01]|^\d11/.test(d) || /^[01]|^\d11/.test(d.slice(3)) ? "impossible" : "";
  if (d.length > 11) return "long";
  return /\d[\s.-]*[a-z]{3,}[a-z\s.-]*$/i.test(t) && d.length + (t.match(/[a-z]/gi) || []).length >= 10 ? "letters" : "short";
}
window.appParts++;
