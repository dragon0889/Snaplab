import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeName, pack, readSteps, referenceOf, splitMpd } from "./pack-ldraw.mjs";

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

function fakeLibrary() {
  const lib = mkdtempSync(join(tmpdir(), "ldraw-"));
  mkdirSync(join(lib, "parts", "s"), { recursive: true });
  mkdirSync(join(lib, "p"), { recursive: true });
  writeFileSync(join(lib, "parts", "3001.dat"), "0 brick\n1 16 0 0 0 1 0 0 0 1 0 0 0 1 s\\3001s01.dat\n1 16 0 0 0 1 0 0 0 1 0 0 0 1 stud.dat\n");
  writeFileSync(join(lib, "parts", "s", "3001s01.dat"), "0 sub\n");
  writeFileSync(join(lib, "p", "stud.dat"), "0 stud\n");
  return lib;
}

describe("pack-ldraw", () => {
  it("normalizes LDraw names", () => {
    expect(normalizeName(" S\\3001S01.DAT ")).toBe("s/3001s01.dat");
  });
  it("reads a type-1 reference, spaces allowed", () => {
    expect(referenceOf("1 4 0 0 0 1 0 0 0 1 0 0 0 1 My Sub Model.ldr")).toBe("my sub model.ldr");
    expect(referenceOf("0 STEP")).toBeNull();
  });
  it("splits an MPD into its files", () => {
    const { files, main } = splitMpd(MODEL, "x.mpd");
    expect(main).toBe("barrier.ldr");
    expect([...files.keys()]).toEqual(["barrier.ldr", "anchor_servo1.ldr"]);
  });
  it("packs every referenced library file once, with normalized names", () => {
    const { packed, missing } = pack(MODEL, "x.mpd", fakeLibrary());
    expect(missing.size).toBe(0);
    expect([...packed.keys()]).toEqual(["barrier.ldr", "3001.dat", "s/3001s01.dat", "stud.dat", "anchor_servo1.ldr"]);
    expect(packed.get("barrier.ldr")).toContain("1 4 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat");
  });
  it("reports files missing from the library", () => {
    const { missing } = pack("1 4 0 0 0 1 0 0 0 1 0 0 0 1 9999.dat", "x.ldr", fakeLibrary());
    expect([...missing]).toEqual(["9999.dat"]);
  });
  it("reads steps, Vietnamese text, parts and anchors", () => {
    const steps = readSteps(splitMpd(MODEL, "x.mpd").files.get("barrier.ldr"));
    expect(steps).toHaveLength(2);
    expect(steps[0]).toMatchObject({ step: 1, textVi: "Dựng khung đế", parts: [{ part: "3001", qty: 1 }] });
    expect(steps[1].anchors[0]).toMatchObject({ name: "servo1", positionLdu: [10, -48, 20] });
  });
});
