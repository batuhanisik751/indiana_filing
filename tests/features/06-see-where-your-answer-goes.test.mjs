// Feature 6: each question says where its answer prints, can show that place highlighted on the official form,
// and links to the blank form and to Indiana Legal Help.
import { describe, test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { fresh, close, reset, pick, walk, step } from "../lib.mjs";

let p;
before(async () => { p = await fresh(); });
beforeEach(() => reset(p));
after(close);
const open = async () => { await p.click("#whereToggle"); await p.waitForSelector("#wherePreview canvas, #whereRetry", { timeout: 120000 }); };

describe("6. See where your answer goes", () => {
  test("a question says where its answer prints", async () => {
    await pick(p, "appearance"); await walk(p, "name");
    assert.match(await p.textContent("#whereText"), /^Prints on: .*Appearance/);
  });
  test("the picture of the form is closed until asked for, and says how much it downloads", async () => {
    await pick(p, "appearance"); await walk(p, "name");
    assert.equal(await p.getAttribute("#whereToggle", "aria-expanded"), "false");
    assert.equal(await p.locator("#wherePreview").isHidden(), true);
    assert.match(await p.textContent("#whereSize"), /3 MB/);
  });
  test("Show it on the form draws the official page with the place highlighted", async () => {
    await pick(p, "appearance"); await walk(p, "name");
    await open();
    assert.equal(await p.locator("#wherePreview canvas").count(), 1);
    assert.ok(await p.locator(".wheremark").count() >= 1);
    assert.match(await p.textContent("#whereCaption"), /Appearance.*page \d+ of \d+/);
  });
  test("the blank official form link points to a PDF that's part of the tool", async () => {
    await pick(p, "appearance");
    const href = await p.getAttribute("#whereBlank", "href"), url = await p.evaluate(h => new URL(h, location.href).href, href);
    assert.match(url, /\/forms\/[^/]+\.pdf$/);
    if (url.startsWith("file:")) assert.ok(fs.existsSync(fileURLToPath(url)), url);
  });
  test("each question links to the form's page on Indiana Legal Help, in a new tab", async () => {
    await pick(p, "respond");
    const link = p.locator(".where a", { hasText: "On Indiana Legal Help" });
    assert.match(await link.getAttribute("href"), /indianalegalhelp\.org/);
    assert.equal(await link.getAttribute("target"), "_blank");
  });
  test("edge: an answer that doesn't print says so, with no picture to open", async () => {
    await pick(p, "appearance"); await walk(p, "svcMore1");
    assert.match(await p.textContent("#whereText"), /doesn't print on the form itself/);
    assert.equal(await p.locator("#whereToggle").count(), 0);
    assert.equal(await p.locator("#whereBlank").count(), 1, "the blank form is still linked");
  });
  test("edge: once opened, it stays open on the next question", async () => {
    await pick(p, "appearance"); await walk(p, "plaintiff");
    await open(); await p.fill("#ans", "Acme Credit LLC"); await p.click("#next");
    assert.equal(await step(p), "name");
    assert.equal(await p.getAttribute("#whereToggle", "aria-expanded"), "true");
    await p.waitForSelector("#wherePreview canvas", { timeout: 120000 });
  });
  test("edge: on another form it starts closed again, since that's another download", async () => {
    await pick(p, "appearance"); await walk(p, "name"); await open();
    await p.click("#changeForm"); await pick(p, "continuance");
    assert.equal(await p.getAttribute("#whereToggle", "aria-expanded"), "false");
  });
  test("edge: if the viewer can't load, it says so, offers Try again, and the blank form link stays", async () => {
    const q = await fresh();
    await q.context().route(/cdnjs\.cloudflare\.com/, r => r.abort());
    await pick(q, "appearance"); await walk(q, "name");
    await q.click("#whereToggle");
    await q.waitForSelector("#whereRetry", { timeout: 60000 });
    assert.match(await q.textContent("#wherePreview"), /couldn't be shown\. The blank form link above still works/);
    assert.equal(await q.locator("#whereBlank").count(), 1);
    await q.context().close();
  });
  test("edge: an answer that prints in more than three places lists the rest behind Show the other N", async () => {
    await pick(p, "continuance"); await walk(p, "name"); // after "who started the case", which decides where it prints
    assert.ok(await p.evaluate(() => whereRows(visible()[cur]).length) > 3);
    const n = +(await p.textContent(".wheremore summary")).match(/Show the other (\d+)/)[1];
    const rest = (await p.textContent(".wheremore p")).split(" · ");
    assert.equal(rest.length, n);
    assert.match(await p.textContent("#whereText"), new RegExp(`and ${n} more\\.$`));
  });
});
