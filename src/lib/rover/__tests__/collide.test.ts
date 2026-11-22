import { describe, expect, it } from "vitest";
import { carCorners, carRadius, findContact, resolveMove } from "../collide";
import { getTuning } from "../tuning";
import type { Obstacle } from "../types";
import { emptyArena } from "./helpers";

const tuning = getTuning("esp32"); // car 22 long x 14 wide
const arenaWith = (...obstacles: Obstacle[]) => emptyArena(100, 100, { obstacles });

describe("carCorners", () => {
  it("places the body around the centre (heading 0: nose up)", () => {
    const [fl, fr, rr, rl] = carCorners({ x: 50, y: 50, headingDeg: 0 }, tuning);
    expect(fl.x).toBeCloseTo(43);
    expect(fl.y).toBeCloseTo(61);
    expect(fr.x).toBeCloseTo(57);
    expect(rr.y).toBeCloseTo(39);
    expect(rl.x).toBeCloseTo(43);
  });

  it("rotates clockwise with the heading (90: nose right, left side up)", () => {
    const [fl] = carCorners({ x: 50, y: 50, headingDeg: 90 }, tuning);
    expect(fl.x).toBeCloseTo(61);
    expect(fl.y).toBeCloseTo(57);
  });

  it("has a circumscribed radius of half the diagonal", () => {
    expect(carRadius(tuning)).toBeCloseTo(Math.hypot(11, 7));
  });
});

describe("findContact", () => {
  it("is null in open space", () => {
    expect(findContact({ x: 50, y: 50, headingDeg: 0 }, arenaWith(), tuning)).toBeNull();
  });

  it("detects the arena wall, but allows resting against it", () => {
    const arena = arenaWith();
    expect(findContact({ x: 5, y: 50, headingDeg: 0 }, arena, tuning)).toEqual({ kind: "wall" });
    expect(findContact({ x: 7.1, y: 50, headingDeg: 0 }, arena, tuning)).toBeNull();
    expect(findContact({ x: 50, y: 95, headingDeg: 0 }, arena, tuning)).toEqual({ kind: "wall" });
  });

  it("detects a box and reports its index; touching is not a contact", () => {
    const arena = arenaWith({ kind: "circle", x: 10, y: 10, r: 2 }, { kind: "box", x: 50, y: 70, w: 20, h: 10 });
    expect(findContact({ x: 50, y: 56, headingDeg: 0 }, arena, tuning)).toEqual({ kind: "obstacle", index: 1 });
    expect(findContact({ x: 50, y: 54, headingDeg: 0 }, arena, tuning)).toBeNull(); // nose exactly on the face
    expect(findContact({ x: 50, y: 50, headingDeg: 0 }, arena, tuning)).toBeNull();
  });

  it("depends on the car's heading (the body is an oriented rectangle)", () => {
    const arena = arenaWith({ kind: "box", x: 60, y: 57, w: 4, h: 4 }); // x from 58 to 62
    expect(findContact({ x: 50, y: 50, headingDeg: 0 }, arena, tuning)).toBeNull(); // body spans x 43..57
    expect(findContact({ x: 50, y: 50, headingDeg: 90 }, arena, tuning)).toEqual({ kind: "obstacle", index: 0 }); // x 39..61
  });

  it("detects a circle, including a hit on a body corner", () => {
    const post = (x: number, y: number, r: number): Obstacle => ({ kind: "circle", x, y, r });
    const car = { x: 50, y: 50, headingDeg: 0 };
    expect(findContact(car, arenaWith(post(50, 70, 5)), tuning)).toBeNull(); // nose at 61, post starts at 65
    expect(findContact({ ...car, y: 55 }, arenaWith(post(50, 70, 5)), tuning)).toEqual({ kind: "obstacle", index: 0 });
    // Corner (57, 61) is 7.6 cm from (64, 64): a 5.1 cm post misses, an 8 cm post hits.
    expect(findContact(car, arenaWith(post(64, 64, 5.1)), tuning)).toBeNull();
    expect(findContact(car, arenaWith(post(64, 64, 8)), tuning)).toEqual({ kind: "obstacle", index: 0 });
  });
});

describe("resolveMove", () => {
  const wall = arenaWith({ kind: "box", x: 50, y: 70, w: 100, h: 10 }); // spans y 65..75 across the whole width

  it("accepts a free move unchanged", () => {
    const prev = { x: 50, y: 30, headingDeg: 0 };
    const next = { x: 50, y: 31, headingDeg: 5 };
    const result = resolveMove(prev, next, wall, tuning);
    expect(result.car).toEqual(next);
    expect(result.contact).toBeNull();
  });

  it("keeps the car in place when driving into a wall", () => {
    const prev = { x: 50, y: 54, headingDeg: 0 };
    const result = resolveMove(prev, { x: 50, y: 56, headingDeg: 0 }, wall, tuning);
    expect(result.car).toEqual(prev);
    expect(result.contact).toEqual({ kind: "obstacle", index: 0 });
  });

  it("still turns on the spot when forward is blocked but the turn is free", () => {
    const prev = { x: 50, y: 50, headingDeg: 0 };
    const result = resolveMove(prev, { x: 50, y: 66, headingDeg: 20 }, wall, tuning);
    expect(result.car).toEqual({ x: 50, y: 50, headingDeg: 20 });
    expect(result.contact).not.toBeNull();
  });

  it("refuses a turn that would swing the body into the wall", () => {
    const prev = { x: 50, y: 54, headingDeg: 0 };
    const result = resolveMove(prev, { x: 50, y: 54, headingDeg: 20 }, wall, tuning);
    expect(result.car).toEqual(prev);
    expect(result.contact).not.toBeNull();
  });
});
