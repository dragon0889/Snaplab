import { describe, expect, it } from "vitest";
import { angleDiffDeg, classifyDrive, forwardVector, normalizeDeg, stepCar, wheelSpeedsCmS } from "../kinematics";
import { getTuning } from "../tuning";

const tuning = getTuning("esp32"); // 42 cm/s at 100 %, track 18 cm

describe("angles", () => {
  it("wraps headings into [0, 360)", () => {
    expect(normalizeDeg(-10)).toBe(350);
    expect(normalizeDeg(370)).toBe(10);
    expect(normalizeDeg(360)).toBe(0);
  });

  it("returns the signed shortest difference", () => {
    expect(angleDiffDeg(350, 10)).toBeCloseTo(20);
    expect(angleDiffDeg(10, 350)).toBeCloseTo(-20);
    expect(angleDiffDeg(0, 180)).toBeCloseTo(180);
  });

  it("uses compass headings: 0 is up (+y) and 90 is right (+x)", () => {
    const up = forwardVector(0);
    const right = forwardVector(90);
    expect(up.x).toBeCloseTo(0);
    expect(up.y).toBeCloseTo(1);
    expect(right.x).toBeCloseTo(1);
    expect(right.y).toBeCloseTo(0);
  });
});

describe("wheelSpeedsCmS", () => {
  it("maps MOTOR-A to the left wheel and MOTOR-B to the right wheel", () => {
    const { left, right } = wheelSpeedsCmS(100, 50, tuning);
    expect(left).toBeCloseTo(42);
    expect(right).toBeCloseTo(21);
  });

  it("clamps power to +/-100 and ignores non-finite values", () => {
    expect(wheelSpeedsCmS(500, -500, tuning)).toEqual({ left: 42, right: -42 });
    expect(wheelSpeedsCmS(Number.NaN, Infinity, tuning)).toEqual({ left: 0, right: 0 });
  });
});

describe("stepCar", () => {
  it("drives straight along the heading", () => {
    const up = stepCar({ x: 50, y: 50, headingDeg: 0 }, 100, 100, 1, tuning);
    expect(up.x).toBeCloseTo(50);
    expect(up.y).toBeCloseTo(92);
    expect(up.headingDeg).toBeCloseTo(0);

    const east = stepCar({ x: 50, y: 50, headingDeg: 90 }, 100, 100, 1, tuning);
    expect(east.x).toBeCloseTo(92);
    expect(east.y).toBeCloseTo(50);
  });

  it("scales speed with motor power (60 % = 25.2 cm/s)", () => {
    const p = stepCar({ x: 0, y: 0, headingDeg: 0 }, 60, 60, 1, tuning);
    expect(p.y).toBeCloseTo(25.2);
  });

  it("drives backward with negative power", () => {
    const p = stepCar({ x: 50, y: 50, headingDeg: 0 }, -50, -50, 1, tuning);
    expect(p.y).toBeCloseTo(29);
  });

  it("spins on the spot: RIGHT turns clockwise, LEFT counter-clockwise", () => {
    // (25.2 + 25.2) / 18 rad/s = 160.43 deg/s
    const right = stepCar({ x: 50, y: 50, headingDeg: 0 }, 60, -60, 0.1, tuning);
    expect(right.headingDeg).toBeCloseTo(16.04, 1);
    expect(right.x).toBeCloseTo(50);
    expect(right.y).toBeCloseTo(50);

    const left = stepCar({ x: 50, y: 50, headingDeg: 0 }, -60, 60, 0.1, tuning);
    expect(left.headingDeg).toBeCloseTo(360 - 16.04, 1);
  });

  it("curves toward the slower wheel", () => {
    const p = stepCar({ x: 50, y: 50, headingDeg: 0 }, 80, 40, 0.5, tuning);
    expect(p.headingDeg).toBeGreaterThan(0); // left wheel faster -> turns right
    expect(p.x).toBeGreaterThan(50);
    expect(p.y).toBeGreaterThan(50);
  });

  it("returns an unchanged copy for dt <= 0 or non-finite dt", () => {
    const start = { x: 10, y: 20, headingDeg: 30 };
    for (const dt of [0, -1, Number.NaN]) {
      const p = stepCar(start, 100, 100, dt, tuning);
      expect(p).toEqual(start);
      expect(p).not.toBe(start);
    }
  });
});

describe("classifyDrive", () => {
  it("matches the labels of the drive block", () => {
    expect(classifyDrive(60, 60)).toBe("FORWARD");
    expect(classifyDrive(-60, -60)).toBe("BACKWARD");
    expect(classifyDrive(-60, 60)).toBe("LEFT");
    expect(classifyDrive(60, -60)).toBe("RIGHT");
    expect(classifyDrive(0, 0)).toBe("STOP");
  });

  it("handles mixed and tiny values", () => {
    expect(classifyDrive(60, 0)).toBe("FORWARD");
    expect(classifyDrive(60, -20)).toBe("RIGHT");
    expect(classifyDrive(0.4, 0.3)).toBe("STOP");
    expect(classifyDrive(Number.NaN, 0)).toBe("STOP");
  });
});
