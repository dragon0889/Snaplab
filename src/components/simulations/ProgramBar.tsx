"use client";

import { Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { UseBlockProgram } from "@/hooks/use-block-program";

/** Run/stop controls shared by the lesson simulations that execute the student's Blockly program. */
export function ProgramBar({
  program,
  label = "Chạy chương trình của con",
  demoLabel = "Xem chương trình mẫu",
  variant = "box",
}: {
  program: UseBlockProgram;
  /** Button text when the student's own blocks will run. */
  label?: string;
  /** Button text when there are no blocks yet, so the sample program will run (it is not graded). */
  demoLabel?: string;
  /** `floating` is the compact pill that sits on top of a `ViewportChrome`; `box` is the older stacked card. */
  variant?: "box" | "floating";
}) {
  if (variant === "floating") {
    const status = program.running
      ? program.usingDemo ? "Đang chạy chương trình mẫu…" : "Đang chạy khối lệnh của con…"
      : program.usingDemo ? "Bản mẫu để xem, chưa tính điểm" : "Sẵn sàng chạy";
    return (
      <div className="flex flex-col items-start gap-1 rounded-card border border-line bg-surface/90 p-2 shadow-float backdrop-blur">
        <div className="flex items-center gap-3">
          {program.running ? (
            <Button variant="stop" size="lg" onClick={program.stop}>
              <Square className="h-5 w-5" aria-hidden /> Dừng
            </Button>
          ) : (
            <Button variant="cta" size="lg" onClick={program.start}>
              <Play className="h-5 w-5" aria-hidden /> {program.usingDemo ? demoLabel : label}
            </Button>
          )}
          <p className="pr-2 text-sm font-bold">{status}</p>
        </div>
        {program.error && (
          <p role="alert" className="px-1 text-sm font-bold text-stop">{program.error}</p>
        )}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-grape/15 p-3">
      <div className="flex items-center gap-2">
        {program.running ? (
          <Button variant="danger" size="sm" onClick={program.stop}>
            <Square className="h-4 w-4" aria-hidden /> Dừng
          </Button>
        ) : (
          <Button variant="success" size="sm" onClick={program.start}>
            <Play className="h-4 w-4" aria-hidden /> {program.usingDemo ? demoLabel : label}
          </Button>
        )}
        <p className="text-sm font-bold">
          {program.running
            ? program.usingDemo ? "Đang chạy chương trình mẫu…" : "Đang chạy khối lệnh của con…"
            : "Sẵn sàng chạy"}
        </p>
      </div>
      {program.usingDemo && !program.running && (
        <p className="text-xs text-ink/70">
          Con chưa ghép khối nào nên mô phỏng chỉ chạy chương trình mẫu để con xem, chưa tính điểm. Sang bước “Lập trình” để tự ghép nhé!
        </p>
      )}
      {program.error && (
        <p role="alert" className="text-sm font-bold text-coral">{program.error}</p>
      )}
    </div>
  );
}
