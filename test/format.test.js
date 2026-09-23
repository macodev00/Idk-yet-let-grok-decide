import assert from "node:assert/strict";
import test from "node:test";
import { summaryText } from "../src/format.js";
import { analyze } from "../src/overlap.js";

test("summary names each person's local hours", () => {
  const nyc = { name: "Alex", place: "New York", timeZone: "America/New_York", start: "09:00", end: "17:00", days: "1111100" };
  const london = { name: "Sam", place: "London", timeZone: "Europe/London", start: "09:00", end: "17:00", days: "1111100" };
  const result = analyze("2026-09-23", "UTC", [nyc, london]);
  const text = summaryText(result, [nyc, london]);
  assert.match(text, /^Everyone can make these times:/);
  assert.match(text, /Alex \(New York\): Wed 23 Sep, 09:00–12:00/);
  assert.match(text, /Sam \(London\): Wed 23 Sep, 14:00–17:00/);
});
