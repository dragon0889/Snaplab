"use client";

import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { ViewportChrome } from "@/components/ui/viewport-chrome";
import type { LessonConfig, SimulationType } from "@/lib/lessons-data/curriculum";
import type { BlocklySummary, SimOutcome, SimTelemetry, WorkspaceTab } from "@/lib/lesson";
import { MatterSimulation } from "@/components/simulations/MatterSimulation";
import { TrafficLightSim } from "@/components/simulations/TrafficLightSim";
import { ThereminWaveSim } from "@/components/simulations/ThereminWaveSim";
import { TempAlarmSim } from "@/components/simulations/TempAlarmSim";
import { SonarSim } from "@/components/simulations/SonarSim";
import { TrashLidSim } from "@/components/simulations/TrashLidSim";
import { FanWindSim } from "@/components/simulations/FanWindSim";
import { GearCurtainSim } from "@/components/simulations/GearCurtainSim";
import { Lesson10Sim } from "@/components/simulations/Lesson10Sim";
import { Lesson11Sim } from "@/components/simulations/Lesson11Sim";
import { Lesson12Sim } from "@/components/simulations/Lesson12Sim";
import { Lesson14Sim } from "@/components/simulations/Lesson14Sim";
import { Lesson15Sim } from "@/components/simulations/Lesson15Sim";
import { Lesson16Sim } from "@/components/simulations/Lesson16Sim";
import { Lesson17Sim } from "@/components/simulations/Lesson17Sim";
import { Lesson18Sim } from "@/components/simulations/Lesson18Sim";
import { Lesson19Sim } from "@/components/simulations/Lesson19Sim";
import type { SerializedWorkspace } from "@/lib/blockly/interpreter";
import { hasLegoModel } from "@/lib/lesson-steps";
import type { ComponentType } from "react";
import { PortDiagram } from "@/components/hardware/PortDiagram";

const BlocklyWorkspace = dynamic(
  () => import("@/components/interactive/BlocklyWorkspace").then((m) => m.BlocklyWorkspace),
  { ssr: false, loading: () => <p className="p-6 text-center font-bold text-ink-soft">Đang tải khối lệnh…</p> },
);
// three.js is heavy and browser-only: load it lazily on the 3D step.
const LegoViewer3D = dynamic(
  () => import("@/components/simulations/LegoViewer3D").then((m) => m.LegoViewer3D),
  { ssr: false, loading: () => <p className="p-6 text-center font-bold text-ink-soft">Đang tải mô hình 3D…</p> },
);

// The 3D arm pulls in three.js, so it loads lazily like the LEGO viewer.
const RobotArmSim = dynamic(() => import("@/components/simulations/RobotArmSim").then((m) => m.default), {
  ssr: false,
  loading: () => <p className="p-6 text-center font-bold text-ink-soft">Đang tải mô hình 3D…</p>,
});

const Lesson13Sim = dynamic(() => import("@/components/simulations/Lesson13Sim").then((m) => m.default), {
  ssr: false,
  loading: () => <p className="p-6 text-center font-bold text-ink-soft">Đang tải mô hình 3D…</p>,
});

const SIM_LABEL: Record<SimulationType, string> = {
  "ui-motion": "Mô phỏng chuyển động",
  "canvas-wave": "Mô phỏng sóng",
  "svg-sonar": "Mô phỏng sóng siêu âm",
  "matter-2d": "Mô phỏng vật lý 2D",
  "r3f-3d": "Mô phỏng 3D",
  "ai-vision": "Mô phỏng thị giác máy tính",
  "ai-speech": "Mô phỏng giọng nói",
};

const STEP_SCENE_LABEL: Partial<Record<WorkspaceTab, string>> = {
  lego3d: "Lắp ráp 3D",
  wiring: "Nối dây",
  blockly: "Lập trình khối",
};

function ComingSoon({ title, note }: { title: string; note: string }) {
  return (
    <div className="grid h-full min-h-[240px] place-items-center rounded-card border border-dashed border-line bg-surface p-6 text-center">
      <div>
        <p className="font-display text-xl font-extrabold">{title}</p>
        <p className="mt-1 text-[15px] text-ink-soft">{note}</p>
      </div>
    </div>
  );
}

/** Shown in place of a scene that failed to load (no WebGL, blocked download, ...). */
function SceneFailed({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="grid h-full min-h-[240px] place-items-center rounded-card border border-dashed border-line bg-surface p-6 text-center">
      <div className="flex flex-col items-center gap-3">
        <p className="font-display text-xl font-extrabold">Chưa tải được mô hình 3D</p>
        <p className="text-[15px] text-ink-soft">Con thử tải lại nhé. Nếu vẫn chưa được, nhờ thầy cô kiểm tra trình duyệt giúp con.</p>
        <Button variant="solid" onClick={onRetry}>Thử lại</Button>
      </div>
    </div>
  );
}

interface BlockSimProps {
  program: SerializedWorkspace | null;
  onTelemetry?: (data: SimTelemetry) => void;
  onRunStart?: () => void;
}

/**
 * Interactive simulations that run the student's Blockly program. A lesson uses one only when its
 * `simulationType` in curriculum.ts matches, so changing the type there swaps it back to the placeholder.
 */
