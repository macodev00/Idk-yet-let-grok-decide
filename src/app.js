import { CITIES, resolvePlace } from "./cities.js";
import { decodeTeam, encodeTeam, normalizeTeam } from "./codec.js";
import { formatSpan, summaryText } from "./format.js";
import { analyze, scoreSlot } from "./overlap.js";
import { addIsoDays, formatClock, formatDay, todayIso, zonedParts } from "./time.js";

const STORAGE_KEY = "whencanwe.v1";
const DAY_LABELS = [
  ["M", "Monday"],
  ["T", "Tuesday"],
  ["W", "Wednesday"],
  ["T", "Thursday"],
  ["F", "Friday"],
  ["S", "Saturday"],
  ["S", "Sunday"],
];

let team = null;
let sampleMode = false;
let selection = null;
let lastResult = null;
let lastReady = [];

function viewerZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function blankPerson(partial = {}) {
  return {
    name: "",
    place: "",
    start: "09:00",
    end: "17:00",
    days: "1111100",
    ...partial,
  };
}

function sampleTeam() {
  return {
    date: todayIso(viewerZone()),
    stepMin: 60,
    people: [
      blankPerson({ name: "Alex", place: "New York" }),
      blankPerson({ name: "Sam", place: "London" }),
    ],
  };
}

function boot() {
  fillCities();
  const loaded = readHash();
  if (loaded?.team) {
    team = loaded.team;
    sampleMode = false;
    setStatus("");
  } else if (loaded?.error) {
    team = sampleTeam();
    sampleMode = true;
    setStatus("That link could not be read. Showing the sample team instead.");
  } else {
    const stored = readStorage();
    if (stored) {
      team = stored;
      sampleMode = false;
    } else {
      team = sampleTeam();
      sampleMode = true;
    }
  }
  bindShell();
  applyTeam();
}

function fillCities() {
  const list = document.querySelector("#cities");
  for (const [city, country, zone] of CITIES) {
    const option = document.createElement("option");
    option.value = city;
    option.label = `${country} · ${zone}`;
    list.append(option);
  }
}

function bindShell() {
  document.querySelector("#week-form").addEventListener("submit", (event) => event.preventDefault());
  document.querySelector("#start-date").addEventListener("change", commit);
  document.querySelector("#step").addEventListener("change", commit);
  document.querySelector("#prev-week").addEventListener("click", () => shiftWeek(-7));
  document.querySelector("#next-week").addEventListener("click", () => shiftWeek(7));
  document.querySelector("#add-person").addEventListener("click", () => addPerson());
  document.querySelector("#add-me").addEventListener("click", () => addMe());
  document.querySelector("#use-sample").addEventListener("click", () => {
    team = sampleTeam();
    sampleMode = true;
    selection = null;
    localStorage.removeItem(STORAGE_KEY);
    clearHash();
    applyTeam();
  });
  document.querySelector("#clear").addEventListener("click", () => {
    team = { date: todayIso(viewerZone()), stepMin: 60, people: [] };
    sampleMode = false;
    selection = null;
    localStorage.removeItem(STORAGE_KEY);
    clearHash();
    applyTeam();
    persist();
  });
  document.querySelector("#copy-link").addEventListener("click", copyLink);
  document.querySelector("#copy-summary").addEventListener("click", copySummary);
  document.querySelector("#people").addEventListener("input", commit);
  document.querySelector("#people").addEventListener("click", onPeopleClick);
  document.querySelector("#people").addEventListener("focusout", onPlaceBlur);
  window.addEventListener("hashchange", () => {
    const loaded = readHash();
    if (!loaded?.team) return;
    team = loaded.team;
    sampleMode = false;
    selection = null;
    applyTeam();
  });
}

