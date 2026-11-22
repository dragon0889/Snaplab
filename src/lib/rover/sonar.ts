import { clamp, forwardVector } from "./kinematics";
import type { Arena, BoxObstacle, CircleObstacle, Pose, RoverTuning, RoverWorld, Vec2 } from "./types";

/** Angle of the sensor relative to the car's nose, clockwise positive: servo 90 = ahead, 0 = right, 180 = left. */
export function servoToRelativeDeg(servoDeg: number): number {
  return 90 - clamp(Number.isFinite(servoDeg) ? servoDeg : 90, 0, 180);
}

/** The sensor head sits on the front edge of the car. */
export function sensorOrigin(car: Pose, tuning: RoverTuning): Vec2 {
  const f = forwardVector(car.headingDeg);
  const d = tuning.carLengthCm / 2;
  return { x: car.x + f.x * d, y: car.y + f.y * d };
}

function rayToBox(o: Vec2, d: Vec2, b: BoxObstacle): number {
  let tMin = -Infinity;
  let tMax = Infinity;
  const axes: [number, number, number, number][] = [
    [o.x, d.x, b.x - b.w / 2, b.x + b.w / 2],
    [o.y, d.y, b.y - b.h / 2, b.y + b.h / 2],
  ];
  for (const [origin, dir, lo, hi] of axes) {
    if (Math.abs(dir) < 1e-12) {
      if (origin < lo || origin > hi) return Infinity;
      continue;
    }
    const t1 = (lo - origin) / dir;
    const t2 = (hi - origin) / dir;
    tMin = Math.max(tMin, Math.min(t1, t2));
    tMax = Math.min(tMax, Math.max(t1, t2));
  }
  if (tMax < Math.max(tMin, 0)) return Infinity;
  return Math.max(tMin, 0);
}

function rayToCircle(o: Vec2, d: Vec2, c: CircleObstacle): number {
  const fx = o.x - c.x;
  const fy = o.y - c.y;
  const b = fx * d.x + fy * d.y;
  const k = fx * fx + fy * fy - c.r * c.r;
  const disc = b * b - k;
  if (disc < 0) return Infinity;
  const root = Math.sqrt(disc);
  const t = -b - root;
  if (t >= 0) return t;
  return -b + root >= 0 ? 0 : Infinity; // origin inside the circle
}

function rayToWalls(o: Vec2, d: Vec2, arena: Arena): number {
  const tx = d.x > 1e-12 ? (arena.width - o.x) / d.x : d.x < -1e-12 ? -o.x / d.x : Infinity;
  const ty = d.y > 1e-12 ? (arena.height - o.y) / d.y : d.y < -1e-12 ? -o.y / d.y : Infinity;
  return Math.max(0, Math.min(tx, ty));
}

/** Distance along one ray to the nearest obstacle or wall (Infinity when nothing is hit). */
export function castRay(arena: Arena, origin: Vec2, headingDeg: number): number {
  const d = forwardVector(headingDeg);
  let best = rayToWalls(origin, d, arena);
  for (const o of arena.obstacles) {
    const t = o.kind === "box" ? rayToBox(origin, d, o) : rayToCircle(origin, d, o);
    if (t < best) best = t;
  }
  return best;
}

/**
 * Ultrasonic reading in cm for the head pointing at `servoDeg`.
 * Three rays (centre and +/- cone half-angle) are cast and the nearest echo wins, like a real HC-SR04 cone.
 * The result is clamped to the sensor range and carries a little noise when `world.sonarNoise` is on.
 */
export function sonarCm(world: RoverWorld, servoDeg: number): number {
  const { arena, car, tuning } = world;
  const origin = sensorOrigin(car, tuning);
  const aim = car.headingDeg + servoToRelativeDeg(servoDeg);
  const cone = tuning.sonarConeDeg;
  let nearest = Infinity;
  for (const offset of [-cone, 0, cone]) {
    nearest = Math.min(nearest, castRay(arena, origin, aim + offset));
  }
  let reading = Number.isFinite(nearest) ? nearest : tuning.sonarMaxCm;
  if (world.sonarNoise) reading += (world.rng() * 2 - 1) * tuning.sonarNoiseCm;
  return clamp(reading, tuning.sonarMinCm, tuning.sonarMaxCm);
}