const BLOCK_SIMS: Record<string, { type: SimulationType; Component: ComponentType<BlockSimProps> }> = {
  "lesson-01": { type: "ui-motion", Component: TrafficLightSim },
  "lesson-02": { type: "canvas-wave", Component: ThereminWaveSim },
  "lesson-03": { type: "ui-motion", Component: TempAlarmSim },
  "lesson-04": { type: "svg-sonar", Component: SonarSim },
  "lesson-06": { type: "matter-2d", Component: TrashLidSim },
  "lesson-07": { type: "r3f-3d", Component: RobotArmSim },
  "lesson-08": { type: "canvas-wave", Component: FanWindSim },
  "lesson-09": { type: "matter-2d", Component: GearCurtainSim },
  "lesson-10": { type: "ui-motion", Component: Lesson10Sim },
  "lesson-11": { type: "matter-2d", Component: Lesson11Sim },
  "lesson-12": { type: "ui-motion", Component: Lesson12Sim },
  "lesson-13": { type: "r3f-3d", Component: Lesson13Sim },
  "lesson-14": { type: "ai-vision", Component: Lesson14Sim },
  "lesson-15": { type: "ai-speech", Component: Lesson15Sim },
  "lesson-16": { type: "svg-sonar", Component: Lesson16Sim },
  "lesson-17": { type: "matter-2d", Component: Lesson17Sim },
  "lesson-18": { type: "ui-motion", Component: Lesson18Sim },
  "lesson-19": { type: "ai-vision", Component: Lesson19Sim },
};

/** Simulations already rebuilt on `ViewportChrome` (they draw their own stage). The rest are wrapped for now. */
const OWN_CHROME = new Set(["lesson-11"]);

/** Only Lesson 5 has dedicated simulation and 3D builds so far. */
const HAS_BARRIER_BUILD = hasLegoModel;

export interface LessonStageProps {
  lesson: LessonConfig;
  step: WorkspaceTab;
  onSimResult?: (outcome: SimOutcome, thresholdCm: number) => void;
  onSimTelemetry?: (data: SimTelemetry) => void;
  onSimRunStart?: () => void;
  onLegoStep?: (step: number) => void;
  /** The student's saved Blockly program, used by the simulations. */
  program?: SerializedWorkspace | null;
  onBlocksChange?: (summary: BlocklySummary, state: SerializedWorkspace) => void;
  onBlocksCheck?: (summary: BlocklySummary) => void;
}

/** The big stage on the left: shows what the current step is about. The steps themselves live in the step rail. */
export function LessonStage({ lesson, step, onSimResult, onSimTelemetry, onSimRunStart, onLegoStep, program = null, onBlocksChange, onBlocksCheck }: LessonStageProps) {
  const isSim = step === "intro" || step === "sim";
  const sceneLabel = isSim ? SIM_LABEL[lesson.simulationType] : STEP_SCENE_LABEL[step];
  const blockSim = BLOCK_SIMS[lesson.id]?.type === lesson.simulationType ? BLOCK_SIMS[lesson.id] : null;

  const guard = (node: React.ReactNode) => (
    <ErrorBoundary key={step} fallback={(reset) => <SceneFailed onRetry={reset} />}>
      {node}
    </ErrorBoundary>
  );

  const content = (() => {
    if (isSim) {
      if (blockSim) {
        const { Component } = blockSim;
        // The "Hiểu" step only shows the sample car: the student's blocks are kept out of it on purpose.
        const sim = <Component program={step === "intro" ? null : program} onTelemetry={onSimTelemetry} onRunStart={onSimRunStart} />;
        return lesson.simulationType === "r3f-3d" ? guard(sim) : sim;
      }
      if (HAS_BARRIER_BUILD(lesson)) {
        return <MatterSimulation onResult={onSimResult} onTelemetry={onSimTelemetry} onRunStart={onSimRunStart} />;
      }
      return <ComingSoon title={SIM_LABEL[lesson.simulationType]} note="Mô phỏng của bài này đang được xây dựng. Con vẫn có thể nối dây và ghép khối lệnh nhé!" />;
    }
    if (step === "lego3d") {
      return HAS_BARRIER_BUILD(lesson) ? (
        guard(<LegoViewer3D onStepChange={onLegoStep} />)
      ) : (
        <ComingSoon title="Lắp ráp LEGO 3D" note={`Mô hình ${lesson.legoStepCount ?? "?"} bước của bài này đang được xây dựng.`} />
      );
    }
    if (step === "wiring") return <PortDiagram ports={lesson.hardwarePorts} />;
    return (
      <BlocklyWorkspace
        lessonId={lesson.id}
        lessonTitle={lesson.titleVi}
        blockTypes={lesson.defaultBlocklyBlocks}
        onChange={onBlocksChange}
        onCheck={onBlocksCheck}
      />
    );
  })();

  // A simulation that already draws its own stage (HUD, controls) is shown as is; everything else is wrapped.
  const ownChrome = isSim && blockSim !== null && OWN_CHROME.has(lesson.id);

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={step === "intro" || step === "sim" ? "sim" : step}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="h-full"
      >
        {ownChrome ? (
          content
        ) : (
          <ViewportChrome scroll label={sceneLabel}>
            <div className="h-full">{content}</div>
          </ViewportChrome>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