function onPeopleClick(event) {
  const day = event.target.closest("[data-day]");
  if (day) {
    const pressed = day.getAttribute("aria-pressed") === "true";
    day.setAttribute("aria-pressed", pressed ? "false" : "true");
    day.classList.toggle("on", !pressed);
    commit();
    return;
  }
  const remove = event.target.closest("[data-remove]");
  if (!remove) return;
  const card = remove.closest(".person");
  const index = [...document.querySelectorAll(".person")].indexOf(card);
  syncFromDom();
  team.people.splice(index, 1);
  selection = null;
  sampleMode = false;
  applyTeam();
  persist();
}

function onPlaceBlur(event) {
  if (!event.target.classList.contains("place")) return;
  const resolved = resolvePlace(event.target.value);
  if (!resolved || event.target.value === resolved.place) return;
  event.target.value = resolved.place;
  commit();
}

function addPerson(partial) {
  if (team.people.length >= 12) {
    setStatus("A shared plan holds up to 12 people.");
    return;
  }
  syncFromDom();
  team.people.push(blankPerson(partial));
  sampleMode = false;
  applyTeam();
  persist();
  const places = document.querySelectorAll(".place");
  places[places.length - 1]?.focus();
}

function addMe() {
  const zone = viewerZone();
  const resolved = resolvePlace(zone);
  addPerson({ name: "Me", place: resolved?.place || zone });
}

function shiftWeek(days) {
  syncFromDom();
  team.date = addIsoDays(team.date, days);
  sampleMode = false;
  selection = null;
  applyTeam();
  persist();
}

function commit() {
  syncFromDom();
  sampleMode = false;
  persist();
  refreshOutputs();
  renderBanner();
}

function syncFromDom() {
  const date = document.querySelector("#start-date").value;
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) team.date = date;
  team.stepMin = document.querySelector("#step").value === "30" ? 30 : 60;
  team.people = [...document.querySelectorAll(".person")].map(readCard);
}

function readCard(card) {
  const days = [...card.querySelectorAll("[data-day]")]
    .map((button) => (button.getAttribute("aria-pressed") === "true" ? "1" : "0"))
    .join("");
  return {
    name: card.querySelector(".name").value,
    place: card.querySelector(".place").value,
    start: card.querySelector(".start").value || "09:00",
    end: card.querySelector(".end").value || "17:00",
    days,
  };
}

function applyTeam() {
  document.querySelector("#start-date").value = team.date;
  document.querySelector("#step").value = String(team.stepMin);
  renderPeople();
  refreshOutputs();
  renderBanner();
  document.querySelector("#add-person").disabled = team.people.length >= 12;
  document.querySelector("#add-me").disabled = team.people.length >= 12;
}

function renderPeople() {
  const root = document.querySelector("#people");
  root.replaceChildren();
  team.people.forEach((person, index) => {
    root.append(personCard(person, index));
  });
}

function personCard(person, index) {
  const card = document.createElement("fieldset");
  card.className = "person";
  const legend = document.createElement("legend");
  legend.textContent = person.name.trim() || `Person ${index + 1}`;
  card.append(legend);

  const nameLabel = field("Name", "text", "name", person.name, "Alex");
  const placeLabel = field("City or time zone", "text", "place", person.place, "Tokyo");
  placeLabel.querySelector("input").setAttribute("list", "cities");
  placeLabel.querySelector("input").setAttribute("spellcheck", "false");
  const error = document.createElement("p");
  error.className = "zone-error";
  const resolved = resolvePlace(person.place);
  if (person.place.trim() && !resolved) error.textContent = "Unknown city or time zone.";
  placeLabel.append(error);

  const hours = document.createElement("div");
  hours.className = "hours";
  hours.append(field("From", "time", "start", person.start));
  hours.append(field("To", "time", "end", person.end));

  const days = document.createElement("div");
  days.className = "days";
  days.setAttribute("role", "group");
  days.setAttribute("aria-label", "Working days");
  DAY_LABELS.forEach(([short, long], dayIndex) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "day";
    button.dataset.day = String(dayIndex);
    button.textContent = short;
    button.setAttribute("aria-label", long);
    const on = person.days[dayIndex] === "1";
    button.setAttribute("aria-pressed", on ? "true" : "false");
    button.classList.toggle("on", on);
    days.append(button);
  });

  const remove = document.createElement("button");
  remove.type = "button";
  remove.dataset.remove = "true";
  remove.className = "text-button";
  remove.textContent = "Remove";

  card.append(nameLabel, placeLabel, hours, days, remove);
  const nameInput = card.querySelector(".name");
  nameInput.addEventListener("input", () => {
    legend.textContent = nameInput.value.trim() || `Person ${index + 1}`;
  });
  return card;
}

