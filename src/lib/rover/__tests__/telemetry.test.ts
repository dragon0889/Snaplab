import { describe, expect, it } from "vitest";
import { ARENAS } from "../arenas";
import { roverFrame } from "../telemetry";
import { emptyArena, makeWorld } from "./helpers";

const FORWARD = { motorA: 60, motorB: 60, servoDeg: 90 };

describe("roverFrame", () => {
  it("emits the documented JSON fields with plain number/string values", () => {
    const world = makeWorld(emptyArena(200, 300), { x: 100.04, y: 100.26, headingDeg: 34.6 });
    world.car = { x: 120.44, y: 80.26, headingDeg: 34.6 };
    const frame = roverFrame(world, { motorA: 60.4, motorB: -59.6, servoDeg: 90 });
    expect(Object.keys(frame).sort()).toEqual(
      ["collisions", "device", "drive", "heading_deg", "motor_a", "motor_b", "rover_x", "rover_y", "servo_deg", "ultrasonic_cm"],
    );
    expect(frame.device).toBe("sim");
    expect(frame.drive).toBe("RIGHT");
    expect(frame.rover_x).toBe(120.4);
    expect(frame.rover_y).toBe(80.3);
    expect(frame.heading_deg).toBe(35);
    expect(frame.motor_a).toBe(60);
    expect(frame.motor_b).toBe(-60);
    expect(frame.servo_deg).toBe(90);
    for (const value of Object.values(frame)) expect(["number", "string"]).toContain(typeof value);
    expect(JSON.parse(JSON.stringify(frame))).toEqual(frame);
  });

  it("reads the sonar through the actual servo angle", () => {
    const world = makeWorld(emptyArena(200, 300), { x: 100, y: 100, headingDeg: 0 });
    expect(roverFrame(world, FORWARD).ultrasonic_cm).toBe(189);
    world.servoDeg = 0; // looking right
    const frame = roverFrame(world, FORWARD);
    expect(frame.ultrasonic_cm).toBe(100);
    expect(frame.servo_deg).toBe(0);
  });

  it("reports queued events one per frame, oldest first, and omits the field when empty", () => {
    const world = makeWorld(ARENAS["straight-wall"]);
    world.eventQueue.push("COLLISION", "STUCK");
    expect(roverFrame(world, FORWARD).event).toBe("COLLISION");
    expect(roverFrame(world, FORWARD).event).toBe("STUCK");
    expect("event" in roverFrame(world, FORWARD)).toBe(false);
  });

  it("carries the collision counter", () => {
    const world = makeWorld(ARENAS["straight-wall"]);
    world.stats.collisions = 3;
    expect(roverFrame(world, FORWARD).collisions).toBe(3);
  });
});
