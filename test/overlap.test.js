import assert from "node:assert/strict";
import test from "node:test";
import { CITIES } from "../src/cities.js";
import { analyze, scoreSlot } from "../src/overlap.js";
import { isValidTimeZone } from "../src/time.js";

const nyc = { name: "Alex", place: "New York", timeZone: "America/New_York", start: "09:00", end: "17:00", days: "1111100" };
const london = { name: "Sam", place: "London", timeZone: "Europe/London", start: "09:00", end: "17:00", days: "1111100" };
const tokyo = { name: "Ren", place: "Tokyo", timeZone: "Asia/Tokyo", start: "09:00", end: "17:00", days: "1111100" };

test("New York and London overlap 09:00–12:00 New York time in September", () => {
  const result = analyze("2026-09-23", "UTC", [nyc, london], { stepMin: 60 });
  assert.equal(result.full.length, 5);
  assert.equal(result.full[0].startUtc, Date.parse("2026-09-23T13:00:00.000Z"));
  assert.equal(result.full[0].endUtc, Date.parse("2026-09-23T16:00:00.000Z"));
  assert.equal(result.compromises.length, 0);
  for (const block of result.full) {
    const day = new Date(block.startUtc).getUTCDay();
    assert.notEqual(day, 0);
    assert.notEqual(day, 6);
  }
});

test("the same overlap is found when the viewer is in New York", () => {
  const result = analyze("2026-09-23", "America/New_York", [nyc, london], { stepMin: 30 });
  assert.equal(result.full[0].startUtc, Date.parse("2026-09-23T13:00:00.000Z"));
  assert.equal(result.full[0].endUtc, Date.parse("2026-09-23T16:00:00.000Z"));
});

test("a 60-minute step does not count an hour that is only partly inside working hours", () => {
  const earlyEnd = { ...london, end: "16:30" };
  const result = analyze("2026-09-23", "UTC", [nyc, earlyEnd], { stepMin: 60 });
  assert.equal(result.full[0].endUtc, Date.parse("2026-09-23T15:00:00.000Z"));
});

test("Tokyo and New York weekday hours do not fully overlap, so the London pair stays the best compromise", () => {
  const result = analyze("2026-09-23", "UTC", [nyc, london, tokyo]);
  assert.equal(result.full.length, 0);
  assert.equal(result.compromises[0].count, 2);
  assert.deepEqual(result.compromises[0].available, ["Alex", "Sam"]);
  assert.deepEqual(result.compromises[0].missing, ["Ren"]);
  assert.equal(result.compromises[0].startUtc, Date.parse("2026-09-23T13:00:00.000Z"));
});

test("closer hours rank ahead of the middle of the night", () => {
  const during = scoreSlot(Date.parse("2026-09-23T13:00:00.000Z"), [nyc, tokyo], 60);
  const late = scoreSlot(Date.parse("2026-09-23T04:00:00.000Z"), [nyc, tokyo], 60);
  assert.ok(during.pain < late.pain);
  assert.equal(during.available.includes("Alex"), true);
  assert.equal(during.available.includes("Ren"), false);
});

test("an overnight Friday shift covers early Saturday and not Sunday", () => {
  const night = { name: "Night", place: "UTC", timeZone: "UTC", start: "22:00", end: "06:00", days: "0000100" };
  const step = 60;
  const saturdayEarly = scoreSlot(Date.parse("2026-09-26T02:00:00.000Z"), [night], step);
  const fridayLate = scoreSlot(Date.parse("2026-09-25T23:00:00.000Z"), [night], step);
  const saturdayNoon = scoreSlot(Date.parse("2026-09-26T12:00:00.000Z"), [night], step);
  const sundayEarly = scoreSlot(Date.parse("2026-09-27T02:00:00.000Z"), [night], step);
  assert.equal(saturdayEarly.all, true);
  assert.equal(fridayLate.all, true);
  assert.equal(saturdayNoon.all, false);
  assert.equal(sundayEarly.all, false);
});

test("every bundled city is a real IANA time zone", () => {
  for (const [city, , zone] of CITIES) {
    assert.equal(isValidTimeZone(zone), true, `${city} -> ${zone}`);
  }
});
