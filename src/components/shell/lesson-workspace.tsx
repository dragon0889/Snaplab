"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlaskConical } from "lucide-react";
import Link from "next/link";
import { useHardwareConnection } from "@/hooks/use-hardware-connection";
import { SimRunContext, type SimRunChannel } from "@/hooks/use-sim-run";
import type { FrameSource, TelemetryFrame, TransportKind } from "@/lib/hardware";
import { HardwareConnectionBar } from "@/components/hardware/hardware-connection-bar";
import { ConnectModal } from "@/components/hardware/connect-modal";
import { SettingsDialog } from "@/components/hardware/settings-dialog";
import { TelemetryDrawer } from "@/components/hardware/telemetry-drawer";
import { UnsupportedBrowserModal } from "@/components/hardware/unsupported-browser-modal";
import type { TutorEvent } from "@/components/interactive/TutorChat";
import { TutorDrawer } from "@/components/interactive/TutorDrawer";
import { StepRail, type RailStep } from "@/components/ui/step-rail";
import { emptyLessonState, type LessonState, type SimTelemetry, type WorkspaceTab } from "@/lib/lesson";
import { useLessonEvaluator } from "@/hooks/use-lesson-evaluator";
import type { SerializedWorkspace } from "@/lib/blockly/interpreter";
import { SNAPLAB_CURRICULUM, type LessonConfig } from "@/lib/lessons-data/curriculum";
import { getSteps, parseStep, stepStatus, type StepProgress } from "@/lib/lesson-steps";
import { CompletionCard } from "./completion-card";
import { LessonStage } from "./lesson-stage";
import { StepPanel } from "./step-panel";

/** After the lesson is passed the running program gets this long to show the result, then it is stopped. */
const STOP_AFTER_PASS_MS = 1500;

