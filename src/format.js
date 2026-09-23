import { formatClock, formatDay, zonedParts } from "./time.js";

export function formatSpan(startUtc, endUtc, timeZone) {
  const start = zonedParts(startUtc, timeZone);
  const end = zonedParts(endUtc, timeZone);
  const startClock = formatClock(start.hour, start.minute);
  const endClock = formatClock(end.hour, end.minute);
  if (start.isoDate === end.isoDate) {
    return `${formatDay(start)}, ${startClock}–${endClock}`;
  }
  return `${formatDay(start)}, ${startClock} – ${formatDay(end)}, ${endClock}`;
}

export function summaryText(result, people) {
  const blocks = result.full.length ? result.full : result.compromises;
  if (people.length === 0) return "Add at least two people to compare working hours.";
  if (people.length === 1) return "Add another person to see where working hours overlap.";
  if (blocks.length === 0) return "No working-hour overlap in this week.";
  const heading = result.full.length
    ? "Everyone can make these times:"
    : "No hour works for everyone. Closest times:";
  const lines = [heading];
  for (const block of blocks) {
    lines.push("");
    for (const person of people) {
      const place = person.place || person.timeZone;
      lines.push(`${person.name} (${place}): ${formatSpan(block.startUtc, block.endUtc, person.timeZone)}`);
    }
    if (block.missing?.length) lines.push(`Outside hours: ${block.missing.join(", ")}`);
  }
  return lines.join("\n");
}
