#!/usr/bin/env node
/**
 * Packs an LDraw model (.ldr / .mpd, e.g. exported from BrickLink Studio or LeoCAD) and every part it uses into
 * ONE self-contained .mpd that three.js LDrawLoader can load without the parts library, plus a steps.json that
 * the lesson UI reads (step count, Vietnamese step text, part list per step, anchor positions).
 *
 * Usage:
 *   node scripts/ldraw/pack-ldraw.mjs <model.mpd|ldr> <outDir> [--lib vendor/ldraw] [--name lesson-05]
 *
 * Writes <outDir>/<name>.mpd and <outDir>/<name>.steps.json.
 *
 * Conventions (see docs/ldraw-pipeline.md):
 *   0 STEP / 0 ROTSTEP ...            ends a building step (standard LDraw)
 *   0 !SNAPLAB STEP "Gắn servo..."    Vietnamese text for the step it sits in
 *   1 ... ANCHOR_<name>.ldr           an (empty) submodel marking where an electronic part is attached
 *
 * The parts library is CC BY 2.0 / 4.0: the packed file is a redistribution, so the app must credit
 * "LDraw Parts Library" (see docs/ldraw-pipeline.md, Attribution).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------------------------
/** LDraw file names are case-insensitive and may use backslashes. */
export const normalizeName = (name) => name.trim().replace(/\\/g, "/").toLowerCase();

/** Splits an MPD text into its embedded files. A plain .ldr becomes one file named after the input. */
export function splitMpd(text, fallbackName) {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const files = new Map();
  let current = null;
  let order = [];
  for (const line of lines) {
    const m = /^\s*0\s+FILE\s+(.+?)\s*$/i.exec(line);
    if (m) {
      current = normalizeName(m[1]);
      files.set(current, []);
      order.push(current);
      continue;
    }
    if (/^\s*0\s+NOFILE\s*$/i.test(line)) {
      current = null;
      continue;
    }
    if (current === null) {
      if (order.length === 0) {
        current = normalizeName(fallbackName);
        files.set(current, []);
        order.push(current);
      } else continue;
    }
    files.get(current).push(line);
  }
  return { files, main: order[0] };
}

/** Type-1 line → referenced file name (everything after the 14th token, spaces allowed). */
export function referenceOf(line) {
  const t = line.trim().split(/\s+/);
  if (t[0] !== "1" || t.length < 15) return null;
  return normalizeName(t.slice(14).join(" "));
}

/** Rewrites a type-1 line so its reference uses the normalized name (the name the packed FILE uses). */
function rewriteReference(line) {
  const t = line.trim().split(/\s+/);
  if (t[0] !== "1" || t.length < 15) return line;
  return [...t.slice(0, 14), normalizeName(t.slice(14).join(" "))].join(" ");
}

