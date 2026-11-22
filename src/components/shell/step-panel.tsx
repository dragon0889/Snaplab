"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Clock, ListChecks, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionLabel } from "@/components/ui/section-label";
import { Surface } from "@/components/ui/surface";
import { ProgressCard } from "@/components/interactive/ProgressCard";
import type { UseLessonEvaluator } from "@/hooks/use-lesson-evaluator";
import type { LessonConfig } from "@/lib/lessons-data/curriculum";
import type { StepInfo } from "@/lib/lesson-steps";

/** The right-hand panel: what to do in the current step, the goal, and the way back and forward. */
export function StepPanel({
  lesson,
  step,
  index,
  total,
  evaluation,
  tutorUnread,
  onOpenTutor,
  onBack,
  onNext,
  wiringConfirmed,
  onWiringConfirm,
  onReset,
}: {
  lesson: LessonConfig;
  step: StepInfo;
  index: number;
  total: number;
  evaluation: UseLessonEvaluator;
  tutorUnread: boolean;
  onOpenTutor: () => void;
  onBack: (() => void) | null;
  onNext: (() => void) | null;
  wiringConfirmed: boolean;
  onWiringConfirm: () => void;
  /** "Làm lại bài này": clears progress, frames, steps and stops the running program. */
  onReset: () => void;
}) {
  return (
    <Surface as="section" aria-label="Hướng dẫn" className="flex h-full flex-col gap-5 overflow-y-auto p-5 lg:p-6">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[.12em] text-ink-soft">
          Bước {index + 1}/{total} · {step.label}
        </p>
        <h2 className="mt-2 font-display text-[28px] font-extrabold leading-[1.2]">{step.title}</h2>
        <p className="mt-2 text-[15px] font-medium text-ink-soft">{step.hintVi}</p>
      </div>

      <section className="flex flex-col gap-3">
        <SectionLabel>Mục tiêu</SectionLabel>
        <p className="flex items-start gap-2 text-[15px] font-bold">
          <ListChecks className="mt-0.5 h-5 w-5 shrink-0" aria-hidden /> {lesson.winCondition.descriptionVi}
        </p>
        <p className="flex items-center gap-1.5 text-xs font-medium text-ink-soft">
          <Clock className="h-3.5 w-3.5" aria-hidden /> Bài {lesson.lessonNumber} · khoảng {lesson.estimatedMinutes} phút
        </p>
        <ProgressCard evaluation={evaluation} onReset={onReset} />
      </section>

      {step.id === "wiring" && (
        <section className="flex flex-col gap-3">
          <SectionLabel>Xác nhận</SectionLabel>
          <Button variant={wiringConfirmed ? "soft" : "solid"} size="lg" onClick={onWiringConfirm} aria-pressed={wiringConfirmed}>
            {wiringConfirmed ? (
              <>
                <Check className="h-5 w-5 text-go" aria-hidden /> Con đã nối xong
              </>
            ) : (
              "Con đã nối xong"
            )}
          </Button>
        </section>
      )}

      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-2">
        <Button variant="soft" size="lg" onClick={onOpenTutor} className="relative whitespace-nowrap">
          <MessageCircle className="h-5 w-5" aria-hidden /> Hỏi bạn đồng hành
          {tutorUnread && (
            <span role="status" className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full border-2 border-surface bg-stop">
              <span className="sr-only">Có tin nhắn mới</span>
            </span>
          )}
        </Button>
        <div className="flex gap-2">
          {onBack && (
            <Button variant="soft" size="lg" onClick={onBack} className="whitespace-nowrap">
              <ArrowLeft className="h-5 w-5" aria-hidden /> Quay lại
            </Button>
          )}
          {onNext ? (
            <Button variant="solid" size="lg" onClick={onNext} className="whitespace-nowrap">
              Tiếp <ArrowRight className="h-5 w-5" aria-hidden />
            </Button>
          ) : (
            <Button variant="solid" size="lg" asChild className="whitespace-nowrap">
              <Link href="/lessons">Về danh sách</Link>
            </Button>
          )}
        </div>
      </div>
    </Surface>
  );
}
