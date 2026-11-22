import { carRadius } from "./collide";
import { distanceToObstacle, insideGoal } from "./reachability";
import type { Contact, EventTracker, RoverEventName, RoverWorld } from "./types";

export const EVENT_TUNING = {
  /** The car is "close" to an obstacle when its body comes within this distance of it. */
  approachCm: 15,
  /** ...and the obstacle counts as avoided once the car is this far away again without having hit it. */
  clearCm: 30,
  /** Seconds of continuous pushing against something (motors on) before STUCK is reported. */
  stuckAfterS: 2,
  /** Maximum number of events waiting to be reported in telemetry. */
  maxQueue: 16,
} as const;

export function createEventTracker(obstacleCount: number): EventTracker {
  return {
    obstacles: Array.from({ length: obstacleCount }, () => ({ approached: false, hit: false })),
    wasBlocked: false,
    stuckS: 0,
    stuckReported: false,
  };
}

export interface TickObservation {
  /** What the car's intended move ran into during this tick (null when it was free). */
  contact: Contact | null;
  /** At least one motor is driven. */
  motorsOn: boolean;
  dt: number;
}

/**
 * Updates the world's statistics and event tracker for one tick and returns the events that fired.
 * - COLLISION: the car starts pushing against something (once per impact).
 * - STUCK: it keeps pushing, motors on, for `stuckAfterS` seconds (once per episode).
 * - OBSTACLE_AVOIDED: the car came close to an obstacle, did not touch it, and moved away again.
 * - GOAL_REACHED: the car centre entered a goal zone (once).
 */
export function detectEvents(world: RoverWorld, obs: TickObservation): RoverEventName[] {
  const events: RoverEventName[] = [];
  const { tracker, stats, car, arena, tuning } = world;
  const blocked = obs.contact !== null;

  if (blocked && !tracker.wasBlocked) {
    stats.collisions += 1;
    events.push("COLLISION");
  }
  tracker.wasBlocked = blocked;
  if (obs.contact?.kind === "obstacle") tracker.obstacles[obs.contact.index].hit = true;

  if (blocked && obs.motorsOn) {
    tracker.stuckS += obs.dt;
    if (tracker.stuckS >= EVENT_TUNING.stuckAfterS && !tracker.stuckReported) {
      tracker.stuckReported = true;
      events.push("STUCK");
    }
  } else {
    tracker.stuckS = 0;
    tracker.stuckReported = false;
  }

  const radius = carRadius(tuning);
  for (let i = 0; i < arena.obstacles.length; i++) {
    const track = tracker.obstacles[i];
    const clearance = distanceToObstacle(car.x, car.y, arena.obstacles[i]) - radius;
    if (clearance < EVENT_TUNING.approachCm) {
      track.approached = true;
    } else if (clearance > EVENT_TUNING.clearCm && track.approached) {
      if (!track.hit) {
        stats.obstaclesAvoided += 1;
        events.push("OBSTACLE_AVOIDED");
      }
      track.approached = false;
      track.hit = false;
    }
  }

  if (!stats.goalReached && arena.goals.some((g) => insideGoal(car.x, car.y, g))) {
    stats.goalReached = true;
    events.push("GOAL_REACHED");
  }
  return events;
}