/** Finds a library file the way LDraw tools do: models, parts, p (incl. s/, 48/, 8/ prefixes), unofficial too. */
function findInLibrary(libDir, name) {
  const roots = ["", "unofficial/"];
  const dirs = ["parts/", "p/", "models/"];
  for (const root of roots) {
    for (const dir of dirs) {
      const candidate = join(libDir, root + dir + name);
      if (existsSync(candidate)) return candidate;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------------------------------------------
// Pack
// ---------------------------------------------------------------------------------------------------------------
export function pack(modelText, modelName, libDir) {
  const { files: own, main } = splitMpd(modelText, modelName);
  const packed = new Map(); // name -> lines (insertion order = output order after main)
  const missing = new Set();

  const visit = (name, lines) => {
    if (packed.has(name)) return;
    packed.set(name, lines.map(rewriteReference));
    for (const line of lines) {
      const ref = referenceOf(line);
      if (!ref || packed.has(ref)) continue;
      if (own.has(ref)) {
        visit(ref, own.get(ref));
        continue;
      }
      const path = findInLibrary(libDir, ref);
      if (!path) {
        missing.add(ref);
        continue;
      }
      visit(ref, readFileSync(path, "utf8").replace(/\r\n?/g, "\n").split("\n"));
    }
  };
  visit(main, own.get(main));
  // Submodels that are never referenced (Studio sometimes keeps them) are still kept, so anchors survive.
  for (const [name, lines] of own) if (!packed.has(name)) visit(name, lines);

  return { packed, main, missing };
}

/** Colour definitions (!COLOUR) from LDConfig.ldr, so the packed file needs nothing else. */
function readColours(libDir) {
  const path = join(libDir, "LDConfig.ldr");
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .filter((l) => /^\s*0\s+!COLOUR\s/i.test(l));
}

// ---------------------------------------------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------------------------------------------
/**
 * Reads building steps of the MAIN model: each step lists the parts placed in it, its Vietnamese text and the
 * anchors placed in it (position in LDU, LDraw axes: -Y is up; 3x3 rotation matrix row by row).
 */
export function readSteps(mainLines) {
  const steps = [];
  let cur = { textVi: null, parts: {}, anchors: [] };
  const close = () => {
    const placed = Object.keys(cur.parts).length + cur.anchors.length;
    if (placed > 0 || cur.textVi) steps.push(cur);
    cur = { textVi: null, parts: {}, anchors: [] };
  };
  for (const raw of mainLines) {
    const line = raw.trim();
    if (/^0\s+(STEP|ROTSTEP)\b/i.test(line)) {
      close();
      continue;
    }
    const text = /^0\s+!SNAPLAB\s+STEP\s+"(.*)"\s*$/i.exec(line);
    if (text) {
      cur.textVi = text[1];
      continue;
    }
    const ref = referenceOf(line);
    if (!ref) continue;
    const t = line.split(/\s+/).map(Number);
    if (/^anchor_/i.test(basename(ref))) {
      cur.anchors.push({
        name: basename(ref).replace(/\.(ldr|dat|mpd)$/i, "").replace(/^anchor_/i, ""),
        positionLdu: [t[2], t[3], t[4]],
        rotation: t.slice(5, 14),
      });
      continue;
    }
    const part = basename(ref).replace(/\.(dat|ldr)$/i, "");
    cur.parts[part] = (cur.parts[part] ?? 0) + 1;
  }
  close();
  return steps.map((s, i) => ({
    step: i + 1,
    textVi: s.textVi,
    parts: Object.entries(s.parts).map(([part, qty]) => ({ part, qty })),
    anchors: s.anchors,
  }));
}

// ---------------------------------------------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------------------------------------------
const isCli = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isCli) {
  const args = process.argv.slice(2);
  const flag = (name, fallback) => {
    const i = args.indexOf(name);
    if (i === -1) return fallback;
    const v = args[i + 1];
    args.splice(i, 2);
    return v;
  };
  const libDir = resolve(flag("--lib", "vendor/ldraw"));
  const nameArg = flag("--name", null);
  const [input, outDir] = args;
  if (!input || !outDir) {
    console.error("Usage: node scripts/ldraw/pack-ldraw.mjs <model.mpd|ldr> <outDir> [--lib vendor/ldraw] [--name id]");
    process.exit(1);
  }
  const outName = nameArg ?? basename(input).replace(/\.(mpd|ldr)$/i, "");
  if (!existsSync(libDir)) {
    console.error(`LDraw library not found at ${libDir}. Download complete.zip from ldraw.org and unzip it there.`);
    process.exit(1);
  }
  const text = readFileSync(input, "utf8");
  const { packed, main, missing } = pack(text, basename(input), libDir);
  if (missing.size > 0) {
    console.error(`Missing ${missing.size} file(s) in the library: ${[...missing].slice(0, 20).join(", ")}`);
    console.error("Update vendor/ldraw (official + unofficial) or embed the custom parts in the model file.");
    process.exit(2);
  }

  const out = [];
  const [first, ...rest] = [...packed.keys()];
  out.push(`0 FILE ${first}`);
  out.push("0 // Packed by scripts/ldraw/pack-ldraw.mjs — uses the LDraw Parts Library (CC BY 2.0 / 4.0)");
  out.push(...readColours(libDir));
  out.push(...packed.get(first));
  for (const name of rest) out.push("", `0 FILE ${name}`, ...packed.get(name));

  const steps = readSteps(packed.get(main));
  mkdirSync(outDir, { recursive: true });
  const mpdPath = join(outDir, `${outName}.mpd`);
  const stepsPath = join(outDir, `${outName}.steps.json`);
  writeFileSync(mpdPath, out.join("\n") + "\n");
  writeFileSync(stepsPath, JSON.stringify({ model: `${outName}.mpd`, stepCount: steps.length, steps }, null, 2) + "\n");
  const kb = (p) => Math.round(readFileSync(p).length / 1024);
  console.log(`${mpdPath}: ${packed.size} files, ${kb(mpdPath)} KB · ${steps.length} steps → ${stepsPath}`);
  const noText = steps.filter((s) => !s.textVi).map((s) => s.step);
  if (noText.length) console.warn(`Steps without "0 !SNAPLAB STEP" text: ${noText.join(", ")}`);
}