function field(labelText, type, className, value, placeholder) {
  const label = document.createElement("label");
  label.append(document.createTextNode(labelText));
  const input = document.createElement("input");
  input.type = type;
  input.className = className;
  input.value = value ?? "";
  if (placeholder) input.placeholder = placeholder;
  if (type === "text") input.autocomplete = "off";
  label.append(input);
  return label;
}

function refreshZoneErrors() {
  for (const card of document.querySelectorAll(".person")) {
    const place = card.querySelector(".place").value;
    const error = card.querySelector(".zone-error");
    const resolved = resolvePlace(place);
    error.textContent = place.trim() && !resolved ? "Unknown city or time zone." : "";
  }
}

function readyPeople() {
  return team.people
    .map((person) => {
      const resolved = resolvePlace(person.place);
      if (!resolved) return null;
      return {
        name: person.name.trim() || "Unnamed",
        place: resolved.place,
        timeZone: resolved.timeZone,
        start: person.start,
        end: person.end,
        days: person.days,
      };
    })
    .filter(Boolean);
}

function refreshOutputs() {
  refreshZoneErrors();
  lastReady = readyPeople();
  const zone = viewerZone();
  try {
    lastResult = analyze(team.date, zone, lastReady, { stepMin: team.stepMin, days: 7 });
  } catch {
    lastResult = { slots: [], full: [], compromises: [], stepMin: team.stepMin };
  }
  if (selection && !lastResult.slots.some((slot) => slot.utc >= selection.startUtc && slot.utc < selection.endUtc)) {
    selection = null;
  }
  if (!selection) {
    const first = lastResult.full[0] || lastResult.compromises[0];
    if (first) selection = { startUtc: first.startUtc, endUtc: first.endUtc };
  }
  renderBest();
  renderGrid();
  const share = document.querySelector("#share-url");
  share.value = currentShareHref();
}

function renderBanner() {
  const banner = document.querySelector("#banner");
  if (!sampleMode) {
    banner.hidden = true;
    banner.textContent = "";
    return;
  }
  banner.hidden = false;
  banner.textContent =
    "Sample team: Alex works 09:00–17:00 in New York, and Sam works 09:00–17:00 in London, on weekdays. Change any field to keep your own plan on this computer.";
}

