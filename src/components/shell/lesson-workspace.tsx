"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlaskConical } from "lucide-react";
import { useHardwareConnection } from "@/hooks/use-hardware-connection";
import type { TransportKind } from "@/lib/hardware";
import { HardwareConnectionBar } from "@/components/hardware/hardware-connection-bar";
import { ConnectModal } from "@/components/hardware/connect-modal";
import { TelemetryDrawer } from "@/components/hardware/telemetry-drawer";
import { UnsupportedBrowserModal } from "@/components/hardware/unsupported-browser-modal";
import type { TutorEvent } from "@/components/interactive/TutorChat";
import { emptyLessonState, type LessonState } from "@/lib/lesson";
import Link from "next/link";
import { useLessonEvaluator } from "@/hooks/use-lesson-evaluator";
import type { TelemetryFrame } from "@/lib/hardware";
import type { SimTelemetry } from "@/lib/lesson";
import type { SerializedWorkspace } from "@/lib/blockly/interpreter";
import { LessonTabs } from "./lesson-tabs";
import type { LessonConfig } from "@/lib/lessons-data/curriculum";
import { InstructionPanel } from "./instruction-panel";

export function LessonWorkspace({ lesson }: { lesson: LessonConfig }) {
  const hw = useHardwareConnection();
  const [connectOpen, setConnectOpen] = useState(false);
  const [telemetryOpen, setTelemetryOpen] = useState(false);
  const [unsupportedOpen, setUnsupportedOpen] = useState(false);
  const [progress, setProgress] = useState<LessonState>(() => emptyLessonState(lesson.id, "sim"));
  const [tutorEvent, setTutorEvent] = useState<TutorEvent | null>(null);
  const patch = (p: Partial<LessonState>) => setProgress((l) => ({ ...l, ...p }));
  const raise = (trigger: TutorEvent["trigger"]) => setTutorEvent((e) => ({ id: (e?.id ?? 0) + 1, trigger }));

  // Simulation frames (same JSON fields as the board) are graded when no real/mock board is connected.
  const [simFrames, setSimFrames] = useState<TelemetryFrame[]>([]);
  const simFrameId = useRef(1);
  const onSimTelemetry = useCallback((data: SimTelemetry) => {
    setSimFrames((prev) =>
      [...prev, { id: simFrameId.current++, receivedAt: Date.now(), raw: JSON.stringify(data), data }].slice(-3000),
    );
  }, []);
  // The saved Blockly program feeds the simulations even before the Blockly tab is opened.
  const [program, setProgram] = useState<SerializedWorkspace | null>(null);
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(`snaplab:${lesson.id}:blocks`);
      if (saved) setProgram(JSON.parse(saved) as SerializedWorkspace);
    } catch {
      /* storage blocked or corrupt: no saved program */
    }
  }, [lesson.id]);
  const clearSimFrames = useCallback(() => setSimFrames([]), []);
  const history = useMemo(() => (hw.status === "connected" ? hw.history : simFrames), [hw.status, hw.history, simFrames]);
  const evaluation = useLessonEvaluator(lesson.winCondition, history, { lessonId: lesson.id });

  const lessonState: LessonState = {
    ...progress,
    hardwareConnected: hw.status === "connected",
    completed: evaluation.completed,
    progress: evaluation.completed ? 1 : evaluation.result.progress,
  };

  const onConnectClick = () => {
    if (hw.unsupported) setUnsupportedOpen(true);
    else setConnectOpen(true);
  };

  const onPick = (kind: TransportKind) => {
    setConnectOpen(false);
    void hw.connect(kind);
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b-2 border-ink/10 bg-cream/95 px-4 py-3 backdrop-blur">
        <Link href="/lessons" className="flex items-center gap-2" aria-label="Về danh sách bài học">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-sun shadow-[0_3px_0_#d9a416]">
            <FlaskConical className="h-6 w-6" aria-hidden />
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight">SnapLab</h1>
        </Link>
        <HardwareConnectionBar
          status={hw.status}
          transport={hw.transport}
          baudRate={hw.baudRate}
          error={hw.error}
          reconnectAttempt={hw.reconnectAttempt}
          onBaudChange={hw.setBaudRate}
          onConnectClick={onConnectClick}
          onDisconnect={() => void hw.disconnect()}
          mockMode={hw.mockMode}
          onMockToggle={(on) => void hw.setMockMode(on)}
          onOpenTelemetry={() => setTelemetryOpen(true)}
        />
      </header>

      <main className="grid flex-1 gap-4 p-4 md:grid-cols-2 md:[&>*]:h-[calc(100vh-6.5rem)]">
        <LessonTabs
          lesson={lesson}
          onTabChange={(tab) => patch({ tab })}
          onSimTelemetry={onSimTelemetry}
          onSimRunStart={clearSimFrames}
          onSimResult={(outcome, thresholdCm) => {
            patch({ sim: { thresholdCm, outcome } });
            if (outcome === "crashed") raise("check");
          }}
          onLegoStep={(legoStep) => patch({ legoStep })}
          program={program}
          onBlocksChange={(blocks, state) => {
            patch({ blocks });
            setProgram(state);
          }}
          onBlocksCheck={(blocks) => {
            patch({ blocks });
            raise("check");
          }}
        />
        <InstructionPanel lesson={lesson} state={lessonState} tutorEvent={tutorEvent} evaluation={evaluation} />
      </main>

      <ConnectModal open={connectOpen} onOpenChange={setConnectOpen} support={hw.support} onPick={onPick} />
      <UnsupportedBrowserModal open={unsupportedOpen} onOpenChange={setUnsupportedOpen} />
      <TelemetryDrawer
        open={telemetryOpen}
        onOpenChange={setTelemetryOpen}
        frames={hw.frames}
        connected={hw.status === "connected"}
        onClear={hw.clearFrames}
        onSend={hw.send}
      />
    </div>
  );
}
