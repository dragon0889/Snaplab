import { describe, expect, it } from "vitest";
import { ARENA_IDS, ARENAS, getArena } from "../arenas";
import { findContact } from "../collide";
import { distanceToObstacle, isGoalReachable } from "../reachability";
import { getTuning } from "../tuning";
import type { ArenaId, Vec2 } from "../types";
import { drive, emptyArena, followWaypoints, makeWorld } from "./helpers";

const tuning = getTuning("esp32");
/** Corridors must be at least 1.5 x the car width (rover-lesson skill). */
const MIN_CORRIDOR_CM = 1.5 * tuning.carWidthCm;

/** Hand-made routes that stand in for a student's winning program. */
const ROUTES: Record<ArenaId, Vec2[]> = {
  // Around the left end of the wall.
  "straight-wall": [{ x: 15, y: 120 }, { x: 15, y: 200 }, { x: 90, y: 215 }],
  // Left of post 1, right of post 2, left of post 3.
  slalom: [
    { x: 70, y: 60 }, { x: 70, y: 135 }, { x: 130, y: 135 }, { x: 130, y: 205 },
    { x: 70, y: 205 }, { x: 70, y: 275 }, { x: 100, y: 305 },
  ],
  // Up the left gap, right along the middle corridor, up the right gap, then left to the goal.
  "maze-s": [{ x: 30, y: 120 }, { x: 200, y: 120 }, { x: 200, y: 205 }, { x: 120, y: 205 }],
  // Along the bottom, then straight up into the gap between the parked cars.
  parking: [{ x: 150, y: 30 }, { x: 150, y: 135 }],
};

describe("arena presets", () => {
  it("exposes every preset by id", () => {
    expect(ARENA_IDS.sort()).toEqual(["maze-s", "parking", "slalom", "straight-wall"]);
    for (const id of ARENA_IDS) {
      expect(getArena(id)).toBe(ARENAS[id]);
      expect(ARENAS[id].id).toBe(id);
      expect(ARENAS[id].title.length).toBeGreaterThan(0);
    }
  });

  for (const id of ["straight-wall", "slalom", "maze-s", "parking"] as const) {
    describe(id, () => {
      const arena = ARENAS[id];

      it("starts the car inside the arena without touching anything", () => {
        expect(findContact(arena.start, arena, tuning)).toBeNull();
      });

      it("keeps every obstacle and goal inside the arena", () => {
        for (const o of arena.obstacles) {
          const [w, h] = o.kind === "box" ? [o.w / 2, o.h / 2] : [o.r, o.r];
          expect(o.x - w).toBeGreaterThanOrEqual(0);
          expect(o.x + w).toBeLessThanOrEqual(arena.width);
          expect(o.y - h).toBeGreaterThanOrEqual(0);
          expect(o.y + h).toBeLessThanOrEqual(arena.height);
        }
        for (const g of arena.goals) {
          expect(g.x - g.w / 2).toBeGreaterThanOrEqual(0);
          expect(g.x + g.w / 2).toBeLessThanOrEqual(arena.width);
          expect(g.y - g.h / 2).toBeGreaterThanOrEqual(0);
          expect(g.y + g.h / 2).toBeLessThanOrEqual(arena.height);
          // The goal centre is free space.
          for (const o of arena.obstacles) expect(distanceToObstacle(g.x, g.y, o)).toBeGreaterThan(0);
        }
      });

      it(`has a route to the goal through corridors of at least ${MIN_CORRIDOR_CM} cm`, () => {
        expect(arena.goals.length).toBeGreaterThan(0);
        expect(isGoalReachable(arena, arena.start, MIN_CORRIDOR_CM)).toBe(true);
      });

      it("can be won by a simple waypoint follower, without a single collision", () => {
        const world = makeWorld(arena);
        const run = followWaypoints(world, ROUTES[id]);
        expect(run.reachedAll).toBe(true);
        expect(run.timeS).toBeLessThan(60);
        expect(world.stats.goalReached).toBe(true);
        expect(world.stats.collisions).toBe(0);
        expect(run.events).toContain("GOAL_REACHED");
      });
    });
  }

  it("makes driving straight ahead fail where the lesson expects it to", () => {
    for (const id of ["straight-wall", "slalom"] as const) {
      const world = makeWorld(ARENAS[id]);
      drive(world, { motorA: 60, motorB: 60, servoDeg: 90 }, 20);
      expect(world.stats.collisions).toBe(1);
      expect(world.stats.goalReached).toBe(false);
    }
  });
});

describe("isGoalReachable", () => {
  const walls = (gap: number) =>
    emptyArena(100, 100, {
      start: { x: 50, y: 10, headingDeg: 0 },
      // A horizontal barrier with a gap in the middle.
      obstacles: [
        { kind: "box", x: (50 - gap / 2) / 2, y: 50, w: 50 - gap / 2, h: 6 },
        { kind: "box", x: 100 - (50 - gap / 2) / 2, y: 50, w: 50 - gap / 2, h: 6 },
      ],
      goals: [{ x: 50, y: 90, w: 20, h: 10 }],
    });

  it("accepts a wide gap and rejects a gap narrower than the car needs", () => {
    expect(isGoalReachable(walls(30), walls(30).start, MIN_CORRIDOR_CM)).toBe(true);
    expect(isGoalReachable(walls(16), walls(16).start, MIN_CORRIDOR_CM)).toBe(false);
  });

  it("is false when the start itself is too close to a wall", () => {
    const arena = walls(30);
    expect(isGoalReachable(arena, { x: 2, y: 10, headingDeg: 0 }, MIN_CORRIDOR_CM)).toBe(false);
  });
});
