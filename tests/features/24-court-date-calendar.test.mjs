// Feature: how far away the court date is, and a calendar file for it, made on the device. (An idea from other teams'
// projects: Team 9's "My dates", Team 11's countdown. Theirs send the date to Google Calendar; this sends nothing.)
import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fresh, close, inject } from "../lib.mjs";

let p;
before(async () => { p = await fresh(); });
after(close);
// A day counted from today on the page's own clock, as the date box would give it.
const dayAhead = n => p.evaluate(n => { const d = new Date(); d.setDate(d.getDate() + n); return dayString(d); }, n);
// The court date step's one line, and the calendar button under it.
const line = () => p.$$eval("ol.steps > li", lis => lis.filter(li => li.querySelector("[data-ics]")).map(li => li.querySelector(":scope > p").textContent));
const steps = () => p.textContent("ol.steps");
async function download() {
  const [d] = await Promise.all([p.waitForEvent("download"), p.click("[data-ics]")]);
  return { name: d.suggestedFilename(), text: fs.readFileSync(await d.path(), "utf8") };
}

describe("Court date: days to go and a calendar file", () => {
  test("respond: the court date step says how many days away it is, with a calendar button", async () => {
    const day = await dayAhead(10);
    await inject(p, "respond", { courtDate: day });
    const [l] = await line();
    assert.match(l, /^Your next court date: \d\d\/\d\d\/\d{4}, 10 days from today\. /);
    assert.equal(await p.getAttribute("[data-ics]", "data-ics"), day);
    assert.equal(await p.textContent("[data-ics]"), "Add it to my calendar");
    assert.equal(await p.textContent("ol.steps .calnote"), 'Made on this device. Nothing is sent, and it says only "Court date".');
  });

  test("the file is a calendar file for that whole day, with two reminders", async () => {
    const day = await dayAhead(10);
    await inject(p, "appearance", { courtDate: day });
    const { name, text } = await download();
    assert.equal(name, `court-date-${day}.ics`);
    const ymd = day.replace(/-/g, "");
    assert.match(text, /^BEGIN:VCALENDAR\r\nVERSION:2\.0\r\n/);
    assert.match(text, new RegExp(`\r\nDTSTART;VALUE=DATE:${ymd}\r\n`));
    assert.match(text, /\r\nSUMMARY:Court date\r\n/);
    assert.equal((text.match(/BEGIN:VALARM/g) || []).length, 2);
    assert.match(text, /END:VEVENT\r\nEND:VCALENDAR\r\n$/);
    await p.waitForFunction(() => /calendar file is downloading/.test(document.getElementById("announce").textContent)); // said 50 ms later, like every announcement
  });

  test("continuance: the hearing date gets the same, and the file is for it", async () => {
    const day = await dayAhead(21);
    await inject(p, "continuance", { hearingDate: day });
    assert.match((await line())[0], /^Your hearing is still set for \d\d\/\d\d\/\d{4}, 21 days from today\. /);
    const { text } = await download();
    assert.match(text, new RegExp(`DTSTART;VALUE=DATE:${day.replace(/-/g, "")}`));
  });

  test("fee waiver: no court date, so none of this", async () => {
    await inject(p, "feewaiver");
    assert.equal(await p.$("[data-ics]"), null);
    assert.doesNotMatch(await steps(), /days from today/);
  });

  test("edge: nothing about the case goes in the file", async () => {
    const day = await dayAhead(5);
    const mine = { name: "Quincy Zephyrine", caseNumber: "02D01-2611-CC-004321", plaintiff: "Wolfram Lenders Inc", address: "77 Hidden Lane, Fort Wayne, IN 46802",
      email: "quincy.z@example.com", phone: "260-555-0111", svc1Name: "Wolfram Lenders Inc", svc1Address: "9 Collector Way, Fort Wayne, IN 46802", county: "Allen" };
    await inject(p, "respond", { ...mine, courtDate: day });
    const { text } = await download();
    for (const v of [...Object.values(mine), "Allen", "Superior", "02D01", "Answer", "Appearance"]) assert.ok(!text.includes(v), v);
  });

  test("edge: no date, or a date already passed: no countdown and no calendar file", async () => {
    await inject(p, "respond", { courtDate: "" });
    assert.equal(await p.$("[data-ics]"), null);
    await inject(p, "respond", { courtDate: await dayAhead(-1) });
    assert.equal(await p.$("[data-ics]"), null);
    assert.match(await steps(), /has already passed/);
    assert.doesNotMatch(await steps(), /days from today/);
    await inject(p, "continuance", { hearingDate: await dayAhead(-3) });
    assert.equal(await p.$("[data-ics]"), null);
  });

  test("edge: today and tomorrow say so", async () => {
    await inject(p, "respond", { courtDate: await dayAhead(0) });
    assert.match((await line())[0], /, today\. /);
    await inject(p, "respond", { courtDate: await dayAhead(1) });
    assert.match((await line())[0], /, tomorrow\. /);
  });

  test("edge: a date on the last day of the year ends on the first day of the next one", async () => {
    const year = await p.evaluate(() => new Date().getFullYear());
    await inject(p, "respond", { courtDate: `${year}-12-31` });
    const { text } = await download();
    assert.match(text, new RegExp(`DTSTART;VALUE=DATE:${year}1231\r\nDTEND;VALUE=DATE:${year + 1}0101\r\n`));
  });

  test("edge: a day that isn't on the calendar gets no file", async () => {
    const year = await p.evaluate(() => new Date().getFullYear() + 1);
    await inject(p, "respond", { courtDate: `${year}-02-30` });
    assert.equal(await p.$("[data-ics]"), null);
    assert.doesNotMatch(await steps(), /days from today/);
  });

  test("edge: making the file sends nothing over the network", async () => {
    await inject(p, "respond", { courtDate: await dayAhead(12) });
    const sent = [];
    const watch = r => { if (!/^(blob|data):/.test(r.url())) sent.push(r.url()); };
    p.on("request", watch);
    await download();
    await p.waitForTimeout(300);
    p.off("request", watch);
    assert.deepEqual(sent, []);
  });

  test("edge: downloading again updates the same event (BT20), and every line fits the calendar format's 75-character limit", async () => {
    await inject(p, "respond", { courtDate: await dayAhead(40) });
    const a = (await download()).text, b = (await download()).text;
    const uid = t => t.match(/\r\nUID:(.+)\r\n/)[1];
    assert.equal(uid(a), uid(b));
    for (const l of a.split("\r\n")) assert.ok(Buffer.byteLength(l) <= 75, l);
  });

  test("edge: the button works from the keyboard", async () => {
    await inject(p, "respond", { courtDate: await dayAhead(3) });
    await p.focus("[data-ics]");
    const [d] = await Promise.all([p.waitForEvent("download"), p.keyboard.press("Enter")]);
    assert.match(d.suggestedFilename(), /^court-date-\d{4}-\d{2}-\d{2}\.ics$/);
  });
});