function renderBest() {
  const root = document.querySelector("#best");
  root.replaceChildren();
  const heading = document.createElement("h2");
  heading.textContent = "Best times";
  root.append(heading);
  const note = document.createElement("p");
  note.className = "note";
  if (lastReady.length < 2) {
    note.textContent =
      lastReady.length === 0
        ? "Add two people, with a city and working hours, to see an overlap."
        : "Add another person to compare working hours.";
    root.append(note);
    return;
  }
  const blocks = lastResult.full.length ? lastResult.full : lastResult.compromises;
  note.textContent = lastResult.full.length
    ? "Everyone is inside working hours for the whole block."
    : "Nobody’s hours cover the same block. These are the closest overlaps.";
  root.append(note);
  if (blocks.length === 0) {
    const empty = document.createElement("p");
    empty.textContent = "No working-hour overlap in this week. Try another week or wider hours.";
    root.append(empty);
    return;
  }
  const list = document.createElement("div");
  list.className = "blocks";
  for (const block of blocks) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "block";
    if (
      selection &&
      selection.startUtc >= block.startUtc &&
      selection.endUtc <= block.endUtc
    ) {
      button.classList.add("selected");
    }
    const title = document.createElement("span");
    title.className = "block-title";
    title.textContent = `${block.durationMin / 60}h · ${block.count} of ${block.total}`;
    button.append(title);
    for (const person of lastReady) {
      const line = document.createElement("span");
      line.className = "block-line";
      line.textContent = `${person.name} · ${person.place} · ${formatSpan(block.startUtc, block.endUtc, person.timeZone)}`;
      button.append(line);
    }
    if (block.missing.length) {
      const miss = document.createElement("span");
      miss.className = "block-miss";
      miss.textContent = `Outside hours: ${block.missing.join(", ")}`;
      button.append(miss);
    }
    button.addEventListener("click", () => {
      selection = { startUtc: block.startUtc, endUtc: block.endUtc };
      renderBest();
      renderGrid();
      document.querySelector(".cell.selected")?.scrollIntoView({ inline: "center", block: "nearest" });
    });
    list.append(button);
  }
  root.append(list);
}

function renderGrid() {
  const root = document.querySelector("#grid-wrap");
  const previous = root.querySelector(".scroller")?.scrollLeft ?? 0;
  root.replaceChildren();
  const heading = document.createElement("h2");
  const zone = viewerZone();
  const place = resolvePlace(zone);
  heading.textContent = `Week grid · ${place?.place || zone}`;
  root.append(heading);
  const hint = document.createElement("p");
  hint.className = "note";
  hint.textContent = `Each cell is ${lastResult.stepMin} minutes in your time zone. The number is how many people are free for that whole step.`;
  root.append(hint);
  if (!lastResult.slots.length) return;

  const scroller = document.createElement("div");
  scroller.className = "scroller";
  const table = document.createElement("table");
  const caption = document.createElement("caption");
  caption.textContent = "Working-hour overlap for seven days. Cells show how many people are free.";
  table.append(caption);
  const columns = [];
  for (let minutes = 0; minutes < 24 * 60; minutes += lastResult.stepMin) columns.push(minutes);

  const head = document.createElement("thead");
  const headRow = document.createElement("tr");
  const corner = document.createElement("th");
  corner.scope = "col";
  corner.textContent = "Day";
  headRow.append(corner);
  for (const minutes of columns) {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = formatClock(Math.floor(minutes / 60), minutes % 60).slice(0, 2);
    if (minutes % 60 !== 0) th.textContent = "";
    headRow.append(th);
  }
  head.append(headRow);
  table.append(head);

  const body = document.createElement("tbody");
  const grouped = new Map();
  for (const slot of lastResult.slots) {
    if (!grouped.has(slot.parts.isoDate)) grouped.set(slot.parts.isoDate, new Map());
    grouped.get(slot.parts.isoDate).set(slot.parts.hour * 60 + slot.parts.minute, slot);
  }
  for (const [iso, slots] of grouped) {
    const row = document.createElement("tr");
    const example = slots.values().next().value;
    const th = document.createElement("th");
    th.scope = "row";
    th.textContent = formatDay(example.parts);
    row.append(th);
    for (const minutes of columns) {
      const td = document.createElement("td");
      const slot = slots.get(minutes);
      if (!slot) {
        td.className = "gap";
        row.append(td);
        continue;
      }
      const button = document.createElement("button");
      button.type = "button";
      button.className = "cell";
      button.dataset.level = levelFor(slot.count, slot.total);
      button.textContent = String(slot.count);
      const selected = selection && slot.utc >= selection.startUtc && slot.utc < selection.endUtc;
      button.classList.toggle("selected", selected);
      button.setAttribute(
        "aria-label",
        `${formatDay(slot.parts)} ${formatClock(slot.parts.hour, slot.parts.minute)}, ${slot.count} of ${slot.total} people free`,
      );
      button.addEventListener("click", () => {
        selection = { startUtc: slot.utc, endUtc: slot.utc + lastResult.stepMin * 60 * 1000 };
        renderBest();
        renderGrid();
        renderDetail(slot.utc);
      });
      td.append(button);
      row.append(td);
    }
    body.append(row);
  }
  table.append(body);
  scroller.append(table);
  root.append(scroller);
  if (previous > 0) scroller.scrollLeft = previous;
  else {
    const morning = [...scroller.querySelectorAll(".cell")].find((cell) =>
      cell.getAttribute("aria-label").includes(" 08:00,"),
    );
    if (morning) scroller.scrollLeft = Math.max(0, morning.offsetLeft - 100);
  }
  if (selection) renderDetail(selection.startUtc);
}

