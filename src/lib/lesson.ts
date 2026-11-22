/** State of the student's work, shared by the UI and the /api/tutor route. */

/** The lesson steps, in the order students meet them (`intro` first, `sim` last). */
export type WorkspaceTab = "intro" | "lego3d" | "wiring" | "blockly" | "sim";

export interface BlockParam {
  type: string;
  field: string;
  value: string | number;
}

export interface BlocklySummary {
  blockCount: number;
  /** Block type -> how many were used. */
  types: Record<string, number>;
  params: BlockParam[];
}

/** One telemetry frame produced by a simulation: the same JSON fields a real board sends. */
export type SimTelemetry = Record<string, number | string>;

export type SimOutcome = "passed" | "crashed";

export interface LessonState {
  lessonId: string;
  tab: WorkspaceTab;
  hardwareConnected: boolean;
  sim: { thresholdCm: number; outcome: SimOutcome | null } | null;
  legoStep: number | null;
  blocks: BlocklySummary | null;
  /** Set by the lesson evaluator: the win condition has been met. */
  completed: boolean;
  /** Evaluator progress, 0..1. */
  progress: number;
}

export type TutorTrigger = "hint" | "check" | "chat";

export interface TutorRequest {
  trigger: TutorTrigger;
  state: LessonState;
  /** Free text from the student (only for trigger "chat"). */
  message?: string;
  /** How many hints were already given: lets the tutor vary its question. */
  attempt: number;
}

export interface TutorResponse {
  reply: string;
  source: "ai" | "rules";
}

export function emptyLessonState(lessonId: string, tab: WorkspaceTab): LessonState {
  return { lessonId, tab, hardwareConnected: false, sim: null, legoStep: null, blocks: null, completed: false, progress: 0 };
}
