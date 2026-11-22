import { describe, expect, it } from "vitest";
import { ARENAS } from "../arenas";
import { EVENT_TUNING } from "../events";
import { resetWorld, stepWorld } from "../world";
import { drive, emptyArena, followWaypoints, makeWorld } from "./helpers";

const FORWARD = { motorA: 60, motorB: 60, servoDeg: 90 };
const STOP = { motorA: 0, motorB: 0, servoDeg: 90 };

describe("stepWorld: driving into the straight wall", () => {
  it("stops at the wall, counts one collision, and reports STUCK after two seconds of pushing", () => {
    const world = makeWorld(ARENAS["straight-wall"]);
    const events = drive(world, FORWARD, 12);
    // Wall face at y = 165; the nose is 11 cm ahead of the car centre.
    expect(world.car.y).toBeGreaterThan(153);
    expect(world.car.y).toBeLessThanOrEqual(154);
    expect(world.car.x).toBeCloseTo(90);
    expect(world.stats.collisions).toBe(1);
    expect(events.filter((e) => e === "COLLISION")).toHaveLength(1);
    expect(events.filter((e) => e === "STUCK")).toHaveLength(1);
    expect(events.indexOf("COLLISION")).toBeLessThan(events.indexOf("STUCK"));
    expect(world.stats.distanceCm).toBeCloseTo(world.car.y - 30, 1);
  });

  it("is not stuck when the motors are off", () => {
    const world = makeWorld(ARENAS["straight-wall"]);
    drive(world, FORWARD, 8);
    const events = drive(world, STOP, 5);
    expect(events).not.toContain("STUCK");
  });

  it("counts a new collision after backing away and hitting again", () => {
    const world = makeWorld(ARENAS["straight-wall"]);
    drive(world, FORWARD, 8);
    drive(world, { motorA: -60, motorB: -60, servoDeg: 90 }, 1);
    drive(world, FORWARD, 3);
    expect(world.stats.collisions).toBe(2);
  });

  it("does not tunnel through a thin wall on a long frame", () => {
    const world = makeWorld(ARENAS["straight-wall"]);
    for (let i = 0; i < 60; i++) stepWorld(world, FORWARD, 0.1); // the loop's maximum dt
    expect(world.car.y).toBeLessThanOrEqual(154);
    expect(world.stats.collisions).toBe(1);
  });
});

describe("stepWorld: inputs and servo", () => {
  it("ignores non-positive or non-finite dt", () => {
    const world = makeWorld(ARENAS.slalom);
    const before = structuredClone(world.car);
    for (const dt of [0, -1, Number.NaN, Infinity]) expect(stepWorld(world, FORWARD, dt)).toEqual([]);
    expect(world.car).toEqual(before);
    expect(world.stats.timeS).toBe(0);
  });

  it("slews the servo toward the commanded angle at the tuned speed", () => {
    const world = makeWorld(emptyArena(200, 200));
    stepWorld(world, { motorA: 0, motorB: 0, servoDeg: 0 }, 0.1);
    expect(world.servoDeg).toBeCloseTo(60); // 300 deg/s * 0.1 s from 90
    drive(world, { motorA: 0, motorB: 0, servoDeg: 0 }, 0.5);
    expect(world.servoDeg).toBe(0);
    drive(world, { motorA: 0, motorB: 0, servoDeg: 400 }, 1); // clamped to 180
    expect(world.servoDeg).toBe(180);
  });

  it("accumulates simulated time", () => {
    const world = makeWorld(emptyArena(200, 200));
    drive(world, STOP, 2.5);
    expect(world.stats.timeS).toBeCloseTo(2.5, 1);
  });
});

describe("events on the arenas", () => {
  it("reports OBSTACLE_AVOIDED once per post when weaving through the slalom", () => {
    const world = makeWorld(ARENAS.slalom);
    const run = followWaypoints(world, [
      { x: 70, y: 60 }, { x: 70, y: 135 }, { x: 130, y: 135 }, { x: 130, y: 205 },
      { x: 70, y: 205 }, { x: 70, y: 275 }, { x: 100, y: 305 },
    ]);
    expect(run.events.filter((e) => e === "OBSTACLE_AVOIDED")).toHaveLength(3);
    expect(world.stats.obstaclesAvoided).toBe(3);
    expect(world.stats.collisions).toBe(0);
  });

  it("does not credit an obstacle the car hit", () => {
    const world = makeWorld(ARENAS.slalom);
    drive(world, FORWARD, 6); // straight into post 1
    drive(world, { motorA: -60, motorB: -60, servoDeg: 90 }, 2); // and back away
    expect(world.stats.collisions).toBe(1);
    expect(world.stats.obstaclesAvoided).toBe(0);
  });

  it("reports GOAL_REACHED exactly once, even if the car stays in the zone", () => {
    const world = makeWorld(ARENAS.parking);
    const run = followWaypoints(world, [{ x: 150, y: 30 }, { x: 150, y: 135 }]);
    const more = drive(world, FORWARD, 0.2).concat(drive(world, STOP, 2));
    expect([...run.events, ...more].filter((e) => e === "GOAL_REACHED")).toHaveLength(1);
    expect(world.stats.goalReached).toBe(true);
  });

  it("queues events for telemetry, capped at the maximum", () => {
    const world = makeWorld(ARENAS["straight-wall"]);
    drive(world, FORWARD, 8);
    expect(world.eventQueue).toEqual(["COLLISION", "STUCK"].slice(0, world.eventQueue.length));
    expect(world.eventQueue.length).toBeLessThanOrEqual(EVENT_TUNING.maxQueue);
    expect(world.eventQueue[0]).toBe("COLLISION");
  });
});

describe("determinism and reset", () => {
  it("replays identically for the same inputs", () => {
    const run = () => {
      const world = makeWorld(ARENAS.slalom, undefined, { sonarNoise: true, seed: 3 });
      followWaypoints(world, [{ x: 70, y: 60 }, { x: 70, y: 135 }, { x: 130, y: 135 }]);
      return JSON.stringify({ car: world.car, stats: world.stats });
    };
    expect(run()).toBe(run());
  });

  it("returns to the start pose with cleared statistics", () => {
    const world = makeWorld(ARENAS["straight-wall"]);
    drive(world, FORWARD, 8);
    resetWorld(world);
    expect(world.car).toEqual(ARENAS["straight-wall"].start);
    expect(world.stats).toEqual({ collisions: 0, obstaclesAvoided: 0, distanceCm: 0, timeS: 0, goalReached: false });
    expect(world.eventQueue).toEqual([]);
    expect(world.servoDeg).toBe(90);
  });

  it("honours a lesson-specific start pose", () => {
    const start = { x: 40, y: 200, headingDeg: 180 };
    const world = makeWorld(ARENAS.slalom, start);
    expect(world.car).toEqual(start);
    expect(world.car).not.toBe(start);
  });
});
