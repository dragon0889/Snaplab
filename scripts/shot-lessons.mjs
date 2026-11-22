#!/usr/bin/env node
/**
 * Screenshots lesson pages with headless Edge/Chrome (no extra dependency).
 *
 * Usage: node scripts/shot-lessons.mjs [--tag before|after] [--step intro|lego3d|wiring|blockly|sim] [--url http://localhost:3000] [lesson-11 ...]
 * Output: shots/<id>-<tag>[-<step>]-<width>.png at 1280x800 and 1024x768.
 * Steps are opened through the ?step= query (no clicking), so no Playwright is needed.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const args = process.argv.slice(2);
let tag = "shot";
let base = "http://localhost:3000";
let step = "";
const ids = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--tag") tag = args[++i];
  else if (args[i] === "--url") base = args[++i];
  else if (args[i] === "--step") step = args[++i];
  else ids.push(args[i]);
}
if (ids.length === 0) ids.push("lesson-11");

const SIZES = [
  [1280, 800],
  [1024, 768],
];
const CANDIDATES = [
  process.env.BROWSER_PATH,
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter(Boolean);
const browser = CANDIDATES.find((p) => existsSync(p));
if (!browser) {
  console.error("No Edge/Chrome found. Set BROWSER_PATH to a Chromium-based browser.");
  process.exit(1);
}

const outDir = resolve("shots");
mkdirSync(outDir, { recursive: true });

for (const id of ids) {
  for (const [w, h] of SIZES) {
    const file = join(outDir, `${id}-${tag}${step ? `-${step}` : ""}-${w}.png`);
    rmSync(file, { force: true });
    // A fresh profile every time: otherwise the browser hands the request to an already running window.
    const profile = mkdtempSync(join(tmpdir(), "snaplab-shot-"));
    spawnSync(
      browser,
      [
        "--headless=new",
        "--disable-gpu",
        "--hide-scrollbars",
        `--user-data-dir=${profile}`,
        `--window-size=${w},${h}`,
        "--virtual-time-budget=12000",
        `--screenshot=${file}`,
        `${base}/lessons/${id}${step ? `?step=${step}` : ""}`,
      ],
      { stdio: "ignore", timeout: 90_000 },
    );
    // The browser can exit before the PNG is flushed, so wait for it.
    for (let i = 0; i < 60 && !existsSync(file); i++) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
    rmSync(profile, { recursive: true, force: true, maxRetries: 5 });
    console.log(`${existsSync(file) ? "ok  " : "FAIL"} ${file}`);
  }
}
