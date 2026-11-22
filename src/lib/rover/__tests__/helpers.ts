import { angleDiffDeg, clamp } from "../kinematics";
import { createWorld, stepWorld } from "../world";
import type { Arena, Pose, RoverEventName, RoverOutputs, RoverWorld, Vec2 } from "../types";

/** A world with exact (noise-free) sonar, which is what almost every test wants. */
export function makeWorld(arena: Arena, start?: Pose, extra: { seed?: number; sonarNoise?: boolean } = {}): RoverWorld {
  return createWorld({ arena, start, sonarNoise: false, ...extra });
}

/** An empty rectangular test arena (cm). */
export function emptyArena(width: number, height: number, partial: Partial<Arena> = {}): Arena {
  return {
    id: "straight-wall",
    title: "test",
    width,
    height,
    start: { x: width / 2, y: height / 2, headingDeg: 0 },
    obstacles: [],
    goals: [],
    ...partial,
  };
}

export interface RunResult {
  timeS: number;
  events: RoverEventName[];
  /** Every waypoint was reached within the time limit. */
  reachedAll: boolean;
}

/** Runs the world for `seconds` with fixed outputs at 60 steps per second. */
export function drive(world: RoverWorld, outputs: RoverOutputs, seconds: number, dt = 1 / 60): RoverEventName[] {
  const events: RoverEventName[] = [];
  const steps = Math.round(seconds / dt);
  for (let i = 0; i < steps; i++) events.push(...stepWorld(world, outputs, dt));
  return events;
}

/**
 * A tiny waypoint follower standing in for a student's program: turn on the spot when badly aimed,
 * otherwise drive forward and steer proportionally. Used to prove that every arena can be won.
 */
export function followWaypoints(
  world: RoverWorld,
  waypoints: Vec2[],
  { maxSeconds = 90, dt = 1 / 60 }: { maxSeconds?: number; dt?: number } = {},
): RunResult {
  const events: RoverEventName[] = [];
  let elapsed = 0;
  let reached = 0;
  for (const target of waypoints) {
    while (elapsed < maxSeconds) {
      const dx = target.x - world.car.x;
      const dy = target.y - world.car.y;
      if (Math.hypot(dx, dy) < 5) {
        reached += 1;
        break;
      }
      const wanted = (Math.atan2(dx, dy) * 180) / Math.PI;
      const err = angleDiffDeg(world.car.headingDeg, wanted);
      let outputs: RoverOutputs;
      if (Math.abs(err) > 25) {
        outputs = { motorA: err > 0 ? 40 : -40, motorB: err > 0 ? -40 : 40, servoDeg: 90 };
      } else {
        const steer = clamp(err * 1.2, -30, 30);
        outputs = { motorA: 60 + steer, motorB: 60 - steer, servoDeg: 90 };
      }
      events.push(...stepWorld(world, outputs, dt));
      elapsed += dt;
    }
  }
  return { timeS: elapsed, events, reachedAll: reached === waypoints.length };
}
