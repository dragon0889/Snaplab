"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import type { ConnectionStatus } from "@/lib/hardware";

export const STATUS_META: Record<ConnectionStatus, { label: string; dot: string; chip: string }> = {
  disconnected: { label: "Chưa kết nối", dot: "bg-ink-soft/50", chip: "bg-sunken text-ink-soft" },
  connecting: { label: "Đang kết nối…", dot: "bg-sun", chip: "bg-sun/20 text-ink" },
  reconnecting: { label: "Đang kết nối lại…", dot: "bg-sun", chip: "bg-sun/20 text-ink" },
  connected: { label: "Đã kết nối", dot: "bg-go", chip: "bg-go/15 text-ink" },
  error: { label: "Có lỗi", dot: "bg-stop", chip: "bg-stop/10 text-ink" },
};

export function StatusIndicator({ status }: { status: ConnectionStatus }) {
  const meta = STATUS_META[status];
  const pulsing = status === "connecting" || status === "reconnecting" || status === "connected";
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn("inline-flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-bold", meta.chip)}
    >
      <motion.span
        className={cn("h-2.5 w-2.5 rounded-full", meta.dot)}
        animate={pulsing ? { scale: [1, 1.35, 1] } : { scale: 1 }}
        transition={pulsing ? { repeat: Infinity, duration: 1.4 } : { type: "spring", stiffness: 300 }}
      />
      {meta.label}
    </span>
  );
}
