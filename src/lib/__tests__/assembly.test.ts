import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SNAPLAB_CURRICULUM, type LessonConfig } from "@/lib/lessons-data/curriculum";

type Checked = Pick<LessonConfig, "id" | "requiresLegoAssembly" | "legoStepCount" | "assembly">;

/**
 * What must hold for a lesson that declares an `assembly` (docs/ldraw-pipeline.md): both files are packed under
 * public/models, and the packed step count equals the lesson's `legoStepCount`. Returns the problems found.
 */
function assemblyProblems(lesson: Checked, publicDir: string): string[] {
  if (!lesson.assembly) return [];
  const problems: string[] = [];
  const { model, steps } = lesson.assembly;
  const file = (url: string) => join(publicDir, url.replace(/^\//, ""));

  if (!lesson.requiresLegoAssembly) problems.push("has an assembly but requiresLegoAssembly is false");
  for (const url of [model, steps]) {
    if (!url.startsWith("/models/")) problems.push(`${url} is not under /models/ (the CSP only allows our own files)`);
    else if (!existsSync(file(url))) problems.push(`${url} does not exist (run npm run models:pack)`);
  }
  if (existsSync(file(steps))) {
    const parsed = JSON.parse(readFileSync(file(steps), "utf8")) as { stepCount: number; steps: unknown[] };
    if (parsed.stepCount !== parsed.steps.length) problems.push(`steps.json says ${parsed.stepCount} steps but lists ${parsed.steps.length}`);
    if (lesson.legoStepCount === undefined) problems.push("steps.json exists but the lesson has no legoStepCount");
    else if (parsed.stepCount !== lesson.legoStepCount) {
      problems.push(`steps.json has ${parsed.stepCount} steps but legoStepCount is ${lesson.legoStepCount}`);
    }
  }
  return problems;
}

describe("every lesson with an assembly is packed and consistent (L1)", () => {
  const publicDir = join(process.cwd(), "public");

  it("holds for the real curriculum", () => {
    for (const lesson of SNAPLAB_CURRICULUM) {
      expect(assemblyProblems(lesson, publicDir), lesson.id).toEqual([]);
    }
  });

  it("lessons that build something declare how many steps it has", () => {
    const missing = SNAPLAB_CURRICULUM.filter((l) => l.requiresLegoAssembly && !(l.legoStepCount && l.legoStepCount > 0)).map((l) => l.id);
    expect(missing).toEqual([]);
  });
});

describe("the check itself catches broken assemblies", () => {
  const publicWith = (stepsJson?: object, withModel = true) => {
    const dir = mkdtempSync(join(tmpdir(), "assembly-"));
    mkdirSync(join(dir, "models"), { recursive: true });
    if (withModel) writeFileSync(join(dir, "models", "x.mpd"), "0 FILE x.mpd\n");
    if (stepsJson) writeFileSync(join(dir, "models", "x.steps.json"), JSON.stringify(stepsJson));
    return dir;
  };
  const lesson = (over: Partial<Checked> = {}): Checked => ({
    id: "lesson-x",
    requiresLegoAssembly: true,
    legoStepCount: 4,
    assembly: { model: "/models/x.mpd", steps: "/models/x.steps.json" },
    ...over,
  });
  const stepsFile = (n: number) => ({ model: "x.mpd", stepCount: n, steps: Array.from({ length: n }, (_, i) => ({ step: i + 1 })) });

  it("accepts a consistent assembly and ignores lessons without one", () => {
    expect(assemblyProblems(lesson(), publicWith(stepsFile(4)))).toEqual([]);
    expect(assemblyProblems(lesson({ assembly: undefined }), publicWith())).toEqual([]);
  });

  it("flags a step count that differs from legoStepCount", () => {
    const problems = assemblyProblems(lesson({ legoStepCount: 5 }), publicWith(stepsFile(4)));
    expect(problems.join("\n")).toContain("4 steps but legoStepCount is 5");
  });

  it("flags a missing legoStepCount", () => {
    expect(assemblyProblems(lesson({ legoStepCount: undefined }), publicWith(stepsFile(4))).join("\n")).toContain("no legoStepCount");
  });

  it("flags files that were never packed", () => {
    const problems = assemblyProblems(lesson(), publicWith(undefined, false));
    expect(problems.join("\n")).toContain("/models/x.mpd does not exist");
    expect(problems.join("\n")).toContain("/models/x.steps.json does not exist");
  });

  it("flags a steps.json that contradicts itself", () => {
    const bad = { ...stepsFile(4), stepCount: 3 };
    expect(assemblyProblems(lesson({ legoStepCount: 3 }), publicWith(bad)).join("\n")).toContain("says 3 steps but lists 4");
  });

  it("flags URLs outside /models and a lesson that does not build anything", () => {
    const outside = lesson({ assembly: { model: "https://cdn.example.com/x.mpd", steps: "/models/x.steps.json" } });
    expect(assemblyProblems(outside, publicWith(stepsFile(4))).join("\n")).toContain("not under /models/");
    expect(assemblyProblems(lesson({ requiresLegoAssembly: false }), publicWith(stepsFile(4))).join("\n")).toContain("requiresLegoAssembly is false");
  });
});
