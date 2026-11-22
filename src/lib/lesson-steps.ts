import type { LessonConfig } from "@/lib/lessons-data/curriculum";
import type { WorkspaceTab } from "@/lib/lesson";

export interface StepInfo {
  id: WorkspaceTab;
  /** Short name on the step rail. */
  label: string;
  /** Heading of the right-hand panel. */
  title: string;
  /** One or two short sentences for the student (Vietnamese). */
  hintVi: string;
}

/** The steps of a lesson in the order a student does them: understand, build, wire, program, try. */
export function getSteps(lesson: LessonConfig): StepInfo[] {
  return [
    { id: "intro", label: "Hiểu", title: lesson.titleVi, hintVi: lesson.subtitleVi },
    ...(lesson.requiresLegoAssembly
      ? [{ id: "lego3d" as const, label: "Lắp 3D", title: "Lắp ráp 3D", hintVi: "Xoay mô hình rồi lắp từng bước theo hướng dẫn nhé!" }]
      : []),
    { id: "wiring", label: "Nối dây", title: "Nối dây vào mạch", hintVi: "Xem từng linh kiện cắm vào cổng nào trên mạch nhé!" },
    { id: "blockly", label: "Lập trình", title: "Lập trình khối", hintVi: "Kéo và ghép các khối lệnh để dạy mạch của con làm việc nhé!" },
    { id: "sim", label: "Chạy thử", title: "Chạy thử", hintVi: "Bấm chạy và quan sát xem chương trình của con hoạt động thế nào nhé!" },
  ];
}

const STEP_IDS: readonly WorkspaceTab[] = ["intro", "lego3d", "wiring", "blockly", "sim"];

/** Parses the `?step=` query value; anything unknown is ignored. */
export function parseStep(value: string | null | undefined): WorkspaceTab | null {
  return STEP_IDS.find((id) => id === value) ?? null;
}

/**
 * Lessons that still use the hand-built 3D viewer (`LegoViewer3D`) because their LDraw model is not ready.
 * Remove a lesson from this list once it has an `assembly`; delete the viewer when the list is empty.
 */
const LEGACY_VIEWER_LESSONS: ReadonlySet<string> = new Set(["lesson-05"]);

export function usesLegacyViewer(lesson: Pick<LessonConfig, "id">): boolean {
  return LEGACY_VIEWER_LESSONS.has(lesson.id);
}

/** True when the 3D step has real content (an LDraw model, or the old hand-built viewer); otherwise it is "coming soon". */
export function hasLegoModel(lesson: Pick<LessonConfig, "id" | "assembly">): boolean {
  return Boolean(lesson.assembly) || usesLegacyViewer(lesson);
}

/** What the student has actually done so far; each step reads only its own part. */
export interface StepProgress {
  visited: ReadonlySet<WorkspaceTab>;
  /** Furthest build step reached in the 3D assembly (0 = none). */
  legoStepReached: number;
  /** The student pressed "Con đã nối xong". */
  wiringConfirmed: boolean;
  blockCount: number;
  /** The student pressed "Kiểm tra" in the programming step. */
  blocksChecked: boolean;
  /** The evaluator passed on the student's own (or the board's) data, never on the sample program. */
  completed: boolean;
}

/** `soon`: the step exists but its content does not yet, so it can never be ticked. */
export type StepStatus = "done" | "todo" | "soon";

export function stepStatus(step: WorkspaceTab, lesson: Pick<LessonConfig, "id" | "legoStepCount" | "assembly">, p: StepProgress): StepStatus {
  switch (step) {
    case "intro":
      return p.visited.has("intro") ? "done" : "todo";
    case "lego3d": {
      if (!hasLegoModel(lesson)) return "soon";
      const last = lesson.legoStepCount ?? 0;
      return last > 0 && p.legoStepReached >= last ? "done" : "todo";
    }
    case "wiring":
      return p.wiringConfirmed ? "done" : "todo";
    case "blockly":
      return p.blocksChecked && p.blockCount >= 1 ? "done" : "todo";
    case "sim":
      return p.completed ? "done" : "todo";
  }
}
