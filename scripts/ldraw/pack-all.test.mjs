import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { findModels, modelName } from "./pack-all.mjs";

const script = join(dirname(fileURLToPath(import.meta.url)), "pack-all.mjs");

const MODEL = [
  "0 FILE Barrier.ldr",
  '0 !SNAPLAB STEP "Dựng khung đế"',
  "1 4 0 0 0 1 0 0 0 1 0 0 0 1 3001.DAT",
  "0 STEP",
  '0 !SNAPLAB STEP "Gắn servo"',
  "1 16 10 -48 20 1 0 0 0 1 0 0 0 1 ANCHOR_servo1.ldr",
  "0 STEP",
  "0 NOFILE",
  "0 FILE ANCHOR_servo1.ldr",
  "0 anchor",
].join("\n");

/** A temp workspace: assets-src/ldraw, vendor/ldraw (tiny fake library), and output folders. */
function workspace({ library = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), "pack-all-"));
  const src = join(root, "assets-src", "ldraw");
  const lib = join(root, "vendor", "ldraw");
  mkdirSync(src, { recursive: true });
  if (library) {
    mkdirSync(join(lib, "parts"), { recursive: true });
    writeFileSync(join(lib, "parts", "3001.dat"), "0 brick\n");
    writeFileSync(join(lib, "LDConfig.ldr"), "0 !COLOUR Black CODE 0 VALUE #05131D EDGE #595959\n");
    writeFileSync(join(lib, "CAreadme.txt"), "CA licence text\n");
  }
  return { root, src, lib, out: join(root, "public", "models"), licenses: join(root, "public", "licenses") };
}

const run = (w, extra = []) =>
  spawnSync(process.execPath, [script, "--src", w.src, "--out", w.out, "--lib", w.lib, "--licenses", w.licenses, ...extra], {
    encoding: "utf8",
  });

describe("findModels", () => {
  it("lists .mpd and .ldr files, sorted, and ignores everything else", () => {
    const w = workspace({ library: false });
    for (const f of ["b.mpd", "a.ldr", "notes.txt", "c.MPD", "x.dat"]) writeFileSync(join(w.src, f), "");
    expect(findModels(w.src).map((p) => p.split(/[\\/]/).pop())).toEqual(["a.ldr", "b.mpd", "c.MPD"]);
  });

  it("returns nothing for a folder that does not exist", () => {
    expect(findModels(join(tmpdir(), "definitely-not-here-ldraw"))).toEqual([]);
  });

  it("names a model after its file, without the extension", () => {
    expect(modelName("assets-src/ldraw/lesson-05.mpd")).toBe("lesson-05");
    expect(modelName("lesson-07.LDR")).toBe("lesson-07");
  });
});

describe("pack-all", () => {
  it("does nothing, successfully, when there are no models (even without a library)", () => {
    const w = workspace({ library: false });
    const result = run(w);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("nothing to pack");
    expect(existsSync(w.out)).toBe(false);
  });

  it("packs every model into <name>.mpd + <name>.steps.json and copies the licence text", () => {
    const w = workspace();
    writeFileSync(join(w.src, "lesson-05.mpd"), MODEL);
    writeFileSync(join(w.src, "lesson-07.mpd"), MODEL);
    const result = run(w);
    expect(result.status, result.stderr).toBe(0);
    for (const name of ["lesson-05", "lesson-07"]) {
      expect(existsSync(join(w.out, `${name}.mpd`))).toBe(true);
      const steps = JSON.parse(readFileSync(join(w.out, `${name}.steps.json`), "utf8"));
      expect(steps.model).toBe(`${name}.mpd`);
      expect(steps.stepCount).toBe(2);
      expect(steps.steps[1].anchors[0].name).toBe("servo1");
    }
    expect(readFileSync(join(w.licenses, "ldraw-CAreadme.txt"), "utf8")).toBe("CA licence text\n");
  });

  it("fails when there are models but no library", () => {
    const w = workspace({ library: false });
    writeFileSync(join(w.src, "lesson-05.mpd"), MODEL);
    const result = run(w);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("LDraw library not found");
  });

  it("fails, naming the model, when a part is missing from the library", () => {
    const w = workspace();
    writeFileSync(join(w.src, "lesson-05.mpd"), MODEL);
    writeFileSync(join(w.src, "lesson-06.mpd"), "1 4 0 0 0 1 0 0 0 1 0 0 0 1 9999.dat\n");
    const result = run(w);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("lesson-06.mpd");
    expect(result.stderr).not.toContain("Failed to pack: lesson-05.mpd");
    expect(existsSync(join(w.out, "lesson-05.mpd"))).toBe(true); // the good model is still packed
  });

  it("refuses two files that would be packed under the same name", () => {
    const w = workspace();
    writeFileSync(join(w.src, "lesson-05.mpd"), MODEL);
    writeFileSync(join(w.src, "lesson-05.ldr"), MODEL);
    const result = run(w);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("lesson-05");
  });
});
