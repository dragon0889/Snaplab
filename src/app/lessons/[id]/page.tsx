import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LessonWorkspace } from "@/components/shell/lesson-workspace";
import { getLessonById, SNAPLAB_CURRICULUM } from "@/lib/lessons-data/curriculum";

type Params = { id: string };

export function generateStaticParams(): Params[] {
  return SNAPLAB_CURRICULUM.map((l) => ({ id: l.id }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const lesson = getLessonById((await params).id);
  return { title: lesson ? `${lesson.titleVi} · SnapLab` : "Không tìm thấy bài học · SnapLab" };
}

export default async function LessonPage({ params }: { params: Promise<Params> }) {
  const lesson = getLessonById((await params).id);
  if (!lesson) notFound();
  // key: switching lessons remounts the workspace, so no state leaks between lessons.
  return <LessonWorkspace key={lesson.id} lesson={lesson} />;
}
