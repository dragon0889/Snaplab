"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { WinCondition } from "@/lib/lessons-data/curriculum";
import { evaluateWinCondition } from "@/lib/evaluator/evaluate";
import { clearCompletion, readCompletions, saveCompletion } from "@/lib/evaluator/storage";
import type { EvalResult, TelemetryFrame } from "@/lib/evaluator/types";

async function celebrate() {
  if (typeof window === "undefined") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  const { default: confetti } = await import("canvas-confetti");
  const burst = (originX: number) =>
    confetti({ particleCount: 90, spread: 75, startVelocity: 45, origin: { x: originX, y: 0.7 }, colors: ["#ffc83d", "#3b9eff", "#2fd6a0", "#ff6b6b", "#ff8fd0"] });
  burst(0.2);
  burst(0.8);
}

export interface UseLessonEvaluator {
  result: EvalResult;
  /** Persisted: stays true across reloads once the student has passed. */
  completed: boolean;
  completedAt: number | null;
  /** True only in the render where the lesson was just passed. */
  justCompleted: boolean;
  /** Forget the saved completion (to replay the lesson). */
  resetCompletion: () => void;
}

/**
 * Grades any lesson from its `winCondition` and the telemetry history.
 * When the condition is met it fires confetti once and saves completion to localStorage.
 */
export function useLessonEvaluator(
  winCondition: WinCondition,
  telemetryHistory: TelemetryFrame[],
  options: { lessonId: string },
): UseLessonEvaluator {
  const { lessonId } = options;
  const result = useMemo(() => evaluateWinCondition(winCondition, telemetryHistory), [winCondition, telemetryHistory]);
  const [completedAt, setCompletedAt] = useState<number | null>(null);
  const [justCompleted, setJustCompleted] = useState(false);
  const completedRef = useRef(false);
  completedRef.current = completedAt !== null;

  // Load saved completion (client only, avoids hydration mismatch).
  useEffect(() => {
    const saved = readCompletions()[lessonId];
    setCompletedAt(saved?.completedAt ?? null);
    setJustCompleted(false);
  }, [lessonId]);

  useEffect(() => {
    if (result.status !== "passed" || completedRef.current) return;
    const record = saveCompletion(lessonId);
    setCompletedAt(record.completedAt);
    setJustCompleted(true);
    void celebrate();
  }, [result.status, lessonId]);

  const resetCompletion = useCallback(() => {
    clearCompletion(lessonId);
    setCompletedAt(null);
    setJustCompleted(false);
  }, [lessonId]);

  return { result, completed: completedAt !== null, completedAt, justCompleted, resetCompletion };
}
