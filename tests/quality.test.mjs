// Item 18: the fixed test set in quality/cases.mjs, measured against quality/baseline.json. A mistake the baseline
// says is caught must still be caught, and a correct answer the baseline says gets no flag must still get none.
// A change that does better fails too, with a note to record it: `npm run quality` makes the report and baseline again.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fresh, close } from "./lib.mjs";
import { measure, summary } from "./quality/run.mjs";
import { CASES } from "./quality/cases.mjs";

let now, was;
before(async () => {
  const p = await fresh();
  now = summary(await measure(p));
  was = JSON.parse(fs.readFileSync(new URL("./quality/baseline.json", import.meta.url), "utf8"));
});
after(close);

test("every case has its own name, a kind, a form and what's wrong with it", () => {
  assert.equal(new Set(CASES.map(c => c.name)).size, CASES.length);
  for (const c of CASES) assert.ok(c.kind && c.form && Array.isArray(c.expect), c.name);
});

test("no mistake the baseline counts as caught is missed now", () => {
  const worse = now.missed.filter(n => !was.missed.includes(n));
  assert.deepEqual(worse, [], `Now missed: ${worse.join("; ")}`);
});

test("no correct answer the baseline counts as clean gets a flag now", () => {
  const worse = now.falseAlarms.filter(n => !was.falseAlarms.includes(n));
  assert.deepEqual(worse, [], `New false alarms: ${worse.join("; ")}`);
});

test("the report is up to date: anything that got better is recorded", () => {
  const better = [...was.missed.filter(n => !now.missed.includes(n)).map(n => `now caught: ${n}`), ...was.falseAlarms.filter(n => !now.falseAlarms.includes(n)).map(n => `no longer flagged: ${n}`)];
  assert.deepEqual(better, [], `Better than the baseline (${better.join("; ")}). Run "npm run quality" in tests/ to record it in quality/REPORT.md.`);
});
