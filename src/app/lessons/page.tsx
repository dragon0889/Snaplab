import type { Metadata } from "next";
import Link from "next/link";
import { Box, Clock, FlaskConical } from "lucide-react";
import { CompletionBadge } from "@/components/interactive/ProgressCard";
import { getLessonsByLevel, type LessonConfig } from "@/lib/lessons-data/curriculum";

export const metadata: Metadata = {
  title: "Bài học · SnapLab",
  description: "Danh sách bài học STEAM tương tác cùng mạch điện thật",
};

const LEVELS = [1, 2, 3, 4] as const;
const LEVEL_COLOR: Record<(typeof LEVELS)[number], string> = {
  1: "bg-mint/25",
  2: "bg-sky/20",
  3: "bg-sun/30",
  4: "bg-grape/30",
};

function LessonCard({ lesson }: { lesson: LessonConfig }) {
  return (
    <li>
      <Link
        href={`/lessons/${lesson.id}`}
        className="flex h-full flex-col gap-2 rounded-2xl bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-md focus-visible:outline-2 focus-visible:outline-sky"
      >
        <span className="flex items-center gap-2 text-sm font-extrabold text-ink/60">
          <span className="grid h-8 w-8 place-items-center rounded-2xl bg-sun text-ink">{lesson.lessonNumber}</span>
          Bài {lesson.lessonNumber}
          <CompletionBadge lessonId={lesson.id} />
        </span>
        <h3 className="text-lg font-extrabold leading-snug">{lesson.titleVi}</h3>
        <p className="text-sm text-ink/75">{lesson.subtitleVi}</p>
        <ul className="mt-1 flex flex-wrap gap-1.5">
          {lesson.steamConceptsVi.map((c) => (
            <li key={c} className="rounded-2xl bg-ink/5 px-2 py-0.5 text-xs font-bold text-ink/70">
              {c}
            </li>
          ))}
        </ul>
        <span className="mt-auto flex items-center gap-3 pt-2 text-xs font-bold text-ink/60">
          <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" aria-hidden /> {lesson.estimatedMinutes} phút</span>
          {lesson.requiresLegoAssembly && (
            <span className="flex items-center gap-1"><Box className="h-3.5 w-3.5" aria-hidden /> Khối lắp ghép · {lesson.legoStepCount} bước</span>
          )}
        </span>
      </Link>
    </li>
  );
}

export default function LessonsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-6 flex items-center gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-sun shadow-[0_3px_0_#d9a416]">
          <FlaskConical className="h-7 w-7" aria-hidden />
        </span>
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">SnapLab</h1>
          <p className="text-ink/70">Chọn một bài để bắt đầu khám phá nhé!</p>
        </div>
      </header>

      <div className="flex flex-col gap-8">
        {LEVELS.map((level) => {
          const lessons = getLessonsByLevel(level);
          if (lessons.length === 0) return null;
          return (
            <section key={level} aria-labelledby={`level-${level}`}>
              <h2 id={`level-${level}`} className={`mb-3 inline-block rounded-2xl px-4 py-2 text-lg font-extrabold ${LEVEL_COLOR[level]}`}>
                {lessons[0].levelTitleVi}
              </h2>
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {lessons.map((l) => (
                  <LessonCard key={l.id} lesson={l} />
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      <footer className="mt-10 border-t border-line pt-4 text-sm text-ink-soft">
        <Link href="/giay-phep" className="font-bold underline-offset-2 hover:underline">
          Giấy phép &amp; ghi công
        </Link>
      </footer>
    </div>
  );
}
