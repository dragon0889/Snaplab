"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Circle, PartyPopper, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UseLessonEvaluator } from "@/hooks/use-lesson-evaluator";
import { readCompletions } from "@/lib/evaluator/storage";

export function ProgressCard({ evaluation, onReset }: { evaluation: UseLessonEvaluator; onReset?: () => void }) {
  const { result, completed, resetCompletion } = evaluation;
  const percent = completed ? 100 : Math.round(result.progress * 100);

  return (
    <div className="rounded-card border border-line bg-sunken p-4" aria-live="polite">
      <div className="flex items-end justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-bold">
          {completed ? <PartyPopper className="h-4 w-4 text-go" aria-hidden /> : <Circle className="h-4 w-4 text-ink-soft" aria-hidden />}
          {completed ? "Đã hoàn thành bài này!" : "Tiến độ bài học"}
        </p>
        <span className="flex items-baseline gap-0.5">
          <span className="font-display text-3xl font-extrabold leading-none tabular-nums">{percent}</span>
          <span className="text-xs font-bold text-ink-soft">%</span>
        </span>
      </div>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
        <motion.div
          className={cn("h-full rounded-full", completed ? "bg-go" : "bg-ink")}
          initial={false}
          animate={{ width: `${percent}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 20 }}
        />
      </div>

      {result.steps.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1.5">
          {result.steps.map((step) => {
            const done = completed || step.done;
            return (
              <li key={step.token} className={cn("flex items-center gap-2 text-sm", done ? "font-bold" : "text-ink-soft")}>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={String(done)}
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 20 }}
                    className={cn("grid h-5 w-5 place-items-center rounded-full", done ? "bg-go text-white" : "bg-line")}
                  >
                    {done && <Check className="h-3 w-3" aria-hidden />}
                  </motion.span>
                </AnimatePresence>
                {step.label}
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-3 text-xs text-ink-soft">{completed ? "Con có thể thử lại để luyện tập thêm nhé!" : result.messageVi}</p>
      {completed && (
        <button
          onClick={onReset ?? resetCompletion}
          className="mt-2 flex min-h-8 cursor-pointer items-center gap-1 text-xs font-bold text-ink underline-offset-2 hover:underline"
        >
          <RotateCcw className="h-3 w-3" aria-hidden /> Làm lại bài này
        </button>
      )}
    </div>
  );
}

/** Small tick shown on the lesson list for lessons the student already finished. */
export function CompletionBadge({ lessonId }: { lessonId: string }) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    const sync = () => setDone(Boolean(readCompletions()[lessonId]));
    sync();
    window.addEventListener("snaplab:completions", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("snaplab:completions", sync);
      window.removeEventListener("storage", sync);
    };
  }, [lessonId]);
  if (!done) return null;
  return (
    <span className="ml-auto flex items-center gap-1 rounded-2xl bg-mint/30 px-2 py-0.5 text-xs font-extrabold">
      <Check className="h-3 w-3" aria-hidden /> Đã xong
    </span>
  );
}
