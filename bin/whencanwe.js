#!/usr/bin/env node
import { analyze } from "../src/overlap.js";
import { summaryText } from "../src/format.js";
import { isValidTimeZone, todayIso } from "../src/time.js";

const args = process.argv.slice(2);
let date = "";
let viewer = "UTC";
let stepMin = 60;
const people = [];

function usage(code) {
  console.error(`Usage: whencanwe --person "Alex|America/New_York|09:00|17:00" --person "Sam|Europe/London|09:00|17:00" [--date 2026-09-23] [--viewer UTC] [--step 60]

Weekdays default to Mon–Fri (1111100). Add a fifth field to set days, Monday first.`);
  process.exit(code);
}

function parsePerson(value) {
  const [name, timeZone, start, end, days = "1111100"] = String(value ?? "").split("|");
  if (!name || !isValidTimeZone(timeZone) || !/^\d{2}:\d{2}$/.test(start ?? "") || !/^\d{2}:\d{2}$/.test(end ?? "")) {
    console.error(`Could not read person "${value}". Expected Name|Time/Zone|09:00|17:00`);
    process.exit(2);
  }
  if (!/^[01]{7}$/.test(days)) {
    console.error("Days must be 7 digits, Monday through Sunday, like 1111100.");
    process.exit(2);
  }
  return { name, place: timeZone, timeZone, start, end, days };
}

for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === "--help" || arg === "-h") usage(0);
  else if (arg === "--date") date = args[++index] ?? "";
  else if (arg === "--viewer") viewer = args[++index] ?? "";
  else if (arg === "--step") stepMin = Number(args[++index]);
  else if (arg === "--person") people.push(parsePerson(args[++index]));
  else usage(2);
}

if (!people.length) usage(2);
if (!isValidTimeZone(viewer)) {
  console.error(`Unknown viewer time zone: ${viewer}`);
  process.exit(2);
}
if (!date) date = todayIso(viewer);
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
  console.error("Date must look like 2026-09-23.");
  process.exit(2);
}

const result = analyze(date, viewer, people, { stepMin });
console.log(summaryText(result, people));
process.exit(result.full.length ? 0 : 1);