function renderDetail(utc) {
  let detail = document.querySelector("#detail");
  if (!detail) {
    detail = document.createElement("div");
    detail.id = "detail";
    document.querySelector("#grid-wrap").append(detail);
  }
  detail.replaceChildren();
  const score = scoreSlot(utc, lastReady, lastResult.stepMin || 60);
  const title = document.createElement("h3");
  const viewer = zonedParts(utc, viewerZone());
  title.textContent = `${formatDay(viewer)}, ${formatClock(viewer.hour, viewer.minute)} your time`;
  detail.append(title);
  const list = document.createElement("ul");
  for (const person of lastReady) {
    const item = document.createElement("li");
    const local = zonedParts(utc, person.timeZone);
    const row = score.available.includes(person.name) ? "free" : "outside working hours";
    item.textContent = `${person.name} · ${person.place} · ${formatClock(local.hour, local.minute)} · ${row}`;
    list.append(item);
  }
  detail.append(list);
}

function levelFor(count, total) {
  if (!total || !count) return "0";
  if (count === total) return "4";
  if (count / total >= 0.67) return "3";
  if (count / total >= 0.34) return "2";
  return "1";
}

function encodableTeam() {
  return {
    date: team.date,
    stepMin: team.stepMin,
    people: team.people.map((person) => {
      const resolved = resolvePlace(person.place);
      return {
        name: person.name,
        place: person.place,
        timeZone: resolved?.timeZone || "",
        start: person.start || "09:00",
        end: person.end || "17:00",
        days: person.days,
      };
    }),
  };
}

function currentShareHref() {
  const url = new URL(location.href);
  url.hash = encodeTeam(encodableTeam());
  return url.href;
}

function persist() {
  const payload = encodableTeam();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    setStatus("This browser blocked local saving. The link still works.");
  }
  const url = new URL(location.href);
  url.hash = encodeTeam(payload);
  history.replaceState(null, "", url);
  document.querySelector("#share-url").value = url.href;
}

function clearHash() {
  const url = new URL(location.href);
  url.hash = "";
  history.replaceState(null, "", url);
  document.querySelector("#share-url").value = "";
}

function readHash() {
  const raw = location.hash.replace(/^#/, "");
  if (!raw) return null;
  try {
    return { team: decodeTeam(raw) };
  } catch {
    return { error: true };
  }
}

function readStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return normalizeTeam(JSON.parse(raw));
  } catch {
    return null;
  }
}

async function copyLink() {
  sampleMode = false;
  persist();
  renderBanner();
  const field = document.querySelector("#share-url");
  const ok = await writeClipboard(field.value);
  if (!ok) {
    field.focus();
    field.select();
  }
  setStatus(ok ? "Link copied." : "Link selected. Copy it from the field.");
}

async function copySummary() {
  if (!lastResult) return;
  const text = summaryText(lastResult, lastReady);
  const ok = await writeClipboard(text);
  setStatus(ok ? "Summary copied." : "Copy failed. The times are listed above.");
}

async function writeClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function setStatus(message) {
  document.querySelector("#status").textContent = message;
}

if (typeof document !== "undefined") boot();
