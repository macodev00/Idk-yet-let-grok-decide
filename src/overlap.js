import { addIsoDays, inWeeklyWindow, isValidTimeZone, minutesOutsideWindow, wallToUtc, zonedParts } from "./time.js";

function coversInstant(utc, person) {
  if (!person.timeZone || !isValidTimeZone(person.timeZone)) return false;
  return inWeeklyWindow(zonedParts(utc, person.timeZone), person);
}

function coversSlot(utc, stepMin, person) {
  const lastInside = utc + (stepMin - 1) * 60 * 1000;
  return coversInstant(utc, person) && coversInstant(lastInside, person);
}

export function scoreSlot(utc, people, stepMin) {
  const rows = people.map((person) => {
    const ok = coversSlot(utc, stepMin, person);
    const outside =
      ok || !person.timeZone || !isValidTimeZone(person.timeZone)
        ? 0
        : minutesOutsideWindow(zonedParts(utc, person.timeZone), person);
    return { name: person.name || "Unnamed", ok, outside };
  });
  const available = rows.filter((row) => row.ok).map((row) => row.name);
  const pain = rows.reduce((sum, row) => sum + (row.ok ? 0 : row.outside), 0);
  return {
    count: available.length,
    total: people.length,
    all: people.length > 0 && available.length === people.length,
    pain,
    available,
    missing: rows.filter((row) => !row.ok).map((row) => row.name),
  };
}

export function analyze(isoDate, viewerTimeZone, people, options = {}) {
  if (!isValidTimeZone(viewerTimeZone)) throw new Error("Unknown viewer time zone.");
  const stepMin = options.stepMin === 30 ? 30 : 60;
  const dayCount = clampDays(options.days);
  const ready = people.filter((person) => person.timeZone && isValidTimeZone(person.timeZone));
  const slots = [];
  for (let offset = 0; offset < dayCount; offset += 1) {
    const date = addIsoDays(isoDate, offset);
    const [year, month, day] = date.split("-").map(Number);
    for (let minutes = 0; minutes < 24 * 60; minutes += stepMin) {
      const hour = Math.floor(minutes / 60);
      const minute = minutes % 60;
      const utc = wallToUtc(year, month, day, hour, minute, viewerTimeZone);
      if (utc === null) continue;
      const parts = zonedParts(utc, viewerTimeZone);
      slots.push({ utc, parts, ...scoreSlot(utc, ready, stepMin) });
    }
  }

  const full = mergeRanges(slots, stepMin, (slot) => (slot.all ? "all" : ""));
  let compromises = [];
  if (full.length === 0) {
    compromises = mergeRanges(slots, stepMin, (slot) =>
      slot.count > 0 && !slot.all ? slot.available.join("\0") : "",
    );
    compromises.sort((left, right) => {
      if (right.count !== left.count) return right.count - left.count;
      if (right.durationMin !== left.durationMin) return right.durationMin - left.durationMin;
      if (left.averagePain !== right.averagePain) return left.averagePain - right.averagePain;
      return left.startUtc - right.startUtc;
    });
    compromises = compromises.slice(0, 6);
  }

  return { stepMin, viewerTimeZone, slots, full, compromises };
}

function clampDays(value) {
  const days = Number(value ?? 7);
  if (!Number.isInteger(days)) return 7;
  return Math.min(14, Math.max(1, days));
}

function mergeRanges(slots, stepMin, keyFor) {
  const ranges = [];
  let current = null;
  const finish = () => {
    if (!current) return;
    ranges.push(current);
    current = null;
  };
  for (const slot of slots) {
    const key = keyFor(slot);
    const continues =
      current &&
      key &&
      current.key === key &&
      current.endUtc === slot.utc &&
      current.viewerDate === slot.parts.isoDate;
    if (continues) {
      current.endUtc = slot.utc + stepMin * 60 * 1000;
      current.painSum += slot.pain;
      current.slots += 1;
      current.averagePain = current.painSum / current.slots;
      current.durationMin = current.slots * stepMin;
      continue;
    }
    finish();
    if (!key) continue;
    current = {
      key,
      startUtc: slot.utc,
      endUtc: slot.utc + stepMin * 60 * 1000,
      count: slot.count,
      total: slot.total,
      available: slot.available,
      missing: slot.missing,
      viewerDate: slot.parts.isoDate,
      painSum: slot.pain,
      slots: 1,
      averagePain: slot.pain,
      durationMin: stepMin,
    };
  }
  finish();
  return ranges.map(({ key, painSum, slots: ignored, ...range }) => range);
}
