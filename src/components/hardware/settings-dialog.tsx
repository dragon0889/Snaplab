"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";
import { Activity, Trash2, X } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { SectionLabel } from "@/components/ui/section-label";
import { cn } from "@/lib/utils";
import { BAUD_RATES, type BaudRate } from "@/lib/hardware";

const BAUD_LABEL: Record<BaudRate, string> = {
  115200: "115200 (ESP32 / micro:bit V2)",
  9600: "9600 (micro:bit V1)",
};

/** Technical options that students do not need on the main screen: baud rate, simulated board, raw data. */
export function SettingsDialog({
  open,
  onOpenChange,
  baudRate,
  onBaudChange,
  baudLocked,
  mockMode,
  onMockToggle,
  onOpenTelemetry,
  onResetProgress,
  error,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  baudRate: BaudRate;
  onBaudChange: (rate: BaudRate) => void;
  /** The baud rate cannot change while a board is connected. */
  baudLocked: boolean;
  mockMode: boolean;
  onMockToggle: (enabled: boolean) => void;
  onOpenTelemetry: () => void;
  /** Clears this lesson's saved progress, telemetry and step state (for teachers). */
  onResetProgress: () => void;
  error: string | null;
}) {
  const [confirmReset, setConfirmReset] = useState(false);
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) setConfirmReset(false);
        onOpenChange(next);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-card border border-line bg-surface p-6 shadow-float">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="font-display text-2xl font-extrabold">Cài đặt</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-ink-soft">
                Phần dành cho người lớn và bạn nào thích tìm hiểu kỹ thuật.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button variant="soft" size="icon" aria-label="Đóng">
                <X className="h-5 w-5" />
              </Button>
            </Dialog.Close>
          </div>

          <div className="mt-5 flex flex-col gap-5">
            <section className="flex flex-col gap-3">
              <SectionLabel>Kết nối</SectionLabel>
              <label htmlFor="baud" className="text-sm font-bold">Tốc độ truyền (baud)</label>
              <select
                id="baud"
                value={baudRate}
                disabled={baudLocked}
                onChange={(e) => onBaudChange(Number(e.target.value) as BaudRate)}
                className="h-12 cursor-pointer rounded-control border border-line bg-sunken px-3 text-sm font-bold disabled:opacity-50"
              >
                {BAUD_RATES.map((r) => (
                  <option key={r} value={r}>{BAUD_LABEL[r]}</option>
                ))}
              </select>
              <button
                type="button"
                role="switch"
                aria-checked={mockMode}
                onClick={() => onMockToggle(!mockMode)}
                className="flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-control border border-line bg-sunken px-3 text-sm font-bold"
              >
                Chế độ giả lập (thử mà không cần cắm mạch)
                <span className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", mockMode ? "bg-ink" : "bg-line")}>
                  <motion.span
                    className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-surface shadow"
                    animate={{ x: mockMode ? 20 : 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                </span>
              </button>
            </section>

            <section className="flex flex-col gap-3">
              <SectionLabel>Dữ liệu từ mạch</SectionLabel>
              <Button
                variant="soft"
                size="lg"
                onClick={() => {
                  onOpenChange(false);
                  onOpenTelemetry();
                }}
              >
                <Activity className="h-5 w-5" aria-hidden /> Mở dữ liệu cảm biến
              </Button>
            </section>

            <section className="flex flex-col gap-3">
              <SectionLabel>Dành cho giáo viên</SectionLabel>
              <Button
                variant={confirmReset ? "stop" : "soft"}
                size="lg"
                onClick={() => {
                  if (!confirmReset) {
                    setConfirmReset(true);
                    return;
                  }
                  setConfirmReset(false);
                  onOpenChange(false);
                  onResetProgress();
                }}
              >
                <Trash2 className="h-5 w-5" aria-hidden /> {confirmReset ? "Bấm lần nữa để xoá" : "Xoá tiến độ bài này"}
              </Button>
              <p className="text-xs text-ink-soft">Xoá kết quả, dữ liệu đã chạy và các bước đã qua. Khối lệnh của học sinh được giữ lại.</p>
            </section>

            {error && (
              <p role="alert" className="rounded-control bg-stop/10 p-3 text-sm font-bold text-stop">{error}</p>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
