import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { encodeTeam } from "../src/codec.js";

function loadPuppeteer() {
  const local = createRequire(import.meta.url);
  try {
    return local("puppeteer-core");
  } catch {
    const fallback = "/tmp/whencanwe-browser/node_modules/puppeteer-core/package.json";
    if (existsSync(fallback)) return createRequire(fallback)("puppeteer-core");
    console.error("Install puppeteer-core to run scripts/browser-check.mjs. Chrome is also required.");
    process.exit(1);
  }
}

const puppeteer = loadPuppeteer();

const team = {
  date: "2026-09-23",
  stepMin: 60,
  people: [
    { name: "Alex", place: "New York", timeZone: "America/New_York", start: "09:00", end: "17:00", days: "1111100" },
    { name: "Sam", place: "London", timeZone: "Europe/London", start: "09:00", end: "17:00", days: "1111100" },
  ],
};

const built = spawnSync(process.execPath, ["scripts/build-standalone.js"], { encoding: "utf8" });
if (built.status !== 0) {
  console.error(built.stderr);
  process.exit(1);
}

const port = 4173;
const origin = `http://127.0.0.1:${port}`;
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1"], {
  cwd: new URL("..", import.meta.url).pathname,
  stdio: "ignore",
});

function fail(message) {
  console.error(message);
  server.kill();
  process.exit(1);
}

for (let attempt = 0; attempt < 50; attempt += 1) {
  try {
    const response = await fetch(origin);
    if (response.ok) break;
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

const browser = await puppeteer.launch({
  executablePath: "/usr/local/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const page = await browser.newPage();
const requests = [];
const errors = [];
page.on("request", (request) => requests.push(request.url()));
page.on("pageerror", (error) => errors.push(String(error)));
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});

mkdirSync(new URL("../assets/", import.meta.url).pathname, { recursive: true });

try {
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(`${origin}/#${encodeTeam(team)}`, { waitUntil: "networkidle0" });
  await page.waitForSelector("#best");
  const best = await page.$eval("#best", (node) => node.innerText);
  if (!best.includes("Everyone is inside working hours")) fail(`Missing full overlap heading:\n${best}`);
  if (!best.includes("09:00–12:00")) fail(`Missing New York hours:\n${best}`);
  if (!best.includes("14:00–17:00")) fail(`Missing London hours:\n${best}`);
  if (!best.toLowerCase().includes("3h · 2 of 2")) fail(`Missing duration:\n${best}`);

  await page.click(".block");
  const detail = await page.$eval("#detail", (node) => node.innerText);
  if (!detail.includes("Alex") || !detail.includes("free")) fail(`Detail missing:\n${detail}`);

  await page.click("#add-person");
  const places = await page.$$(".place");
  const names = await page.$$(".name");
  await names[names.length - 1].type("Ren");
  await places[places.length - 1].type("Tokyo");
  await places[places.length - 1].evaluate((element) => element.blur());
  await page.waitForFunction(() => document.querySelector("#best").innerText.includes("Outside hours: Ren"));
  const harder = await page.$eval("#best", (node) => node.innerText);
  if (harder.includes("Everyone is inside working hours")) fail("Tokyo was treated as a full overlap");

  const share = await page.$eval("#share-url", (node) => node.value);
  await page.goto(share, { waitUntil: "networkidle0" });
  const namesAfter = await page.$$eval(".name", (nodes) => nodes.map((node) => node.value));
  if (namesAfter.join(",") !== "Alex,Sam,Ren") fail(`Link did not restore people: ${namesAfter}`);

  await page.click("#prev-week");
  const date = await page.$eval("#start-date", (node) => node.value);
  if (date !== "2026-09-16") fail(`Previous week was ${date}`);

  await page.$eval(".place", (element) => {
    element.value = "Nopeville";
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
  const zoneError = await page.$eval(".zone-error", (node) => node.textContent);
  if (!zoneError.includes("Unknown city")) fail(`Zone error missing: ${zoneError}`);

  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(`${origin}/#${encodeTeam(team)}`, { waitUntil: "networkidle0" });
  await page.screenshot({ path: new URL("../assets/desktop.png", import.meta.url).pathname, fullPage: true });

  await page.setViewport({ width: 390, height: 844 });
  await page.screenshot({ path: new URL("../assets/mobile.png", import.meta.url).pathname, fullPage: true });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 1) fail(`Mobile page overflows by ${overflow}px`);

  const standalone = await browser.newPage();
  const standaloneErrors = [];
  standalone.on("pageerror", (error) => standaloneErrors.push(String(error)));
  const fileUrl = `file://${new URL("../dist/whencanwe.html", import.meta.url).pathname}#${encodeTeam(team)}`;
  await standalone.goto(fileUrl, { waitUntil: "load" });
  await standalone.waitForSelector("#best");
  const offline = await standalone.$eval("#best", (node) => node.innerText);
  if (!offline.includes("09:00–12:00")) fail(`Standalone file did not render:\n${offline}`);
  if (standaloneErrors.length) fail(`Standalone errors:\n${standaloneErrors.join("\n")}`);
  await standalone.close();

  await page.click("#clear");
  const empty = await page.$eval("#best", (node) => node.innerText);
  if (!empty.includes("Add two people")) fail(`Empty state missing:\n${empty}`);

  const foreign = requests.filter((url) => !url.startsWith(origin) && !url.startsWith("data:"));
  if (foreign.length) fail(`Unexpected network requests: ${foreign.join(", ")}`);
  if (errors.length) fail(`Browser errors:\n${errors.join("\n")}`);
  console.log("Browser check passed");
} finally {
  await browser.close();
  server.kill();
}
