"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "motion/react";
import { Box, Cable, Puzzle, Waves } from "lucide-react";
import { cn } from "@/lib/utils";
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
import type { ComponentType } from "react";
import { PortDiagram } from "@/components/hardware/PortDiagram";

const BlocklyWorkspace = dynamic(
  () => import("@/components/interactive/BlocklyWorkspace").then((m) => m.BlocklyWorkspace),
  { ssr: false, loading: () => <p className="p-6 text-center font-bold text-ink/60">Đang tải khối lệnh…</p> },
);
// three.js is heavy and browser-only: load it lazily on the 3D tab.
const LegoViewer3D = dynamic(
  () => import("@/components/simulations/LegoViewer3D").then((m) => m.LegoViewer3D),
  { ssr: false, loading: () => <p className="p-6 text-center font-bold text-ink/60">Đang tải mô hình 3D…</p> },
);

// The 3D arm pulls in three.js, so it loads lazily like the LEGO viewer.
const RobotArmSim = dynamic(() => import("@/components/simulations/RobotArmSim").then((m) => m.default), {
  ssr: false,
  loading: () => <p className="p-6 text-center font-bold text-ink/60">Đang tải mô hình 3D…</p>,
});

const Lesson13Sim = dynamic(() => import("@/components/simulations/Lesson13Sim").then((m) => m.default), {
  ssr: false,
  loading: () => <p className="p-6 text-center font-bold text-ink/60">Đang tải mô hình 3D…</p>,
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

function ComingSoon({ title, note }: { title: string; note: string }) {
  return (
    <div className="grid h-full min-h-[240px] place-items-center rounded-2xl border-2 border-dashed border-sky/40 bg-sky/5 p-6 text-center">
      <div>
        <p className="font-bold">{title}</p>
        <p className="text-sm text-ink/70">{note}</p>
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

/** Only Lesson 5 has dedicated simulation and 3D builds so far. */
const HAS_BARRIER_BUILD = (lesson: LessonConfig) => lesson.id === "lesson-05";

export interface LessonTabsProps {
  lesson: LessonConfig;
  onTabChange?: (tab: WorkspaceTab) => void;
  onSimResult?: (outcome: SimOutcome, thresholdCm: number) => void;
  onSimTelemetry?: (data: SimTelemetry) => void;
  onSimRunStart?: () => void;
  onLegoStep?: (step: number) => void;
  /** The student's saved Blockly program, used by the simulations. */
  program?: SerializedWorkspace | null;
  onBlocksChange?: (summary: BlocklySummary, state: SerializedWorkspace) => void;
  onBlocksCheck?: (summary: BlocklySummary) => void;
}

export function LessonTabs({ lesson, onTabChange, onSimResult, onSimTelemetry, onSimRunStart, onLegoStep, program = null, onBlocksChange, onBlocksCheck }: LessonTabsProps) {
  const tabs = [
    { id: "sim" as const, label: SIM_LABEL[lesson.simulationType], icon: Waves },
    ...(lesson.requiresLegoAssembly ? [{ id: "lego3d" as const, label: "Lắp ráp 3D", icon: Box }] : []),
    { id: "wiring" as const, label: "Nối dây", icon: Cable },
    { id: "blockly" as const, label: "Lập trình khối", icon: Puzzle },
  ];
  const [active, setActive] = useState<WorkspaceTab>("sim");
  const select = (id: WorkspaceTab) => {
    setActive(id);
    onTabChange?.(id);
  };

  return (
    <section className="flex h-full min-h-[320px] flex-col rounded-2xl bg-white p-3 shadow-sm" aria-label="Khu vực thực hành">
      <div role="tablist" className="flex flex-wrap gap-2">
        {tabs.map((t) => {
          const selected = t.id === active;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={selected}
              onClick={() => select(t.id)}
              className={cn(
                "relative flex cursor-pointer items-center gap-2 rounded-2xl px-4 py-2 text-sm font-bold transition-colors",
                selected ? "text-white" : "text-ink/70 hover:bg-ink/5",
              )}
            >
              {selected && (
                <motion.span
                  layoutId="workspace-tab-pill"
                  className="absolute inset-0 rounded-2xl bg-sky"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <t.icon className="relative h-4 w-4" aria-hidden />
              <span className="relative hidden sm:inline">{t.label}</span>
            </button>
          );
        })}
      </div>
      <div role="tabpanel" className="mt-3 min-h-0 flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            className="h-full"
          >
            {active === "sim" &&
              (BLOCK_SIMS[lesson.id]?.type === lesson.simulationType ? (
                (() => {
                  const { Component } = BLOCK_SIMS[lesson.id];
                  return <Component program={program} onTelemetry={onSimTelemetry} onRunStart={onSimRunStart} />;
                })()
              ) : HAS_BARRIER_BUILD(lesson) ? (
                <MatterSimulation onResult={onSimResult} onTelemetry={onSimTelemetry} onRunStart={onSimRunStart} />
              ) : (
                <ComingSoon title={SIM_LABEL[lesson.simulationType]} note="Mô phỏng của bài này đang được xây dựng. Con vẫn có thể nối dây và ghép khối lệnh nhé!" />
              ))}
            {active === "lego3d" &&
              (HAS_BARRIER_BUILD(lesson) ? (
                <LegoViewer3D onStepChange={onLegoStep} />
              ) : (
                <ComingSoon title="Lắp ráp LEGO 3D" note={`Mô hình ${lesson.legoStepCount ?? "?"} bước của bài này đang được xây dựng.`} />
              ))}
            {active === "wiring" && <PortDiagram ports={lesson.hardwarePorts} />}
            {active === "blockly" && (
              <BlocklyWorkspace
                lessonId={lesson.id}
                lessonTitle={lesson.titleVi}
                blockTypes={lesson.defaultBlocklyBlocks}
                onChange={onBlocksChange}
                onCheck={onBlocksCheck}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
