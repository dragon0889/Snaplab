#!/usr/bin/env node
/**
 * Packs every LDraw model in assets-src/ldraw into public/models, by running pack-ldraw.mjs for each file
 * (<name>.mpd + <name>.steps.json). Also copies the library's CAreadme.txt to public/licenses/ for the credits page.
 *
 * Usage (npm run models:pack):
 *   node scripts/ldraw/pack-all.mjs [--src assets-src/ldraw] [--out public/models] [--lib vendor/ldraw]
 *                                   [--licenses public/licenses]
 *
 * No models in --src is fine (exit 0): most lessons have none yet. Models but no library, a duplicate name, or a
 * failed pack is an error (exit 1). Nothing is downloaded.
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const MODEL_FILE = /\.(mpd|ldr)$/i;
/** The name a model is packed under: its file name without the extension (the lesson id, e.g. "lesson-05"). */
export const modelName = (file) => basename(file).replace(MODEL_FILE, "");

/** Model files directly inside `srcDir`, sorted. A missing folder simply has none. */
export function findModels(srcDir) {
  if (!existsSync(srcDir)) return [];
  return readdirSync(srcDir)
    .filter((f) => MODEL_FILE.test(f))
    .sort()
    .map((f) => join(srcDir, f));
}

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
  const src = resolve(flag("--src", "assets-src/ldraw"));
  const out = resolve(flag("--out", "public/models"));
  const lib = resolve(flag("--lib", "vendor/ldraw"));
  const licenses = resolve(flag("--licenses", "public/licenses"));

  const models = findModels(src);
  if (models.length === 0) {
    console.log(`No LDraw models in ${src}; nothing to pack.`);
    process.exit(0);
  }
  if (!existsSync(lib)) {
    console.error(`LDraw library not found at ${lib}. Download complete.zip from ldraw.org and unzip it there.`);
    process.exit(1);
  }
  const names = models.map(modelName);
  const duplicate = names.find((n, i) => names.indexOf(n) !== i);
  if (duplicate) {
    console.error(`Two model files would be packed as "${duplicate}" (.mpd and .ldr). Keep one.`);
    process.exit(1);
  }

  const failed = [];
  for (const file of models) {
    const result = spawnSync(process.execPath, [join(here, "pack-ldraw.mjs"), file, out, "--lib", lib, "--name", modelName(file)], {
      stdio: "inherit",
    });
    if (result.status !== 0) failed.push(basename(file));
  }

  // The credits page links to the library's own licence text.
  const readme = join(lib, "CAreadme.txt");
  if (existsSync(readme)) {
    mkdirSync(licenses, { recursive: true });
    copyFileSync(readme, join(licenses, "ldraw-CAreadme.txt"));
  } else {
    console.warn(`No CAreadme.txt in ${lib}; public/licenses/ldraw-CAreadme.txt was not updated.`);
  }

  if (failed.length > 0) {
    console.error(`\nFailed to pack: ${failed.join(", ")}`);
    process.exit(1);
  }
  console.log(`\nPacked ${models.length} model(s) into ${out}`);
}
