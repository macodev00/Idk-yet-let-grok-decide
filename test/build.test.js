import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

test("standalone build inlines the app and does not import files", () => {
  const result = spawnSync(process.execPath, ["scripts/build-standalone.js"], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  const html = readFileSync("dist/whencanwe.html", "utf8");
  assert.equal(html.includes('src="./'), false);
  assert.equal(html.includes('from "./'), false);
  assert.match(html, /function analyze/);
  assert.match(html, /When can we/);
});
