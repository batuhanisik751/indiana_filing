// Works out what a typed address seems to be missing. It runs on this device only.
/* ---------- address check ---------- */
// First three digits of the ZIP codes used in each state, including ones that cross a state line.
const ZIP_PREFIXES = Object.fromEntries("MH:969 AA:340 AE:90-98 AK:995-999 AL:350-369,388 AP:962-966 AR:380,657,716-729,755 AS:967 AZ:845,850-865,873,890 CA:894,900-961,976 CO:800-816,820 CT:60-69 DC:200,202-205,569 DE:197-199 FL:320-349 GA:300-319,398-399 GU:969 HI:967-968 IA:500-528,559-561 ID:831-838,979,991 IL:527,600-629 IN:460-479 KS:660-679 KY:380,400-427 LA:700-714,717 MA:10-27,55 MD:206-219,205 ME:39-49 MI:480-499 MN:550-567 MO:516,526,630-658,726 MP:969 MS:386-397 MT:590-599 NC:270-289 ND:576,580-588,592 NE:680-693,820 NH:30-38 NJ:70-89,100 NM:799,855,865,870-884 NV:889-898 NY:5,63,100-149 OH:430-459 OK:679,730-749,790 OR:970-979,993 PA:150-196 PR:6-9 RI:28-29 SC:290-299 SD:562,570-577,693 TN:370-385,422 TX:739,750-799,885,733 UT:840-847,860,865 VA:201,220-246,376,205 VI:8 VT:50-59 WA:980-994 WI:530-549 WV:247-268 WY:820-831,834".split(" ").map(e => { const [st, list] = e.split(":"); return [st, list.split(",").map(r => r.split("-").map(Number))]; }));
const STATE_NAMES = {"alabama":"AL","alaska":"AK","arizona":"AZ","arkansas":"AR","california":"CA","colorado":"CO","connecticut":"CT","delaware":"DE","district of columbia":"DC","florida":"FL","georgia":"GA","hawaii":"HI","idaho":"ID","illinois":"IL","indiana":"IN","iowa":"IA","kansas":"KS","kentucky":"KY","louisiana":"LA","maine":"ME","maryland":"MD","massachusetts":"MA","michigan":"MI","minnesota":"MN","mississippi":"MS","missouri":"MO","montana":"MT","nebraska":"NE","nevada":"NV","new hampshire":"NH","new jersey":"NJ","new mexico":"NM","new york":"NY","north carolina":"NC","north dakota":"ND","ohio":"OH","oklahoma":"OK","oregon":"OR","pennsylvania":"PA","rhode island":"RI","south carolina":"SC","south dakota":"SD","tennessee":"TN","texas":"TX","utah":"UT","vermont":"VT","virginia":"VA","washington":"WA","west virginia":"WV","wisconsin":"WI","wyoming":"WY","puerto rico":"PR","guam":"GU","virgin islands":"VI","american samoa":"AS","northern mariana islands":"MP","marshall islands":"MH",
  "ind":"IN","ill":"IL","mich":"MI","ky":"KY","tenn":"TN","wis":"WI","wisc":"WI","minn":"MN","calif":"CA","cal":"CA","fla":"FL","ala":"AL","ark":"AR","ariz":"AZ","colo":"CO","conn":"CT","del":"DE","kan":"KS","kans":"KS","mass":"MA","miss":"MS","mont":"MT","neb":"NE","nebr":"NE","nev":"NV","okla":"OK","ore":"OR","oreg":"OR","penn":"PA","tex":"TX","wash":"WA","wyo":"WY","w va":"WV","w. va":"WV"};
