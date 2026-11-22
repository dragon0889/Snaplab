import { describe, expect, it } from "vitest";
import { getLessonById } from "@/lib/lessons-data/curriculum";
import { getSteps, hasLegoModel, parseStep, stepStatus, type StepProgress } from "../lesson-steps";

const lesson = (id: string) => {
  const found = getLessonById(id);
  if (!found) throw new Error(`missing ${id}`);
  return found;
};
const LESSON_5 = lesson("lesson-05"); // the only lesson with a real 3D build
const LESSON_11 = lesson("lesson-11"); // its 3D step is a placeholder

const NOTHING: StepProgress = {
  visited: new Set(),
  legoStepReached: 0,
  wiringConfirmed: false,
  blockCount: 0,
  blocksChecked: false,
  completed: false,
};
const progress = (p: Partial<StepProgress>): StepProgress => ({ ...NOTHING, ...p });

describe("stepStatus: each step ticks only for its own condition (A3)", () => {
  it("Hiểu: ticked once seen", () => {
    expect(stepStatus("intro", LESSON_11, NOTHING)).toBe("todo");
    expect(stepStatus("intro", LESSON_11, progress({ visited: new Set(["intro"]) }))).toBe("done");
  });

  it("Lắp 3D: needs the last build step of a real model", () => {
    expect(LESSON_5.legoStepCount).toBeGreaterThan(1);
    const last = LESSON_5.legoStepCount!;
    expect(stepStatus("lego3d", LESSON_5, NOTHING)).toBe("todo");
    expect(stepStatus("lego3d", LESSON_5, progress({ legoStepReached: last - 1 }))).toBe("todo");
    expect(stepStatus("lego3d", LESSON_5, progress({ legoStepReached: last }))).toBe("done");
  });

  it("Lắp 3D: a placeholder model is 'soon' and never ticked, whatever else happens", () => {
    expect(hasLegoModel(LESSON_11)).toBe(false);
    expect(stepStatus("lego3d", LESSON_11, NOTHING)).toBe("soon");
    const everything = progress({ visited: new Set(["intro", "lego3d", "wiring", "blockly", "sim"]), legoStepReached: 99, completed: true });
    expect(stepStatus("lego3d", LESSON_11, everything)).toBe("soon");
  });

  it("Nối dây: needs the confirmation button, not just a visit", () => {
    expect(stepStatus("wiring", LESSON_11, progress({ visited: new Set(["wiring"]) }))).toBe("todo");
    expect(stepStatus("wiring", LESSON_11, progress({ wiringConfirmed: true }))).toBe("done");
  });

  it("Lập trình: needs at least one block AND a press on Kiểm tra", () => {
    expect(stepStatus("blockly", LESSON_11, progress({ blockCount: 3 }))).toBe("todo"); // not checked yet
    expect(stepStatus("blockly", LESSON_11, progress({ blocksChecked: true, blockCount: 0 }))).toBe("todo"); // empty
    expect(stepStatus("blockly", LESSON_11, progress({ blocksChecked: true, blockCount: 1 }))).toBe("done");
  });

  it("Chạy thử: only when the evaluator has passed", () => {
    expect(stepStatus("sim", LESSON_11, progress({ visited: new Set(["sim"]) }))).toBe("todo");
    expect(stepStatus("sim", LESSON_11, progress({ completed: true }))).toBe("done");
  });

  it("finishing the lesson from step 1 does not tick the steps the student skipped", () => {
    const passedEarly = progress({ visited: new Set(["intro"]), completed: true });
    expect(stepStatus("intro", LESSON_11, passedEarly)).toBe("done");
    expect(stepStatus("sim", LESSON_11, passedEarly)).toBe("done");
    expect(stepStatus("wiring", LESSON_11, passedEarly)).toBe("todo");
    expect(stepStatus("blockly", LESSON_11, passedEarly)).toBe("todo");
    expect(stepStatus("lego3d", LESSON_11, passedEarly)).toBe("soon");
  });

  it("visiting a step does not tick it (except Hiểu)", () => {
    const visitedAll = progress({ visited: new Set(["intro", "lego3d", "wiring", "blockly", "sim"]) });
    expect(stepStatus("wiring", LESSON_11, visitedAll)).toBe("todo");
    expect(stepStatus("blockly", LESSON_11, visitedAll)).toBe("todo");
    expect(stepStatus("sim", LESSON_11, visitedAll)).toBe("todo");
    expect(stepStatus("lego3d", LESSON_5, visitedAll)).toBe("todo");
  });
});

describe("getSteps and parseStep", () => {
  it("lists the steps in learning order, ending with the trial run", () => {
    const ids = getSteps(LESSON_5).map((s) => s.id);
    expect(ids[0]).toBe("intro");
    expect(ids[ids.length - 1]).toBe("sim");
    expect(ids.indexOf("wiring")).toBeLessThan(ids.indexOf("blockly"));
    expect(ids.indexOf("blockly")).toBeLessThan(ids.indexOf("sim"));
  });

  it("accepts known step ids from the query string and nothing else", () => {
    expect(parseStep("sim")).toBe("sim");
    expect(parseStep("intro")).toBe("intro");
    expect(parseStep("nope")).toBeNull();
    expect(parseStep(null)).toBeNull();
    expect(parseStep(undefined)).toBeNull();
  });
});
