import { describe, expect, it } from "vitest";
import { castRay, sensorOrigin, servoToRelativeDeg, sonarCm } from "../sonar";
import { getTuning } from "../tuning";
import type { Obstacle } from "../types";
import { emptyArena, makeWorld } from "./helpers";

const tuning = getTuning("esp32");
const START = { x: 100, y: 100, headingDeg: 0 };
// Sensor origin for this start: the nose at (100, 111).
const worldWith = (heading = 0, ...obstacles: Obstacle[]) =>
  makeWorld(emptyArena(200, 300, { obstacles }), { ...START, headingDeg: heading });

describe("servo mapping", () => {
  it("90 looks ahead, 0 looks right, 180 looks left", () => {
    expect(servoToRelativeDeg(90)).toBe(0);
    expect(servoToRelativeDeg(0)).toBe(90);
    expect(servoToRelativeDeg(180)).toBe(-90);
    expect(servoToRelativeDeg(999)).toBe(-90);
    expect(servoToRelativeDeg(Number.NaN)).toBe(0);
  });

  it("puts the sensor on the nose of the car", () => {
    const o = sensorOrigin({ x: 100, y: 100, headingDeg: 90 }, tuning);
    expect(o.x).toBeCloseTo(111);
    expect(o.y).toBeCloseTo(100);
  });
});

describe("sonarCm", () => {
  it("measures the distance to the arena wall", () => {
    expect(sonarCm(worldWith(0), 90)).toBeCloseTo(189); // 300 - 111
    expect(sonarCm(worldWith(90), 90)).toBeCloseTo(89); // 200 - 111
    expect(sonarCm(worldWith(180), 90)).toBeCloseTo(89); // looking down from y = 89
  });

  it("sweeps with the servo", () => {
    const world = worldWith(0);
    expect(sonarCm(world, 0)).toBeCloseTo(100); // right: x = 200
    expect(sonarCm(world, 180)).toBeCloseTo(100); // left: x = 0
  });

  it("measures boxes and circles", () => {
    expect(sonarCm(worldWith(0, { kind: "box", x: 100, y: 200, w: 40, h: 10 }), 90)).toBeCloseTo(84); // face at y = 195
    expect(sonarCm(worldWith(0, { kind: "circle", x: 100, y: 200, r: 10 }), 90)).toBeCloseTo(79); // top of nearest arc at 190
  });

  it("sees an object that only the edge of the 15-degree cone touches", () => {
    const side: Obstacle = { kind: "box", x: 112, y: 200, w: 4, h: 4 }; // centre ray (x = 100) misses it
    const reading = sonarCm(worldWith(0, side), 90);
    expect(reading).toBeCloseTo(87 / Math.cos((7.5 * Math.PI) / 180), 1);
    expect(reading).toBeLessThan(189);
  });

  it("reports the sensor maximum when nothing is in range", () => {
    const world = makeWorld(emptyArena(1000, 1000), { x: 500, y: 500, headingDeg: 0 });
    expect(sonarCm(world, 90)).toBe(400);
  });

  it("never reads below the sensor minimum", () => {
    const world = worldWith(0, { kind: "box", x: 100, y: 116, w: 40, h: 10 }); // face exactly at the nose
    expect(sonarCm(world, 90)).toBe(2);
  });

  it("adds bounded, reproducible noise when enabled", () => {
    const make = (seed: number) => makeWorld(emptyArena(200, 300), START, { sonarNoise: true, seed });
    const a = make(7);
    const b = make(7);
    const readingsA = Array.from({ length: 50 }, () => sonarCm(a, 90));
    const readingsB = Array.from({ length: 50 }, () => sonarCm(b, 90));
    expect(readingsA).toEqual(readingsB);
    for (const r of readingsA) expect(Math.abs(r - 189)).toBeLessThanOrEqual(0.2 + 1e-9);
    expect(new Set(readingsA).size).toBeGreaterThan(1);
    expect(Array.from({ length: 5 }, () => sonarCm(make(8), 90))).not.toEqual(readingsA.slice(0, 5));
  });
});

describe("castRay", () => {
  it("handles rays parallel to an axis", () => {
    const arena = emptyArena(100, 100);
    expect(castRay(arena, { x: 50, y: 10 }, 0)).toBeCloseTo(90);
    expect(castRay(arena, { x: 50, y: 10 }, 180)).toBeCloseTo(10);
    expect(castRay(arena, { x: 50, y: 10 }, 90)).toBeCloseTo(50);
    expect(castRay(arena, { x: 50, y: 10 }, 270)).toBeCloseTo(50);
  });
});
