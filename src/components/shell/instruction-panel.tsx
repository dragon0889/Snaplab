import { Clock, Sparkles, Target } from "lucide-react";
import { TutorChat, type TutorEvent } from "@/components/interactive/TutorChat";
import type { LessonConfig } from "@/lib/lessons-data/curriculum";
import type { LessonState } from "@/lib/lesson";
import type { UseLessonEvaluator } from "@/hooks/use-lesson-evaluator";
import { ProgressCard } from "@/components/interactive/ProgressCard";

export function InstructionPanel({
  lesson,
  state,
  tutorEvent,
  evaluation,
}: {
  lesson: LessonConfig;
  state: LessonState;
  tutorEvent: TutorEvent | null;
  evaluation: UseLessonEvaluator;
}) {
  return (
    <section className="flex h-full min-h-[320px] flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm" aria-label="Hướng dẫn">
      <div className="rounded-2xl bg-sun/20 p-4">
        <p className="flex items-center gap-2 text-sm font-extrabold uppercase text-ink/70">
          <Sparkles className="h-4 w-4" aria-hidden /> Bài {lesson.lessonNumber} · {lesson.levelTitleVi.split(":")[0]}
        </p>
        <h2 className="mt-1 text-lg font-extrabold">{lesson.titleVi}</h2>
        <p className="text-sm text-ink/80">{lesson.subtitleVi}</p>
        <p className="mt-2 flex items-start gap-2 text-sm font-bold">
          <Target className="mt-0.5 h-4 w-4 shrink-0 text-sky" aria-hidden /> {lesson.winCondition.descriptionVi}
        </p>
        <p className="mt-1 flex items-center gap-1 text-xs text-ink/60">
          <Clock className="h-3 w-3" aria-hidden /> Khoảng {lesson.estimatedMinutes} phút
        </p>
      </div>
      <ProgressCard evaluation={evaluation} />
      {/* key: a fresh chat (and greeting) for every lesson */}
      <TutorChat key={lesson.id} state={state} event={tutorEvent} greeting={lesson.aiTutor.initialGreetingVi} />
    </section>
  );
}
