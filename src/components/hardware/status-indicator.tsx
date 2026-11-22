"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import type { ConnectionStatus } from "@/lib/hardware";

export const STATUS_META: Record<ConnectionStatus, { label: string; dot: string; chip: string }> = {
  disconnected: { label: "Chưa kết nối", dot: "bg-ink/40", chip: "bg-ink/5 text-ink/70" },
  connecting: { label: "Đang kết nối…", dot: "bg-sun", chip: "bg-sun/20 text-ink" },
  reconnecting: { label: "Đang kết nối lại…", dot: "bg-sun", chip: "bg-sun/20 text-ink" },
  connected: { label: "Đã kết nối", dot: "bg-mint", chip: "bg-mint/20 text-ink" },
  error: { label: "Có lỗi", dot: "bg-coral", chip: "bg-coral/15 text-ink" },
};

export function StatusIndicator({ status }: { status: ConnectionStatus }) {
  const meta = STATUS_META[status];
  const pulsing = status === "connecting" || status === "reconnecting" || status === "connected";
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn("inline-flex items-center gap-2 rounded-2xl px-3 py-1.5 text-sm font-bold", meta.chip)}
    >
      <motion.span
        className={cn("h-3 w-3 rounded-full", meta.dot)}
        animate={pulsing ? { scale: [1, 1.35, 1] } : { scale: 1 }}
        transition={pulsing ? { repeat: Infinity, duration: 1.4 } : { type: "spring", stiffness: 300 }}
      />
      {meta.label}
    </span>
  );
}
