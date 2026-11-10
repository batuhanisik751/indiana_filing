// Only with BASE_URL set: the hosted copy serves the page at its root, with every file, and isn't listed by search engines.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ROOT, BASE_URL } from "./lib.mjs";

const hosted = BASE_URL ? test : test.skip;
const html = fs.readFileSync(path.join(ROOT, "form-builder-mvp.html"), "utf8");
const files = [...html.matchAll(/(?:src|href)="(app\/[^"]+)"/g)].map(m => m[1]).concat(fs.readdirSync(path.join(ROOT, "forms/data")).map(f => `forms/data/${f}`));
const root = BASE_URL.replace(/[^/]*$/, "");

hosted("the root address serves the tool, and asks not to be listed", async () => {
  const r = await fetch(root);
  assert.equal(r.status, 200);
  assert.match(await r.text(), /<title>Indiana Court Form Helper/);
  assert.match(r.headers.get("x-robots-tag") || "", /noindex/);
});

hosted("every file the page loads is there, and matches this copy", async () => {
  for (const f of files) {
    const r = await fetch(root + f);
    assert.equal(r.status, 200, f);
    assert.equal(Buffer.from(await r.arrayBuffer()).equals(fs.readFileSync(path.join(ROOT, f))), true, `${f} is the same as this copy`);
  }
});

hosted("the blank official forms are there", async () => {
  for (const f of fs.readdirSync(path.join(ROOT, "forms")).filter(f => f.endsWith(".pdf"))) assert.equal((await fetch(root + "forms/" + encodeURIComponent(f), { method: "HEAD" })).status, 200, f);
});
