import { resolveMove } from "./collide";
import { createEventTracker, detectEvents, EVENT_TUNING } from "./events";
import { clamp, stepCar } from "./kinematics";
import { getTuning } from "./tuning";
import type { Arena, Pose, RoverBoard, RoverEventName, RoverOutputs, RoverStats, RoverTuning, RoverWorld } from "./types";

/** Largest physics sub-step: keeps thin obstacles from being skipped when a frame takes long. */
const MAX_SUBSTEP_S = 0.02;

/** Small deterministic generator (mulberry32) so sonar noise is reproducible for a given seed. */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface CreateWorldOptions {
  arena: Arena;
  /** Overrides the arena's default start pose (a lesson may place the car elsewhere). */
  start?: Pose;
  board?: RoverBoard;
  /** Full tuning override; wins over `board`. */
  tuning?: RoverTuning;
  seed?: number;
  sonarNoise?: boolean;
}

function freshStats(): RoverStats {
  return { collisions: 0, obstaclesAvoided: 0, distanceCm: 0, timeS: 0, goalReached: false };
}

/**
 * Creates a mutable simulation world. Keep it in a `useRef`: it is stepped from the sim loop and read by the
 * renderer, never stored in React state.
 */
export function createWorld(options: CreateWorldOptions): RoverWorld {
  const { arena } = options;
  return {
    arena,
    tuning: options.tuning ?? getTuning(options.board ?? "esp32"),
    car: { ...(options.start ?? arena.start) },
    servoDeg: 90,
    stats: freshStats(),
    eventQueue: [],
    tracker: createEventTracker(arena.obstacles.length),
    rng: createRng(options.seed ?? 1),
    sonarNoise: options.sonarNoise ?? true,
  };
}

/** Puts the car back on its start pose and clears statistics and events. */
export function resetWorld(world: RoverWorld, start?: Pose): void {
  world.car = { ...(start ?? world.arena.start) };
  world.servoDeg = 90;
  world.stats = freshStats();
  world.eventQueue = [];
  world.tracker = createEventTracker(world.arena.obstacles.length);
}

const approach = (current: number, target: number, maxDelta: number) =>
  Math.abs(target - current) <= maxDelta ? target : current + Math.sign(target - current) * maxDelta;

/**
 * Advances the world by `dt` seconds under the given outputs and returns the events that fired.
 * The same events are also queued for the next telemetry frames (see `roverFrame`).
 */
export function stepWorld(world: RoverWorld, outputs: RoverOutputs, dt: number): RoverEventName[] {
  if (!Number.isFinite(dt) || dt <= 0) return [];
  const steps = Math.max(1, Math.ceil(dt / MAX_SUBSTEP_S));
  const sub = dt / steps;
  const motorsOn = Math.abs(outputs.motorA) >= 1 || Math.abs(outputs.motorB) >= 1;
  const servoTarget = clamp(Number.isFinite(outputs.servoDeg) ? outputs.servoDeg : 90, 0, 180);
  const fired: RoverEventName[] = [];

  for (let i = 0; i < steps; i++) {
    world.servoDeg = approach(world.servoDeg, servoTarget, world.tuning.servoSpeedDegS * sub);
    const prev = world.car;
    const proposed = stepCar(prev, outputs.motorA, outputs.motorB, sub, world.tuning);
    const { car, contact } = resolveMove(prev, proposed, world.arena, world.tuning);
    world.car = car;
    world.stats.distanceCm += Math.hypot(car.x - prev.x, car.y - prev.y);
    world.stats.timeS += sub;
    fired.push(...detectEvents(world, { contact, motorsOn, dt: sub }));
  }

  for (const event of fired) {
    if (world.eventQueue.length < EVENT_TUNING.maxQueue) world.eventQueue.push(event);
  }
  return fired;
}
