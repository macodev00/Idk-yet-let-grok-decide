import { isValidTimeZone, parseHHMM } from "./time.js";

const MAX_PEOPLE = 12;
const MAX_ENCODED = 6000;

export function encodeTeam(team) {
  const payload = {
    v: 1,
    d: team.date,
    s: team.stepMin === 30 ? 30 : 60,
    p: team.people.slice(0, MAX_PEOPLE).map((person) => [
      cleanName(person.name),
      person.place || "",
      person.timeZone || "",
      person.start,
      person.end,
      person.days,
    ]),
  };
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

export function decodeTeam(encoded) {
  if (typeof encoded !== "string" || encoded.length === 0 || encoded.length > MAX_ENCODED) {
    throw new Error("Link is empty or too long.");
  }
  if (!/^[A-Za-z0-9_-]+$/.test(encoded)) throw new Error("Link has unexpected characters.");
  const padded = encoded + "=".repeat((4 - (encoded.length % 4)) % 4);
  const binary = atob(padded.replaceAll("-", "+").replaceAll("_", "/"));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  const parsed = JSON.parse(new TextDecoder().decode(bytes));
  return normalizeTeam(parsed);
}

export function normalizeTeam(input) {
  if (!input || typeof input !== "object") throw new Error("Plan is not an object.");
  const date = String(input.d ?? input.date ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Plan date is invalid.");
  const [year, month, day] = date.split("-").map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 2000 || year > 2100) {
    throw new Error("Plan date is out of range.");
  }
  const stepValue = Number(input.s ?? input.stepMin ?? 60);
  const stepMin = stepValue === 30 ? 30 : 60;
  const rawPeople = input.p ?? input.people;
  if (!Array.isArray(rawPeople)) throw new Error("Plan has no people.");
  if (rawPeople.length > MAX_PEOPLE) throw new Error("Plan has too many people.");
  const people = rawPeople.map((entry, index) => normalizePerson(entry, index));
  return { date, stepMin, people };
}

function normalizePerson(entry, index) {
  const fields = Array.isArray(entry)
    ? entry
    : [entry?.name, entry?.place, entry?.timeZone, entry?.start, entry?.end, entry?.days];
  const [name, place, timeZone, start, end, days] = fields;
  const zone = String(timeZone ?? "");
  if (zone && !isValidTimeZone(zone)) throw new Error(`Unknown time zone for person ${index + 1}.`);
  if (parseHHMM(start) === null || parseHHMM(end) === null) {
    throw new Error(`Working hours are invalid for person ${index + 1}.`);
  }
  if (!/^[01]{7}$/.test(String(days ?? ""))) throw new Error(`Weekdays are invalid for person ${index + 1}.`);
  return {
    name: cleanName(name),
    place: cleanName(place).slice(0, 80),
    timeZone: zone,
    start,
    end,
    days: String(days),
  };
}

function cleanName(value) {
  return String(value ?? "")
    .replace(/[\r\n\t]+/g, " ")
    .trim()
    .slice(0, 60);
}
