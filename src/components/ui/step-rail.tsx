"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type StepState = "done" | "current" | "todo";

export interface RailStep {
  id: string;
  label: string;
  state: StepState;
  /** Small second line under the label, e.g. "Sắp có" for a step whose content is not built yet. */
  note?: string;
}

/** The lesson journey: numbered steps along the bottom of the stage. Scrolls sideways on narrow screens. */
export function StepRail({ steps, onSelect }: { steps: RailStep[]; onSelect: (id: string) => void }) {
  return (
    <nav aria-label="Các bước của bài học" className="overflow-x-auto">
      <ol className="flex min-w-max gap-2 lg:min-w-0">
        {steps.map((step, i) => (
          <li key={step.id} className="flex-1">
            <button
              type="button"
              onClick={() => onSelect(step.id)}
              aria-current={step.state === "current" ? "step" : undefined}
              className={cn(
                "flex min-h-12 w-full cursor-pointer items-center gap-2 rounded-control border px-3 text-left text-sm font-bold transition active:scale-95",
                step.state === "current" && "border-ink bg-ink text-white shadow-card",
                step.state === "done" && "border-line bg-surface text-ink",
                step.state === "todo" && "border-line bg-surface text-ink-soft hover:bg-sunken",
              )}
            >
              <span
                className={cn(
                  "grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-extrabold",
                  step.state === "current" && "bg-sun text-ink",
                  step.state === "done" && "bg-go text-white",
                  step.state === "todo" && "bg-sunken text-ink-soft",
                )}
              >
                {step.state === "done" ? <Check className="h-3.5 w-3.5" aria-hidden /> : i + 1}
              </span>
              <span className="min-w-0">
                <span className="block truncate">{step.label}</span>
                {step.note && <span className="block truncate text-[11px] font-semibold opacity-70">{step.note}</span>}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
