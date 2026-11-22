import { classifyDrive } from "./kinematics";
import { sonarCm } from "./sonar";
import type { RoverOutputs, RoverWorld } from "./types";

/** Same shape as `SimTelemetry` in `src/lib/lesson.ts` (kept local so this folder has no app imports). */
export type RoverFrame = Record<string, number | string>;

const round1 = (v: number) => Math.round(v * 10) / 10;

/**
 * Builds one telemetry frame (call it every 100 ms). Field names match what the real car sends, plus the
 * simulation-only `rover_x`, `rover_y`, `heading_deg` and `collisions`. Each call reports at most one queued
 * event in `event`, oldest first, so no event is lost between frames.
 */
export function roverFrame(world: RoverWorld, outputs: RoverOutputs): RoverFrame {
  const frame: RoverFrame = {
    device: "sim",
    ultrasonic_cm: round1(sonarCm(world, world.servoDeg)),
    drive: classifyDrive(outputs.motorA, outputs.motorB),
    servo_deg: Math.round(world.servoDeg),
    motor_a: Math.round(outputs.motorA),
    motor_b: Math.round(outputs.motorB),
    rover_x: round1(world.car.x),
    rover_y: round1(world.car.y),
    heading_deg: Math.round(world.car.headingDeg),
    collisions: world.stats.collisions,
  };
  const event = world.eventQueue.shift();
  if (event) frame.event = event;
  return frame;
}
