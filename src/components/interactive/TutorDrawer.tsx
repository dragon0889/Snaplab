"use client";

import { motion } from "motion/react";
import { Bot, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LessonState } from "@/lib/lesson";
import { TutorChat, type TutorEvent } from "./TutorChat";

/**
 * The tutor chat as a drawer sliding over the right-hand panel. The chat stays mounted while the drawer is
 * closed, so its history survives and it can still react to events (and report an unread reply).
 */
export function TutorDrawer({
  open,
  onClose,
  state,
  event,
  greeting,
  onTutorReply,
}: {
  open: boolean;
  onClose: () => void;
  state: LessonState;
  event: TutorEvent | null;
  greeting: string;
  onTutorReply: () => void;
}) {
  return (
    <motion.aside
      aria-label="Bạn đồng hành"
      aria-hidden={!open}
      inert={!open}
      initial={false}
      animate={{ x: open ? 0 : "105%", opacity: open ? 1 : 0 }}
      transition={{ type: "spring", stiffness: 320, damping: 32 }}
      className="absolute inset-0 z-20 flex flex-col gap-3 rounded-card border border-line bg-surface p-4 shadow-float"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 font-display text-xl font-extrabold">
          <Bot className="h-6 w-6" aria-hidden /> Bạn đồng hành
        </p>
        <Button variant="soft" size="icon" onClick={onClose} aria-label="Đóng">
          <X className="h-5 w-5" aria-hidden />
        </Button>
      </div>
      <TutorChat state={state} event={event} greeting={greeting} onTutorReply={onTutorReply} />
    </motion.aside>
  );
}
