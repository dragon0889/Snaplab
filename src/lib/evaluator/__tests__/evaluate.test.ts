import { describe, expect, it } from "vitest";
import { evaluateWinCondition, isGradedFrame } from "../evaluate";
import { getLessonById, type WinCondition } from "@/lib/lessons-data/curriculum";
import type { FrameSource, TelemetryFrame } from "../types";

let nextId = 0;
const frame = (data: Record<string, unknown>, source?: FrameSource): TelemetryFrame => {
  nextId += 1;
  return { id: nextId, receivedAt: nextId * 100, raw: JSON.stringify(data), data, source };
};

/** Lesson 11 style: count the dodges. */
const DODGES: WinCondition = {
  type: "hardware_telemetry",
  descriptionVi: "Né 3 lần",
  targetMetric: "obstacles_avoided_count",
  operator: ">=",
  targetValue: 3,
};

const SEQUENCE: WinCondition = {
  type: "sequence_complete",
  descriptionVi: "Tiến rồi rẽ trái",
  targetMetric: "drive_sequence",
  operator: "sequence",
  targetValue: ["FORWARD", "TURN_LEFT"],
};

describe("isGradedFrame", () => {
  it("skips only the sample program", () => {
    expect(isGradedFrame(frame({}, "demo"))).toBe(false);
    expect(isGradedFrame(frame({}, "student"))).toBe(true);
    expect(isGradedFrame(frame({}, "hardware"))).toBe(true);
    expect(isGradedFrame(frame({}))).toBe(true); // a real board sends no source
  });
});

describe("evaluateWinCondition ignores frames of the sample program (A2)", () => {
  it("does not pass a lesson from demo frames, however good they look", () => {
    const history = [frame({ obstacles_avoided_count: 1 }, "demo"), frame({ obstacles_avoided_count: 9 }, "demo")];
    const result = evaluateWinCondition(DODGES, history);
    expect(result.status).not.toBe("passed");
    expect(result.status).toBe("waiting");
    expect(result.progress).toBe(0);
    expect(result.value).toBeNull();
  });

  it("tells the student that the sample is only for watching", () => {
    const result = evaluateWinCondition(DODGES, [frame({ obstacles_avoided_count: 3 }, "demo")]);
    expect(result.messageVi).toContain("chương trình mẫu");
  });

  it("keeps the usual 'no data' message when there are no frames at all", () => {
    const result = evaluateWinCondition(DODGES, []);
    expect(result.status).toBe("waiting");
    expect(result.messageVi).not.toContain("chương trình mẫu");
  });

  it("passes from the student's own frames", () => {
    const result = evaluateWinCondition(DODGES, [frame({ obstacles_avoided_count: 2 }, "student"), frame({ obstacles_avoided_count: 3 }, "student")]);
    expect(result.status).toBe("passed");
    expect(result.progress).toBe(1);
  });

  it("passes from board frames, with or without a source", () => {
    expect(evaluateWinCondition(DODGES, [frame({ obstacles_avoided_count: 3 }, "hardware")]).status).toBe("passed");
    expect(evaluateWinCondition(DODGES, [frame({ obstacles_avoided_count: 3 })]).status).toBe("passed");
  });

  it("grades only the student's frames when both kinds are present", () => {
    const history = [
      frame({ obstacles_avoided_count: 9 }, "demo"),
      frame({ obstacles_avoided_count: 1 }, "student"),
      frame({ obstacles_avoided_count: 9 }, "demo"),
    ];
    const result = evaluateWinCondition(DODGES, history);
    expect(result.status).toBe("in_progress");
    expect(result.value).toBe(1);
    expect(result.progress).toBeCloseTo(1 / 3);
  });

  it("ignores demo events when matching an ordered sequence", () => {
    const demoOnly = [frame({ event: "FORWARD" }, "demo"), frame({ event: "TURN_LEFT" }, "demo")];
    expect(evaluateWinCondition(SEQUENCE, demoOnly).status).not.toBe("passed");

    const mixed = [frame({ event: "FORWARD" }, "demo"), frame({ event: "TURN_LEFT" }, "demo"), frame({ event: "FORWARD" }, "student")];
    const partial = evaluateWinCondition(SEQUENCE, mixed);
    expect(partial.status).toBe("in_progress");
    expect(partial.steps.map((s) => s.done)).toEqual([true, false]);

    const student = [frame({ event: "FORWARD" }, "student"), frame({ event: "TURN_LEFT" }, "student")];
    expect(evaluateWinCondition(SEQUENCE, student).status).toBe("passed");
  });

  it("holds for the real lesson 11 condition too", () => {
    const lesson = getLessonById("lesson-11");
    expect(lesson).toBeDefined();
    const win = lesson!.winCondition;
    const demo = [frame({ obstacles_avoided_count: 9, collision_count: 0 }, "demo")];
    expect(evaluateWinCondition(win, demo).status).not.toBe("passed");
    const student = [frame({ obstacles_avoided_count: 3, collision_count: 0 }, "student")];
    expect(evaluateWinCondition(win, student).status).toBe("passed");
  });
});
