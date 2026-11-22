import type { DriveLabel, Pose, RoverTuning, Vec2 } from "./types";

const DEG = Math.PI / 180;

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Wraps an angle to [0, 360). */
export function normalizeDeg(deg: number): number {
  const m = deg % 360;
  return m < 0 ? m + 360 : m;
}

/** Signed smallest difference `to - from`, in (-180, 180]. */
export function angleDiffDeg(from: number, to: number): number {
  const d = normalizeDeg(to - from);
  return d > 180 ? d - 360 : d;
}

/** Unit vector the car faces (heading 0 = +y, clockwise positive). */
export function forwardVector(headingDeg: number): Vec2 {
  const h = headingDeg * DEG;
  return { x: Math.sin(h), y: Math.cos(h) };
}

/** Unit vector pointing to the car's right-hand side. */
export function rightVector(headingDeg: number): Vec2 {
  const h = headingDeg * DEG;
  return { x: Math.cos(h), y: -Math.sin(h) };
}

/** Wheel ground speeds in cm/s. MOTOR-A drives the left wheel and MOTOR-B the right wheel. */
export function wheelSpeedsCmS(motorA: number, motorB: number, tuning: RoverTuning): { left: number; right: number } {
  const power = (p: number) => (Number.isFinite(p) ? clamp(p, -100, 100) : 0);
  return {
    left: (power(motorA) / 100) * tuning.maxSpeedCmS,
    right: (power(motorB) / 100) * tuning.maxSpeedCmS,
  };
}

/**
 * Differential-drive step. Returns the pose the car WOULD reach after `dt` seconds; collisions are resolved
 * separately (see `collide.ts`). The left wheel faster than the right turns the car to the right (clockwise).
 */
export function stepCar(car: Pose, motorA: number, motorB: number, dt: number, tuning: RoverTuning): Pose {
  if (!Number.isFinite(dt) || dt <= 0) return { ...car };
  const { left, right } = wheelSpeedsCmS(motorA, motorB, tuning);
  const v = (left + right) / 2;
  const omegaDegS = ((left - right) / tuning.trackWidthCm) / DEG;
  // Integrate along the mid-point heading so arcs stay accurate at large time steps.
  const mid = forwardVector(car.headingDeg + (omegaDegS * dt) / 2);
  return {
    x: car.x + mid.x * v * dt,
    y: car.y + mid.y * v * dt,
    headingDeg: normalizeDeg(car.headingDeg + omegaDegS * dt),
  };
}

/** Names the motion the way the `snaplab_drive_motors` block does (used for the telemetry `drive` field). */
export function classifyDrive(motorA: number, motorB: number): DriveLabel {
  const a = Number.isFinite(motorA) ? motorA : 0;
  const b = Number.isFinite(motorB) ? motorB : 0;
  if (Math.abs(a) < 1 && Math.abs(b) < 1) return "STOP";
  const sum = a + b;
  const diff = a - b;
  if (Math.abs(diff) > Math.abs(sum)) return diff > 0 ? "RIGHT" : "LEFT";
  return sum >= 0 ? "FORWARD" : "BACKWARD";
}
