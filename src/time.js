const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function isValidTimeZone(timeZone) {
  if (!timeZone || typeof timeZone !== "string") return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(0);
    return true;
  } catch {
    return false;
  }
}

export function addIsoDays(isoDate, days) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return shifted.toISOString().slice(0, 10);
}

export function timeZoneOffsetMs(utcMs, timeZone) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = Object.fromEntries(
    dtf
      .formatToParts(new Date(utcMs))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  let hour = Number(parts.hour);
  let extraDay = 0;
  if (hour === 24) {
    hour = 0;
    extraDay = 1;
  }
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day) + extraDay,
    hour,
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - utcMs;
}

export function zonedTimeToUtc(year, month, day, hour, minute, timeZone) {
  const guess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const firstOffset = timeZoneOffsetMs(guess, timeZone);
  let utc = guess - firstOffset;
  const secondOffset = timeZoneOffsetMs(utc, timeZone);
  if (secondOffset !== firstOffset) utc = guess - secondOffset;
  return utc;
}

export function zonedParts(utcMs, timeZone) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const parts = Object.fromEntries(
    dtf
      .formatToParts(new Date(utcMs))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  let hour = Number(parts.hour);
  let year = Number(parts.year);
  let month = Number(parts.month);
  let day = Number(parts.day);
  if (hour === 24) {
    hour = 0;
    const rolled = new Date(Date.UTC(year, month - 1, day + 1));
    year = rolled.getUTCFullYear();
    month = rolled.getUTCMonth() + 1;
    day = rolled.getUTCDate();
  }
  const weekday = WEEKDAYS.indexOf(parts.weekday);
  return {
    year,
    month,
    day,
    hour,
    minute: Number(parts.minute),
    weekday,
    isoDate: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
  };
}

export function wallToUtc(year, month, day, hour, minute, timeZone) {
  if (!isValidTimeZone(timeZone)) return null;
  const utc = zonedTimeToUtc(year, month, day, hour, minute, timeZone);
  const back = zonedParts(utc, timeZone);
  if (
    back.year !== year ||
    back.month !== month ||
    back.day !== day ||
    back.hour !== hour ||
    back.minute !== minute
  ) {
    return null;
  }
  return utc;
}

export function parseHHMM(value) {
  const match = /^(\d{2}):(\d{2})$/.exec(String(value ?? "").trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

export function weekdayMonIndex(weekdaySun0) {
  return (weekdaySun0 + 6) % 7;
}

function daySelected(days, index) {
  return days[index] === "1";
}

export function inWeeklyWindow(parts, person) {
  const start = parseHHMM(person.start);
  const end = parseHHMM(person.end);
  if (start === null || end === null || start === end || person.days?.length !== 7) return false;
  const minutes = parts.hour * 60 + parts.minute;
  const index = weekdayMonIndex(parts.weekday);
  if (start < end) {
    return daySelected(person.days, index) && minutes >= start && minutes < end;
  }
  if (minutes >= start) return daySelected(person.days, index);
  if (minutes < end) return daySelected(person.days, (index + 6) % 7);
  return false;
}

export function minutesOutsideWindow(parts, person) {
  const start = parseHHMM(person.start);
  const end = parseHHMM(person.end);
  if (start === null || end === null || start === end) return 24 * 60;
  const minutes = parts.hour * 60 + parts.minute;
  const index = weekdayMonIndex(parts.weekday);
  const clockDistance = distanceToClockWindow(minutes, start, end);
  if (!daySelected(person.days, index)) {
    if (start > end && minutes < end && daySelected(person.days, (index + 6) % 7)) return 0;
    return 12 * 60 + clockDistance;
  }
  return clockDistance;
}

function distanceToClockWindow(minutes, start, end) {
  if (start < end) {
    if (minutes < start) return start - minutes;
    if (minutes >= end) return minutes - end;
    return 0;
  }
  if (minutes >= start || minutes < end) return 0;
  return Math.min(minutes - end, start - minutes);
}

export function formatClock(hour, minute) {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function formatDay(parts) {
  return `${WEEKDAYS[parts.weekday]} ${parts.day} ${MONTHS[parts.month - 1]}`;
}

export function todayIso(timeZone, now = Date.now()) {
  const parts = zonedParts(now, timeZone);
  return parts.isoDate;
}
