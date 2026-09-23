import assert from "node:assert/strict";
import test from "node:test";
import { wallToUtc, zonedParts } from "../src/time.js";

test("converts known civil times to UTC", () => {
  assert.equal(wallToUtc(2026, 9, 23, 0, 0, "America/New_York"), Date.parse("2026-09-23T04:00:00.000Z"));
  assert.equal(wallToUtc(2026, 1, 15, 0, 0, "America/New_York"), Date.parse("2026-01-15T05:00:00.000Z"));
  assert.equal(wallToUtc(2026, 9, 23, 0, 0, "Asia/Kolkata"), Date.parse("2026-09-22T18:30:00.000Z"));
  assert.equal(wallToUtc(2026, 9, 23, 0, 0, "Asia/Kathmandu"), Date.parse("2026-09-22T18:15:00.000Z"));
  assert.equal(wallToUtc(2026, 9, 23, 0, 0, "America/St_Johns"), Date.parse("2026-09-23T02:30:00.000Z"));
});

test("reads zoned parts back from UTC", () => {
  const parts = zonedParts(Date.parse("2026-09-23T13:00:00.000Z"), "America/New_York");
  assert.equal(parts.hour, 9);
  assert.equal(parts.minute, 0);
  assert.equal(parts.isoDate, "2026-09-23");
  assert.equal(parts.weekday, 3);
});

test("skips the missing hour when US clocks spring forward", () => {
  assert.equal(wallToUtc(2026, 3, 8, 2, 30, "America/New_York"), null);
  assert.equal(wallToUtc(2026, 3, 8, 1, 30, "America/New_York"), Date.parse("2026-03-08T06:30:00.000Z"));
  assert.equal(wallToUtc(2026, 3, 8, 3, 30, "America/New_York"), Date.parse("2026-03-08T07:30:00.000Z"));
});

test("still resolves one of the repeated hours when US clocks fall back", () => {
  const first = wallToUtc(2026, 11, 1, 1, 30, "America/New_York");
  assert.ok(first === Date.parse("2026-11-01T05:30:00.000Z") || first === Date.parse("2026-11-01T06:30:00.000Z"));
});
