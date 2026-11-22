import { forwardVector, rightVector } from "./kinematics";
import type { Arena, BoxObstacle, CircleObstacle, Contact, Pose, RoverTuning, Vec2 } from "./types";

/** Corners of the car body (an oriented rectangle): front-left, front-right, rear-right, rear-left. */
export function carCorners(car: Pose, tuning: RoverTuning): Vec2[] {
  const f = forwardVector(car.headingDeg);
  const r = rightVector(car.headingDeg);
  const hl = tuning.carLengthCm / 2;
  const hw = tuning.carWidthCm / 2;
  const at = (lf: number, lr: number): Vec2 => ({
    x: car.x + f.x * lf + r.x * lr,
    y: car.y + f.y * lf + r.y * lr,
  });
  return [at(hl, -hw), at(hl, hw), at(-hl, hw), at(-hl, -hw)];
}

/** Radius of the smallest circle around the car body (used for clearance checks). */
export function carRadius(tuning: RoverTuning): number {
  return Math.hypot(tuning.carLengthCm / 2, tuning.carWidthCm / 2);
}

function boxCorners(b: BoxObstacle): Vec2[] {
  const hw = b.w / 2;
  const hh = b.h / 2;
  return [
    { x: b.x - hw, y: b.y + hh },
    { x: b.x + hw, y: b.y + hh },
    { x: b.x + hw, y: b.y - hh },
    { x: b.x - hw, y: b.y - hh },
  ];
}

function project(poly: Vec2[], axis: Vec2): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (const p of poly) {
    const d = p.x * axis.x + p.y * axis.y;
    if (d < min) min = d;
    if (d > max) max = d;
  }
  return [min, max];
}

/** Separating-axis test for two convex rectangles. Merely touching edges do not count as overlap. */
function rectsOverlap(a: Vec2[], b: Vec2[]): boolean {
  const axes: Vec2[] = [];
  for (const poly of [a, b]) {
    for (let i = 0; i < 2; i++) {
      const p = poly[i];
      const q = poly[i + 1];
      const edge = { x: q.x - p.x, y: q.y - p.y };
      const len = Math.hypot(edge.x, edge.y) || 1;
      axes.push({ x: -edge.y / len, y: edge.x / len });
    }
  }
  for (const axis of axes) {
    const [minA, maxA] = project(a, axis);
    const [minB, maxB] = project(b, axis);
    if (maxA <= minB || maxB <= minA) return false;
  }
  return true;
}

function circleHitsCar(car: Pose, tuning: RoverTuning, c: CircleObstacle): boolean {
  const f = forwardVector(car.headingDeg);
  const r = rightVector(car.headingDeg);
  const dx = c.x - car.x;
  const dy = c.y - car.y;
  // Circle centre in the car's own frame, then the closest point of the body rectangle to it.
  const lf = dx * f.x + dy * f.y;
  const lr = dx * r.x + dy * r.y;
  const nf = Math.max(-tuning.carLengthCm / 2, Math.min(tuning.carLengthCm / 2, lf));
  const nr = Math.max(-tuning.carWidthCm / 2, Math.min(tuning.carWidthCm / 2, lr));
  return (lf - nf) ** 2 + (lr - nr) ** 2 < c.r * c.r;
}

/** First thing the car body overlaps, or null. Obstacles are reported before the arena wall. */
export function findContact(car: Pose, arena: Arena, tuning: RoverTuning): Contact | null {
  const corners = carCorners(car, tuning);
  for (let i = 0; i < arena.obstacles.length; i++) {
    const o = arena.obstacles[i];
    const hit = o.kind === "box" ? rectsOverlap(corners, boxCorners(o)) : circleHitsCar(car, tuning, o);
    if (hit) return { kind: "obstacle", index: i };
  }
  for (const p of corners) {
    if (p.x < 0 || p.x > arena.width || p.y < 0 || p.y > arena.height) return { kind: "wall" };
  }
  return null;
}

export interface MoveResult {
  /** Where the car ends up after the collision rules. */
  car: Pose;
  /** What the intended move ran into (null when it was free). */
  contact: Contact | null;
}

/**
 * Applies a proposed move. A free move is accepted as is. A blocked move falls back to turning on the spot,
 * then to sliding without turning, and otherwise the car stays where it was.
 */
export function resolveMove(prev: Pose, next: Pose, arena: Arena, tuning: RoverTuning): MoveResult {
  const contact = findContact(next, arena, tuning);
  if (!contact) return { car: next, contact: null };
  const turnOnly: Pose = { x: prev.x, y: prev.y, headingDeg: next.headingDeg };
  if (!findContact(turnOnly, arena, tuning)) return { car: turnOnly, contact };
  const slideOnly: Pose = { x: next.x, y: next.y, headingDeg: prev.headingDeg };
  if (!findContact(slideOnly, arena, tuning)) return { car: slideOnly, contact };
  return { car: { ...prev }, contact };
}