const STATE_AT_END = new RegExp(`(?:^|[\\s,])(${Object.keys(STATE_NAMES).sort((x, y) => y.length - x.length).join("|").replace(/\./g, "\\.")}|[a-z]\\.\\s?[a-z]|[a-z]{2})$`, "i");
const ROAD_WORD = /^(?:st|street|ave|avenue|rd|road|dr|drive|ln|lane|blvd|boulevard|ct|court|pl|place|way|ter|terrace|cir|circle|pkwy|parkway|hwy|highway|trl|trail|pike|run|xing|crossing|loop|path|pass|row|walk|sq|square)$/i;
const SIDE_WORD = /^(?:n|s|e|w|ne|nw|se|sw|north|south|east|west)$/i;
const UNIT_WORD = /^(?:apt|apartment|unit|ste|suite|lot|bldg|building|fl|floor|rm|room)$/i;
const trimEnd = t => { let n = t.length; while (n && /[.,;\s]/.test(t[n - 1])) n--; return t.slice(0, n); };
// A state at the very end: its two letters, what comes before it, and whether a comma set it apart.
function stateAtEnd(text) {
  const t = trimEnd(text), m = STATE_AT_END.exec(t);
  if (!m) return null;
  const word = m[1].toLowerCase(), letters = word.replace(/[.\s]/g, "");
  const state = STATE_NAMES[word] || (letters.length === 2 && ZIP_PREFIXES[letters.toUpperCase()] ? letters.toUpperCase() : "");
  if (!state) return null;
  const rest = t.slice(0, m.index + (m[0].length - m[1].length)), plain = !STATE_NAMES[word] && !/\./.test(word);
  return { state, rest: trimEnd(rest), comma: /,\s*$/.test(rest), word: m[1], plain };
}
// Is there no city in what comes before the state? The last comma-separated part is the place to look.
function noCityIn(rest) {
  const parts = rest.split(",").map(x => x.trim()).filter(Boolean);
  if (!parts.length) return true;
  const last = parts[parts.length - 1], clean = w => w.replace(/\.$/, "");
  const tokens = last.split(/\s+/);
  // A unit, like "Apt 4". What's after it can still be the city, as in "Apt 4 Indianapolis".
  if (/^#/.test(last) || UNIT_WORD.test(clean(tokens[0]))) return !tokens.slice(/^#./.test(last) ? 1 : 2).some(w => /[a-z]/i.test(w));
  if (/^(?:p\.?\s?o\.?\s*box|box|rr|rural route)\b/i.test(last)) return !tokens.some(w => !/^(?:p\.?|o\.?|p\.?o\.?|box|rr|rural|route|#?\d+\w*)$/i.test(w));
  if (!/^\d/.test(last)) return false; // only words: taken as the city
  const road = tokens.findIndex((w, i) => i > 1 && ROAD_WORD.test(clean(w)));
  if (road < 0) {
    const words = tokens.slice(1).filter((w, i) => !(i === 0 && SIDE_WORD.test(clean(w))));
    // A numbered road, like "8901 N 300 W" or "3210 SR 37": the city is whatever comes after the number.
    const numbered = words.findIndex(w => /^\d/.test(w));
    if (numbered >= 0) return !words.slice(numbered + 1).some(w => !/^\d/.test(w) && !SIDE_WORD.test(clean(w)));
    return words.length < 2; // "123 N Main"
  }
  // After the street: a word that isn't another part of the street, a unit or a number is the city.
  const after = tokens.slice(road + 1);
  for (let i = 0; i < after.length; i++) {
    const w = clean(after[i]);
    if (UNIT_WORD.test(w)) { if (!/^\d+(?:st|nd|rd|th)$/i.test(after[i - 1] || "")) i++; continue; } // "Apt 4", but "5th Floor" is over
    if (!/^#|\d/.test(w) && !ROAD_WORD.test(w) && !SIDE_WORD.test(w)) return false;
  }
  return true;
}
function hasStreetIn(rest) {
  // The number in "County Road 500 E" or "Highway 31" names the road. It isn't a house number.
  const plain = rest.replace(/\b(?:apt|apartment|unit|ste|suite|lot|bldg|building|fl|floor|rm|room)\b\.?\s*#?\s*[\w-]+/gi, " ").replace(/#\s*[\w-]+/g, " ").replace(/\b\d+(?:st|nd|rd|th)\b/gi, " ")
    .replace(/(^|,\s*)(?:county (?:road|rd)|cr|state (?:road|rd|route)|sr|us(?: highway| hwy)?|highway|hwy)\s+\d+\w*/gi, "$1 ");
  // "PO Box A" has its letter, and "PO Box" alone has nothing to deliver to.
  return /\d/.test(plain) || /\b(?:box\s*#?\s*[a-z]\b|gen(?:eral|\.)? del(?:ivery|\.)?|apo|fpo|dpo|courthouse|square|plaza|city hall|government center|county building|city-county building)(?:\b|$)/i.test(rest)
    || /(?:^|,\s*)(?:one|two|three|four|five|six|seven|eight|nine|ten)\b/i.test(rest);
}
// What a typed U.S. address seems to be missing. Worked out on this device only: an address is never sent anywhere to be checked.
function addressGaps(text) {
  const none = { missing: [], note: "" }, raw = String(text ?? "");
  if (raw.length > 1000) return none; // far too long to be an address, and it has its own flag
  const lines = raw.split(/\n+/).map(x => x.trim()).filter(Boolean).join(", ").replace(/\s+/g, " ");
  let s = trimEnd(lines).replace(/[,\s]*\b(?:usa|u\.s\.a|united states(?: of america)?)$/i, "");
  s = trimEnd(s);
  if (!s || startsNo(s) || SAYS_NONE.test(s) || /(?:^|,\s*)(?:canada|mexico)$/i.test(s)) return none;
  if (/^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/.test(s)) return { missing: [], note: "This looks like an email address, not a mailing address." };
  // The ZIP code is the last 5 digits with a state right before them, wherever they are. Anything can follow.
  let zip = "", state = "", rest = s, why = null, zipEnd = 0;
  const found = [...s.matchAll(/(?:^|[\s,])(\d{5})(?:[\s\-–—]{1,2}\d{4})?(?=$|[\s,.;)])/g)];
  for (let i = found.length - 1; i >= 0 && !zip; i--) {
    why = stateAtEnd(s.slice(0, found[i].index));
    if (why) { zip = found[i][1]; state = why.state; rest = why.rest; zipEnd = found[i].index + found[i][0].length; }
  }
  // No state before it: 5 digits at the very end are still the ZIP code.
  if (!zip && found.length) { const m = found[found.length - 1]; if (m.index + m[0].length === s.length && m.index > 0) { zip = m[1]; rest = trimEnd(s.slice(0, m.index)); } }
  // Digits at the end that aren't 5 only count as a bad ZIP code right after a state. Otherwise they're part of the street.
  let badZip = false;
  if (!zip) {
    const end = /(?:^|[\s,])(\d[\d-]*)$/.exec(s), before = end && stateAtEnd(s.slice(0, end.index));
    if (before) { badZip = true; why = before; state = before.state; rest = before.rest; }
    else {
      // With no ZIP code, a two-letter word like "Ct" could be the street, so it has to follow a comma or be in capitals.
      const tail = stateAtEnd(s);
      if (tail && (!tail.plain || tail.comma || (tail.word === tail.word.toUpperCase() && tail.state !== "CT"))) { why = tail; state = tail.state; rest = tail.rest; }
    }
  }
  // "Washington" or "Ct" can also be the city or the street. If taking it as the state leaves no city, it wasn't the state.
  if (state && noCityIn(rest) && (/^(?:washington|new york)$/i.test(why.word) || (ROAD_WORD.test(why.word) && !why.comma))) {
    rest = zip ? trimEnd(s.slice(0, found.find(m => m[1] === zip).index)) : s; state = "";
  }
  const missing = [];
  if (!hasStreetIn(rest + (zipEnd ? ` ${s.slice(zipEnd)}` : ""))) missing.push(/\bbox\b/i.test(rest) ? "box number" : "street number"); // the street can come after the ZIP code
  // "123 Main St Apt," has the word and no number. (Not "Building": that can be a building's name.)
  else if (rest.split(",").some(p => /^(?:\d.*\s)?(?:apt|apartment|unit|ste|suite|lot|rm|room)\.?(?:\s*(?:#|_+|\?+))?$|^\d.*\s(?:#|_+|\?+)$/i.test(p.trim()))) missing.push("unit number");
  if (noCityIn(rest)) missing.push("city");
  if (!state) missing.push("state");
  if (!zip && !badZip) missing.push("ZIP code");
  let note = "";
  if (badZip) note = "The ZIP code should have 5 digits, or 5 digits, a dash and 4 more.";
  else if (zip && state && !ZIP_PREFIXES[state].some(([lo, hi = lo]) => +zip.slice(0, 3) >= lo && +zip.slice(0, 3) <= hi)) note = "The ZIP code doesn't usually go with that state. Check both.";
  return { missing, note };
}
