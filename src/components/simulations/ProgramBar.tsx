"use client";

import { Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { UseBlockProgram } from "@/hooks/use-block-program";

/** Run/stop controls shared by the lesson simulations that execute the student's Blockly program. */
export function ProgramBar({ program, label = "Chạy chương trình khối" }: { program: UseBlockProgram; label?: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-grape/15 p-3">
      <div className="flex items-center gap-2">
        {program.running ? (
          <Button variant="danger" size="sm" onClick={program.stop}>
            <Square className="h-4 w-4" aria-hidden /> Dừng
          </Button>
        ) : (
          <Button variant="success" size="sm" onClick={program.start}>
            <Play className="h-4 w-4" aria-hidden /> {label}
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
          Con chưa ghép khối nào nên mô phỏng sẽ chạy chương trình mẫu. Sang tab “Lập trình khối” để tự ghép nhé!
        </p>
      )}
      {program.error && (
        <p role="alert" className="text-sm font-bold text-coral">{program.error}</p>
      )}
    </div>
  );
}
