import assert from "node:assert/strict";
import test from "node:test";
import { resolvePlace } from "../src/cities.js";
import { decodeTeam, encodeTeam } from "../src/codec.js";

test("resolves cities, accents, and raw IANA names", () => {
  assert.equal(resolvePlace("london").timeZone, "Europe/London");
  assert.equal(resolvePlace("São Paulo").timeZone, "America/Sao_Paulo");
  assert.equal(resolvePlace("sao paulo").place, "São Paulo");
  assert.equal(resolvePlace("America/Chicago").place, "Chicago");
  assert.equal(resolvePlace("Nopeville"), null);
});

test("round-trips a plan through a URL-safe hash", () => {
  const team = {
    date: "2026-09-23",
    stepMin: 30,
    people: [
      { name: "José", place: "São Paulo", timeZone: "America/Sao_Paulo", start: "09:00", end: "17:00", days: "1111100" },
      { name: "Sam", place: "London", timeZone: "Europe/London", start: "10:00", end: "16:00", days: "1111110" },
    ],
  };
  const encoded = encodeTeam(team);
  assert.match(encoded, /^[A-Za-z0-9_-]+$/);
  const decoded = decodeTeam(encoded);
  assert.equal(decoded.date, "2026-09-23");
  assert.equal(decoded.stepMin, 30);
  assert.equal(decoded.people[0].name, "José");
  assert.equal(decoded.people[0].timeZone, "America/Sao_Paulo");
  assert.equal(decoded.people[1].days, "1111110");
});

test("rejects a tampered time zone and oversized links", () => {
  const team = {
    date: "2026-09-23",
    stepMin: 60,
    people: [{ name: "A", place: "UTC", timeZone: "UTC", start: "09:00", end: "17:00", days: "1111100" }],
  };
  const decoded = decodeTeam(encodeTeam(team));
  decoded.people[0].timeZone = "Not/AZone";
  assert.throws(() => decodeTeam(encodeTeam(decoded)));
  assert.throws(() => decodeTeam("%%%%"));
  assert.throws(() => decodeTeam("a".repeat(6001)));
});
