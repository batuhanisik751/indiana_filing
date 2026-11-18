// Item 18 on the MVP list: a fixed test set for measuring the checks.
//
// Each case is one form filled with the usual sample answers (VALUES in ../lib.mjs) except for the answers given here.
// `expect` is what a careful person reading the form would flag: the questions whose answers have a mistake. It is
// written from what's wrong with the answer, not from what the tool happens to do. Where a mistake is between two
// answers (a paragraph in two lists), either question counts: ["admitted", "denied"]. An empty `expect` is a correct
// answer that looks a little like a mistake, to count false alarms.
//
// A mistake case is "caught" when every entry in `expect` gets a flag. A flag on another question the form showed
// before the change (and that the form's own sample answers don't already get) is a false alarm. A question the
// change itself brings up, like the case type letters when the case number isn't complete, isn't counted.
//
// Kinds: the kind of check the case is for, as the report groups them. "hard" cases are the same kinds of mistakes
// written in less usual ways, which a simple check could miss.

const D = n => ({ days: n }); // a date this many days from today (filled in when the case runs)

export const CASES = [
  // ---------- Email ----------
  { kind: "Email", name: "gmial.com", form: "respond", answers: { email: "pat@gmial.com" }, expect: ["email"] },
  { kind: "Email", name: "yaho.com", form: "appearance", answers: { email: "pat@yaho.com" }, expect: ["email"] },
  { kind: "Email", name: "hotmial.com", form: "continuance", answers: { email: "pat@hotmial.com" }, expect: ["email"] },
  { kind: "Email", name: "no ending after the provider", form: "respond", answers: { email: "pat@gmail" }, expect: ["email"] },
  { kind: "Email", name: "no @", form: "appearance", answers: { email: "pat.gmail.com" }, expect: ["email"] },
  { kind: "Email", name: "two @", form: "respond", answers: { email: "pat@@gmail.com" }, expect: ["email"] },
  { kind: "Email", name: "gmail.con", form: "respond", answers: { email: "pat@gmail.con" }, expect: ["email"], hard: true },
  { kind: "Email", name: "gmai.com", form: "continuance", answers: { email: "pat@gmai.com" }, expect: ["email"], hard: true },
  { kind: "Email", name: "outlok.com", form: "appearance", answers: { email: "pat@outlok.com" }, expect: ["email"], hard: true },
  { kind: "Email", name: "a space inside", form: "respond", answers: { email: "pat example@gmail.com" }, expect: ["email"], hard: true },

  // ---------- Phone ----------
  { kind: "Phone", name: "nine digits", form: "respond", answers: { phone: "260-555-010" }, expect: ["phone"] },
  { kind: "Phone", name: "no area code", form: "appearance", answers: { phone: "555-0100" }, expect: ["phone"] },
  { kind: "Phone", name: "eleven digits not starting with 1", form: "continuance", answers: { phone: "260-555-01000" }, expect: ["phone"] },
  { kind: "Phone", name: "area code 000", form: "respond", answers: { phone: "000-555-0100" }, expect: ["phone"] },
  { kind: "Phone", name: "words instead of a number", form: "appearance", answers: { phone: "call my cell" }, expect: ["phone"] },
  { kind: "Phone", name: "letter O for a zero in the phone number", form: "respond", answers: { phone: "260-555-O100" }, expect: ["phone"], hard: true },
  { kind: "Phone", name: "fax with too few digits", form: "continuance", answers: { fax: "260-555" }, expect: ["fax"], hard: true },

  // ---------- Address ----------
  { kind: "Address", name: "no house number", form: "respond", answers: { address: "Main St, Fort Wayne, IN 46802" }, expect: ["address"] },
  { kind: "Address", name: "no ZIP code", form: "appearance", answers: { address: "1 Main St, Fort Wayne, IN" }, expect: ["address"] },
  { kind: "Address", name: "no city", form: "continuance", answers: { address: "1 Main St, IN 46802" }, expect: ["address"] },
  { kind: "Address", name: "no state", form: "respond", answers: { address: "1 Main St, Fort Wayne, 46802" }, expect: ["address"] },
  { kind: "Address", name: "four-digit ZIP", form: "appearance", answers: { address: "1 Main St, Fort Wayne, IN 4680" }, expect: ["address"] },
  { kind: "Address", name: "ZIP code from another state", form: "respond", answers: { address: "1 Main St, Fort Wayne, IN 90210" }, expect: ["address"] },
  { kind: "Address", name: "the other side's address has no ZIP", form: "continuance", answers: { otherPartyAddress: "2 Oak St, Fort Wayne, IN" }, expect: ["otherPartyAddress"] },
  { kind: "Address", name: "ZIP+4 cut short", form: "appearance", answers: { address: "1 Main St, Fort Wayne, IN 46802-12" }, expect: ["address"], hard: true },
  { kind: "Address", name: "apartment word with no number", form: "respond", answers: { address: "1 Main St Apt, Fort Wayne, IN 46802" }, expect: ["address"], hard: true },

  // ---------- Case number ----------
  { kind: "Case number", name: "too short", form: "respond", answers: { caseNumber: "02D01-2611-CC-00123" }, expect: ["caseNumber"] },
  { kind: "Case number", name: "case type not in Rule 8", form: "appearance", answers: { caseNumber: "02D01-2611-XX-001234" }, expect: ["caseNumber"] },
  { kind: "Case number", name: "another county's number", form: "respond", answers: { caseNumber: "49D01-2611-CC-001234" }, expect: ["caseNumber"] },
  { kind: "Case number", name: "Circuit Court letter, Superior Court chosen", form: "continuance", answers: { caseNumber: "02C01-2611-CC-001234" }, expect: ["caseNumber"] },
  { kind: "Case number", name: "missing the county and court part", form: "appearance", answers: { caseNumber: "2611-CC-001234" }, expect: ["caseNumber"] },
  { kind: "Case number", name: "letter O for a zero in the case number", form: "respond", answers: { caseNumber: "02D01-2611-CC-0O1234" }, expect: ["caseNumber"], hard: true },

  // ---------- Private information ----------
  { kind: "Private information", name: "SSN with dashes in the defenses", form: "respond", answers: { defenses: "I paid in full. My SSN is 123-45-6789." }, expect: ["defenses"] },
  { kind: "Private information", name: "SSN with no dashes", form: "respond", answers: { defenses: "They have my SSN 123456789 on file." }, expect: ["defenses"] },
  { kind: "Private information", name: "card number", form: "respond", answers: { defenses: "They charged my card 4111 1111 1111 1111 twice." }, expect: ["defenses"] },
  { kind: "Private information", name: "bank account number", form: "continuance", answers: { reason: "Payments come out of account number 12345678, so I need time." }, expect: ["reason"] },
  { kind: "Private information", name: "PIN", form: "respond", answers: { defenses: "The card's PIN is 4821 and it was stolen." }, expect: ["defenses"] },
  { kind: "Private information", name: "password", form: "respond", answers: { defenses: "My online password: Hunter2!x was used by someone else." }, expect: ["defenses"] },
  { kind: "Private information", name: "SSN typed in the address box", form: "appearance", answers: { address: "1 Main St, Fort Wayne, IN 46802 SSN 123-45-6789" }, expect: ["address"] },
  { kind: "Private information", name: "card number with dashes", form: "continuance", answers: { reason: "My card 4111-1111-1111-1111 was declined for the fee." }, expect: ["reason"], hard: true },
  { kind: "Private information", name: "SSN with spaces", form: "respond", answers: { defenses: "My social is 123 45 6789." }, expect: ["defenses"], hard: true },
  { kind: "Private information", name: "SSN with dots", form: "respond", answers: { defenses: "SSN: 123.45.6789" }, expect: ["defenses"], hard: true },
  { kind: "Private information", name: "password written as \"pass is\"", form: "respond", answers: { defenses: "My pass is hunter2 and they changed it." }, expect: ["defenses"], hard: true },

  // ---------- Dates ----------
  { kind: "Dates", name: "signing year typed as 2062", form: "respond", answers: { signDate: "2062-01-15" }, expect: ["signDate"] },
  { kind: "Dates", name: "court date already passed", form: "respond", answers: { courtDate: D(-20), signDate: D(-30), svc1Date: D(-30) }, expect: ["courtDate"] },
  { kind: "Dates", name: "conversation date in the future", form: "continuance", answers: { spokeDate: D(5) }, expect: ["spokeDate"] },
  { kind: "Dates", name: "hearing more than a year away", form: "continuance", answers: { hearingDate: D(500) }, expect: ["hearingDate"] },
  { kind: "Dates", name: "fee waiver signed a year ago", form: "feewaiver", answers: { incomeKinds: "wages", signDate: D(-370) }, expect: ["signDate"] },
  { kind: "Dates", name: "service before signing by a year", form: "appearance", answers: { svc1Date: D(-400) }, expect: ["svc1Date"] },

  // ---------- Your answer to the Complaint ----------
  { kind: "Answer lists", name: "a paragraph both admitted and denied", form: "respond", answers: { admitted: "1, 2", denied: "2, 3" }, expect: [["admitted", "denied"]] },
  { kind: "Answer lists", name: "a paragraph left out", form: "respond", answers: { admitted: "1, 2", denied: "4" }, expect: ["admitted"] },
  { kind: "Answer lists", name: "\"all of them\" admitted, and paragraph 3 denied", form: "respond", answers: { admitted: "all of them", denied: "3" }, expect: [["admitted", "denied"]] },
  { kind: "Answer lists", name: "no defenses", form: "respond", answers: { defenses: "" }, expect: ["defenses"] },
  { kind: "Answer lists", name: "a paragraph left out, the numbers written as words", form: "respond", answers: { admitted: "one, two", denied: "four" }, expect: ["admitted"], hard: true },

  // ---------- Words that would print ----------
  { kind: "Words that would print", name: "/s/ typed before the name", form: "respond", answers: { name: "/s/ Pat Example" }, expect: ["name"] },
  { kind: "Words that would print", name: "\"I don't know\" as the plaintiff", form: "appearance", answers: { plaintiff: "I don't know" }, expect: ["plaintiff"] },
  { kind: "Words that would print", name: "\"idk\" as the other party", form: "continuance", answers: { otherParty: "idk" }, expect: ["otherParty"] },
  { kind: "Words that would print", name: "\"none\" as the address, papers sent there", form: "respond", answers: { address: "None" }, expect: [["address", "receiveAt"]] },
  { kind: "Words that would print", name: "\"not sure\" as the case number", form: "appearance", answers: { caseNumber: "not sure" }, expect: ["caseNumber"], hard: true },

  // ---------- Blank answers ----------
  { kind: "Blank answers", name: "no name", form: "respond", answers: { name: "" }, expect: ["name"] },
  { kind: "Blank answers", name: "no plaintiff", form: "appearance", answers: { plaintiff: "" }, expect: ["plaintiff"] },
  { kind: "Blank answers", name: "no address for the copy sent", form: "respond", answers: { svc1Address: "" }, expect: ["svc1Address"] },
  { kind: "Blank answers", name: "no reason for the continuance", form: "continuance", answers: { reason: "" }, expect: ["reason"] },
  { kind: "Blank answers", name: "no case number", form: "respond", answers: { caseNumber: "" }, expect: ["caseNumber"] },

  // ---------- Amounts (fee waiver) ----------
  { kind: "Amounts", name: "wages of $1,250 an hour", form: "feewaiver", answers: { incomeKinds: "wages", hourlyRate: "1250" }, expect: ["hourlyRate"] },
  { kind: "Amounts", name: "800 hours a month", form: "feewaiver", answers: { incomeKinds: "wages", monthlyHours: "800" }, expect: ["monthlyHours"] },
  { kind: "Amounts", name: "$1,500,000 in the bank", form: "feewaiver", answers: { incomeKinds: "wages", bank: "1500000" }, expect: ["bank"] },
  { kind: "Amounts", name: "wages checked with no wage", form: "feewaiver", answers: { incomeKinds: "wages", hourlyRate: "" }, expect: ["hourlyRate"] },
  { kind: "Amounts", name: "a comma where the decimal point goes", form: "feewaiver", answers: { incomeKinds: "wages", hourlyRate: "12,50" }, expect: ["hourlyRate"], hard: true },

  // ---------- Your request (continuance) ----------
  { kind: "Your request", name: "a date for the time needed", form: "continuance", answers: { timeNeeded: "12/15/2026" }, expect: ["timeNeeded"] },
  { kind: "Your request", name: "didn't say whether they agreed", form: "continuance", answers: { otherAgreed: "" }, expect: ["otherAgreed"] },
  { kind: "Your request", name: "time needed as a month name", form: "continuance", answers: { timeNeeded: "until January" }, expect: ["timeNeeded"], hard: true },

  // ---------- Correct answers that look a little like mistakes (false alarm probes) ----------
  { kind: "Correct answers", name: "plus address at protonmail.com", form: "respond", answers: { email: "pat.example+court@protonmail.com" }, expect: [] },
  { kind: "Correct answers", name: "att.net email", form: "appearance", answers: { email: "pat@att.net" }, expect: [] },
  { kind: "Correct answers", name: "pcloud.com email", form: "continuance", answers: { email: "pat_ex@pcloud.com" }, expect: [] },
  { kind: "Correct answers", name: "email in capitals", form: "respond", answers: { email: "PAT@EXAMPLE.COM" }, expect: [] },
  { kind: "Correct answers", name: "no email: None", form: "appearance", answers: { email: "None" }, expect: [] },
  { kind: "Correct answers", name: "phone in parentheses", form: "respond", answers: { phone: "(260) 555-0100" }, expect: [] },
  { kind: "Correct answers", name: "phone with dots", form: "appearance", answers: { phone: "260.555.0100" }, expect: [] },
  { kind: "Correct answers", name: "phone with +1", form: "continuance", answers: { phone: "+1 260 555 0100" }, expect: [] },
  { kind: "Correct answers", name: "phone starting with 1-", form: "respond", answers: { phone: "1-260-555-0100" }, expect: [] },
  { kind: "Correct answers", name: "PO box", form: "appearance", answers: { address: "PO Box 1203, Gary, IN 46401" }, expect: [] },
  { kind: "Correct answers", name: "apartment number", form: "respond", answers: { address: "1203 W 5th Ave Apt 3B, Gary, IN 46402" }, expect: [] },
  { kind: "Correct answers", name: "military address", form: "continuance", answers: { address: "PSC 1234, Box 5678, APO AE 09012" }, expect: [] },
  { kind: "Correct answers", name: "rural route", form: "respond", answers: { address: "RR 2 Box 15, Rome City, IN 46784" }, expect: [] },
  { kind: "Correct answers", name: "county road address", form: "appearance", answers: { address: "4500 N County Road 500 E, Muncie, IN 47303" }, expect: [] },
  { kind: "Correct answers", name: "ZIP+4 and the state spelled out", form: "respond", answers: { address: "12 Elm St Unit 4, Indianapolis, Indiana 46204-1234" }, expect: [] },
  { kind: "Correct answers", name: "address on two lines", form: "continuance", answers: { address: "1 Main St\nFort Wayne, IN 46802" }, expect: [] },
  { kind: "Correct answers", name: "name with an apostrophe and a hyphen", form: "respond", answers: { name: "Mary O'Brien-Smith" }, expect: [] },
  { kind: "Correct answers", name: "name with accents", form: "appearance", answers: { name: "José Núñez" }, expect: [] },
  { kind: "Correct answers", name: "name with Jr.", form: "continuance", answers: { name: "Pat Example Jr." }, expect: [] },
  { kind: "Correct answers", name: "amount, date and confirmation number", form: "respond", answers: { defenses: "I paid $1,250.00 on 03/15/2025, confirmation number 882131." }, expect: [] },
  { kind: "Correct answers", name: "a year and a time limit", form: "respond", answers: { defenses: "The debt is from 2019 and is past the 6-year limit." }, expect: [] },
  { kind: "Correct answers", name: "nine-digit invoice number", form: "respond", answers: { defenses: "Invoice 445566778 was paid in full." }, expect: [] },
  { kind: "Correct answers", name: "last four digits of an account", form: "respond", answers: { defenses: "My account ending in 1234 was closed in 2022." }, expect: [] },
  { kind: "Correct answers", name: "a phone number in the defenses", form: "respond", answers: { defenses: "Their office told me by phone (260-555-0100) that it was paid." }, expect: [] },
  { kind: "Correct answers", name: "a case number in the defenses", form: "respond", answers: { defenses: "Case 02D01-2401-SC-000555 already decided this debt." }, expect: [] },
  { kind: "Correct answers", name: "a bus pass in the defenses", form: "respond", answers: { defenses: "My bus pass is valid until 12/31, and the pass was 10am-2pm only." }, expect: [] },
  { kind: "Correct answers", name: "a street number in the defenses", form: "respond", answers: { defenses: "I moved out of 1234 Main St in May." }, expect: [] },
  { kind: "Correct answers", name: "time needed: 3 weeks", form: "continuance", answers: { timeNeeded: "3 weeks" }, expect: [] },
  { kind: "Correct answers", name: "time needed: 30 days", form: "continuance", answers: { timeNeeded: "30 days" }, expect: [] },
  { kind: "Correct answers", name: "a date in the reason", form: "continuance", answers: { reason: "My surgery is scheduled for that morning, and I will be in the hospital for two days." }, expect: [] },
  { kind: "Correct answers", name: "minimum wage and full-time hours", form: "feewaiver", answers: { incomeKinds: "wages", hourlyRate: "7.25", monthlyHours: "160" }, expect: [] },
  { kind: "Correct answers", name: "a little in the bank", form: "feewaiver", answers: { incomeKinds: "wages", bank: "25.50" }, expect: [] },
  { kind: "Correct answers", name: "fax: none", form: "appearance", answers: { fax: "None" }, expect: [] },
  { kind: "Correct answers", name: "paragraph lists with \"and\"", form: "respond", answers: { admitted: "1 and 2", denied: "3" }, expect: [] },
  { kind: "Correct answers", name: "paragraph range", form: "respond", answers: { admitted: "1-2", denied: "3" }, expect: [] },
  { kind: "Correct answers", name: "a paragraph number written as a word", form: "respond", answers: { admitted: "one, 2", denied: "3" }, expect: [] },
  { kind: "Correct answers", name: "\"all except 3\" admitted, 3 denied", form: "respond", answers: { admitted: "all except 3", denied: "3" }, expect: [] },
  { kind: "Correct answers", name: "\"the rest\" admitted, 2 and 3 denied", form: "respond", answers: { admitted: "the rest", denied: "2, 3" }, expect: [] },
  { kind: "Correct answers", name: "court date tomorrow", form: "respond", answers: { courtDate: D(1), signDate: D(0), svc1Date: D(0) }, expect: [] },
];

// Each form filled with the usual sample answers and nothing else: the starting point every case is compared with.
export const FORMS = ["respond", "appearance", "continuance", "feewaiver"];
export const BASE = { feewaiver: { incomeKinds: "wages", expenseKinds: "none" } };
