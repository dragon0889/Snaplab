import type { FrameSource, TelemetryFrame } from "@/lib/hardware";

export type { FrameSource, TelemetryFrame };

export type EvalStatus = "waiting" | "in_progress" | "passed";

export interface EvalStep {
  token: string;
  label: string;
  done: boolean;
}

export interface EvalResult {
  status: EvalStatus;
  /** 0..1, for the progress bar. */
  progress: number;
  /** Ordered checklist: only filled for sequence-style conditions. */
  steps: EvalStep[];
  /** Current measured value for numeric conditions. */
  value: number | null;
  /** False when nothing in the history can ever answer this condition (e.g. firmware never sends the metric). */
  measurable: boolean;
  /** Short Vietnamese status line for the student. */
  messageVi: string;
}
