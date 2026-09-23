import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

function run(args) {
  return spawnSync(process.execPath, ["bin/whencanwe.js", ...args], { encoding: "utf8" });
}

test("CLI prints the New York and London overlap", () => {
  const result = run([
    "--date",
    "2026-09-23",
    "--viewer",
    "UTC",
    "--person",
    "Alex|America/New_York|09:00|17:00",
    "--person",
    "Sam|Europe/London|09:00|17:00",
  ]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Alex \(America\/New_York\): Wed 23 Sep, 09:00–12:00/);
  assert.match(result.stdout, /Sam \(Europe\/London\): Wed 23 Sep, 14:00–17:00/);
});

test("CLI fails when nobody shares an hour", () => {
  const result = run([
    "--date",
    "2026-09-23",
    "--person",
    "Alex|America/New_York|09:00|17:00",
    "--person",
    "Ren|Asia/Tokyo|09:00|17:00",
  ]);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /Closest times:/);
});
