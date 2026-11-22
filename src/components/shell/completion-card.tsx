"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { PartyPopper, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Floats over the simulation when the lesson is passed: a clear moment of celebration, then a choice. */
export function CompletionCard({
  nextHref,
  nextLabel,
  onRetry,
}: {
  /** Link to the next lesson, or null on the last one (then the card points back to the list). */
  nextHref: string | null;
  nextLabel: string | null;
  onRetry: () => void;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center p-6">
      <motion.div
        role="dialog"
        aria-label="Hoàn thành bài học"
        initial={{ opacity: 0, scale: 0.9, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 24 }}
        className="pointer-events-auto flex max-w-sm flex-col items-center gap-4 rounded-card border border-line bg-surface p-6 text-center shadow-float"
      >
        <span className="grid h-14 w-14 place-items-center rounded-full bg-go text-white">
          <PartyPopper className="h-7 w-7" aria-hidden />
        </span>
        <div>
          <p className="font-display text-3xl font-extrabold leading-tight">Hoàn thành!</p>
          <p className="mt-1 text-[15px] font-medium text-ink-soft">Con làm được rồi, giỏi quá!</p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="soft" size="lg" onClick={onRetry}>
            <RotateCcw className="h-5 w-5" aria-hidden /> Làm lại
          </Button>
          <Button variant="solid" size="lg" asChild className="whitespace-nowrap">
            <Link href={nextHref ?? "/lessons"}>{nextHref ? nextLabel ?? "Bài tiếp" : "Về danh sách"}</Link>
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