export function LessonWorkspace({ lesson }: { lesson: LessonConfig }) {
  const hw = useHardwareConnection();
  const [connectOpen, setConnectOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [telemetryOpen, setTelemetryOpen] = useState(false);
  const [unsupportedOpen, setUnsupportedOpen] = useState(false);
  const [progress, setProgress] = useState<LessonState>(() => emptyLessonState(lesson.id, "intro"));
  const [tutorEvent, setTutorEvent] = useState<TutorEvent | null>(null);
  const [tutorOpen, setTutorOpen] = useState(false);
  const [tutorUnread, setTutorUnread] = useState(false);
  const patch = (p: Partial<LessonState>) => setProgress((l) => ({ ...l, ...p }));
  const raise = (trigger: TutorEvent["trigger"]) => setTutorEvent((e) => ({ id: (e?.id ?? 0) + 1, trigger }));

  const steps = useMemo(() => getSteps(lesson), [lesson]);
  const [step, setStep] = useState<WorkspaceTab>("intro");
  const [visited, setVisited] = useState<ReadonlySet<WorkspaceTab>>(() => new Set(["intro"]));
  // What the student has really done, one flag per step (see `stepStatus`).
  const [wiringConfirmed, setWiringConfirmed] = useState(false);
  const [blocksChecked, setBlocksChecked] = useState(false);
  const [legoReached, setLegoReached] = useState(0);
  const goTo = useCallback((next: WorkspaceTab) => {
    setStep(next);
    setVisited((v) => new Set(v).add(next));
    setProgress((l) => ({ ...l, tab: next }));
  }, []);
  // `?step=` opens a given step directly (handy for links and screenshots).
  useEffect(() => {
    const wanted = parseStep(new URLSearchParams(window.location.search).get("step"));
    if (wanted && steps.some((s) => s.id === wanted)) goTo(wanted);
  }, [steps, goTo]);

  // Whose program is running: the sample program's frames are shown but never graded.
  const runSourceRef = useRef<FrameSource>("student");
  const stoppersRef = useRef(new Set<() => void>());
  const stopAll = useCallback(() => stoppersRef.current.forEach((stop) => stop()), []);
  const runChannel = useMemo<SimRunChannel>(
    () => ({
      reportRun: (source) => {
        runSourceRef.current = source;
      },
      registerStopper: (stop) => {
        stoppersRef.current.add(stop);
        return () => {
          stoppersRef.current.delete(stop);
        };
      },
    }),
    [],
  );

  // Simulation frames (same JSON fields as the board) are graded when no real/mock board is connected.
  const [simFrames, setSimFrames] = useState<TelemetryFrame[]>([]);
  const simFrameId = useRef(1);
  const onSimTelemetry = useCallback((data: SimTelemetry) => {
    const source = runSourceRef.current;
    setSimFrames((prev) =>
      [...prev, { id: simFrameId.current++, receivedAt: Date.now(), raw: JSON.stringify(data), data, source }].slice(-3000),
    );
  }, []);
  // The saved Blockly program feeds the simulations even before the Blockly step is opened.
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

  // Lesson passed: let the result show for a moment, stop the program, then congratulate.
  const [showDone, setShowDone] = useState(false);
  const justCompleted = evaluation.justCompleted;
  useEffect(() => {
    if (!justCompleted) return;
    const timer = setTimeout(() => {
      stopAll();
      setShowDone(true);
    }, STOP_AFTER_PASS_MS);
    return () => clearTimeout(timer);
  }, [justCompleted, stopAll]);

  // "Làm lại bài này" / teacher reset: forget the result, the data, the steps, and restart the simulation.
  const [runKey, setRunKey] = useState(0);
  const { resetCompletion } = evaluation;
  const { clearFrames } = hw;
  const resetLesson = useCallback(() => {
    stopAll();
    resetCompletion();
    clearSimFrames();
    clearFrames();
    runSourceRef.current = "student";
    setVisited(new Set(["intro"]));
    setStep("intro");
    setProgress((l) => ({ ...l, tab: "intro", sim: null, legoStep: null }));
    setWiringConfirmed(false);
    setBlocksChecked(false);
    setLegoReached(0);
    setShowDone(false);
    setRunKey((k) => k + 1); // remounts the stage: the car, counters and any running program start fresh
  }, [stopAll, resetCompletion, clearSimFrames, clearFrames]);

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

  const index = Math.max(0, steps.findIndex((s) => s.id === step));
  const stepProgress: StepProgress = {
    visited,
    legoStepReached: legoReached,
    wiringConfirmed,
    blockCount: progress.blocks?.blockCount ?? 0,
    blocksChecked,
    completed: evaluation.completed,
  };
  const railSteps: RailStep[] = steps.map((s, i) => {
    const status = stepStatus(s.id, lesson, stepProgress);
    return {
      id: s.id,
      label: s.label,
      state: i === index ? "current" : status === "done" ? "done" : "todo",
      note: status === "soon" ? "Sắp có" : undefined,
    };
  });
  const openTutor = () => {
    setTutorOpen(true);
    setTutorUnread(false);
  };

  const lessonIndex = SNAPLAB_CURRICULUM.findIndex((l) => l.id === lesson.id);
  const nextLesson = SNAPLAB_CURRICULUM[lessonIndex + 1] ?? null;

  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh lg:overflow-hidden">
      <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-line bg-canvas px-4">
        <div className="flex min-w-0 items-center gap-4">
          <Link href="/lessons" className="flex shrink-0 items-center gap-2" aria-label="Về danh sách bài học">
            <span className="grid h-10 w-10 place-items-center rounded-control bg-ink text-white">
              <FlaskConical className="h-6 w-6" aria-hidden />
            </span>
            <span className="font-display text-2xl font-extrabold tracking-tight">SnapLab</span>
          </Link>
          <p className="hidden min-w-0 truncate rounded-full border border-line bg-surface px-4 py-1.5 text-sm font-bold md:block">
            Bài {lesson.lessonNumber} · {lesson.titleVi}
          </p>
        </div>
        <HardwareConnectionBar
          status={hw.status}
          reconnectAttempt={hw.reconnectAttempt}
          onConnectClick={onConnectClick}
          onDisconnect={() => void hw.disconnect()}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      </header>
      {hw.error && !settingsOpen && (
        <p role="alert" className="bg-stop/10 px-4 py-2 text-sm font-bold text-stop">{hw.error}</p>
      )}

      <main className="grid min-h-0 flex-1 gap-4 p-4 lg:grid-cols-[62fr_38fr] lg:grid-rows-[minmax(0,1fr)]">
        <div className="flex min-h-0 flex-col gap-3">
          <div className="relative min-h-[60vh] flex-1 lg:min-h-0">
            <SimRunContext.Provider value={runChannel}>
              <LessonStage
                key={runKey}
                lesson={lesson}
                step={step}
                onSimTelemetry={onSimTelemetry}
                onSimRunStart={clearSimFrames}
                onSimResult={(outcome, thresholdCm) => {
                  patch({ sim: { thresholdCm, outcome } });
                  if (outcome === "crashed") raise("check");
                }}
                onLegoStep={(legoStep) => {
                  patch({ legoStep });
                  setLegoReached((reached) => Math.max(reached, legoStep));
                }}
                program={program}
                onBlocksChange={(blocks, state) => {
                  patch({ blocks });
                  setProgram(state);
                }}
                onBlocksCheck={(blocks) => {
                  patch({ blocks });
                  setBlocksChecked(true);
                  raise("check");
                }}
              />
            </SimRunContext.Provider>
            {showDone && (
              <CompletionCard
                nextHref={nextLesson ? `/lessons/${nextLesson.id}` : null}
                nextLabel={nextLesson ? `Bài ${nextLesson.lessonNumber}` : null}
                onRetry={resetLesson}
              />
            )}
          </div>
          <StepRail steps={railSteps} onSelect={(id) => goTo(id as WorkspaceTab)} />
        </div>

        <div className="relative min-h-0 overflow-hidden rounded-card">
          <StepPanel
            lesson={lesson}
            step={steps[index]}
            index={index}
            total={steps.length}
            evaluation={evaluation}
            tutorUnread={tutorUnread}
            onOpenTutor={openTutor}
            onBack={index > 0 ? () => goTo(steps[index - 1].id) : null}
            onNext={index < steps.length - 1 ? () => goTo(steps[index + 1].id) : null}
            wiringConfirmed={wiringConfirmed}
            onWiringConfirm={() => setWiringConfirmed((done) => !done)}
            onReset={resetLesson}
          />
          <TutorDrawer
            open={tutorOpen}
            onClose={() => setTutorOpen(false)}
            state={lessonState}
            event={tutorEvent}
            greeting={lesson.aiTutor.initialGreetingVi}
            onTutorReply={() => setTutorUnread(!tutorOpen)}
          />
        </div>
      </main>

      <ConnectModal open={connectOpen} onOpenChange={setConnectOpen} support={hw.support} onPick={onPick} />
      <UnsupportedBrowserModal open={unsupportedOpen} onOpenChange={setUnsupportedOpen} />
      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        baudRate={hw.baudRate}
        onBaudChange={hw.setBaudRate}
        baudLocked={hw.status === "connected" || hw.status === "connecting" || hw.status === "reconnecting"}
        mockMode={hw.mockMode}
        onMockToggle={(on) => void hw.setMockMode(on)}
        onOpenTelemetry={() => setTelemetryOpen(true)}
        onResetProgress={resetLesson}
        error={hw.error}
      />
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
